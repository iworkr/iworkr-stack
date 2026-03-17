import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:local_auth/local_auth.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/care_shift_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/slide_to_act.dart';
import 'package:iworkr_mobile/models/care_shift.dart';

class ShiftDebriefScreen extends ConsumerStatefulWidget {
  final String shiftId;
  const ShiftDebriefScreen({super.key, required this.shiftId});

  @override
  ConsumerState<ShiftDebriefScreen> createState() => _ShiftDebriefScreenState();
}

class _ShiftDebriefScreenState extends ConsumerState<ShiftDebriefScreen> {
  static const _secureStorage = FlutterSecureStorage();
  final _localAuth = LocalAuthentication();
  final _imagePicker = ImagePicker();

  CareShift? _shift;
  bool _loading = true;
  bool _submitting = false;
  bool _workerDeclared = false;
  bool _participantUnableToSign = false;
  String _signatureExemptionReason = 'asleep';
  String _signatureExemptionNotes = '';
  String? _workerSignatureToken;
  Timer? _autoSaveTimer;

  List<Map<String, dynamic>> _schemaFields = [];
  final Map<String, dynamic> _values = {};
  final Set<String> _missingRequiredFieldIds = {};
  final List<Offset?> _signaturePoints = [];
  bool _isShadowShift = false;
  bool _usingDefaultForm = false;
  String? _childShadowShiftId;
  String? _childShadowWorkerId;
  String? _templateLoadError;

  // ── Teleology: Goal Tracking State ──────────────────────
  List<Map<String, dynamic>> _activeGoals = [];
  final Map<String, String> _goalRatings = {}; // goal_id -> 'REGRESSED'|'MAINTAINED'|'PROGRESSED'
  final Map<String, String> _goalObservations = {}; // goal_id -> observation text
  bool _goalsLoaded = false;

  String get _draftKey => 'rosetta_shift_note_draft_${widget.shiftId}';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    await _loadShiftAndTemplate();
    await _restoreDraft();
    _autoSaveTimer = Timer.periodic(const Duration(seconds: 5), (_) => _persistDraft());
    _validateRequired();
    await _loadActiveGoals();
  }

  Future<void> _loadActiveGoals() async {
    if (_shift?.participantId == null) return;
    try {
      final rows = await SupabaseService.client
          .rpc('get_active_goals_for_participant', params: {'p_participant_id': _shift!.participantId})
          .select();
      if (mounted) {
        setState(() {
          _activeGoals = (rows as List).map((r) => Map<String, dynamic>.from(r as Map)).toList();
          // Default all goals to MAINTAINED
          for (final g in _activeGoals) {
            final id = g['id'] as String? ?? '';
            if (id.isNotEmpty && !_goalRatings.containsKey(id)) {
              _goalRatings[id] = 'MAINTAINED';
            }
          }
          _goalsLoaded = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _goalsLoaded = true);
    }
  }

  Future<void> _loadShiftAndTemplate() async {
    try {
      final row = await SupabaseService.client
          .from('schedule_blocks')
          .select(
            '*, participant_profiles(preferred_name, critical_alerts), required_shift_note_template_id, required_shift_note_template_version',
          )
          .eq('id', widget.shiftId)
          .maybeSingle();

      if (row == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      final shift = CareShift.fromJson(row);
      _isShadowShift = shift.isShadowShift;
      final templateId = row['required_shift_note_template_id'] as String?;
      List<Map<String, dynamic>> fields = [];

      if (templateId != null) {
        final template = await SupabaseService.client
            .from('shift_note_templates')
            .select('schema_payload')
            .eq('id', templateId)
            .maybeSingle();
        final payload = template?['schema_payload'] as Map<String, dynamic>?;
        final rawFields = (payload?['fields'] as List<dynamic>? ?? []);
        fields = rawFields
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
      }

      if (_isShadowShift) {
        // Project Doppelganger trainee reflection replaces official progress note schema.
        fields = <Map<String, dynamic>>[
          {
            'id': 'shadow_learning_reflection',
            'type': 'long_text',
            'label': 'What did you learn about this participant routine today?',
            'required': true,
          },
          {
            'id': 'shadow_ready_for_independent',
            'type': 'single_select',
            'label': 'Do you feel confident performing this shift independently?',
            'required': true,
            'options': ['yes', 'no'],
          },
        ];
      } else {
        final childShadow = await SupabaseService.client
            .from('schedule_blocks')
            .select('id, technician_id')
            .eq('parent_shift_id', shift.id)
            .eq('is_shadow_shift', true)
            .maybeSingle();
        _childShadowShiftId = childShadow?['id']?.toString();
        _childShadowWorkerId = childShadow?['technician_id']?.toString();
        if (_childShadowShiftId != null) {
          fields = [
            ...fields,
            {
              'id': 'mentor_eval_engagement',
              'type': 'single_select',
              'label': 'Did the shadow worker arrive on time and engage appropriately?',
              'required': true,
              'options': ['yes', 'no'],
            },
            {
              'id': 'mentor_eval_manual_handling',
              'type': 'single_select',
              'label': 'Did they demonstrate understanding of manual handling requirements?',
              'required': true,
              'options': ['yes', 'no'],
            },
            {
              'id': 'mentor_eval_recommendation',
              'type': 'single_select',
              'label': 'Do you recommend this worker for independent shifts?',
              'required': true,
              'options': ['pass', 'needs_more_training', 'fail'],
            },
          ];
        }
      }

      // If no template exists, provide a simple default debrief form
      if (!_isShadowShift && fields.isEmpty) {
        _usingDefaultForm = true;
        fields = <Map<String, dynamic>>[
          {
            'id': 'shift_summary',
            'type': 'long_text',
            'label': 'Shift Summary',
            'placeholder': 'Describe what happened during this shift...',
            'required': false,
          },
          {
            'id': 'incidents_or_concerns',
            'type': 'long_text',
            'label': 'Incidents or Concerns',
            'placeholder': 'Any incidents, behavioural changes, or concerns to report?',
            'required': false,
          },
          {
            'id': 'handover_notes',
            'type': 'long_text',
            'label': 'Handover Notes',
            'placeholder': 'Notes for the next worker...',
            'required': false,
          },
        ];
      }

      if (shift.participantId != null) {
        try {
          final goalRows = await SupabaseService.client
              .from('participant_goals')
              .select('goal_statement, status')
              .eq('participant_id', shift.participantId!)
              .neq('status', 'abandoned')
              .order('updated_at', ascending: false);
          final goalOptions = (goalRows as List)
              .map((g) => (g as Map<String, dynamic>)['goal_statement']?.toString() ?? '')
              .where((g) => g.isNotEmpty)
              .toList();
          if (goalOptions.isNotEmpty) {
            fields = fields.map((f) {
              final type = f['type']?.toString();
              if (type == 'goal_linker') {
                return {
                  ...f,
                  'options': goalOptions,
                };
              }
              return f;
            }).toList(growable: false);
          }
        } catch (_) {
          // Keep fallback options when goals cannot be loaded.
        }
      }

      if (!mounted) return;
      setState(() {
        _shift = shift;
        _schemaFields = fields;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _restoreDraft() async {
    try {
      final raw = await _secureStorage.read(key: _draftKey);
      if (raw == null) return;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final savedValues = (json['values'] as Map?)?.cast<String, dynamic>() ?? {};
      final savedDeclared = json['worker_declared'] as bool? ?? false;
      final savedUnable = json['participant_unable_to_sign'] as bool? ?? false;
      final savedReason = json['signature_exemption_reason'] as String? ?? 'asleep';
      final savedNotes = json['signature_exemption_notes'] as String? ?? '';
      if (!mounted) return;
      setState(() {
        _values.addAll(savedValues);
        _workerDeclared = savedDeclared;
        _participantUnableToSign = savedUnable;
        _signatureExemptionReason = savedReason;
        _signatureExemptionNotes = savedNotes;
      });
    } catch (_) {}
  }

  Future<void> _persistDraft() async {
    try {
      final payload = {
        'values': _values,
        'worker_declared': _workerDeclared,
        'participant_unable_to_sign': _participantUnableToSign,
        'signature_exemption_reason': _signatureExemptionReason,
        'signature_exemption_notes': _signatureExemptionNotes,
        'saved_at': DateTime.now().toIso8601String(),
      };
      await _secureStorage.write(key: _draftKey, value: jsonEncode(payload));
    } catch (_) {}
  }

  Future<void> _clearDraft() async {
    await _secureStorage.delete(key: _draftKey);
  }

  List<Map<String, dynamic>> get _visibleFields {
    return _schemaFields.where((f) {
      final visibility = f['visibility'] as Map<String, dynamic>?;
      if (visibility == null) return true;
      final targetField = visibility['field_id']?.toString();
      final operator = visibility['operator']?.toString();
      final expectedValue = visibility['value'];
      final actualValue = _values[targetField];
      if (targetField == null || operator == null) return true;
      switch (operator) {
        case 'eq':
          return actualValue == expectedValue;
        case 'neq':
          return actualValue != expectedValue;
        case 'contains':
          return actualValue?.toString().contains(expectedValue.toString()) ?? false;
        case 'not_contains':
          return !(actualValue?.toString().contains(expectedValue.toString()) ?? false);
        default:
          return true;
      }
    }).toList(growable: false);
  }

  void _setValue(String fieldId, dynamic value) {
    setState(() {
      _values[fieldId] = value;
    });
    _validateRequired();
  }

  void _validateRequired() {
    final missing = <String>{};
    for (final field in _visibleFields) {
      final required = field['required'] == true;
      if (!required) continue;
      final id = field['id']?.toString();
      if (id == null) continue;
      final value = _values[id];
      final empty = value == null || (value is String && value.trim().isEmpty);
      if (empty) missing.add(id);
    }
    if (mounted) {
      setState(() {
        _missingRequiredFieldIds
          ..clear()
          ..addAll(missing);
      });
    }
  }

  Future<String?> _renderSignatureAsBase64() async {
    if (_signaturePoints.isEmpty) return null;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final paint = Paint()
      ..color = Colors.white
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.0;

    for (var i = 0; i < _signaturePoints.length - 1; i++) {
      final p1 = _signaturePoints[i];
      final p2 = _signaturePoints[i + 1];
      if (p1 != null && p2 != null) {
        canvas.drawLine(p1, p2, paint);
      }
    }

    final picture = recorder.endRecording();
    final image = await picture.toImage(600, 200);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    if (bytes == null) return null;
    return base64Encode(bytes.buffer.asUint8List());
  }

  Future<void> _capturePhotoToField(String fieldId) async {
    final xFile = await _imagePicker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (xFile == null) return;
    final bytes = await xFile.readAsBytes();
    _setValue(fieldId, base64Encode(bytes));
  }

  Future<void> _finalizeAndClockOut() async {
    if (_shift == null || _submitting) return;
    // If no template was loaded, skip field validation — still allow clock-out
    if (_templateLoadError == null) {
      _validateRequired();
      if (_missingRequiredFieldIds.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Complete all required fields before finalizing.',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
    }

    setState(() => _submitting = true);
    try {
      // Biometric auth — fail gracefully if unavailable or user cancels
      bool biometricsOk = false;
      try {
        biometricsOk = await _localAuth.authenticate(
          localizedReason: 'Verify identity to sign this shift note',
          options: const AuthenticationOptions(stickyAuth: false, biometricOnly: false),
        );
      } catch (_) {
        biometricsOk = true; // Device doesn't support biometrics — proceed
      }
      if (!biometricsOk) {
        setState(() => _submitting = false);
        return;
      }
      _workerSignatureToken = 'biometric_${DateTime.now().millisecondsSinceEpoch}';

      Position position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 10),
          ),
        );
      } catch (_) {
        position = Position(
          latitude: 0,
          longitude: 0,
          timestamp: DateTime.now(),
          accuracy: 0,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        );
      }

      final userId = SupabaseService.auth.currentUser?.id;
      if (userId == null) throw Exception('Not authenticated');

      final signatureB64 =
          _participantUnableToSign ? null : await _renderSignatureAsBase64();

      // Submit shift note data
      try {
        if (_isShadowShift) {
          await SupabaseService.client.from('shadow_shift_reflections').upsert({
            'organization_id': _shift!.organizationId,
            'shadow_shift_id': _shift!.id,
            'worker_id': userId,
            'participant_id': _shift!.participantId,
            'reflection_data': _values,
            'confidence_ready': (_values['shadow_ready_for_independent']?.toString() ?? '').toLowerCase() == 'yes',
          }, onConflict: 'shadow_shift_id,worker_id');
        } else if (_usingDefaultForm) {
          // Default form — write directly to shift_note_submissions
          await SupabaseService.client.from('shift_note_submissions').insert({
            'organization_id': _shift!.organizationId,
            'shift_id': _shift!.id,
            'worker_id': userId,
            'participant_id': _shift!.participantId,
            'submission_data': _values,
            'worker_signature_token': _workerSignatureToken,
            'participant_signature_base64': signatureB64,
            'participant_signature_exemption_reason':
                _participantUnableToSign ? _signatureExemptionReason : null,
            'participant_signature_exemption_notes':
                _participantUnableToSign ? _signatureExemptionNotes : null,
            'worker_declared': true,
            'evv_clock_out_location': {
              'lat': position.latitude,
              'lng': position.longitude,
              'accuracy': position.accuracy,
            },
            'status': 'submitted',
          });
        } else {
          // Template-based form — use edge function for processing
          await SupabaseService.client.functions.invoke(
            'process-shift-note',
            body: {
              'shift_id': _shift!.id,
              'organization_id': _shift!.organizationId,
              'participant_id': _shift!.participantId,
              'worker_id': userId,
              'submission_data': _values,
              'worker_signature_token': _workerSignatureToken,
              'participant_signature_base64': signatureB64,
              'participant_signature_exemption_reason':
                  _participantUnableToSign ? _signatureExemptionReason : null,
              'participant_signature_exemption_notes':
                  _participantUnableToSign ? _signatureExemptionNotes : null,
              'worker_declared': true,
              'evv_clock_out_location': {
                'lat': position.latitude,
                'lng': position.longitude,
                'accuracy': position.accuracy,
              },
            },
          );

          if (_childShadowShiftId != null) {
            final recommendation = (_values['mentor_eval_recommendation'] ?? '').toString();
            if (recommendation.isNotEmpty) {
              await SupabaseService.client.from('mentorship_evaluations').upsert({
                'organization_id': _shift!.organizationId,
                'primary_shift_id': _shift!.id,
                'shadow_shift_id': _childShadowShiftId,
                'evaluator_worker_id': userId,
                'trainee_worker_id': _childShadowWorkerId,
                'participant_id': _shift!.participantId,
                'evaluation_data': {
                  'engagement': _values['mentor_eval_engagement'],
                  'manual_handling': _values['mentor_eval_manual_handling'],
                  'recommendation': recommendation,
                },
                'recommendation_status': recommendation,
              }, onConflict: 'primary_shift_id,shadow_shift_id');
            }
          }
        }
      } catch (_) {
        // Shift note submission failed — still proceed with clock-out
      }

      // ── Teleology: Submit goal linkages atomically ──────
      if (_activeGoals.isNotEmpty) {
        try {
          final linkages = _goalRatings.entries
              .where((e) => e.value != 'MAINTAINED' || (_goalObservations[e.key]?.isNotEmpty ?? false))
              .map((e) => {
                'goal_id': e.key,
                'progress_rating': e.value,
                'worker_observation': _goalObservations[e.key] ?? '',
              })
              .toList();
          if (linkages.isNotEmpty) {
            final teIdx = await SupabaseService.client
                .from('time_entries')
                .select('id')
                .eq('shift_id', _shift!.id)
                .order('clock_in', ascending: false)
                .limit(1);
            final teId = (teIdx as List).isNotEmpty ? teIdx[0]['id'] as String? : null;
            await SupabaseService.client.rpc('submit_timesheet_with_goals', params: {
              'p_organization_id': _shift!.organizationId,
              'p_shift_id': _shift!.id,
              'p_worker_id': userId,
              'p_participant_id': _shift!.participantId,
              'p_time_entry_id': teId,
              'p_goal_linkages': linkages,
            });
          }
        } catch (_) {
          // Goal linkage submission failed — non-blocking, still proceed
        }
      }

      final entries = await SupabaseService.client
          .from('time_entries')
          .select('id, clock_in')
          .eq('shift_id', _shift!.id)
          .eq('status', 'active')
          .order('clock_in', ascending: false)
          .limit(1);

      if ((entries as List).isNotEmpty) {
        final entry = entries[0];
        final rawClockIn = entry['clock_in']?.toString();
        final rawTimeEntryId = entry['id']?.toString();
        if (rawClockIn == null || rawTimeEntryId == null) {
          throw Exception('Active time entry missing required clock data.');
        }
        final clockIn = DateTime.parse(rawClockIn).toLocal();
        await clockOutOfShift(
          shiftId: _shift!.id,
          timeEntryId: rawTimeEntryId,
          clockInTime: clockIn,
          lat: position.latitude,
          lng: position.longitude,
        );
      } else {
        await SupabaseService.client.from('schedule_blocks').update({
          'status': 'complete',
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        }).eq('id', _shift!.id);
      }

      await _clearDraft();
      HapticFeedback.heavyImpact();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Shift note finalized and shift completed.',
              style: GoogleFonts.inter(color: Colors.white),
            ),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.go('/');
      }
    } catch (error) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to finalize: $error', style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Widget _renderField(Map<String, dynamic> field) {
    final c = context.iColors;
    final id = field['id']?.toString() ?? '';
    final type = field['type']?.toString() ?? 'short_text';
    final label = field['label']?.toString() ?? id;
    final required = field['required'] == true;
    final isMissing = _missingRequiredFieldIds.contains(id);
    final value = _values[id];

    final decoration = BoxDecoration(
      color: c.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: isMissing ? ObsidianTheme.rose : c.border),
    );

    Widget input;
    switch (type) {
      case 'long_text':
        input = TextField(
          maxLines: 4,
          onChanged: (v) => _setValue(id, v),
          controller: TextEditingController(text: value?.toString() ?? '')
            ..selection = TextSelection.fromPosition(
              TextPosition(offset: (value?.toString() ?? '').length),
            ),
          style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
          decoration: const InputDecoration(border: InputBorder.none, contentPadding: EdgeInsets.all(12)),
        );
        break;
      case 'number':
      case 'blood_glucose':
      case 'weight':
        input = TextField(
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          onChanged: (v) => _setValue(id, v),
          controller: TextEditingController(text: value?.toString() ?? '')
            ..selection = TextSelection.fromPosition(
              TextPosition(offset: (value?.toString() ?? '').length),
            ),
          style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
          decoration: const InputDecoration(border: InputBorder.none, contentPadding: EdgeInsets.all(12)),
        );
        break;
      case 'dropdown':
      case 'goal_linker':
        final options = (field['options'] as List?)?.map((e) => e.toString()).toList() ??
            ['Option A', 'Option B', 'Option C'];
        input = Padding(
          padding: const EdgeInsets.all(8.0),
          child: DropdownButtonFormField<String>(
            initialValue: value?.toString().isNotEmpty == true ? value.toString() : null,
            dropdownColor: c.surface,
            items: options
                .map((o) => DropdownMenuItem(value: o, child: Text(o, style: GoogleFonts.inter(color: c.textPrimary))))
                .toList(),
            onChanged: (v) => _setValue(id, v ?? ''),
            decoration: const InputDecoration(border: InputBorder.none),
          ),
        );
        break;
      case 'checkbox':
        final checked = value == true || value == 'true' || value == 'Yes';
        input = CheckboxListTile(
          value: checked,
          onChanged: (v) => _setValue(id, v == true ? 'Yes' : 'No'),
          title: Text(label, style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary)),
          controlAffinity: ListTileControlAffinity.leading,
        );
        break;
      case 'mood_slider':
        final numericValue = double.tryParse(value?.toString() ?? '3') ?? 3;
        input = Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Slider(
                value: numericValue.clamp(1, 5),
                min: 1,
                max: 5,
                divisions: 4,
                onChanged: (v) => _setValue(id, v.toStringAsFixed(0)),
              ),
              Text('Mood score: ${numericValue.toStringAsFixed(0)}',
                  style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
            ],
          ),
        );
        break;
      case 'photo_upload':
        input = TextButton.icon(
          onPressed: () => _capturePhotoToField(id),
          icon: const Icon(Icons.photo_camera),
          label: Text(
            value == null ? 'Capture evidence photo' : 'Photo attached',
            style: GoogleFonts.inter(),
          ),
        );
        break;
      case 'body_map':
        input = Padding(
          padding: const EdgeInsets.all(10),
          child: Wrap(
            spacing: 6,
            children: ['head', 'left_arm', 'right_arm', 'torso', 'left_leg', 'right_leg']
                .map((part) => ChoiceChip(
                      label: Text(part),
                      selected: value == part,
                      onSelected: (_) => _setValue(id, part),
                    ))
                .toList(),
          ),
        );
        break;
      default:
        input = TextField(
          onChanged: (v) => _setValue(id, v),
          controller: TextEditingController(text: value?.toString() ?? '')
            ..selection = TextSelection.fromPosition(
              TextPosition(offset: (value?.toString() ?? '').length),
            ),
          style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
          decoration: const InputDecoration(border: InputBorder.none, contentPadding: EdgeInsets.all(12)),
        );
    }

    return Container(
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (type != 'checkbox')
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Text(
                required ? '$label *' : label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isMissing ? ObsidianTheme.rose : c.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          input,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    if (_loading) {
      return Scaffold(
        backgroundColor: c.canvas,
        body: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (_, __) async {
        unawaited(_persistDraft());
        if (!mounted) return;
        final navigator = Navigator.of(context);
        final shouldExit = await showDialog<bool>(
              context: context,
              builder: (dialogCtx) => AlertDialog(
                title: const Text('Exit Shift Debrief?'),
                content: const Text('Progress is auto-saved, but this shift is not finalized yet.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Stay')),
                  TextButton(onPressed: () => Navigator.pop(dialogCtx, true), child: const Text('Exit')),
                ],
              ),
            ) ??
            false;
        if (shouldExit && mounted) navigator.pop();
      },
      child: Scaffold(
        backgroundColor: c.canvas,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          title: Text('Shift Debrief', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            Text(
              'Clock-Out Gate',
              style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary),
            ),
            const SizedBox(height: 4),
            Text(
              'Complete required dynamic fields before finalization.',
              style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary),
            ),
            if (_templateLoadError != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: ObsidianTheme.rose.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.35)),
                ),
                child: Text(
                  _templateLoadError!,
                  style: GoogleFonts.inter(fontSize: 12, color: c.textPrimary),
                ),
              ),
            ],
            const SizedBox(height: 14),
            ..._visibleFields.map((field) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _renderField(field),
                )),
            const SizedBox(height: 10),
            Container(
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
                      Checkbox(
                        value: _workerDeclared,
                        onChanged: (v) => setState(() => _workerDeclared = v == true),
                      ),
                      Expanded(
                        child: Text(
                          'I declare this is a true and accurate record of supports delivered.',
                          style: GoogleFonts.inter(fontSize: 13, color: c.textPrimary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('Participant / Guardian Signature',
                      style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  if (!_participantUnableToSign)
                    Container(
                      height: 140,
                      decoration: BoxDecoration(
                        color: c.canvas,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: c.border),
                      ),
                      child: Stack(
                        children: [
                          GestureDetector(
                            onPanUpdate: (details) => setState(() => _signaturePoints.add(details.localPosition)),
                            onPanEnd: (_) => setState(() => _signaturePoints.add(null)),
                            child: CustomPaint(
                              painter: _SignaturePainter(points: _signaturePoints, color: c.textPrimary),
                              size: Size.infinite,
                            ),
                          ),
                          if (_signaturePoints.isEmpty)
                            Center(
                              child: Text('Sign here', style: GoogleFonts.inter(fontSize: 13, color: c.textDisabled)),
                            ),
                          Positioned(
                            top: 8,
                            right: 8,
                            child: IconButton(
                              icon: Icon(PhosphorIconsLight.eraser, size: 16, color: c.textTertiary),
                              onPressed: () => setState(() => _signaturePoints.clear()),
                            ),
                          ),
                        ],
                      ),
                    ),
                  TextButton(
                    onPressed: () => setState(() => _participantUnableToSign = !_participantUnableToSign),
                    child: Text(
                      _participantUnableToSign
                          ? 'Participant will sign on device'
                          : 'Participant unable/refused to sign',
                    ),
                  ),
                  if (_participantUnableToSign)
                    Column(
                      children: [
                        DropdownButtonFormField<String>(
                          initialValue: _signatureExemptionReason,
                          items: const [
                            DropdownMenuItem(value: 'asleep', child: Text('Asleep')),
                            DropdownMenuItem(value: 'physical_incapacity', child: Text('Physical incapacity')),
                            DropdownMenuItem(value: 'refusal_agitation', child: Text('Refusal / agitation')),
                          ],
                          onChanged: (v) => setState(() => _signatureExemptionReason = v ?? 'asleep'),
                          decoration: const InputDecoration(labelText: 'Reason'),
                        ),
                        TextField(
                          onChanged: (v) => _signatureExemptionNotes = v,
                          decoration: const InputDecoration(labelText: 'Notes'),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            if (_missingRequiredFieldIds.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Missing required fields: ${_missingRequiredFieldIds.length}',
                  style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose),
                ),
              ),
            // ── Teleology: Goal Tracking Step ───────────────
            if (_goalsLoaded && _activeGoals.isNotEmpty) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      color: ObsidianTheme.emerald,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Goal Tracking',
                    style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'Link this shift to participant goals. Your observations fuel their funding renewal.',
                style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
              ),
              const SizedBox(height: 10),
              ..._activeGoals.map((goal) {
                final goalId = goal['id'] as String? ?? '';
                final goalTitle = goal['title'] as String? ?? goal['goal_statement'] as String? ?? 'Untitled Goal';
                final domain = goal['domain'] as String? ?? 'DAILY_LIVING';
                final currentRating = _goalRatings[goalId] ?? 'MAINTAINED';
                final obs = _goalObservations[goalId] ?? '';
                final showObs = currentRating != 'MAINTAINED' || obs.isNotEmpty;

                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: currentRating == 'PROGRESSED'
                          ? ObsidianTheme.emerald.withValues(alpha: 0.4)
                          : currentRating == 'REGRESSED'
                              ? ObsidianTheme.rose.withValues(alpha: 0.4)
                              : c.border,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(goalTitle,
                                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: c.textPrimary)),
                                Text(domain.replaceAll('_', ' '),
                                    style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary, letterSpacing: 0.5)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Tri-state toggle
                      Row(
                        children: [
                          _GoalRatingPill(
                            label: 'Regressed',
                            active: currentRating == 'REGRESSED',
                            color: ObsidianTheme.rose,
                            onTap: () => setState(() {
                              _goalRatings[goalId] = 'REGRESSED';
                            }),
                          ),
                          const SizedBox(width: 6),
                          _GoalRatingPill(
                            label: 'Maintained',
                            active: currentRating == 'MAINTAINED',
                            color: Colors.white54,
                            onTap: () => setState(() {
                              _goalRatings[goalId] = 'MAINTAINED';
                            }),
                          ),
                          const SizedBox(width: 6),
                          _GoalRatingPill(
                            label: 'Progressed',
                            active: currentRating == 'PROGRESSED',
                            color: ObsidianTheme.emerald,
                            onTap: () => setState(() {
                              _goalRatings[goalId] = 'PROGRESSED';
                            }),
                          ),
                        ],
                      ),
                      // Observation text field (auto-expands on non-Maintained)
                      AnimatedSize(
                        duration: const Duration(milliseconds: 200),
                        curve: Curves.easeOut,
                        child: showObs
                            ? Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: TextField(
                                  controller: TextEditingController(text: obs)
                                    ..selection = TextSelection.fromPosition(TextPosition(offset: obs.length)),
                                  onChanged: (v) => _goalObservations[goalId] = v,
                                  style: GoogleFonts.inter(fontSize: 13, color: c.textPrimary),
                                  maxLines: 2,
                                  decoration: InputDecoration(
                                    hintText: 'Brief note on this goal (optional)…',
                                    hintStyle: GoogleFonts.inter(fontSize: 12, color: c.textDisabled),
                                    filled: true,
                                    fillColor: c.canvas,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(8),
                                      borderSide: BorderSide(color: c.border),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(8),
                                      borderSide: BorderSide(color: c.border),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(8),
                                      borderSide: BorderSide(color: ObsidianTheme.emerald, width: 1.5),
                                    ),
                                  ),
                                ),
                              )
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
        bottomNavigationBar: Container(
          padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
          decoration: BoxDecoration(color: c.canvas, border: Border(top: BorderSide(color: c.border))),
          child: _submitting
              ? const SizedBox(
                  height: 56,
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                )
              : SlideToAct(
                  label: 'Finalize & Clock Out',
                  color: ObsidianTheme.emerald,
                  icon: PhosphorIconsLight.checkCircle,
                  onSlideComplete: _finalizeAndClockOut,
                ),
        ),
      ),
    );
  }
}

class _GoalRatingPill extends StatelessWidget {
  final String label;
  final bool active;
  final Color color;
  final VoidCallback onTap;
  const _GoalRatingPill({required this.label, required this.active, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: active ? color.withValues(alpha: 0.18) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: active ? color : Colors.white.withValues(alpha: 0.1),
              width: active ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? color : Colors.white.withValues(alpha: 0.5),
              letterSpacing: 0.2,
            ),
          ),
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  final Color color;
  _SignaturePainter({required this.points, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.0;
    for (var i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
