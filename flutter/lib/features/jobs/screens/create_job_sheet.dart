import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/stealth_text_field.dart';
import 'package:iworkr_mobile/core/widgets/stealth_toast.dart';
import 'package:iworkr_mobile/models/job.dart';

/// Shows the "New Job" modal sheet from any screen.
Future<void> showCreateJobSheet(BuildContext context) {
  HapticFeedback.mediumImpact();
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _CreateJobSheet(),
  );
}

class _CreateJobSheet extends ConsumerStatefulWidget {
  const _CreateJobSheet();

  @override
  ConsumerState<_CreateJobSheet> createState() => _CreateJobSheetState();
}

class _CreateJobSheetState extends ConsumerState<_CreateJobSheet> {
  final _titleController = TextEditingController();
  final _clientController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();

  String? _selectedClientId;
  JobPriority _priority = JobPriority.medium;
  DateTime _scheduledDate = DateTime.now();
  int _scheduledHour = 9;
  bool _scheduleNow = false;

  bool _loading = false;
  String? _error;

  // Client search
  List<Map<String, dynamic>> _clientResults = [];
  bool _showClientDropdown = false;

  @override
  void dispose() {
    _titleController.dispose();
    _clientController.dispose();
    _descriptionController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _searchClients(String query) async {
    if (query.length < 2) {
      setState(() { _clientResults = []; _showClientDropdown = false; });
      return;
    }

    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) return;

    final data = await SupabaseService.client
        .from('clients')
        .select('id, name, email, phone, address')
        .eq('organization_id', orgId)
        .ilike('name', '%$query%')
        .limit(5);

    if (mounted) {
      setState(() {
        _clientResults = (data as List).cast<Map<String, dynamic>>();
        _showClientDropdown = true;
      });
    }
  }

  void _selectClient(Map<String, dynamic> client) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedClientId = client['id'] as String;
      _clientController.text = client['name'] as String;
      _locationController.text = client['address'] as String? ?? '';
      _showClientDropdown = false;
    });
  }

  void _applyTemplate(String name, String title, JobPriority priority) {
    HapticFeedback.selectionClick();
    setState(() {
      _titleController.text = title;
      _priority = priority;
    });
  }

  bool get _isValid => _titleController.text.trim().isNotEmpty;

  Future<void> _createJob() async {
    if (!_isValid) {
      HapticFeedback.heavyImpact();
      setState(() => _error = 'Job title is required');
      return;
    }

    setState(() { _loading = true; _error = null; });
    HapticFeedback.mediumImpact();

    try {
      final orgId = await ref.read(organizationIdProvider.future);
      final userId = SupabaseService.auth.currentUser?.id;
      if (orgId == null || userId == null) throw Exception('Not authenticated');

      // Generate display ID from existing job count
      final existingJobs = await SupabaseService.client
          .from('jobs')
          .select('id')
          .eq('organization_id', orgId);
      final nextId = (existingJobs as List).length + 1;

      final dueDate = _scheduleNow
          ? DateTime.now()
          : DateTime(_scheduledDate.year, _scheduledDate.month, _scheduledDate.day, _scheduledHour);

      final status = _scheduleNow ? 'in_progress' : 'todo';

      final jobData = await SupabaseService.client.from('jobs').insert({
        'organization_id': orgId,
        'display_id': 'JOB-$nextId',
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        'status': status,
        'priority': _priority.name,
        'client_id': _selectedClientId,
        'location': _locationController.text.trim().isEmpty ? null : _locationController.text.trim(),
        'due_date': dueDate.toIso8601String(),
        'created_by': userId,
      }).select().single();

      if (mounted) {
        HapticFeedback.heavyImpact();
        Navigator.pop(context);

        // Show stealth toast with action
        final jobId = jobData['id'] as String;
        final displayId = jobData['display_id'] as String;
        if (context.mounted) {
          StealthToast.show(
            context,
            message: '$displayId Created',
            type: ToastType.success,
            actionLabel: 'View',
            onAction: () {
              if (context.mounted) context.push('/jobs/$jobId');
            },
          );
        }
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _loading = false; _error = e.toString(); });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).viewInsets.bottom;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          height: MediaQuery.of(context).size.height * 0.92,
          decoration: BoxDecoration(
            color: c.canvas.withValues(alpha: 0.97),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border(top: BorderSide(color: c.borderMedium)),
          ),
          child: Column(
            children: [
              // Drag handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 6),
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: c.textTertiary,
                  ),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
                child: Row(
                  children: [
                    Text(
                      'New Job',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                      },
                      child: Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                          border: Border.all(color: c.border),
                        ),
                        child: Center(child: Icon(PhosphorIconsLight.x, size: 14, color: c.textTertiary)),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 200.ms),

              // Content
              Expanded(
                child: StealthFieldScope(
                  child: ListView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                    children: [
                      // ── Client Lookup ──────────────────────
                      _buildSectionLabel('CLIENT / LOCATION', c),
                      const SizedBox(height: 8),
                      StealthTextField(
                        label: 'Client',
                        hintText: 'Search client name...',
                        controller: _clientController,
                        prefixIcon: PhosphorIconsLight.magnifyingGlass,
                        onChanged: _searchClients,
                      ),
                      if (_showClientDropdown && _clientResults.isNotEmpty)
                        _buildClientDropdown(c),
                      const SizedBox(height: 4),
                      const StealthDivider(),
                      const SizedBox(height: 4),
                      StealthTextField(
                        label: 'Location',
                        hintText: 'Street address',
                        controller: _locationController,
                        prefixIcon: PhosphorIconsLight.mapPin,
                      ),

                      const SizedBox(height: 24),

                      // ── Job Definition ─────────────────────
                      _buildSectionLabel('JOB DEFINITION', c),
                      const SizedBox(height: 8),
                      _buildTemplateChips(c),
                      const SizedBox(height: 10),
                      StealthTextField(
                        label: 'Job Title',
                        controller: _titleController,
                        prefixIcon: PhosphorIconsLight.briefcase,
                        errorText: _error != null && _titleController.text.trim().isEmpty
                            ? 'Job title is required'
                            : null,
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                      ),
                      const SizedBox(height: 4),
                      const StealthDivider(),
                      const SizedBox(height: 4),
                      StealthTextField(
                        label: 'Description',
                        hintText: 'Optional',
                        controller: _descriptionController,
                        prefixIcon: PhosphorIconsLight.noteBlank,
                        maxLines: 3,
                      ),

                    const SizedBox(height: 24),

                    // ── Priority ───────────────────────────
                    _buildSectionLabel('PRIORITY', c),
                    const SizedBox(height: 8),
                    _buildPrioritySelector(c),

                    const SizedBox(height: 24),

                    // ── Scheduling ─────────────────────────
                    _buildSectionLabel('SCHEDULE', c),
                    const SizedBox(height: 8),
                    _buildDateScrubber(c),
                    const SizedBox(height: 12),
                    _buildTimePicker(c),

                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),

              // ── Floating Command Bar ────────────────────
              AnimatedPadding(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutQuart,
                padding: EdgeInsets.fromLTRB(20, 0, 20, bottomPad > 0 ? bottomPad + 8 : MediaQuery.of(context).padding.bottom + 16),
                child: _buildCommandBar(c),
              ),
            ],
          ),
        ),
      ),
    ).animate().moveY(begin: 40, end: 0, duration: 350.ms, curve: Curves.easeOutQuart).fadeIn(duration: 250.ms);
  }

  // ── Section Label ──────────────────────────────────

  Widget _buildSectionLabel(String text, IWorkrColors c) {
    return Text(
      text,
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5),
    );
  }

  // ── Client Dropdown ────────────────────────────────

  Widget _buildClientDropdown(IWorkrColors c) {
    return Container(
      margin: const EdgeInsets.only(left: 22, top: 4),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surfaceSecondary,
        border: Border.all(color: c.borderMedium),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ..._clientResults.map((cl) => GestureDetector(
            onTap: () => _selectClient(cl),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: c.border)),
              ),
              child: Row(
                children: [
                  Icon(PhosphorIconsLight.user, size: 14, color: c.textTertiary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cl['name'] as String,
                          style: GoogleFonts.inter(fontSize: 13, color: c.textPrimary, fontWeight: FontWeight.w500),
                        ),
                        if (cl['address'] != null)
                          Text(
                            cl['address'] as String,
                            style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )),
          // Create new option
          GestureDetector(
            onTap: () {
              setState(() => _showClientDropdown = false);
    },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.emerald),
                  const SizedBox(width: 10),
                  Text(
                    'Create "${_clientController.text}" as new client',
                    style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.emerald),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 150.ms).moveY(begin: -4, end: 0, duration: 150.ms);
  }

  // ── Template Chips ─────────────────────────────────

  Widget _buildTemplateChips(IWorkrColors c) {
    const templates = [
      ('Service', 'General Service', JobPriority.medium),
      ('Install', 'New Installation', JobPriority.medium),
      ('Urgent', 'Urgent Repair', JobPriority.urgent),
      ('Quote', 'Site Inspection & Quote', JobPriority.low),
      ('Callout', 'Emergency Callout', JobPriority.high),
    ];

    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: templates.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (label, title, priority) = templates[i];
          final isActive = _titleController.text == title;

          return GestureDetector(
            onTap: () => _applyTemplate(label, title, priority),
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusFull,
                color: isActive ? ObsidianTheme.emeraldDim : c.shimmerBase,
                border: Border.all(
                  color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : c.border,
                ),
              ),
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isActive ? ObsidianTheme.emerald : c.textSecondary,
                  fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Priority Selector ──────────────────────────────

  Widget _buildPrioritySelector(IWorkrColors c) {
    final levels = [
      (JobPriority.low, 'Low', c.textTertiary),
      (JobPriority.medium, 'Med', ObsidianTheme.blue),
      (JobPriority.high, 'High', ObsidianTheme.amber),
      (JobPriority.urgent, 'Critical', ObsidianTheme.rose),
    ];

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: levels.map((level) {
          final (p, label, color) = level;
          final isActive = _priority == p;

          return Expanded(
            child: GestureDetector(
              onTap: () {
                if (p == JobPriority.urgent) {
                  HapticFeedback.heavyImpact();
                } else {
                  HapticFeedback.selectionClick();
                }
                setState(() => _priority = p);
              },
              child: AnimatedContainer(
                duration: ObsidianTheme.fast,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: isActive ? c.surfaceSecondary : Colors.transparent,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 6, height: 6,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isActive ? color : color.withValues(alpha: 0.3),
                        boxShadow: isActive && p == JobPriority.urgent
                            ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 6)]
                            : null,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isActive ? Colors.white : c.textTertiary,
                        fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Date Scrubber ──────────────────────────────────

  Widget _buildDateScrubber(IWorkrColors c) {
    final now = DateTime.now();
    final dates = List.generate(7, (i) => now.add(Duration(days: i)));

    return SizedBox(
      height: 50,
      child: Row(
        children: [
          // "Now" button
          GestureDetector(
            onTap: () {
              HapticFeedback.mediumImpact();
              setState(() {
                _scheduleNow = true;
                _scheduledDate = now;
              });
            },
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: _scheduleNow ? ObsidianTheme.emeraldDim : Colors.transparent,
                border: Border.all(
                  color: _scheduleNow ? ObsidianTheme.emerald.withValues(alpha: 0.3) : c.border,
                ),
              ),
              child: Text(
                'NOW',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 11,
                  color: _scheduleNow ? ObsidianTheme.emerald : c.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Date chips
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: dates.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final date = dates[i];
                final isToday = i == 0;
                final isTomorrow = i == 1;
                final isSelected = !_scheduleNow &&
                    _scheduledDate.year == date.year &&
                    _scheduledDate.month == date.month &&
                    _scheduledDate.day == date.day;

                String label;
                if (isToday) {
                  label = 'Today';
                } else if (isTomorrow) {
                  label = 'Tmrw';
                } else {
                  label = DateFormat('EEE d').format(date);
                }

                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _scheduleNow = false;
                      _scheduledDate = date;
                    });
                  },
                  child: AnimatedContainer(
                    duration: ObsidianTheme.fast,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusMd,
                      color: isSelected ? c.surfaceSecondary : Colors.transparent,
                      border: Border.all(
                        color: isSelected ? c.borderActive : c.border,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          label,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: isSelected ? Colors.white : c.textTertiary,
                            fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                          ),
                        ),
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

  // ── Time Picker ────────────────────────────────────

  Widget _buildTimePicker(IWorkrColors c) {
    if (_scheduleNow) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: ObsidianTheme.emeraldDim,
          border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(PhosphorIconsLight.lightning, size: 14, color: ObsidianTheme.emerald),
            const SizedBox(width: 8),
            Text(
              'Starts immediately as In Progress',
              style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.emerald),
            ),
          ],
        ),
      );
    }

    final hours = List.generate(13, (i) => i + 6); // 6am - 6pm

    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: hours.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final h = hours[i];
          final isSelected = _scheduledHour == h;
          final label = h < 12 ? '${h}am' : h == 12 ? '12pm' : '${h - 12}pm';

          return GestureDetector(
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _scheduledHour = h);
            },
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              width: 50,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: isSelected ? c.surfaceSecondary : Colors.transparent,
                border: Border.all(
                  color: isSelected ? c.borderActive : c.border,
                ),
              ),
              child: Center(
                child: Text(
                  label,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 11,
                    color: isSelected ? Colors.white : c.textTertiary,
                    fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Floating Command Bar ───────────────────────────

  Widget _buildCommandBar(IWorkrColors c) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: ObsidianTheme.roseDim,
              border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(PhosphorIconsLight.warning, size: 14, color: ObsidianTheme.rose),
                const SizedBox(width: 8),
                Expanded(child: Text(_error!, style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12))),
              ],
            ),
          ).animate().fadeIn(duration: 200.ms).shake(hz: 3, offset: const Offset(4, 0), duration: 300.ms),

        GestureDetector(
          onTap: _loading ? null : _createJob,
          child: AnimatedContainer(
            duration: ObsidianTheme.fast,
            width: double.infinity,
            height: 48,
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusMd,
              color: _loading
                  ? c.surfaceSecondary
                  : _isValid
                      ? Colors.white
                      : c.shimmerBase,
              border: Border.all(
                color: _isValid ? Colors.transparent : c.border,
              ),
            ),
            child: Center(
              child: _loading
                  ? SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald),
                    )
                  : Text(
                      _isValid ? 'Create Job' : 'Enter job title to continue',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _isValid ? Colors.black : c.textTertiary,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
