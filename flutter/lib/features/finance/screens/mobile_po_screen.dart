// ============================================================
// Mobile PO Generator & Receipt Capture
// Project Aegis-Spend — The 10-Second "Counter Strike"
// PRD 139.0 § 3 — Mobile Counter-Strike UX
// ============================================================

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// ── Common Suppliers ─────────────────────────────────────────
const _suppliers = [
  {'name': 'Reece Plumbing', 'id': 'REECE', 'icon': '🔧'},
  {'name': 'Rexel Electrical', 'id': 'REXEL', 'icon': '⚡'},
  {'name': 'Tradelink', 'id': 'TRADELINK', 'icon': '🚰'},
  {'name': 'MMEM', 'id': 'MMEM', 'icon': '🔌'},
  {'name': 'CNW Electrical', 'id': 'CNW', 'icon': '💡'},
  {'name': 'Bunnings', 'id': 'CUSTOM_API', 'icon': '🏗️'},
  {'name': 'Other', 'id': 'CUSTOM_API', 'icon': '📦'},
];

class MobilePOScreen extends ConsumerStatefulWidget {
  final String jobId;
  final String jobTitle;
  final String orgId;

  const MobilePOScreen({
    super.key,
    required this.jobId,
    required this.jobTitle,
    required this.orgId,
  });

  @override
  ConsumerState<MobilePOScreen> createState() => _MobilePOScreenState();
}

class _MobilePOScreenState extends ConsumerState<MobilePOScreen> {
  // ── State ──────────────────────────────────────────────────
  int _step = 0; // 0=supplier, 1=amount, 2=result, 3=receipt
  String? _selectedSupplier;
  String _selectedSupplierName = '';
  final _amountController = TextEditingController();
  bool _generating = false;
  bool _uploading = false;
  String? _poNumber;
  String? _poId;
  bool _needsApproval = false;
  bool _waitingApproval = false;
  double? _spendLimit;
  String? _errorMessage;
  File? _receiptImage;

  final _supabase = Supabase.instance.client;
  RealtimeChannel? _approvalChannel;

  @override
  void dispose() {
    _amountController.dispose();
    _approvalChannel?.unsubscribe();
    super.dispose();
  }

  // ── Step 1: Select Supplier ────────────────────────────────
  Widget _buildSupplierStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Supplier',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Job: ${widget.jobTitle}',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey[500],
          ),
        ),
        const SizedBox(height: 24),
        ..._suppliers.map((s) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() {
                  _selectedSupplier = s['id'];
                  _selectedSupplierName = s['name']!;
                  _step = 1;
                });
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _selectedSupplier == s['id']
                        ? const Color(0xFF10B981)
                        : Colors.white.withOpacity(0.06),
                  ),
                ),
                child: Row(
                  children: [
                    Text(s['icon']!, style: const TextStyle(fontSize: 24)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        s['name']!,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: Colors.grey[700],
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),
        )),
      ],
    );
  }

  // ── Step 2: Estimated Spend ────────────────────────────────
  Widget _buildAmountStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: () => setState(() => _step = 0),
              child: Icon(Icons.arrow_back_ios_rounded, size: 18, color: Colors.grey[400]),
            ),
            const SizedBox(width: 12),
            Text(
              _selectedSupplierName,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 32),
        const Text(
          'Estimated Spend',
          style: TextStyle(
            fontSize: 13,
            color: Color(0xFF888888),
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                '\$',
                style: TextStyle(
                  fontFamily: 'JetBrains Mono',
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF10B981),
                ),
              ),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: TextField(
                controller: _amountController,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(
                  fontFamily: 'JetBrains Mono',
                  fontSize: 48,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -1,
                ),
                decoration: InputDecoration(
                  hintText: '0.00',
                  hintStyle: TextStyle(
                    fontFamily: 'JetBrains Mono',
                    fontSize: 48,
                    fontWeight: FontWeight.w800,
                    color: Colors.grey[800],
                  ),
                  border: InputBorder.none,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[\d.]')),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 32),
        if (_errorMessage != null)
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.red.withOpacity(0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(fontSize: 13, color: Colors.redAccent),
                  ),
                ),
              ],
            ),
          ),
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _generating ? null : _generatePO,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: _generating
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : const Text(
                    'Generate PO',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
          ),
        ),
      ],
    );
  }

  // ── PO Generation Logic ────────────────────────────────────
  Future<void> _generatePO() async {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      setState(() => _errorMessage = 'Enter a valid amount');
      return;
    }

    setState(() {
      _generating = true;
      _errorMessage = null;
    });

    try {
      final userId = _supabase.auth.currentUser?.id;
      final result = await _supabase.rpc('generate_next_po_number', params: {
        'p_org_id': widget.orgId,
        'p_job_id': widget.jobId,
        'p_worker_id': userId,
        'p_supplier': _selectedSupplier,
        'p_supplier_name': _selectedSupplierName,
        'p_expected_total': amount,
      });

      if (result != null) {
        final data = result is String ? jsonDecode(result) : result;
        if (data['error'] != null) {
          setState(() => _errorMessage = data['error'].toString());
          return;
        }

        setState(() {
          _poNumber = data['po_number'];
          _poId = data['po_id'];
          _needsApproval = data['needs_approval'] == true;
          _spendLimit = data['spend_limit']?.toDouble();
        });

        if (_needsApproval) {
          _listenForApproval();
          setState(() {
            _waitingApproval = true;
            _step = 2;
          });
        } else {
          HapticFeedback.heavyImpact();
          setState(() => _step = 2);
        }
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to generate PO: ${e.toString()}');
    } finally {
      setState(() => _generating = false);
    }
  }

  // ── Realtime Approval Listener ─────────────────────────────
  void _listenForApproval() {
    if (_poId == null) return;

    _approvalChannel = _supabase.channel('po-approval-$_poId');
    _approvalChannel!.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'purchase_orders',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'id',
        value: _poId!,
      ),
      callback: (payload) {
        final newStatus = payload.newRecord['approval_status'];
        if (newStatus == 'approved') {
          HapticFeedback.heavyImpact();
          setState(() {
            _waitingApproval = false;
            _needsApproval = false;
          });
        }
      },
    ).subscribe();
  }

  // ── Step 3: PO Result (The Big Number) ─────────────────────
  Widget _buildResultStep() {
    if (_waitingApproval) {
      return _buildWaitingApproval();
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 60),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withOpacity(0.15),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_rounded,
            color: Color(0xFF10B981),
            size: 44,
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Show this to the cashier',
          style: TextStyle(
            fontSize: 14,
            color: Color(0xFF888888),
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          _poNumber ?? 'PO-????',
          style: const TextStyle(
            fontFamily: 'JetBrains Mono',
            fontSize: 52,
            fontWeight: FontWeight.w900,
            color: Color(0xFF10B981),
            letterSpacing: -2,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _selectedSupplierName,
          style: TextStyle(
            fontSize: 16,
            color: Colors.grey[400],
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '\$${_amountController.text}',
          style: const TextStyle(
            fontFamily: 'JetBrains Mono',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 48),
        // Snap Receipt Button (pulsing)
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton.icon(
            onPressed: _captureReceipt,
            icon: const Icon(Icons.camera_alt_rounded, size: 22),
            label: const Text(
              'Snap Receipt',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            'Skip for now',
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  // ── Waiting for Approval State ─────────────────────────────
  Widget _buildWaitingApproval() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 60),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.amber.withOpacity(0.15),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.hourglass_top_rounded,
            color: Colors.amber,
            size: 44,
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Waiting for Manager Approval',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Your spend limit is \$${_spendLimit?.toStringAsFixed(0) ?? "500"}',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[500],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Requested: \$${_amountController.text}',
          style: const TextStyle(
            fontFamily: 'JetBrains Mono',
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: Colors.amber,
          ),
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: 36,
          height: 36,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: Colors.amber.withOpacity(0.5),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'A push notification has been sent to your manager',
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  // ── Receipt Capture ────────────────────────────────────────
  Future<void> _captureReceipt() async {
    final picker = ImagePicker();
    final photo = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
      maxWidth: 1920,
    );

    if (photo == null) return;

    setState(() {
      _receiptImage = File(photo.path);
      _uploading = true;
      _step = 3;
    });

    try {
      final bytes = await _receiptImage!.readAsBytes();
      final path = '${widget.orgId}/${DateTime.now().millisecondsSinceEpoch}_${photo.name}';

      await _supabase.storage
          .from('supplier-receipts-photos')
          .uploadBinary(path, bytes, fileOptions: const FileOptions(contentType: 'image/jpeg'));

      // Create receipt record
      await _supabase.from('supplier_receipts').insert({
        'organization_id': widget.orgId,
        'po_id': _poId,
        'job_id': widget.jobId,
        'worker_id': _supabase.auth.currentUser?.id,
        'receipt_storage_path': path,
        'status': 'PENDING_AI_PARSE',
      });

      // Trigger OCR edge function
      try {
        await _supabase.functions.invoke('receipt-ocr', body: {
          'storage_path': path,
          'organization_id': widget.orgId,
          'po_id': _poId,
          'job_id': widget.jobId,
          'worker_id': _supabase.auth.currentUser?.id,
        });
      } catch (_) {
        // OCR runs async — not critical if direct call fails
      }

      HapticFeedback.heavyImpact();
    } catch (e) {
      setState(() => _errorMessage = 'Upload failed: ${e.toString()}');
    } finally {
      setState(() => _uploading = false);
    }
  }

  // ── Step 4: Receipt Uploaded Success ───────────────────────
  Widget _buildReceiptStep() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 40),
        if (_receiptImage != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(
              height: 240,
              width: double.infinity,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white.withOpacity(0.08)),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Image.file(_receiptImage!, fit: BoxFit.cover),
            ),
          ),
        const SizedBox(height: 24),
        if (_uploading) ...[
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF10B981)),
          ),
          const SizedBox(height: 12),
          Text(
            'Uploading & scanning...',
            style: TextStyle(fontSize: 14, color: Colors.grey[500]),
          ),
        ] else ...[
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded, color: Color(0xFF10B981), size: 32),
          ),
          const SizedBox(height: 16),
          const Text(
            'Receipt Captured',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'AI is extracting the data. Your finance team will review it.',
            style: TextStyle(fontSize: 13, color: Colors.grey[500]),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            _poNumber ?? '',
            style: const TextStyle(
              fontFamily: 'JetBrains Mono',
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Color(0xFF10B981),
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: const Text(
                'Done — Return to Job',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.close_rounded, color: Colors.grey[400]),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            const Icon(Icons.shopping_cart_rounded, color: Color(0xFF10B981), size: 18),
            const SizedBox(width: 8),
            const Text(
              'Buy Materials',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
        centerTitle: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: [
              _buildSupplierStep,
              _buildAmountStep,
              _buildResultStep,
              _buildReceiptStep,
            ][_step](),
          ),
        ),
      ),
    );
  }
}
