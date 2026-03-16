import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:iworkr_mobile/core/services/incidents_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/incident.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show FileOptions;

class ShiftWalletScreen extends StatefulWidget {
  final String shiftId;
  const ShiftWalletScreen({super.key, required this.shiftId});

  @override
  State<ShiftWalletScreen> createState() => _ShiftWalletScreenState();
}

class _ShiftWalletScreenState extends State<ShiftWalletScreen> {
  final _picker = ImagePicker();
  bool _loading = true;
  bool _busy = false;
  String? _error;

  Map<String, dynamic>? _shift;
  List<Map<String, dynamic>> _wallets = [];
  List<Map<String, dynamic>> _ledger = [];
  String? _selectedWalletId;
  Map<String, dynamic>? _session;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = SupabaseService.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final shift = await SupabaseService.client
          .from('schedule_blocks')
          .select('id, organization_id, participant_id, facility_id')
          .eq('id', widget.shiftId)
          .single();
      _shift = (shift as Map).cast<String, dynamic>();

      final walletQuery = SupabaseService.client
          .from('participant_wallets')
          .select('*')
          .eq('organization_id', _shift!['organization_id'] as String)
          .eq('is_active', true);

      final participantId = _shift!['participant_id'] as String?;
      final facilityId = _shift!['facility_id'] as String?;
      dynamic walletsRaw;
      if (participantId != null) {
        walletsRaw = await walletQuery.eq('participant_id', participantId);
      } else if (facilityId != null) {
        walletsRaw = await walletQuery.eq('facility_id', facilityId);
      } else {
        walletsRaw = await walletQuery.limit(0);
      }
      _wallets = (walletsRaw as List).cast<Map<String, dynamic>>();

      if (_wallets.isNotEmpty) {
        _selectedWalletId = _selectedWalletId ?? _wallets.first['id'] as String;
        await _loadWalletState();
      }
      if (mounted) {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _loadWalletState() async {
    final user = SupabaseService.auth.currentUser;
    if (_selectedWalletId == null || user == null) return;
    final rows = await SupabaseService.client
        .from('wallet_ledger_entries')
        .select('*')
        .eq('wallet_id', _selectedWalletId!)
        .order('created_at', ascending: false)
        .limit(80);
    _ledger = (rows as List).cast<Map<String, dynamic>>();

    final session = await SupabaseService.client
        .from('wallet_shift_sessions')
        .select('*')
        .eq('wallet_id', _selectedWalletId!)
        .eq('shift_id', widget.shiftId)
        .eq('worker_id', user.id)
        .maybeSingle();
    _session = (session as Map?)?.cast<String, dynamic>();
  }

  Future<String?> _captureReceiptAndUpload({
    required String organizationId,
    required String walletId,
  }) async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 1920,
    );
    if (photo == null) return null;
    final bytes = await photo.readAsBytes();
    final path = '$organizationId/wallet-receipts/$walletId/${DateTime.now().millisecondsSinceEpoch}.jpg';
    await SupabaseService.client.storage.from('evidence').uploadBinary(
      path,
      bytes,
      fileOptions: const FileOptions(contentType: 'image/jpeg'),
    );
    return SupabaseService.client.storage.from('evidence').getPublicUrl(path);
  }

  Future<void> _openWalletSession() async {
    if (_selectedWalletId == null || _shift == null) return;
    final input = await _promptMoneyInput(
      title: 'Opening Blind Count',
      subtitle: 'Enter the total currently in this wallet.',
    );
    if (input == null) return;

    String? evidenceUrl;
    final wallet = _wallets.firstWhere((w) => w['id'] == _selectedWalletId);
    if ((wallet['wallet_type'] as String) == 'debit_card') {
      evidenceUrl = await _captureReceiptAndUpload(
        organizationId: _shift!['organization_id'] as String,
        walletId: _selectedWalletId!,
      );
    }

    setState(() => _busy = true);
    try {
      final result = await SupabaseService.client.rpc(
        'open_wallet_session_blind_count',
        params: {
          'p_wallet_id': _selectedWalletId,
          'p_shift_id': widget.shiftId,
          'p_counted_balance': input,
          'p_evidence_url': evidenceUrl,
        },
      );
      final json = (result as Map).cast<String, dynamic>();
      final variance = (json['variance_amount'] as num?)?.toDouble() ?? 0.0;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              variance == 0
                  ? 'Balance verified.'
                  : 'Discrepancy logged ${variance > 0 ? '+' : '-'}\$${variance.abs().toStringAsFixed(2)}',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      await _loadWalletState();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logTransaction() async {
    if (_selectedWalletId == null || _shift == null) return;
    final tx = await _promptTransactionInput();
    if (tx == null) return;
    setState(() => _busy = true);
    try {
      String? receiptUrl;
      if (!tx.noReceipt) {
        receiptUrl = await _captureReceiptAndUpload(
          organizationId: _shift!['organization_id'] as String,
          walletId: _selectedWalletId!,
        );
      }

      final payload = {
        'wallet_id': _selectedWalletId,
        'shift_id': widget.shiftId,
        'entry_type': tx.entryType,
        'amount': tx.entryType == 'expense' ? -tx.amount : tx.amount,
        'category': tx.category,
        'description': tx.description,
        'receipt_image_url': receiptUrl,
        'no_receipt_justification': tx.noReceipt ? tx.noReceiptReason : null,
      };
      await SupabaseService.client.functions.invoke('log-wallet-transaction', body: payload);
      await _loadWalletState();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _closeWalletSession() async {
    if (_selectedWalletId == null || _shift == null) return;
    final counted = await _promptMoneyInput(
      title: 'Closing Blind Count',
      subtitle: 'Count all funds now before clock-out.',
    );
    if (counted == null) return;

    setState(() => _busy = true);
    try {
      final initial = await SupabaseService.client.rpc(
        'close_wallet_session_blind_count',
        params: {
          'p_wallet_id': _selectedWalletId,
          'p_shift_id': widget.shiftId,
          'p_counted_balance': counted,
        },
      );
      final response = (initial as Map).cast<String, dynamic>();
      if (response['requires_incident'] == true) {
        final variance = ((response['variance_amount'] as num?) ?? 0).toDouble();
        final note = await _promptTextInput(
          title: 'Financial Discrepancy Incident',
          subtitle:
              'Variance ${variance > 0 ? '+' : '-'}\$${variance.abs().toStringAsFixed(2)} detected. Provide incident details to continue.',
          hint: 'Describe what happened',
        );
        if (note == null || note.trim().isEmpty) return;

        final incident = await createIncident(
          title: 'Financial Discrepancy / Suspected Loss',
          description: note.trim(),
          category: IncidentCategory.abuseAllegation,
          severity: IncidentSeverity.high,
          participantId: _shift!['participant_id'] as String?,
          shiftId: widget.shiftId,
          immediateActions: 'Auto-generated by Fort Knox wallet gate.',
        );
        if (incident == null) throw Exception('Failed to file incident report');

        await SupabaseService.client.rpc(
          'close_wallet_session_blind_count',
          params: {
            'p_wallet_id': _selectedWalletId,
            'p_shift_id': widget.shiftId,
            'p_counted_balance': counted,
            'p_incident_id': incident.id,
            'p_force_with_incident': true,
          },
        );
      }

      await _loadWalletState();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Wallet reconciled and closed.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<double?> _promptMoneyInput({
    required String title,
    required String subtitle,
  }) async {
    final controller = TextEditingController();
    return showDialog<double>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF101010),
        title: Text(title, style: GoogleFonts.inter(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle, style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: GoogleFonts.jetBrainsMono(color: Colors.white),
              decoration: const InputDecoration(hintText: '0.00'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final parsed = double.tryParse(controller.text.trim());
              if (parsed == null) return;
              Navigator.pop(context, parsed);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Future<String?> _promptTextInput({
    required String title,
    required String subtitle,
    required String hint,
  }) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF101010),
        title: Text(title, style: GoogleFonts.inter(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle, style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              maxLines: 4,
              style: GoogleFonts.inter(color: Colors.white),
              decoration: InputDecoration(hintText: hint),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Submit Incident'),
          ),
        ],
      ),
    );
  }

  Future<_TxInput?> _promptTransactionInput() async {
    final amountCtl = TextEditingController();
    final descCtl = TextEditingController();
    final noReceiptCtl = TextEditingController();
    String entryType = 'expense';
    String category = 'groceries';
    bool noReceipt = false;

    return showModalBottomSheet<_TxInput>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF101010),
      builder: (_) => StatefulBuilder(
        builder: (context, setLocal) {
          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.of(context).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Log Transaction', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'expense', label: Text('Expense')),
                          ButtonSegment(value: 'injection', label: Text('Top-Up')),
                        ],
                        selected: {entryType},
                        onSelectionChanged: (s) => setLocal(() => entryType = s.first),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: amountCtl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  style: GoogleFonts.jetBrainsMono(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: category,
                  items: const [
                    DropdownMenuItem(value: 'groceries', child: Text('Groceries')),
                    DropdownMenuItem(value: 'entertainment', child: Text('Entertainment')),
                    DropdownMenuItem(value: 'transport_taxi', child: Text('Transport/Taxi')),
                    DropdownMenuItem(value: 'medical_pharmacy', child: Text('Medical/Pharmacy')),
                    DropdownMenuItem(value: 'personal_care', child: Text('Personal Care')),
                  ],
                  onChanged: (v) => setLocal(() => category = v ?? 'groceries'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descCtl,
                  style: GoogleFonts.inter(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  value: noReceipt,
                  onChanged: (v) => setLocal(() => noReceipt = v),
                  title: const Text('No receipt available'),
                  dense: true,
                ),
                if (noReceipt)
                  TextField(
                    controller: noReceiptCtl,
                    maxLines: 3,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Receipt justification (required)'),
                  ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    icon: const Icon(PhosphorIconsBold.camera),
                    label: Text(noReceipt ? 'Submit Transaction' : 'Capture Receipt & Submit'),
                    onPressed: () {
                      final amount = double.tryParse(amountCtl.text.trim());
                      if (amount == null || amount <= 0) return;
                      if (noReceipt && noReceiptCtl.text.trim().isEmpty) return;
                      Navigator.pop(
                        context,
                        _TxInput(
                          entryType: entryType,
                          amount: amount,
                          category: category,
                          description: descCtl.text.trim(),
                          noReceipt: noReceipt,
                          noReceiptReason: noReceiptCtl.text.trim(),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    if (_loading) {
      return const Scaffold(
        backgroundColor: Color(0xFF050505),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF050505),
        title: Text('Wallets & Funds', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!, style: GoogleFonts.inter(color: ObsidianTheme.rose)),
            ),
          if (_wallets.isEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.surfaceSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.border),
              ),
              child: Text('No active wallets assigned to this shift.', style: GoogleFonts.inter(color: c.textSecondary)),
            ),
          for (final wallet in _wallets)
            GestureDetector(
              onTap: () async {
                setState(() => _selectedWalletId = wallet['id'] as String);
                await _loadWalletState();
                if (mounted) setState(() {});
              },
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _selectedWalletId == wallet['id']
                      ? ObsidianTheme.emerald.withValues(alpha: 0.12)
                      : c.surfaceSecondary,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _selectedWalletId == wallet['id']
                        ? ObsidianTheme.emerald.withValues(alpha: 0.45)
                        : c.border,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      (wallet['wallet_type'] as String) == 'debit_card'
                          ? PhosphorIconsBold.creditCard
                          : PhosphorIconsBold.wallet,
                      color: c.textPrimary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(wallet['name']?.toString() ?? 'Wallet', style: GoogleFonts.inter(color: c.textPrimary)),
                          Text(
                            (wallet['wallet_type'] as String) == 'debit_card'
                                ? 'Card ending ${wallet['card_last_four'] ?? '----'}'
                                : 'Cash wallet',
                            style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '\$${((wallet['current_balance'] as num?) ?? 0).toStringAsFixed(2)}',
                      style: GoogleFonts.jetBrainsMono(
                        color: ObsidianTheme.emerald,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (_selectedWalletId != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : _openWalletSession,
                    child: const Text('Opening Blind Count'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy || _session == null ? null : _logTransaction,
                    child: const Text('+ Log Transaction'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonal(
                onPressed: _busy || _session == null ? null : _closeWalletSession,
                child: const Text('Closing Blind Count'),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Ledger',
              style: GoogleFonts.jetBrainsMono(
                color: c.textTertiary,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 6),
            for (final row in _ledger)
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: c.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(row['entry_type']?.toString() ?? 'entry', style: GoogleFonts.inter(color: c.textPrimary)),
                          Text(
                            row['description']?.toString() ?? '',
                            style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${((row['amount'] as num?) ?? 0) < 0 ? '-' : '+'}\$${((row['amount'] as num?) ?? 0).abs().toStringAsFixed(2)}',
                      style: GoogleFonts.jetBrainsMono(
                        color: ((row['amount'] as num?) ?? 0) < 0 ? ObsidianTheme.rose : ObsidianTheme.emerald,
                      ),
                    ),
                  ],
                ),
              ),
            if (_ledger.isEmpty)
              Text('No ledger entries yet.', style: GoogleFonts.inter(color: c.textTertiary)),
          ],
        ],
      ),
      floatingActionButton: _busy
          ? const FloatingActionButton(
              onPressed: null,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : FloatingActionButton(
              onPressed: () => context.pop(),
              child: const Icon(Icons.check),
            ),
    );
  }
}

class _TxInput {
  final String entryType;
  final double amount;
  final String category;
  final String description;
  final bool noReceipt;
  final String noReceiptReason;

  const _TxInput({
    required this.entryType,
    required this.amount,
    required this.category,
    required this.description,
    required this.noReceipt,
    required this.noReceiptReason,
  });
}

