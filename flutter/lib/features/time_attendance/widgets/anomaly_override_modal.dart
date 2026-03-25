import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/spatial_gate_service.dart';

/// Hard-gate modal shown when a worker attempts to clock in/out
/// outside the 150m geofence radius.
///
/// Provides two paths:
/// - Cancel (walk away)
/// - Request Override (submit justification for dispatcher review)
class AnomalyOverrideModal extends StatefulWidget {
  final SpatialGateResult gateResult;
  final String jobTitle;
  final VoidCallback onCancel;
  final void Function(String justification) onRequestOverride;

  const AnomalyOverrideModal({
    super.key,
    required this.gateResult,
    required this.jobTitle,
    required this.onCancel,
    required this.onRequestOverride,
  });

  static Future<String?> show(
    BuildContext context, {
    required SpatialGateResult gateResult,
    required String jobTitle,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String? justification;
        return AnomalyOverrideModal(
          gateResult: gateResult,
          jobTitle: jobTitle,
          onCancel: () => Navigator.of(ctx).pop(null),
          onRequestOverride: (j) {
            justification = j;
            Navigator.of(ctx).pop(justification);
          },
        );
      },
    );
  }

  @override
  State<AnomalyOverrideModal> createState() => _AnomalyOverrideModalState();
}

class _AnomalyOverrideModalState extends State<AnomalyOverrideModal> {
  final _controller = TextEditingController();
  bool _showTextArea = false;
  static const int minJustificationLength = 20;

  String get _distanceLabel {
    final d = widget.gateResult.distanceMeters;
    if (d >= 1000) return '${(d / 1000).toStringAsFixed(1)} kilometers';
    return '$d meters';
  }

  bool get _canSubmit => _controller.text.trim().length >= minJustificationLength;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0A0A0A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          border: Border(
            top: BorderSide(color: Color(0xFF2A0A0A), width: 2),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Warning header
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.location_off_rounded,
                        color: Colors.redAccent,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Location Mismatch Detected',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.jobTitle,
                            style: const TextStyle(
                              color: Color(0xFF666666),
                              fontSize: 13,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Distance warning card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _distanceLabel,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'from the job site',
                        style: TextStyle(
                          color: Color(0xFF999999),
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Timesheets submitted outside the ${SpatialGateService.geofenceRadiusMeters}m geofence '
                        'require administrative approval before payroll.',
                        style: const TextStyle(
                          color: Color(0xFF888888),
                          fontSize: 13,
                          height: 1.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                if (!_showTextArea) ...[
                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: _ModalButton(
                          label: 'Cancel',
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            widget.onCancel();
                          },
                          isPrimary: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ModalButton(
                          label: 'Request Override',
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            setState(() => _showTextArea = true);
                          },
                          isPrimary: true,
                        ),
                      ),
                    ],
                  ),
                ] else ...[
                  // Justification text area
                  const Text(
                    'Explain why you are clocking in from this location:',
                    style: TextStyle(
                      color: Color(0xFFCCCCCC),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _controller,
                    autofocus: true,
                    maxLines: 3,
                    maxLength: 500,
                    style: const TextStyle(color: Colors.white, fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'e.g., "Parked 3 streets down due to road construction..."',
                      hintStyle: const TextStyle(color: Color(0xFF555555), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFF141414),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF333333)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF333333)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFF10B981)),
                      ),
                      counterStyle: const TextStyle(color: Color(0xFF666666)),
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 8),
                  if (_controller.text.isNotEmpty &&
                      _controller.text.trim().length < minJustificationLength)
                    Text(
                      'Minimum $minJustificationLength characters required '
                      '(${_controller.text.trim().length}/$minJustificationLength)',
                      style: const TextStyle(color: Color(0xFF666666), fontSize: 12),
                    ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _ModalButton(
                          label: 'Back',
                          onTap: () {
                            setState(() => _showTextArea = false);
                          },
                          isPrimary: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ModalButton(
                          label: 'Submit Override',
                          onTap: _canSubmit
                              ? () {
                                  HapticFeedback.heavyImpact();
                                  widget.onRequestOverride(
                                    _controller.text.trim(),
                                  );
                                }
                              : null,
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

class _ModalButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool isPrimary;

  const _ModalButton({
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
                ? (enabled ? const Color(0xFF10B981) : const Color(0xFF1A3D2E))
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
