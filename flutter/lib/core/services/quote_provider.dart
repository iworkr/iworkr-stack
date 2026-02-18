import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/quote.dart';

/// All quotes for the organization
final quotesProvider = FutureProvider<List<Quote>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('quotes')
      .select()
      .eq('organization_id', orgId)
      .order('created_at', ascending: false)
      .limit(50);

  return (data as List).map((q) => Quote.fromJson(q as Map<String, dynamic>)).toList();
});

/// Quotes for a specific job
final jobQuotesProvider = FutureProvider.family<List<Quote>, String>((ref, jobId) async {
  final data = await SupabaseService.client
      .from('quotes')
      .select()
      .eq('job_id', jobId)
      .order('created_at', ascending: false);

  return (data as List).map((q) => Quote.fromJson(q as Map<String, dynamic>)).toList();
});

/// Single quote with line items
final quoteDetailProvider = FutureProvider.family<Quote?, String>((ref, quoteId) async {
  final quoteData = await SupabaseService.client
      .from('quotes')
      .select()
      .eq('id', quoteId)
      .maybeSingle();

  if (quoteData == null) return null;

  final itemsData = await SupabaseService.client
      .from('quote_line_items')
      .select()
      .eq('quote_id', quoteId)
      .order('sort_order');

  final items = (itemsData as List)
      .map((i) => QuoteLineItem.fromJson(i as Map<String, dynamic>))
      .toList();

  return Quote.fromJson(quoteData, items: items);
});

/// Create a new quote linked to a job
Future<Quote?> createQuote({
  required String organizationId,
  required String jobId,
  String? clientId,
  String? clientName,
  String? clientEmail,
  String? clientAddress,
  String? title,
  required List<QuoteLineItem> items,
  double taxRate = 10.0,
  String? notes,
}) async {
  final subtotal = items.fold(0.0, (sum, i) => sum + i.lineTotal);
  final tax = subtotal * (taxRate / 100);
  final total = subtotal + tax;

  // Generate display ID
  final countResult = await SupabaseService.client
      .from('quotes')
      .select('id')
      .eq('organization_id', organizationId);
  final nextNum = (countResult as List).length + 1;
  final displayId = 'QT-${nextNum.toString().padLeft(4, '0')}';

  final data = await SupabaseService.client
      .from('quotes')
      .insert({
        'organization_id': organizationId,
        'display_id': displayId,
        'job_id': jobId,
        'client_id': clientId,
        'client_name': clientName,
        'client_email': clientEmail,
        'client_address': clientAddress,
        'title': title,
        'subtotal': subtotal,
        'tax_rate': taxRate,
        'tax': tax,
        'total': total,
        'notes': notes,
        'status': 'draft',
        'created_by': SupabaseService.auth.currentUser?.id,
      })
      .select()
      .single();

  final quoteId = data['id'] as String;

  // Insert line items
  for (int i = 0; i < items.length; i++) {
    await SupabaseService.client.from('quote_line_items').insert({
      'quote_id': quoteId,
      ...items[i].toJson(),
      'sort_order': i,
    });
  }

  return Quote.fromJson(data, items: items);
}

/// Accept a quote with signature SVG path data
Future<void> acceptQuote({
  required String quoteId,
  required String signatureSvg,
  String? signedBy,
}) async {
  await SupabaseService.client
      .from('quotes')
      .update({
        'status': 'accepted',
        'signature_url': signatureSvg,
        'signed_at': DateTime.now().toIso8601String(),
        'signed_by': signedBy,
        'updated_at': DateTime.now().toIso8601String(),
      })
      .eq('id', quoteId);
}

/// Quote win rate for the org
final quoteWinRateProvider = FutureProvider<double>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return 0;

  final all = await SupabaseService.client
      .from('quotes')
      .select('id, status')
      .eq('organization_id', orgId)
      .inFilter('status', ['sent', 'accepted', 'rejected']);

  final list = all as List;
  if (list.isEmpty) return 0;

  final accepted = list.where((q) => q['status'] == 'accepted').length;
  return (accepted / list.length) * 100;
});
