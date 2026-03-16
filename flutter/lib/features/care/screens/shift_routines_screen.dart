import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/routines_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// FIXME: HIGH — 16 async awaits with ZERO mounted checks. All ScaffoldMessenger/Navigator calls after await risk BuildContext crashes.
class ShiftRoutinesScreen extends ConsumerStatefulWidget {
  final String shiftId;
  const ShiftRoutinesScreen({super.key, required this.shiftId});

  @override
  ConsumerState<ShiftRoutinesScreen> createState() => _ShiftRoutinesScreenState();
}

class _ShiftRoutinesScreenState extends ConsumerState<ShiftRoutinesScreen> {
  final _picker = ImagePicker();
  bool _saving = false;
  dynamic _channel;
  String? _subscribedOrgId;

  @override
  void dispose() {
    if (_channel != null) {
      SupabaseService.client.removeChannel(_channel);
    }
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(shiftRoutineBundleProvider(widget.shiftId));
    await ref.read(shiftRoutineBundleProvider(widget.shiftId).future);
  }

  Future<void> _completeTask(ShiftRoutineTask task, ShiftRoutineBundle bundle) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      Map<String, dynamic> evidence = {};
      if (task.taskType == 'photo_required') {
        final photo = await _picker.pickImage(
          source: ImageSource.camera,
          imageQuality: 70,
          maxWidth: 1200,
        );
        if (photo == null) {
          setState(() => _saving = false);
          return;
        }
        final bytes = await photo.readAsBytes();
        final url = await uploadTaskEvidencePhoto(
          organizationId: bundle.organizationId,
          taskInstanceId: task.id,
          bytes: bytes,
        );
        evidence = {'photo_url': url};
      } else if (task.taskType == 'number_input') {
        final value = await _showNumberCaptureDialog();
        if (value == null) {
          setState(() => _saving = false);
          return;
        }
        evidence = {'value': value};
      } else if (task.taskType == 'form_trigger') {
        if (mounted) {
          await context.push('/care/shift/${widget.shiftId}/debrief');
        }
        evidence = {'form_triggered': true};
      }

      await completeRoutineTask(taskInstanceId: task.id, evidenceData: evidence);
      HapticFeedback.mediumImpact();
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to complete task: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _exemptTask(ShiftRoutineTask task) async {
    final result = await _showExemptionDialog();
    if (result == null) return;
    try {
      await exemptRoutineTask(
        taskInstanceId: task.id,
        reason: result.$1,
        note: result.$2,
      );
      HapticFeedback.heavyImpact();
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to exempt task: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _addAdHocTask(ShiftRoutineBundle bundle) async {
    final controller = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Ad-Hoc Task'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Cleaned juice spill'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Add')),
        ],
      ),
    );
    if (title == null || title.isEmpty) return;
    try {
      await createAdHocRoutineTask(
        organizationId: bundle.organizationId,
        shiftId: widget.shiftId,
        title: title,
        facilityId: bundle.facilityId,
        participantId: bundle.participantId,
      );
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add task: $e', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
          ),
        );
      }
    }
  }

  Future<String?> _showNumberCaptureDialog() async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Enter Value'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(hintText: 'e.g. 3.2'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Save')),
        ],
      ),
    );
  }

  Future<(String, String?)?> _showExemptionDialog() async {
    final noteController = TextEditingController();
    String reason = 'participant_refused';
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Unable to Complete'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: reason,
                items: const [
                  DropdownMenuItem(value: 'participant_refused', child: Text('Participant Refused')),
                  DropdownMenuItem(value: 'equipment_broken', child: Text('Equipment Broken/Missing')),
                  DropdownMenuItem(value: 'not_enough_time_unsafe', child: Text('Not Enough Time / Unsafe')),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (v) => setDialogState(() => reason = v ?? 'participant_refused'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: noteController,
                decoration: const InputDecoration(hintText: 'Optional note'),
                minLines: 2,
                maxLines: 4,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
          ],
        ),
      ),
    );
    if (ok != true) return null;
    return (reason, noteController.text.trim().isEmpty ? null : noteController.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final asyncBundle = ref.watch(shiftRoutineBundleProvider(widget.shiftId));

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text('Routines & Tasks', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      ),
      body: asyncBundle.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Text('Failed to load tasks: $e', style: GoogleFonts.inter(color: c.textTertiary)),
        ),
        data: (bundle) {
          if (_subscribedOrgId != bundle.organizationId) {
            if (_channel != null) {
              SupabaseService.client.removeChannel(_channel);
            }
            _subscribedOrgId = bundle.organizationId;
            _channel = subscribeRoutineRealtime(
              channelName: 'routine-${widget.shiftId}',
              organizationId: bundle.organizationId,
              onAnyChange: () => _refresh(),
            );
          }
          final tasks = bundle.tasks;
          final completionRatio = tasks.isEmpty ? 0.0 : bundle.completedCount / tasks.length;
          return Column(
            children: [
              Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${bundle.completedCount}/${tasks.length} tasks completed',
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary),
                          ),
                        ),
                        if (bundle.pendingMandatoryCount > 0)
                          Text(
                            '${bundle.pendingMandatoryCount} mandatory pending',
                            style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.amber),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: completionRatio,
                      minHeight: 6,
                      backgroundColor: c.border,
                      color: ObsidianTheme.careBlue,
                    ),
                  ],
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    itemCount: tasks.length,
                    itemBuilder: (context, index) {
                      final task = tasks[index];
                      final isDone = task.status == 'completed' || task.status == 'exempted';
                      return Dismissible(
                        key: ValueKey(task.id),
                        direction: isDone ? DismissDirection.none : DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.amber.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            'Unable to Complete',
                            style: GoogleFonts.inter(color: ObsidianTheme.amber, fontWeight: FontWeight.w600),
                          ),
                        ),
                        confirmDismiss: (_) async {
                          await _exemptTask(task);
                          return false;
                        },
                        child: GestureDetector(
                          onTap: isDone ? null : () => _completeTask(task, bundle),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: c.surface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: task.isCritical && !isDone
                                    ? ObsidianTheme.amber.withValues(alpha: 0.4)
                                    : c.border,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isDone ? PhosphorIconsBold.checkCircle : PhosphorIconsLight.circle,
                                  size: 18,
                                  color: isDone ? ObsidianTheme.emerald : c.textTertiary,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        task.title,
                                        style: GoogleFonts.inter(
                                          fontSize: 14,
                                          color: isDone ? c.textTertiary : c.textPrimary,
                                          decoration: isDone ? TextDecoration.lineThrough : null,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${task.taskType} • ${task.status}${task.isMandatory ? ' • mandatory' : ''}',
                                        style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                                      ),
                                    ],
                                  ),
                                ),
                                if (task.isCritical && !isDone)
                                  const Icon(PhosphorIconsLight.warningCircle, size: 14, color: ObsidianTheme.amber),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: asyncBundle.maybeWhen(
        data: (bundle) => FloatingActionButton.extended(
          backgroundColor: ObsidianTheme.careBlue.withValues(alpha: 0.18),
          foregroundColor: ObsidianTheme.careBlue,
          onPressed: () => _addAdHocTask(bundle),
          icon: const Icon(PhosphorIconsBold.plus),
          label: Text('Add Ad-Hoc Task', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        ),
        orElse: () => null,
      ),
    );
  }
}
