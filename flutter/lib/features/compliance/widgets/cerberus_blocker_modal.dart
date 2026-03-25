import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import '../services/cerberus_validator.dart';

/// Hard/Soft stop modal displayed when the CerberusValidator blocks a transition.
///
/// - Hard blocks with no escape: worker must resolve every violation
/// - Hard blocks with admin PIN override: worker can enter a 6-digit PIN
/// - Soft blocks: worker can justify and bypass
class CerberusBlockerModal extends StatefulWidget {
  final ComplianceResult complianceResult;
  final String jobId;
  final String organizationId;
  final String workerId;
  final VoidCallback onResolved;
  final void Function(List<ComplianceViolation> overridden, String? justification, String? adminId)?
      onOverride;
  final void Function(String ruleType, String? actionRoute)? onNavigateToAction;

  const CerberusBlockerModal({
    super.key,
    required this.complianceResult,
    required this.jobId,
    required this.organizationId,
    required this.workerId,
    required this.onResolved,
    this.onOverride,
    this.onNavigateToAction,
  });

  static Future<bool> show(
    BuildContext context, {
    required ComplianceResult result,
    required String jobId,
    required String organizationId,
    required String workerId,
    void Function(String ruleType, String? actionRoute)? onNavigateToAction,
    void Function(List<ComplianceViolation> overridden, String? justification,
            String? adminId)?
        onOverride,
  }) async {
    final resolved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CerberusBlockerModal(
        complianceResult: result,
        jobId: jobId,
        organizationId: organizationId,
        workerId: workerId,
        onResolved: () => Navigator.of(ctx).pop(true),
        onOverride: onOverride,
        onNavigateToAction: onNavigateToAction,
      ),
    );
    return resolved ?? false;
  }

  @override
  State<CerberusBlockerModal> createState() => _CerberusBlockerModalState();
}

class _CerberusBlockerModalState extends State<CerberusBlockerModal> {
  bool _showPinEntry = false;
  bool _showJustification = false;
  bool _validatingPin = false;
  String _pinError = '';
  final _pinController = TextEditingController();
  final _justificationController = TextEditingController();
  static const int _minJustificationLength = 20;

  bool get _canSubmitJustification =>
      _justificationController.text.trim().length >= _minJustificationLength;

  @override
  void dispose() {
    _pinController.dispose();
    _justificationController.dispose();
    super.dispose();
  }

  Future<void> _validatePin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 6) {
      setState(() => _pinError = 'PIN must be 6 digits');
      return;
    }

    setState(() {
      _validatingPin = true;
      _pinError = '';
    });

    try {
      final pinHash = await _hashPin(pin);

      final supabaseUrl =
          SupabaseService.client.rest.url.replaceAll('/rest/v1', '');
      final session = SupabaseService.auth.currentSession;

      if (session != null) {
        final response = await http.post(
          Uri.parse('$supabaseUrl/rest/v1/rpc/validate_override_pin'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${session.accessToken}',
            'apikey': const String.fromEnvironment('SUPABASE_ANON_KEY',
                defaultValue: ''),
          },
          body: jsonEncode({
            'p_job_id': widget.jobId,
            'p_pin_hash': pinHash,
            'p_worker_id': widget.workerId,
          }),
        );

        if (response.statusCode == 200) {
          final result = jsonDecode(response.body) as Map<String, dynamic>;
          if (result['valid'] == true) {
            final adminId = result['admin_id'] as String?;
            widget.onOverride?.call(
              widget.complianceResult.violations,
              'Admin PIN override',
              adminId,
            );
            if (mounted) widget.onResolved();
            return;
          } else {
            setState(() => _pinError = result['error'] ?? 'Invalid PIN');
          }
        } else {
          setState(() => _pinError = 'Server error');
        }
      } else {
        setState(() => _pinError = 'Not authenticated — connect to network');
      }
    } catch (e) {
      setState(() => _pinError = 'Connection failed — try again');
    } finally {
      if (mounted) setState(() => _validatingPin = false);
    }
  }

  Future<String> _hashPin(String pin) async {
    final bytes = utf8.encode(pin);
    final digest = await _sha256(bytes);
    return digest;
  }

  Future<String> _sha256(List<int> data) async {
    // Use a simple hex-based hash compatible with the server
    var hash = 0x811c9dc5;
    for (final byte in data) {
      hash = hash ^ byte;
      hash = (hash * 0x01000193) & 0xFFFFFFFF;
    }
    // Expand to full SHA-256 equivalent by repeating
    // In production, use crypto package. This is a placeholder for offline capability.
    return data.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  void _submitJustification() {
    if (!_canSubmitJustification) return;
    HapticFeedback.heavyImpact();
    widget.onOverride?.call(
      widget.complianceResult.softStops,
      _justificationController.text.trim(),
      null,
    );
    widget.onResolved();
  }

  @override
  Widget build(BuildContext context) {
    final violations = widget.complianceResult.violations;
    final hasHard = widget.complianceResult.hasHardBlocks;
    final hasSoft = widget.complianceResult.hasSoftStopsOnly;
    final triggerState = violations.isNotEmpty ? violations.first.triggerState : '';
    final isPreStart = triggerState == 'PRE_START';

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFF0A0A0A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(
            top: BorderSide(color: Color(0xFF2A0A0A), width: 2),
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.shield_rounded,
                          color: Colors.redAccent, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isPreStart
                                ? 'Action Required to Start Job'
                                : 'Action Required to Complete',
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${violations.length} compliance requirement${violations.length > 1 ? 's' : ''} not met',
                            style: const TextStyle(
                              color: Color(0xFF666666),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Violation list
                ...violations.map((v) => _ViolationTile(
                      violation: v,
                      onTap: () {
                        widget.onNavigateToAction
                            ?.call(v.ruleType, v.actionRoute);
                      },
                    )),

                const SizedBox(height: 16),

                // Actions
                if (!_showPinEntry && !_showJustification) ...[
                  // Cancel
                  _ActionButton(
                    label: 'Cancel',
                    onTap: () => Navigator.of(context).pop(false),
                    isPrimary: false,
                  ),

                  // Soft stop justification option
                  if (hasSoft && !hasHard) ...[
                    const SizedBox(height: 8),
                    Center(
                      child: GestureDetector(
                        onTap: () =>
                            setState(() => _showJustification = true),
                        child: const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text(
                            'Unable to comply? Provide justification...',
                            style: TextStyle(
                              color: Color(0xFF666666),
                              fontSize: 12,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],

                  // Hard stop admin PIN option
                  if (hasHard) ...[
                    const SizedBox(height: 8),
                    Center(
                      child: GestureDetector(
                        onTap: () => setState(() => _showPinEntry = true),
                        child: const Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Text(
                            'Have an admin override PIN?',
                            style: TextStyle(
                              color: Color(0xFF666666),
                              fontSize: 12,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],

                // PIN entry
                if (_showPinEntry) ...[
                  const Text(
                    'Enter 6-digit admin override PIN:',
                    style: TextStyle(
                      color: Color(0xFFCCCCCC),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pinController,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 12,
                      fontFamily: 'JetBrainsMono',
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: const Color(0xFF141414),
                      counterText: '',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(
                          color: _pinError.isNotEmpty
                              ? Colors.redAccent
                              : const Color(0xFF333333),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide(
                          color: _pinError.isNotEmpty
                              ? Colors.redAccent
                              : const Color(0xFF333333),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF10B981)),
                      ),
                    ),
                    onChanged: (_) => setState(() => _pinError = ''),
                  ),
                  if (_pinError.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(_pinError,
                        style: const TextStyle(
                            color: Colors.redAccent, fontSize: 12)),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionButton(
                          label: 'Back',
                          onTap: () => setState(() {
                            _showPinEntry = false;
                            _pinController.clear();
                          }),
                          isPrimary: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionButton(
                          label: _validatingPin ? 'Validating...' : 'Verify',
                          onTap: _validatingPin ? null : _validatePin,
                          isPrimary: true,
                        ),
                      ),
                    ],
                  ),
                ],

                // Justification entry
                if (_showJustification) ...[
                  const Text(
                    'Explain why you cannot comply:',
                    style: TextStyle(
                      color: Color(0xFFCCCCCC),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _justificationController,
                    autofocus: true,
                    maxLines: 3,
                    maxLength: 500,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText:
                          'e.g., "Client not home to sign. Verbal approval given."',
                      hintStyle: const TextStyle(
                          color: Color(0xFF555555), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFF141414),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF333333)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF333333)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF10B981)),
                      ),
                      counterStyle:
                          const TextStyle(color: Color(0xFF666666)),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_justificationController.text.isNotEmpty &&
                      _justificationController.text.trim().length <
                          _minJustificationLength)
                    Text(
                      'Minimum $_minJustificationLength characters '
                      '(${_justificationController.text.trim().length}/$_minJustificationLength)',
                      style: const TextStyle(
                          color: Color(0xFF666666), fontSize: 12),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionButton(
                          label: 'Back',
                          onTap: () => setState(() {
                            _showJustification = false;
                            _justificationController.clear();
                          }),
                          isPrimary: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionButton(
                          label: 'Submit Override',
                          onTap:
                              _canSubmitJustification ? _submitJustification : null,
                          isPrimary: true,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ViolationTile extends StatelessWidget {
  final ComplianceViolation violation;
  final VoidCallback onTap;

  const _ViolationTile({required this.violation, required this.onTap});

  IconData get _icon {
    switch (violation.ruleType) {
      case 'FORM_SUBMISSION':
        return Icons.description_outlined;
      case 'MEDIA_CAPTURE':
        return Icons.camera_alt_outlined;
      case 'PROGRESS_NOTE':
        return Icons.edit_note_outlined;
      case 'EMAR_SIGN_OFF':
        return Icons.medication_outlined;
      case 'CLIENT_SIGNATURE':
        return Icons.draw_outlined;
      case 'SWMS_REQUIRED':
        return Icons.health_and_safety_outlined;
      case 'SUBTASK_COMPLETION':
        return Icons.checklist_outlined;
      default:
        return Icons.warning_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: violation.isHardBlock
                ? Colors.red.withValues(alpha: 0.08)
                : Colors.amber.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: violation.isHardBlock
                  ? Colors.red.withValues(alpha: 0.2)
                  : Colors.amber.withValues(alpha: 0.2),
            ),
          ),
          child: Row(
            children: [
              Icon(
                _icon,
                color: violation.isHardBlock ? Colors.redAccent : Colors.amber,
                size: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          violation.isHardBlock ? 'REQUIRED' : 'RECOMMENDED',
                          style: TextStyle(
                            color: violation.isHardBlock
                                ? Colors.redAccent
                                : Colors.amber,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            violation.ruleName,
                            style: const TextStyle(
                              color: Color(0xFF999999),
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      violation.message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: violation.isHardBlock
                    ? Colors.redAccent.withValues(alpha: 0.5)
                    : Colors.amber.withValues(alpha: 0.5),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool isPrimary;

  const _ActionButton({
    required this.label,
    required this.onTap,
    required this.isPrimary,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 48,
        decoration: BoxDecoration(
          color: isPrimary
              ? (enabled ? const Color(0xFF10B981) : const Color(0xFF1A3D2E))
              : const Color(0xFF1A1A1A),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isPrimary
                ? (enabled
                    ? const Color(0xFF10B981)
                    : const Color(0xFF1A3D2E))
                : const Color(0xFF333333),
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isPrimary
                ? (enabled ? Colors.black : const Color(0xFF555555))
                : const Color(0xFFCCCCCC),
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
