import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/industry_provider.dart';
import 'package:iworkr_mobile/core/services/invoice_provider.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/database/app_database.dart';
import 'package:drift/drift.dart' show Value;
import 'package:uuid/uuid.dart';

class _LineItem {
  String id;
  String description;
  double quantity;
  double unitPrice;

  _LineItem({
    String? id,
    this.description = '',
    this.quantity = 1,
    this.unitPrice = 0,
  }) : id = id ?? const Uuid().v4();

  double get total => (quantity * unitPrice * 100).roundToDouble() / 100;

  Map<String, dynamic> toJson() => {
    'description': description,
    'quantity': quantity,
    'unit_price': unitPrice,
  };
}

class CreateInvoiceScreen extends ConsumerStatefulWidget {
  final String? jobId;
  final String? clientId;
  final String? clientName;

  const CreateInvoiceScreen({
    super.key,
    this.jobId,
    this.clientId,
    this.clientName,
  });

  @override
  ConsumerState<CreateInvoiceScreen> createState() => _CreateInvoiceScreenState();
}

class _CreateInvoiceScreenState extends ConsumerState<CreateInvoiceScreen> {
  final List<_LineItem> _items = [];
  String? _selectedClientId;
  String _clientName = '';
  String _notes = '';
  double _taxRate = 10.0;
  String _terms = 'net_7';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.clientId != null) _selectedClientId = widget.clientId;
    if (widget.clientName != null) _clientName = widget.clientName!;
  }

  bool get _hasUnsavedChanges => _items.isNotEmpty || _clientName.isNotEmpty || _notes.isNotEmpty;

  double get _subtotal =>
      _items.fold(0.0, (sum, item) => sum + item.total);

  double get _tax => (_subtotal * _taxRate / 100.0 * 100.0).roundToDouble() / 100.0;

  double get _total => ((_subtotal + _tax) * 100.0).roundToDouble() / 100.0;

  Future<void> _submit({required bool send}) async {
    if (_submitting) return;

    // Validate line items
    if (_items.isEmpty) {
      _showError('Add at least one line item before ${send ? 'sending' : 'saving'}.');
      return;
    }

    // Validate line item data
    for (final item in _items) {
      if (item.description.trim().isEmpty) {
        _showError('All line items must have a description.');
        return;
      }
      if (item.quantity <= 0) {
        _showError('Quantity must be greater than zero for "${item.description}".');
        return;
      }
      if (item.unitPrice <= 0) {
        _showError('Unit price must be greater than zero for "${item.description}".');
        return;
      }
    }

    // Warn if sending without a client
    if (send && _selectedClientId == null && _clientName.isEmpty) {
      _showError('Select a client before sending the invoice.');
      return;
    }

    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    final orgId = ref.read(organizationIdProvider).valueOrNull;
    if (orgId == null) {
      setState(() => _submitting = false);
      _showError('No organization found. Please sign in again.');
      return;
    }

    try {
      final user = SupabaseService.client.auth.currentUser;
      if (user == null) {
        setState(() => _submitting = false);
        _showError('Session expired. Please sign in again.');
        return;
      }

      final now = DateTime.now();
      final daysMap = {'due_receipt': 0, 'net_7': 7, 'net_14': 14, 'net_30': 30};
      final dueDays = daysMap[_terms] ?? 7;
      final dueDate = now.add(Duration(days: dueDays));

      // Generate display ID via count fallback (safer than raw sequence)
      String displayId;
      try {
        final seqResult = await SupabaseService.client
            .rpc('next_invoice_number', params: {'org_id': orgId});
        displayId = 'INV-$seqResult';
      } catch (_) {
        // Fallback: use timestamp-based ID if RPC not available
        displayId = 'INV-${now.millisecondsSinceEpoch ~/ 1000}';
      }

      final invoiceRow = await SupabaseService.client.from('invoices').insert({
        'organization_id': orgId,
        'display_id': displayId,
        'client_id': _selectedClientId,
        'client_name': _clientName.isEmpty ? null : _clientName,
        'job_id': widget.jobId,
        'status': send ? 'sent' : 'draft',
        'issue_date': now.toIso8601String().split('T')[0],
        'due_date': dueDate.toIso8601String().split('T')[0],
        'subtotal': _subtotal,
        'tax_rate': _taxRate,
        'tax': _tax,
        'total': _total,
        'notes': _notes.isEmpty ? null : _notes,
        'created_by': user.id,
      }).select().single();

      final invoiceId = invoiceRow['id'] as String;

      final lineItemRows = _items.asMap().entries.map((entry) {
        return {
          'invoice_id': invoiceId,
          'description': entry.value.description,
          'quantity': entry.value.quantity,
          'unit_price': entry.value.unitPrice,
          'sort_order': entry.key,
        };
      }).toList();

      await SupabaseService.client.from('invoice_line_items').insert(lineItemRows);

      await SupabaseService.client.from('invoice_events').insert({
        'invoice_id': invoiceId,
        'type': 'created',
        'text': 'Invoice created from mobile app',
      });

      if (send) {
        await SupabaseService.client.from('invoice_events').insert({
          'invoice_id': invoiceId,
          'type': 'sent',
          'text': 'Invoice sent to client',
        });
      }

      ref.invalidate(invoicesStreamProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(send ? 'Invoice sent' : 'Invoice saved as draft'),
          backgroundColor: ObsidianTheme.emerald,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ));
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _showError('Failed to create invoice: ${e.toString().split('\n').first}');
      // Queue for offline retry if network error
      try {
        final db = ref.read(appDatabaseProvider);
        await db.enqueue(SyncQueueCompanion(
          id: Value(const Uuid().v4()),
          entityType: const Value('invoices'),
          entityId: Value(const Uuid().v4()),
          action: const Value('create'),
          payload: Value(jsonEncode({
            'items': _items.map((i) => i.toJson()).toList(),
            'client_id': _selectedClientId,
            'client_name': _clientName,
            'notes': _notes,
            'tax_rate': _taxRate,
            'terms': _terms,
            'job_id': widget.jobId,
          })),
          createdAt: Value(DateTime.now()),
        ));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Invoice saved offline. It will sync when connected.'),
            backgroundColor: ObsidianTheme.amber,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ));
        }
      } catch (syncErr) {
        debugPrint('Offline queue failed: $syncErr');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _preview() {
    if (_items.isEmpty) {
      _showError('Add line items to preview the invoice.');
      return;
    }
    // INCOMPLETE: PDF preview — Edge Function integration needed
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('PDF preview coming soon — save as draft and view on web.',
          style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
      backgroundColor: ObsidianTheme.amber,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
      duration: const Duration(seconds: 3),
    ));
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: const Color(0xFFF43F5E),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
      duration: const Duration(seconds: 3),
    ));
  }

  void _addItem() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddItemSheet(onAdd: (desc, qty, price) {
        setState(() {
          _items.add(_LineItem(description: desc, quantity: qty, unitPrice: price));
        });
      }),
    );
  }

  Future<void> _pickClient() async {
    HapticFeedback.lightImpact();
    final orgId = ref.read(activeWorkspaceIdProvider);
    if (orgId == null) {
      _showError('No organization found.');
      return;
    }

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClientPickerSheet(orgId: orgId),
    );

    if (result != null && mounted) {
      setState(() {
        _selectedClientId = result['id'] as String?;
        _clientName = result['name'] as String? ?? '';
      });
    }
  }

  Future<bool> _onWillPop() async {
    if (!_hasUnsavedChanges) return true;
    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF141414),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Discard invoice?', style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
        content: Text('You have unsaved changes. Are you sure you want to leave?', style: GoogleFonts.inter(color: Colors.white70, fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Keep editing', style: GoogleFonts.inter(color: ObsidianTheme.emerald)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Discard', style: GoogleFonts.inter(color: ObsidianTheme.rose)),
          ),
        ],
      ),
    );
    return shouldLeave ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isCare = ref.watch(isCareProvider);

    return PopScope(
      canPop: !_hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: c.canvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(PhosphorIconsLight.arrowLeft, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          isCare ? 'NEW CLAIM' : 'NEW INVOICE',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 2,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(PhosphorIconsLight.eye, size: 20),
            onPressed: _preview,
            tooltip: 'Preview PDF',
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
              children: [
                // Client
                _SectionHeader(label: isCare ? 'PARTICIPANT' : 'CLIENT'),
                const SizedBox(height: 8),
                _clientName.isEmpty
                    ? GestureDetector(
                        onTap: _pickClient,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: c.border),
                            color: c.hoverBg,
                          ),
                          child: Row(
                            children: [
                              Icon(PhosphorIconsLight.userPlus, color: c.textTertiary, size: 18),
                              const SizedBox(width: 12),
                              Text(
                                isCare ? 'Select participant' : 'Select client',
                                style: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                          color: ObsidianTheme.emeraldDim,
                        ),
                        child: Row(
                          children: [
                            Icon(PhosphorIconsBold.user, color: ObsidianTheme.emerald, size: 18),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _clientName,
                                style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                            ),
                            GestureDetector(
                              onTap: () => setState(() {
                                _selectedClientId = null;
                                _clientName = '';
                              }),
                              child: Icon(PhosphorIconsLight.x, color: c.textTertiary, size: 16),
                            ),
                          ],
                        ),
                      ),

                const SizedBox(height: 24),

                // Line Items
                _SectionHeader(label: 'LINE ITEMS'),
                const SizedBox(height: 8),
                ..._items.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final item = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Dismissible(
                      key: Key(item.id),
                      direction: DismissDirection.endToStart,
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 20),
                        decoration: BoxDecoration(
                          color: ObsidianTheme.rose.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(PhosphorIconsLight.trash, color: ObsidianTheme.rose, size: 20),
                      ),
                      onDismissed: (_) {
                        setState(() => _items.remove(item));
                        HapticFeedback.lightImpact();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: c.hoverBg,
                          border: Border.all(color: c.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.description.isEmpty ? 'Untitled item' : item.description,
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '${item.quantity} × \$${item.unitPrice.toStringAsFixed(2)}',
                                  style: GoogleFonts.jetBrainsMono(color: c.textTertiary, fontSize: 12),
                                ),
                                const Spacer(),
                                Text(
                                  '\$${item.total.toStringAsFixed(2)}',
                                  style: GoogleFonts.jetBrainsMono(
                                    color: ObsidianTheme.emerald,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(delay: Duration(milliseconds: 50 * idx), duration: 300.ms)
                          .moveX(begin: 12, delay: Duration(milliseconds: 50 * idx), duration: 300.ms),
                    ),
                  );
                }),

                // Add Item button
                GestureDetector(
                  onTap: _addItem,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: c.border, style: BorderStyle.solid),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(PhosphorIconsLight.plus, color: c.textTertiary, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          'Add Line Item',
                          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Payment Terms & Tax Rate
                _SectionHeader(label: 'TERMS'),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: c.hoverBg,
                          border: Border.all(color: c.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _terms,
                            isExpanded: true,
                            dropdownColor: const Color(0xFF1A1A1A),
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                            icon: Icon(PhosphorIconsLight.caretDown, size: 14, color: c.textTertiary),
                            items: const [
                              DropdownMenuItem(value: 'due_receipt', child: Text('Due on receipt')),
                              DropdownMenuItem(value: 'net_7', child: Text('Net 7 days')),
                              DropdownMenuItem(value: 'net_14', child: Text('Net 14 days')),
                              DropdownMenuItem(value: 'net_30', child: Text('Net 30 days')),
                            ],
                            onChanged: (v) {
                              if (v != null) setState(() => _terms = v);
                            },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 100,
                      child: TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 13),
                        controller: TextEditingController(text: _taxRate.toStringAsFixed(1)),
                        onChanged: (v) {
                          final parsed = double.tryParse(v);
                          if (parsed != null && parsed >= 0 && parsed <= 100) {
                            setState(() => _taxRate = parsed);
                          }
                        },
                        decoration: InputDecoration(
                          labelText: 'Tax %',
                          labelStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 11),
                          filled: true,
                          fillColor: c.hoverBg,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: c.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: c.border),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Notes
                _SectionHeader(label: 'NOTES'),
                const SizedBox(height: 8),
                TextField(
                  onChanged: (v) => _notes = v,
                  maxLines: 3,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Payment instructions, warranty info…',
                    hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Totals
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: c.hoverBg,
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    children: [
                      _TotalsRow(label: 'Subtotal', value: _subtotal, c: c),
                      const SizedBox(height: 6),
                      _TotalsRow(label: 'GST (${_taxRate.toStringAsFixed(0)}%)', value: _tax, c: c),
                      const SizedBox(height: 8),
                      Divider(height: 1, color: c.border),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Total',
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                          ),
                          Text(
                            '\$${_total.toStringAsFixed(2)}',
                            style: GoogleFonts.jetBrainsMono(
                              color: ObsidianTheme.emerald,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: 200.ms, duration: 400.ms),
              ],
            ),
          ),

          // Bottom Bar
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 12),
            decoration: BoxDecoration(
              color: c.surfaceSecondary,
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting || _items.isEmpty ? null : () => _submit(send: false),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: c.hoverBg,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: Text(
                      'SAVE DRAFT',
                      style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _submitting || _items.isEmpty ? null : () => _submit(send: true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ObsidianTheme.emerald,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 20, height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(PhosphorIconsBold.paperPlaneTilt, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                isCare ? 'SEND CLAIM' : 'SEND INVOICE',
                                style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Text(
      label,
      style: GoogleFonts.jetBrainsMono(
        color: c.textTertiary,
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 2,
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  final String label;
  final double value;
  final IWorkrColors c;
  const _TotalsRow({required this.label, required this.value, required this.c});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13)),
        Text(
          '\$${value.toStringAsFixed(2)}',
          style: GoogleFonts.jetBrainsMono(color: c.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}

/// Bottom sheet for adding a single line item.
class _AddItemSheet extends StatefulWidget {
  final void Function(String description, double quantity, double unitPrice) onAdd;
  const _AddItemSheet({required this.onAdd});

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  final _descController = TextEditingController();
  final _qtyController = TextEditingController(text: '1');
  final _priceController = TextEditingController();

  @override
  void dispose() {
    _descController.dispose();
    _qtyController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  String? _descError;
  String? _priceError;

  void _save() {
    final desc = _descController.text.trim();
    final qty = double.tryParse(_qtyController.text) ?? 1;
    final price = double.tryParse(_priceController.text) ?? 0;

    setState(() {
      _descError = desc.isEmpty ? 'Description is required' : null;
      _priceError = price <= 0 ? 'Enter a valid price' : null;
    });

    if (_descError != null || _priceError != null) {
      HapticFeedback.heavyImpact();
      return;
    }

    widget.onAdd(desc, qty > 0 ? qty : 1, price);
    HapticFeedback.lightImpact();
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, mq.viewInsets.bottom + mq.padding.bottom + 16),
      decoration: BoxDecoration(
        color: const Color(0xF5080808),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: c.borderHover,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'ADD LINE ITEM',
            style: GoogleFonts.jetBrainsMono(
              color: c.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _descController,
            autofocus: true,
            style: GoogleFonts.inter(color: Colors.white, fontSize: 15),
            decoration: InputDecoration(
              hintText: 'Description',
              hintStyle: GoogleFonts.inter(color: c.textTertiary),
              errorText: _descError,
              errorStyle: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 11),
              filled: true,
              fillColor: c.hoverBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qtyController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    labelText: 'Qty',
                    labelStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _priceController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(color: Colors.white, fontSize: 15),
                  decoration: InputDecoration(
                    labelText: 'Unit Price (\$)',
                    labelStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                    filled: true,
                    fillColor: c.hoverBg,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: c.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: ObsidianTheme.emerald,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: Text(
                'ADD ITEM',
                style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Client picker — searches org clients with live filtering.
class _ClientPickerSheet extends StatefulWidget {
  final String orgId;
  const _ClientPickerSheet({required this.orgId});

  @override
  State<_ClientPickerSheet> createState() => _ClientPickerSheetState();
}

class _ClientPickerSheetState extends State<_ClientPickerSheet> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _clients = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadClients();
    _searchController.addListener(_onSearch);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadClients([String? query]) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      var request = SupabaseService.client
          .from('clients')
          .select('id, name, email, phone')
          .eq('organization_id', widget.orgId)
          .order('name');

      if (query != null && query.trim().isNotEmpty) {
        request = SupabaseService.client
            .from('clients')
            .select('id, name, email, phone')
            .eq('organization_id', widget.orgId)
            .ilike('name', '%${query.trim()}%')
            .order('name');
      }

      final data = await request.limit(20);
      if (mounted) {
        setState(() {
          _clients = List<Map<String, dynamic>>.from(data);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not load clients';
          _loading = false;
        });
      }
    }
  }

  void _onSearch() {
    _loadClients(_searchController.text);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      height: mq.size.height * 0.7,
      padding: EdgeInsets.fromLTRB(20, 16, 20, mq.padding.bottom + 16),
      decoration: BoxDecoration(
        color: const Color(0xF5080808),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: c.borderHover,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'SELECT CLIENT',
            style: GoogleFonts.jetBrainsMono(
              color: c.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            autofocus: true,
            style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search clients…',
              hintStyle: GoogleFonts.inter(color: c.textTertiary),
              prefixIcon: Icon(PhosphorIconsLight.magnifyingGlass, size: 18, color: c.textTertiary),
              filled: true,
              fillColor: c.hoverBg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: c.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(PhosphorIconsLight.warning, color: ObsidianTheme.amber, size: 32),
                            const SizedBox(height: 8),
                            Text(_error!, style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13)),
                            const SizedBox(height: 12),
                            GestureDetector(
                              onTap: () => _loadClients(_searchController.text),
                              child: Text('Retry', style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 13, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      )
                    : _clients.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(PhosphorIconsLight.users, color: c.textTertiary, size: 32),
                                const SizedBox(height: 8),
                                Text(
                                  _searchController.text.isNotEmpty
                                      ? 'No clients match "${_searchController.text}"'
                                      : 'No clients yet',
                                  style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            itemCount: _clients.length,
                            itemBuilder: (context, index) {
                              final client = _clients[index];
                              return GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  Navigator.of(context).pop(client);
                                },
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 6),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(12),
                                    color: c.hoverBg,
                                    border: Border.all(color: c.border),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 36, height: 36,
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(10),
                                          color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                                        ),
                                        child: Center(
                                          child: Text(
                                            (client['name'] as String? ?? '?')[0].toUpperCase(),
                                            style: GoogleFonts.inter(color: ObsidianTheme.emerald, fontSize: 14, fontWeight: FontWeight.w600),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              client['name'] as String? ?? '',
                                              style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
                                            ),
                                            if (client['email'] != null)
                                              Text(
                                                client['email'] as String,
                                                style: GoogleFonts.inter(color: c.textTertiary, fontSize: 11),
                                              ),
                                          ],
                                        ),
                                      ),
                                      Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textTertiary),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
