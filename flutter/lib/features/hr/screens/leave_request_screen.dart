import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/timeclock_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';

class LeaveRequestScreen extends ConsumerStatefulWidget {
  const LeaveRequestScreen({super.key});

  @override
  ConsumerState<LeaveRequestScreen> createState() => _LeaveRequestScreenState();
}

class _LeaveRequestScreenState extends ConsumerState<LeaveRequestScreen> {
  @override
  Widget build(BuildContext context) {
    final leaveAsync = ref.watch(leaveRequestsProvider);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.hoverBg,
                        borderRadius: ObsidianTheme.radiusMd,
                      ),
                      child: const Icon(PhosphorIconsLight.arrowLeft, color: ObsidianTheme.textSecondary, size: 20),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Leave Requests',
                      style: GoogleFonts.inter(
                        fontSize: 20, fontWeight: FontWeight.w600,
                        color: ObsidianTheme.textPrimary, letterSpacing: -0.3,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _showNewLeaveSheet(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: ObsidianTheme.emeraldDim,
                        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.emerald),
                          const SizedBox(width: 4),
                          Text(
                            'Request',
                            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: ObsidianTheme.emerald),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 300.ms, curve: ObsidianTheme.easeOutExpo),

            const SizedBox(height: 20),

            // Leave list
            Expanded(
              child: leaveAsync.when(
                data: (requests) {
                  if (requests.isEmpty) {
                    return const AnimatedEmptyState(
                      type: EmptyStateType.calendar,
                      title: 'No Leave Requests',
                      subtitle: 'Submit a leave request\nusing the + button above.',
                    );
                  }

                  return RefreshIndicator(
                    color: ObsidianTheme.emerald,
                    backgroundColor: ObsidianTheme.surface1,
                    onRefresh: () async => ref.invalidate(leaveRequestsProvider),
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                      itemCount: requests.length,
                      itemBuilder: (_, i) => _LeaveCard(request: requests[i], index: i),
                    ),
                  );
                },
                loading: () => const Center(
                  child: CircularProgressIndicator(color: ObsidianTheme.emerald, strokeWidth: 2),
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showNewLeaveSheet(BuildContext context) {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: ObsidianTheme.surface1,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      isScrollControlled: true,
      builder: (_) => _NewLeaveForm(
        onSubmit: (type, start, end, reason) async {
          final orgId = await ref.read(organizationIdProvider.future);
          if (orgId == null) return;

          await submitLeaveRequest(
            organizationId: orgId,
            type: type,
            startDate: start,
            endDate: end,
            reason: reason,
          );
          ref.invalidate(leaveRequestsProvider);
          if (context.mounted) Navigator.of(context).pop();
        },
      ),
    );
  }
}

// ── Leave Card ──────────────────────────────────────

class _LeaveCard extends StatelessWidget {
  final Map<String, dynamic> request;
  final int index;

  const _LeaveCard({required this.request, required this.index});

  @override
  Widget build(BuildContext context) {
    final type = request['type'] as String? ?? 'annual';
    final status = request['status'] as String? ?? 'pending';
    final startDate = DateTime.tryParse(request['start_date']?.toString() ?? '');
    final endDate = DateTime.tryParse(request['end_date']?.toString() ?? '');
    final days = request['days'] as int? ?? 1;
    final reason = request['reason'] as String?;

    final Color statusColor;
    final String statusLabel;
    final IconData statusIcon;

    switch (status) {
      case 'approved':
        statusColor = ObsidianTheme.emerald;
        statusLabel = 'APPROVED';
        statusIcon = PhosphorIconsLight.checkCircle;
        break;
      case 'rejected':
        statusColor = ObsidianTheme.rose;
        statusLabel = 'REJECTED';
        statusIcon = PhosphorIconsLight.xCircle;
        break;
      default:
        statusColor = ObsidianTheme.amber;
        statusLabel = 'PENDING';
        statusIcon = PhosphorIconsLight.hourglass;
    }

    final IconData typeIcon;
    switch (type) {
      case 'sick':
        typeIcon = PhosphorIconsLight.thermometer;
        break;
      case 'rdo':
        typeIcon = PhosphorIconsLight.calendarX;
        break;
      case 'personal':
        typeIcon = PhosphorIconsLight.user;
        break;
      default:
        typeIcon = PhosphorIconsLight.sunHorizon;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusLg,
        color: ObsidianTheme.surface1,
        border: Border.all(color: ObsidianTheme.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: statusColor.withValues(alpha: 0.1),
            ),
            child: Center(child: Icon(typeIcon, size: 18, color: statusColor)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${type[0].toUpperCase()}${type.substring(1)} Leave',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (startDate != null)
                      Text(
                        startDate == endDate
                            ? DateFormat('d MMM').format(startDate)
                            : '${DateFormat('d MMM').format(startDate)} — ${DateFormat('d MMM').format(endDate!)}',
                        style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                      ),
                    const SizedBox(width: 8),
                    Text(
                      '$days ${days == 1 ? "day" : "days"}',
                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                    ),
                  ],
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    reason,
                    style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: statusColor.withValues(alpha: 0.1),
              border: Border.all(color: statusColor.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 10, color: statusColor),
                const SizedBox(width: 4),
                Text(
                  statusLabel,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8, fontWeight: FontWeight.w600,
                    color: statusColor, letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 100 + index * 40), duration: 500.ms, curve: ObsidianTheme.easeOutExpo)
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 100 + index * 40), duration: 500.ms);
  }
}

// ── New Leave Form ──────────────────────────────────

class _NewLeaveForm extends StatefulWidget {
  final Future<void> Function(String type, DateTime start, DateTime end, String? reason) onSubmit;
  const _NewLeaveForm({required this.onSubmit});

  @override
  State<_NewLeaveForm> createState() => _NewLeaveFormState();
}

class _NewLeaveFormState extends State<_NewLeaveForm> {
  String _type = 'annual';
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  DateTime _endDate = DateTime.now().add(const Duration(days: 1));
  final _reasonController = TextEditingController();
  bool _submitting = false;

  final _types = [
    ('annual', 'Annual', PhosphorIconsLight.sunHorizon),
    ('sick', 'Sick', PhosphorIconsLight.thermometer),
    ('rdo', 'RDO', PhosphorIconsLight.calendarX),
    ('personal', 'Personal', PhosphorIconsLight.user),
  ];

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final initial = isStart ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: ObsidianTheme.darkTheme.copyWith(
          colorScheme: const ColorScheme.dark(
            primary: ObsidianTheme.emerald,
            surface: ObsidianTheme.surface1,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate.isBefore(picked)) _endDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusFull,
                color: ObsidianTheme.borderMedium,
              ),
            ),
          ),
          const SizedBox(height: 20),

          Text(
            'Request Leave',
            style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: ObsidianTheme.textPrimary),
          ),
          const SizedBox(height: 20),

          // Type selector
          Text(
            'TYPE',
            style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
          ),
          const SizedBox(height: 8),
          Row(
            children: _types.map((t) {
              final isActive = t.$1 == _type;
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _type = t.$1);
                  },
                  child: AnimatedContainer(
                    duration: ObsidianTheme.fast,
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: isActive ? ObsidianTheme.emeraldDim : ObsidianTheme.hoverBg,
                      border: Border.all(
                        color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.border,
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(t.$3, size: 16, color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textTertiary),
                        const SizedBox(height: 4),
                        Text(
                          t.$2,
                          style: GoogleFonts.inter(
                            fontSize: 10, fontWeight: FontWeight.w500,
                            color: isActive ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 20),

          // Dates
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _pickDate(true),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: ObsidianTheme.hoverBg,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('FROM', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
                        const SizedBox(height: 4),
                        Text(
                          DateFormat('d MMM yyyy').format(_startDate),
                          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () => _pickDate(false),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: ObsidianTheme.hoverBg,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('TO', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1)),
                        const SizedBox(height: 4),
                        Text(
                          DateFormat('d MMM yyyy').format(_endDate),
                          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Reason
          TextField(
            controller: _reasonController,
            style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary),
            decoration: InputDecoration(
              hintText: 'Reason (optional)',
              hintStyle: GoogleFonts.inter(color: ObsidianTheme.textDisabled),
            ),
          ),

          const SizedBox(height: 24),

          // Submit
          GestureDetector(
            onTap: _submitting
                ? null
                : () async {
                    setState(() => _submitting = true);
                    HapticFeedback.mediumImpact();
                    await widget.onSubmit(
                      _type,
                      _startDate,
                      _endDate,
                      _reasonController.text.isEmpty ? null : _reasonController.text,
                    );
                    if (mounted) setState(() => _submitting = false);
                  },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: ObsidianTheme.emerald,
              ),
              child: Center(
                child: _submitting
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                      )
                    : Text(
                        'Submit Request',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
