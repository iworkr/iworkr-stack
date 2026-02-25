import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/invoice.dart';

// ═══════════════════════════════════════════════════════════
// ── Reactive Invoices Stream ──────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Single reactive stream that is the source of truth for ALL
// invoice data in the app. Uses REST fetch + Supabase Realtime
// Postgres changes so that any mutation (Web Dashboard, another
// device, RPC) is reflected instantly without pull-to-refresh.

final invoicesStreamProvider = StreamProvider<List<Invoice>>((ref) {
  final orgIdAsync = ref.watch(organizationIdProvider);
  final orgId = orgIdAsync.valueOrNull;
  if (orgId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<Invoice>>();

  Future<void> fetchInvoices() async {
    try {
      final data = await client
          .from('invoices')
          .select()
          .eq('organization_id', orgId)
          .isFilter('deleted_at', null)
          .order('created_at', ascending: false)
          .limit(50);

      if (!controller.isClosed) {
        controller.add(
          (data as List).map((j) => Invoice.fromJson(j as Map<String, dynamic>)).toList(),
        );
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetchInvoices();

  final sub = client
      .channel('invoices-stream-$orgId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'invoices',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'organization_id',
          value: orgId,
        ),
        callback: (_) => fetchInvoices(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

/// Legacy compatibility — bridges old FutureProvider consumers to the
/// new stream. Avoids a massive one-shot migration of every screen.
final invoicesProvider = FutureProvider<List<Invoice>>((ref) async {
  return ref.watch(invoicesStreamProvider).when(
    data: (invoices) => invoices,
    loading: () => <Invoice>[],
    error: (_, __) => <Invoice>[],
  );
});

// ═══════════════════════════════════════════════════════════
// ── Derived Providers (computed from the single stream) ──
// ═══════════════════════════════════════════════════════════

/// Outstanding invoices (sent, overdue, partially_paid) — auto-updates when the invoices stream changes.
final outstandingInvoicesProvider = Provider<AsyncValue<List<Invoice>>>((ref) {
  return ref.watch(invoicesStreamProvider).whenData((invoices) =>
    invoices.where((invoice) => invoice.isOutstanding).toList(),
  );
});

/// Paid invoices — auto-updates when the invoices stream changes.
final paidInvoicesProvider = Provider<AsyncValue<List<Invoice>>>((ref) {
  return ref.watch(invoicesStreamProvider).whenData((invoices) =>
    invoices.where((invoice) => invoice.isPaid).toList(),
  );
});

/// Invoice stats — auto-updates when the invoices stream changes.
/// Retains the AsyncValue wrapper so consumers can use .when()
final invoiceStatsProvider = Provider<AsyncValue<Map<String, dynamic>>>((ref) {
  return ref.watch(invoicesStreamProvider).whenData((invoices) {
    final outstanding = invoices.where((invoice) => invoice.isOutstanding);
    final paid = invoices.where((invoice) => invoice.isPaid);
    final overdue = invoices.where((invoice) => invoice.isOverdue);
    
    final outstandingTotal = outstanding.fold<double>(0, (sum, invoice) => sum + invoice.total);
    final paidTotal = paid.fold<double>(0, (sum, invoice) => sum + invoice.total);
    final overdueTotal = overdue.fold<double>(0, (sum, invoice) => sum + invoice.total);
    
    return {
      'totalOutstanding': outstandingTotal,
      'totalPaid': paidTotal,
      'totalOverdue': overdueTotal,
      'outstandingCount': outstanding.length,
      'paidCount': paid.length,
      'overdueCount': overdue.length,
      'totalInvoices': invoices.length,
    };
  });
});

// ═══════════════════════════════════════════════════════════
// ── Single Invoice Detail — Realtime ──────────────────────
// ═══════════════════════════════════════════════════════════

final invoiceDetailProvider = StreamProvider.family<Invoice?, String>((ref, invoiceId) {
  final client = SupabaseService.client;
  final controller = StreamController<Invoice?>();

  Future<void> fetch() async {
    try {
      final data = await client
          .from('invoices')
          .select()
          .eq('id', invoiceId)
          .maybeSingle();

      if (!controller.isClosed) {
        controller.add(data != null ? Invoice.fromJson(data) : null);
      }
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  fetch();

  final sub = client
      .channel('invoice-detail-$invoiceId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'invoices',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'id',
          value: invoiceId,
        ),
        callback: (_) => fetch(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(sub);
    controller.close();
  });

  return controller.stream;
});

// ═══════════════════════════════════════════════════════════
// ── Mutations ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/// Mark an invoice as paid in Supabase
Future<void> markInvoicePaid(String invoiceId) async {
  await SupabaseService.client
      .from('invoices')
      .update({
        'status': 'paid',
        'paid_date': DateTime.now().toIso8601String().split('T').first,
        'updated_at': DateTime.now().toIso8601String(),
      })
      .eq('id', invoiceId);
}
