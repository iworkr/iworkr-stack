import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/invoice.dart';

/// All invoices for the current organization
final invoicesProvider = FutureProvider<List<Invoice>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('invoices')
      .select()
      .eq('organization_id', orgId)
      .isFilter('deleted_at', null)
      .order('created_at', ascending: false)
      .limit(50);

  return (data as List).map((j) => Invoice.fromJson(j as Map<String, dynamic>)).toList();
});

/// Single invoice by ID
final invoiceDetailProvider = FutureProvider.family<Invoice?, String>((ref, invoiceId) async {
  final data = await SupabaseService.client
      .from('invoices')
      .select()
      .eq('id', invoiceId)
      .maybeSingle();

  if (data == null) return null;
  return Invoice.fromJson(data);
});

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
