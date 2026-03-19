// ============================================================================
// Aegis SWMS — Dynamic SWMS & Geofenced Compliance Assessment
// ============================================================================
//
// Full-screen multi-step assessment flow:
//   0. Geofence Check   — Verify device is within 200m of job site
//   1. PPE Confirmation — Toggle-chip grid for required protective equipment
//   2. Site Conditions  — Yes/No site hazard questionnaire
//   3. Hazard Matrix    — L×C risk scoring with mitigation re-score
//   4. Stop Work        — Blocks if residual risk ≥ HIGH after mitigations
//   5. Digital Signature — Worker sign-off canvas
//   6. Complete         — Success confirmation with PDF generation trigger
// ============================================================================

import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ── Constants ────────────────────────────────────────────────────────────────

const _kGeofenceRadius = 200.0; // meters
const _kEmerald = Color(0xFF10B981);
const _kRose = Color(0xFFF43F5E);
const _kAmber = Color(0xFFF59E0B);
const _kYellow = Color(0xFFEAB308);

// ── Risk Rating ──────────────────────────────────────────────────────────────

enum RiskRating { low, medium, high, extreme }

RiskRating riskRatingFromScore(int score) {
  if (score <= 4) return RiskRating.low;
  if (score <= 12) return RiskRating.medium;
  if (score <= 19) return RiskRating.high;
  return RiskRating.extreme;
}

Color riskColor(RiskRating r) {
  switch (r) {
    case RiskRating.low:
      return _kEmerald;
    case RiskRating.medium:
      return _kYellow;
    case RiskRating.high:
      return _kAmber;
    case RiskRating.extreme:
      return _kRose;
  }
}

String riskLabel(RiskRating r) {
  switch (r) {
    case RiskRating.low:
      return 'LOW';
    case RiskRating.medium:
      return 'MEDIUM';
    case RiskRating.high:
      return 'HIGH';
    case RiskRating.extreme:
      return 'EXTREME';
  }
}

// ── PPE Item ─────────────────────────────────────────────────────────────────

class _PpeItem {
  final String key;
  final String label;
  final IconData icon;
  const _PpeItem(this.key, this.label, this.icon);
}

const _ppeItems = [
  _PpeItem('hard_hat', 'Hard Hat', PhosphorIconsLight.hardHat),
  _PpeItem('hi_vis', 'Hi-Vis Vest', PhosphorIconsLight.tShirt),
  _PpeItem('steel_caps', 'Steel Caps', PhosphorIconsLight.boot),
  _PpeItem('safety_glasses', 'Safety Glasses', PhosphorIconsLight.sunglasses),
  _PpeItem('hearing', 'Hearing Protection', PhosphorIconsLight.ear),
  _PpeItem('gloves', 'Insulated Gloves', PhosphorIconsLight.hand),
];

// ── Site Condition Questions ─────────────────────────────────────────────────

class _SiteQuestion {
  final String key;
  final String question;
  const _SiteQuestion(this.key, this.question);
}

const _siteQuestions = [
  _SiteQuestion('contractors_nearby', 'Other contractors working nearby?'),
  _SiteQuestion('working_heights', 'Working at heights?'),
  _SiteQuestion('confined_spaces', 'Confined spaces?'),
  _SiteQuestion('electrical_hazards', 'Electrical hazards present?'),
  _SiteQuestion('excavation_nearby', 'Excavation nearby?'),
];

// ── Hazard Definition ────────────────────────────────────────────────────────

class _HazardDef {
  final String key;
  final String name;
  final List<String> mitigations;
  const _HazardDef(this.key, this.name, this.mitigations);
}

const _standardHazards = [
  _HazardDef('falling_objects', 'Falling Objects', [
    'Establish exclusion zones',
    'Secure tools with lanyards',
    'Use protective netting',
  ]),
  _HazardDef('electrical', 'Electrical Contact', [
    'Isolate power supply',
    'Use insulated tools',
    'Verify lockout/tagout',
  ]),
  _HazardDef('manual_handling', 'Manual Handling', [
    'Use mechanical aids',
    'Two-person lift protocol',
    'Reduce load weight',
  ]),
  _HazardDef('slips_trips', 'Slips, Trips & Falls', [
    'Clear walkways',
    'Install temporary barriers',
    'Non-slip matting',
  ]),
  _HazardDef('confined_space', 'Confined Space', [
    'Atmospheric monitoring',
    'Buddy system required',
    'Rescue plan in place',
  ]),
  _HazardDef('heat_stress', 'Heat Stress', [
    'Scheduled rest breaks',
    'Hydration stations',
    'Shade structures',
  ]),
];

// ── Hazard State ─────────────────────────────────────────────────────────────

class _HazardState {
  int likelihood;
  int consequence;
  String? selectedMitigation;
  int? residualLikelihood;
  int? residualConsequence;

  _HazardState({this.likelihood = 1, this.consequence = 1});

  int get score => likelihood * consequence;
  RiskRating get rating => riskRatingFromScore(score);

  int? get residualScore =>
      (residualLikelihood != null && residualConsequence != null)
          ? residualLikelihood! * residualConsequence!
          : null;

  RiskRating? get residualRating =>
      residualScore != null ? riskRatingFromScore(residualScore!) : null;

  bool get requiresMitigation => score >= 13;

  bool get mitigationComplete =>
      !requiresMitigation ||
      (selectedMitigation != null && residualScore != null);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Screen ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

class SwmsAssessmentScreen extends ConsumerStatefulWidget {
  final String jobId;
  final String jobTitle;
  final String orgId;
  final double? jobLat;
  final double? jobLng;

  const SwmsAssessmentScreen({
    super.key,
    required this.jobId,
    required this.jobTitle,
    required this.orgId,
    this.jobLat,
    this.jobLng,
  });

  @override
  ConsumerState<SwmsAssessmentScreen> createState() =>
      _SwmsAssessmentScreenState();
}

class _SwmsAssessmentScreenState extends ConsumerState<SwmsAssessmentScreen>
    with TickerProviderStateMixin {
  // ── Step machine ───────────────────────────────────────
  int _step = 0;
  bool _submitting = false;
  String? _swmsRecordId;

  // Step 0: Geofence
  bool _geoChecking = true;
  double? _distanceMeters;
  bool _geoViolation = false;
  String? _geoError;

  // Step 1: PPE
  final Map<String, bool> _ppeConfirmed = {
    for (final item in _ppeItems) item.key: false,
  };

  // Step 2: Site Conditions
  final Map<String, bool?> _siteAnswers = {
    for (final q in _siteQuestions) q.key: null,
  };

  // Step 3: Hazard Matrix
  final Map<String, _HazardState> _hazards = {
    for (final h in _standardHazards) h.key: _HazardState(),
  };

  // Step 5: Signature
  final List<Offset?> _signaturePoints = [];
  final GlobalKey _signatureKey = GlobalKey();

  // ── Animation ──────────────────────────────────────────
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    _performGeofenceCheck();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 0: Geofence Check ────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Future<void> _performGeofenceCheck() async {
    if (widget.jobLat == null || widget.jobLng == null) {
      // No job coords — skip geofence, proceed
      setState(() {
        _geoChecking = false;
        _step = 1;
      });
      return;
    }

    try {
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        setState(() {
          _geoChecking = false;
          _geoError = 'Location permission denied. Cannot verify site presence.';
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      final dist = _haversineDistance(
        pos.latitude,
        pos.longitude,
        widget.jobLat!,
        widget.jobLng!,
      );

      setState(() {
        _geoChecking = false;
        _distanceMeters = dist;
        _geoViolation = dist > _kGeofenceRadius;
        if (!_geoViolation) _step = 1;
      });
    } catch (e) {
      setState(() {
        _geoChecking = false;
        _geoError = 'GPS unavailable: ${e.toString().substring(0, min(80, e.toString().length))}';
      });
    }
  }

  /// Haversine formula — returns distance in meters between two GPS points.
  double _haversineDistance(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const R = 6371000.0; // Earth radius in meters
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(_degToRad(lat1)) *
            cos(_degToRad(lat2)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  double _degToRad(double deg) => deg * (pi / 180);

  // ══════════════════════════════════════════════════════════════════════════
  // ── Validation Helpers ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  bool get _allPpeConfirmed => _ppeConfirmed.values.every((v) => v);

  bool get _allSiteQuestionsAnswered =>
      _siteAnswers.values.every((v) => v != null);

  bool get _allHazardsMitigated =>
      _hazards.values.every((h) => h.mitigationComplete);

  bool get _anyResidualHigh {
    for (final h in _hazards.values) {
      if (h.requiresMitigation && h.residualRating != null) {
        if (h.residualRating == RiskRating.high ||
            h.residualRating == RiskRating.extreme) {
          return true;
        }
      }
    }
    return false;
  }

  bool get _hasSignature => _signaturePoints.whereType<Offset>().length > 10;

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 6: Submission ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Future<void> _submitAssessment() async {
    setState(() => _submitting = true);
    HapticFeedback.heavyImpact();

    try {
      final user = SupabaseService.client.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      // 1. Save SWMS record
      final record = await SupabaseService.client
          .from('job_swms_records')
          .insert({
            'job_id': widget.jobId,
            'organization_id': widget.orgId,
            'assessed_by': user.id,
            'job_title': widget.jobTitle,
            'geofence_distance_m': _distanceMeters,
            'geofence_passed': !_geoViolation,
            'ppe_confirmed': _ppeConfirmed,
            'site_conditions': _siteAnswers,
            'hazards': _hazards.entries.map((e) {
              final h = e.value;
              return {
                'key': e.key,
                'likelihood': h.likelihood,
                'consequence': h.consequence,
                'score': h.score,
                'rating': riskLabel(h.rating),
                'mitigation': h.selectedMitigation,
                'residual_likelihood': h.residualLikelihood,
                'residual_consequence': h.residualConsequence,
                'residual_score': h.residualScore,
                'residual_rating': h.residualRating != null
                    ? riskLabel(h.residualRating!)
                    : null,
              };
            }).toList(),
            'status': 'completed',
            'signed_at': DateTime.now().toUtc().toIso8601String(),
          })
          .select('id')
          .single();

      final recordId = record['id'] as String;

      // 2. Save signature
      final sigBytes = await _captureSignature();
      if (sigBytes != null) {
        final sigPath = 'swms-signatures/$recordId/${user.id}.png';
        await SupabaseService.client.storage
            .from('documents')
            .uploadBinary(sigPath, sigBytes,
                fileOptions: const FileOptions(contentType: 'image/png'));

        await SupabaseService.client.from('job_swms_signatures').insert({
          'swms_record_id': recordId,
          'user_id': user.id,
          'signature_path': sigPath,
          'signed_at': DateTime.now().toUtc().toIso8601String(),
        });
      }

      // 3. Trigger PDF generation edge function
      await SupabaseService.client.functions.invoke(
        'generate-swms-pdf',
        body: {'swms_record_id': recordId},
      );

      setState(() {
        _submitting = false;
        _swmsRecordId = recordId;
        _step = 6;
      });
    } catch (e) {
      setState(() => _submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: _kRose.withValues(alpha: 0.9),
            content: Text(
              'Failed to save SWMS: ${e.toString().substring(0, min(100, e.toString().length))}',
              style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
            ),
          ),
        );
      }
    }
  }

  Future<Uint8List?> _captureSignature() async {
    if (!_hasSignature) return null;
    try {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      final paint = Paint()
        ..color = Colors.white
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      for (int i = 0; i < _signaturePoints.length - 1; i++) {
        if (_signaturePoints[i] != null && _signaturePoints[i + 1] != null) {
          canvas.drawLine(_signaturePoints[i]!, _signaturePoints[i + 1]!, paint);
        }
      }

      final picture = recorder.endRecording();
      final img = await picture.toImage(400, 200);
      final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Build ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(c),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                child: _buildCurrentStep(c),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────

  Widget _buildHeader(IWorkrColors c) {
    if (_step == 4 || _step == 6) return const SizedBox.shrink();

    final stepLabels = [
      'GEOFENCE CHECK',
      'PPE CONFIRMATION',
      'SITE CONDITIONS',
      'HAZARD MATRIX',
      'STOP WORK',
      'DIGITAL SIGNATURE',
      'COMPLETE',
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.of(context).pop(false),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: c.hoverBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(PhosphorIconsLight.x, color: c.textSecondary, size: 20),
                ),
              ),
              const Spacer(),
              Icon(PhosphorIconsBold.shieldCheck, color: _kEmerald, size: 24),
              const SizedBox(width: 8),
              Text(
                'SWMS',
                style: GoogleFonts.jetBrainsMono(
                  color: _kEmerald,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2,
                ),
              ),
              const Spacer(),
              const SizedBox(width: 36),
            ],
          ),
          const SizedBox(height: 14),
          // Step indicator
          Row(
            children: List.generate(7, (i) {
              final isActive = i == _step;
              final isDone = i < _step;
              return Expanded(
                child: Container(
                  height: 3,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    color: isDone
                        ? _kEmerald
                        : isActive
                            ? _kEmerald.withValues(alpha: 0.6)
                            : c.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          Text(
            _step < stepLabels.length ? stepLabels[_step] : '',
            style: GoogleFonts.jetBrainsMono(
              color: c.textTertiary,
              fontSize: 11,
              fontWeight: FontWeight.w500,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.jobTitle,
            style: GoogleFonts.inter(
              color: c.textSecondary,
              fontSize: 13,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  // ── Step Router ────────────────────────────────────────────────────────

  Widget _buildCurrentStep(IWorkrColors c) {
    switch (_step) {
      case 0:
        return _buildGeofenceStep(c);
      case 1:
        return _buildPpeStep(c);
      case 2:
        return _buildSiteConditionsStep(c);
      case 3:
        return _buildHazardMatrixStep(c);
      case 4:
        return _buildStopWorkStep(c);
      case 5:
        return _buildSignatureStep(c);
      case 6:
        return _buildCompleteStep(c);
      default:
        return const SizedBox.shrink();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 0: Geofence ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildGeofenceStep(IWorkrColors c) {
    if (_geoChecking) {
      return Center(
        key: const ValueKey('geo_checking'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: _kEmerald,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Verifying site presence…',
              style: GoogleFonts.inter(color: c.textSecondary, fontSize: 15),
            ),
            const SizedBox(height: 8),
            Text(
              'Acquiring GPS signal',
              style: GoogleFonts.jetBrainsMono(
                color: c.textTertiary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      );
    }

    if (_geoError != null) {
      return _buildGeoCenterCard(
        c,
        icon: PhosphorIconsBold.warning,
        iconColor: _kAmber,
        title: 'GPS ERROR',
        subtitle: _geoError!,
        actionLabel: 'RETRY',
        onAction: () {
          setState(() {
            _geoChecking = true;
            _geoError = null;
          });
          _performGeofenceCheck();
        },
      );
    }

    if (_geoViolation) {
      return _buildGeoCenterCard(
        c,
        icon: PhosphorIconsBold.mapPinX,
        iconColor: _kRose,
        title: 'GEOFENCE VIOLATION',
        subtitle:
            'You are ${_distanceMeters?.toStringAsFixed(0) ?? '?'}m from the job site.\nMaximum allowed: ${_kGeofenceRadius.toInt()}m.',
        actionLabel: 'RETRY LOCATION',
        onAction: () {
          setState(() {
            _geoChecking = true;
            _geoViolation = false;
          });
          _performGeofenceCheck();
        },
        isError: true,
      );
    }

    return const SizedBox.shrink(key: ValueKey('geo_pass'));
  }

  Widget _buildGeoCenterCard(
    IWorkrColors c, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onAction,
    bool isError = false,
  }) {
    return Center(
      key: ValueKey('geo_$title'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _pulseCtrl,
              builder: (_, child) {
                return Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: iconColor.withValues(
                        alpha: 0.08 + _pulseCtrl.value * 0.08),
                    border: Border.all(
                      color: iconColor.withValues(
                          alpha: 0.2 + _pulseCtrl.value * 0.3),
                      width: 2,
                    ),
                  ),
                  child: child,
                );
              },
              child: Icon(icon, color: iconColor, size: 36),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: GoogleFonts.jetBrainsMono(
                color: iconColor,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              subtitle,
              style: GoogleFonts.inter(color: c.textSecondary, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onAction,
                style: ElevatedButton.styleFrom(
                  backgroundColor:
                      isError ? _kRose.withValues(alpha: 0.15) : c.hoverBg,
                  foregroundColor: isError ? _kRose : c.textPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Text(
                  actionLabel,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 1: PPE Confirmation ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildPpeStep(IWorkrColors c) {
    return ListView(
      key: const ValueKey('step_ppe'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      children: [
        Text(
          'Confirm all required PPE before proceeding.',
          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 20),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 2.2,
          children: _ppeItems.map((item) {
            final confirmed = _ppeConfirmed[item.key] ?? false;
            return GestureDetector(
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _ppeConfirmed[item.key] = !confirmed);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: confirmed
                      ? _kEmerald.withValues(alpha: 0.10)
                      : c.hoverBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: confirmed
                        ? _kEmerald.withValues(alpha: 0.4)
                        : c.border,
                    width: confirmed ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      item.icon,
                      size: 22,
                      color: confirmed ? _kEmerald : c.textTertiary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        item.label,
                        style: GoogleFonts.inter(
                          color: confirmed ? c.textPrimary : c.textSecondary,
                          fontSize: 12,
                          fontWeight:
                              confirmed ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                    if (confirmed)
                      Icon(PhosphorIconsBold.checkCircle,
                          color: _kEmerald, size: 18),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 32),
        _buildNextButton(
          c,
          label: 'CONTINUE',
          enabled: _allPpeConfirmed,
          onTap: () => setState(() => _step = 2),
        ),
        if (!_allPpeConfirmed) ...[
          const SizedBox(height: 10),
          Text(
            'All PPE items must be confirmed',
            style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 2: Site Conditions ───────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildSiteConditionsStep(IWorkrColors c) {
    return ListView(
      key: const ValueKey('step_site'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      children: [
        Text(
          'Answer all site condition questions.',
          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 20),
        ..._siteQuestions.map((q) {
          final answer = _siteAnswers[q.key];
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: c.hoverBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: answer != null
                    ? (answer ? _kAmber.withValues(alpha: 0.3) : _kEmerald.withValues(alpha: 0.2))
                    : c.border,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    q.question,
                    style: GoogleFonts.inter(
                      color: c.textPrimary,
                      fontSize: 14,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                _buildYesNoChip(c, 'Yes', answer == true, () {
                  HapticFeedback.selectionClick();
                  setState(() => _siteAnswers[q.key] = true);
                }),
                const SizedBox(width: 6),
                _buildYesNoChip(c, 'No', answer == false, () {
                  HapticFeedback.selectionClick();
                  setState(() => _siteAnswers[q.key] = false);
                }),
              ],
            ),
          );
        }),
        const SizedBox(height: 28),
        _buildNextButton(
          c,
          label: 'CONTINUE',
          enabled: _allSiteQuestionsAnswered,
          onTap: () => setState(() => _step = 3),
        ),
      ],
    );
  }

  Widget _buildYesNoChip(
    IWorkrColors c,
    String label,
    bool selected,
    VoidCallback onTap,
  ) {
    final isYes = label == 'Yes';
    final activeColor = isYes ? _kAmber : _kEmerald;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? activeColor.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected ? activeColor.withValues(alpha: 0.5) : c.border,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            color: selected ? activeColor : c.textTertiary,
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 3: Hazard Matrix ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildHazardMatrixStep(IWorkrColors c) {
    return ListView(
      key: const ValueKey('step_hazard'),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        Text(
          'Assess each hazard. Slide to set Likelihood × Consequence.',
          style: GoogleFonts.inter(color: c.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 20),
        ..._standardHazards.map((def) => _buildHazardCard(c, def)),
        const SizedBox(height: 28),
        _buildNextButton(
          c,
          label: _anyResidualHigh ? 'REVIEW STOP WORK' : 'CONTINUE TO SIGN',
          enabled: _allHazardsMitigated,
          onTap: () {
            setState(() => _step = _anyResidualHigh ? 4 : 5);
          },
        ),
      ],
    );
  }

  Widget _buildHazardCard(IWorkrColors c, _HazardDef def) {
    final state = _hazards[def.key]!;
    final color = riskColor(state.rating);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Expanded(
                child: Text(
                  def.name,
                  style: GoogleFonts.inter(
                    color: c.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _buildRiskBadge(state.score, state.rating),
            ],
          ),
          const SizedBox(height: 16),
          // Likelihood slider
          _buildSliderRow(
            c,
            label: 'Likelihood',
            value: state.likelihood,
            onChanged: (v) => setState(() => state.likelihood = v),
          ),
          const SizedBox(height: 8),
          // Consequence slider
          _buildSliderRow(
            c,
            label: 'Consequence',
            value: state.consequence,
            onChanged: (v) => setState(() => state.consequence = v),
          ),
          // Mitigation section (if score ≥ 13)
          if (state.requiresMitigation) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _kAmber.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kAmber.withValues(alpha: 0.15)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MITIGATION REQUIRED',
                    style: GoogleFonts.jetBrainsMono(
                      color: _kAmber,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...def.mitigations.map((m) {
                    final isSelected = state.selectedMitigation == m;
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() {
                          state.selectedMitigation = m;
                          // Reset residual scores when changing mitigation
                          state.residualLikelihood ??= max(1, state.likelihood - 1);
                          state.residualConsequence ??= max(1, state.consequence - 1);
                        });
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? _kEmerald.withValues(alpha: 0.08)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isSelected
                                ? _kEmerald.withValues(alpha: 0.3)
                                : c.border,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isSelected
                                  ? PhosphorIconsBold.checkCircle
                                  : PhosphorIconsLight.circle,
                              color: isSelected ? _kEmerald : c.textTertiary,
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                m,
                                style: GoogleFonts.inter(
                                  color: isSelected
                                      ? c.textPrimary
                                      : c.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  // Residual risk sliders
                  if (state.selectedMitigation != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'RESIDUAL RISK',
                      style: GoogleFonts.jetBrainsMono(
                        color: c.textTertiary,
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildSliderRow(
                      c,
                      label: 'Likelihood',
                      value: state.residualLikelihood ?? 1,
                      onChanged: (v) =>
                          setState(() => state.residualLikelihood = v),
                    ),
                    const SizedBox(height: 6),
                    _buildSliderRow(
                      c,
                      label: 'Consequence',
                      value: state.residualConsequence ?? 1,
                      onChanged: (v) =>
                          setState(() => state.residualConsequence = v),
                    ),
                    const SizedBox(height: 8),
                    if (state.residualScore != null)
                      Row(
                        children: [
                          Text(
                            'Residual: ',
                            style: GoogleFonts.inter(
                              color: c.textTertiary,
                              fontSize: 12,
                            ),
                          ),
                          _buildRiskBadge(
                            state.residualScore!,
                            state.residualRating!,
                          ),
                        ],
                      ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSliderRow(
    IWorkrColors c, {
    required String label,
    required int value,
    required ValueChanged<int> onChanged,
  }) {
    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: GoogleFonts.inter(color: c.textSecondary, fontSize: 12),
          ),
        ),
        Expanded(
          child: SliderTheme(
            data: SliderThemeData(
              activeTrackColor: _kEmerald.withValues(alpha: 0.5),
              inactiveTrackColor: c.border,
              thumbColor: _kEmerald,
              overlayColor: _kEmerald.withValues(alpha: 0.1),
              trackHeight: 3,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
            ),
            child: Slider(
              value: value.toDouble(),
              min: 1,
              max: 5,
              divisions: 4,
              onChanged: (v) => onChanged(v.round()),
            ),
          ),
        ),
        SizedBox(
          width: 24,
          child: Text(
            '$value',
            style: GoogleFonts.jetBrainsMono(
              color: c.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildRiskBadge(int score, RiskRating rating) {
    final color = riskColor(rating);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$score',
            style: GoogleFonts.jetBrainsMono(
              color: color,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            riskLabel(rating),
            style: GoogleFonts.jetBrainsMono(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 4: Stop Work Authority ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildStopWorkStep(IWorkrColors c) {
    return AnimatedBuilder(
      key: const ValueKey('step_stop'),
      animation: _pulseCtrl,
      builder: (context, child) {
        return Container(
          width: double.infinity,
          height: double.infinity,
          decoration: BoxDecoration(
            color: _kRose.withValues(alpha: 0.03 + _pulseCtrl.value * 0.03),
            border: Border.all(
              color: _kRose.withValues(alpha: 0.15 + _pulseCtrl.value * 0.15),
              width: 3,
            ),
          ),
          child: child,
        );
      },
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _kRose.withValues(alpha: 0.12),
                  border: Border.all(color: _kRose.withValues(alpha: 0.3), width: 3),
                ),
                child: const Icon(PhosphorIconsBold.handPalm,
                    color: _kRose, size: 48),
              ),
              const SizedBox(height: 28),
              Text(
                'STOP WORK\nAUTHORITY',
                style: GoogleFonts.jetBrainsMono(
                  color: _kRose,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  height: 1.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                'One or more hazards remain HIGH or EXTREME\nafter mitigation controls.',
                style: GoogleFonts.inter(
                  color: c.textSecondary,
                  fontSize: 14,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Work MUST NOT proceed until risk is\nreduced to MEDIUM or below.',
                style: GoogleFonts.inter(
                  color: _kRose.withValues(alpha: 0.8),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => setState(() => _step = 3),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kRose.withValues(alpha: 0.12),
                    foregroundColor: _kRose,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                    side: BorderSide(color: _kRose.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    'REVISE HAZARD ASSESSMENT',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(
                  'Abort Assessment',
                  style: GoogleFonts.inter(
                    color: c.textTertiary,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 5: Digital Signature ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildSignatureStep(IWorkrColors c) {
    return ListView(
      key: const ValueKey('step_sign'),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      children: [
        Text(
          'By signing below, I acknowledge that I have read and understood this Safe Work Method Statement. '
          'I agree to follow the outlined procedures and control measures.',
          style: GoogleFonts.inter(
            color: c.textSecondary,
            fontSize: 13,
            height: 1.6,
          ),
        ),
        const SizedBox(height: 20),
        // Signature canvas
        Container(
          height: 200,
          decoration: BoxDecoration(
            color: c.hoverBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _hasSignature
                  ? _kEmerald.withValues(alpha: 0.3)
                  : c.border,
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(13),
            child: Stack(
              children: [
                // Canvas
                GestureDetector(
                  onPanStart: (d) {
                    setState(() => _signaturePoints.add(d.localPosition));
                  },
                  onPanUpdate: (d) {
                    setState(() => _signaturePoints.add(d.localPosition));
                  },
                  onPanEnd: (_) {
                    setState(() => _signaturePoints.add(null));
                  },
                  child: RepaintBoundary(
                    key: _signatureKey,
                    child: CustomPaint(
                      painter: _SignaturePainter(_signaturePoints),
                      size: const Size(double.infinity, 200),
                    ),
                  ),
                ),
                // Placeholder text
                if (!_hasSignature)
                  Center(
                    child: Text(
                      'Sign here',
                      style: GoogleFonts.inter(
                        color: c.textDisabled,
                        fontSize: 16,
                      ),
                    ),
                  ),
                // Clear button
                if (_signaturePoints.isNotEmpty)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() => _signaturePoints.clear());
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: c.border),
                        ),
                        child: Icon(PhosphorIconsLight.eraser,
                            color: c.textTertiary, size: 16),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 32),
        _buildNextButton(
          c,
          label: _submitting ? 'SUBMITTING…' : 'SUBMIT SWMS',
          enabled: _hasSignature && !_submitting,
          onTap: _submitAssessment,
          isPrimary: true,
        ),
      ],
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Step 6: Complete ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildCompleteStep(IWorkrColors c) {
    return Center(
      key: const ValueKey('step_complete'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _kEmerald.withValues(alpha: 0.10),
                border:
                    Border.all(color: _kEmerald.withValues(alpha: 0.3), width: 2),
              ),
              child: const Icon(PhosphorIconsBold.shieldCheck,
                  color: _kEmerald, size: 42),
            ),
            const SizedBox(height: 24),
            Text(
              'SWMS COMPLETE',
              style: GoogleFonts.jetBrainsMono(
                color: _kEmerald,
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Safe Work Method Statement has been recorded\nand PDF is being generated.',
              style: GoogleFonts.inter(
                color: c.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (_swmsRecordId != null) ...[
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: c.hoverBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: c.border),
                ),
                child: Text(
                  'REF: ${_swmsRecordId!.substring(0, min(8, _swmsRecordId!.length)).toUpperCase()}',
                  style: GoogleFonts.jetBrainsMono(
                    color: c.textTertiary,
                    fontSize: 12,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 36),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kEmerald,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(PhosphorIconsBold.arrowLeft, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'RETURN TO JOB',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Shared Widgets ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  Widget _buildNextButton(
    IWorkrColors c, {
    required String label,
    required bool enabled,
    required VoidCallback onTap,
    bool isPrimary = false,
  }) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: enabled ? onTap : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: enabled
              ? (isPrimary ? _kEmerald : _kEmerald.withValues(alpha: 0.12))
              : c.hoverBg,
          foregroundColor: enabled
              ? (isPrimary ? Colors.white : _kEmerald)
              : c.textDisabled,
          disabledBackgroundColor: c.hoverBg,
          disabledForegroundColor: c.textDisabled,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
          side: enabled && !isPrimary
              ? BorderSide(color: _kEmerald.withValues(alpha: 0.3))
              : BorderSide.none,
        ),
        child: Text(
          label,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.5,
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Signature Painter ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  _SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_SignaturePainter oldDelegate) => true;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Navigation Helper ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/// Opens the SWMS Assessment as a full-screen blocking modal.
/// Returns `true` if the assessment was completed successfully.
Future<bool> showSwmsAssessment(
  BuildContext context, {
  required String jobId,
  required String jobTitle,
  required String orgId,
  double? jobLat,
  double? jobLng,
}) {
  return Navigator.of(context, rootNavigator: true)
      .push<bool>(
        PageRouteBuilder<bool>(
          opaque: true,
          pageBuilder: (_, __, ___) => SwmsAssessmentScreen(
            jobId: jobId,
            jobTitle: jobTitle,
            orgId: orgId,
            jobLat: jobLat,
            jobLng: jobLng,
          ),
          transitionsBuilder: (_, animation, __, child) => FadeTransition(
            opacity: animation,
            child: child,
          ),
          transitionDuration: const Duration(milliseconds: 400),
        ),
      )
      .then((v) => v ?? false);
}
