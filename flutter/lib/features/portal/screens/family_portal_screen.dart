import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/brand_cache_service.dart';

// ═══════════════════════════════════════════════════════════════════════════
// Models
// ═══════════════════════════════════════════════════════════════════════════

class HearthBudgetTelemetry {
  final double totalBudget;
  final double invoiced;
  final double unbilledWip;
  final double remaining;
  final double burnRatePct;
  final double proRataPct;
  final String burnStatus; // on_track | over_burning | critical | depleted
  final HearthNextShift? nextShift;

  HearthBudgetTelemetry({
    required this.totalBudget,
    required this.invoiced,
    required this.unbilledWip,
    required this.remaining,
    required this.burnRatePct,
    required this.proRataPct,
    required this.burnStatus,
    this.nextShift,
  });

  factory HearthBudgetTelemetry.fromJson(Map<String, dynamic> json) {
    return HearthBudgetTelemetry(
      totalBudget: (json['total_budget'] as num?)?.toDouble() ?? 0,
      invoiced: (json['invoiced'] as num?)?.toDouble() ?? 0,
      unbilledWip: (json['unbilled_wip'] as num?)?.toDouble() ?? 0,
      remaining: (json['remaining'] as num?)?.toDouble() ?? 0,
      burnRatePct: (json['burn_rate_pct'] as num?)?.toDouble() ?? 0,
      proRataPct: (json['pro_rata_pct'] as num?)?.toDouble() ?? 50,
      burnStatus: json['burn_status'] as String? ?? 'on_track',
      nextShift: json['next_shift'] != null
          ? HearthNextShift.fromJson(json['next_shift'] as Map<String, dynamic>)
          : null,
    );
  }
}

class HearthNextShift {
  final String id;
  final DateTime startTime;
  final DateTime endTime;
  final String workerName;
  final String? workerAvatar;
  final String workerFirstName;
  final String? publicNote;

  HearthNextShift({
    required this.id,
    required this.startTime,
    required this.endTime,
    required this.workerName,
    this.workerAvatar,
    required this.workerFirstName,
    this.publicNote,
  });

  factory HearthNextShift.fromJson(Map<String, dynamic> json) {
    return HearthNextShift(
      id: json['id'] as String,
      startTime: DateTime.parse(json['start_time'] as String).toLocal(),
      endTime: DateTime.parse(json['end_time'] as String).toLocal(),
      workerName: json['worker_name'] as String? ?? 'Support Worker',
      workerAvatar: json['worker_avatar'] as String?,
      workerFirstName: json['worker_first_name'] as String? ?? '',
      publicNote: json['public_note'] as String?,
    );
  }
}

class HearthPortalShift {
  final String id;
  final DateTime startTime;
  final DateTime endTime;
  final String status;
  final String? shiftNote;
  final bool clientApproved;
  final DateTime? clientApprovedAt;
  final String? workerName;
  final String? workerAvatar;
  final double? billableHours;

  HearthPortalShift({
    required this.id,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.shiftNote,
    required this.clientApproved,
    this.clientApprovedAt,
    this.workerName,
    this.workerAvatar,
    this.billableHours,
  });

  factory HearthPortalShift.fromJson(Map<String, dynamic> json) {
    return HearthPortalShift(
      id: json['id'] as String,
      startTime: DateTime.parse(json['start_time'] as String).toLocal(),
      endTime: DateTime.parse(json['end_time'] as String).toLocal(),
      status: json['status'] as String? ?? 'scheduled',
      shiftNote: json['shift_note'] as String?,
      clientApproved: json['client_approved'] as bool? ?? false,
      clientApprovedAt: json['client_approved_at'] != null
          ? DateTime.parse(json['client_approved_at'] as String).toLocal()
          : null,
      workerName: json['worker_name'] as String?,
      workerAvatar: json['worker_avatar'] as String?,
      billableHours: (json['billable_hours'] as num?)?.toDouble(),
    );
  }

  bool get needsApproval => !clientApproved && status == 'complete';
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants & Theme
// ═══════════════════════════════════════════════════════════════════════════

const _kBg = Color(0xFF050505);
const _kSurface = Color(0xFF0A0A0A);
const _kSurface2 = Color(0xFF141414);
const _kBorder = Color(0x14FFFFFF);
const _kTextPrimary = Colors.white;
const _kTextSecondary = Color(0xFFD4D4D8);
const _kTextMuted = Color(0xFF71717A);
const _kEmerald = Color(0xFF10B981);
const _kAmber = Color(0xFFF59E0B);
const _kRose = Color(0xFFF43F5E);
const _kMono = 'JetBrainsMono'; // reserved for potential direct font family references
// ignore: unused_element

TextStyle _monoStyle(double size, Color color, {FontWeight weight = FontWeight.normal}) {
  return GoogleFonts.jetBrainsMono(fontSize: size, color: color, fontWeight: weight);
}

TextStyle _interStyle(double size, Color color, {FontWeight weight = FontWeight.normal}) {
  return TextStyle(fontFamily: 'Inter', fontSize: size, color: color, fontWeight: weight);
}

Color _burnColor(String burnStatus) {
  switch (burnStatus) {
    case 'on_track': return _kEmerald;
    case 'over_burning': return _kAmber;
    case 'critical':
    case 'depleted': return _kRose;
    default: return _kTextMuted;
  }
}

String _formatAUD(double val) {
  return '\$${val.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
}

String _formatTime(DateTime dt) {
  final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final min = dt.minute.toString().padLeft(2, '0');
  final amPm = dt.hour < 12 ? 'AM' : 'PM';
  return '$hour:$min $amPm';
}

String _formatDateShort(DateTime dt) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${days[dt.weekday - 1]} ${dt.day} ${months[dt.month - 1]}';
}

// ═══════════════════════════════════════════════════════════════════════════
// Budget Gauge Painter
// ═══════════════════════════════════════════════════════════════════════════

class _BudgetGaugePainter extends CustomPainter {
  final double burnPct;
  final double proPct;
  final Color burnColor;

  _BudgetGaugePainter({
    required this.burnPct,
    required this.proPct,
    required this.burnColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final radius = (size.width / 2) - 10;
    const startAngle = -math.pi / 2;

    // Track
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      0, 2 * math.pi, false,
      Paint()
        ..color = const Color(0x0AFFFFFF)
        ..strokeWidth = 10
        ..style = PaintingStyle.stroke,
    );

    // Pro-rata ghost line
    final proSweep = 2 * math.pi * (proPct / 100);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      startAngle, proSweep, false,
      Paint()
        ..color = Colors.white.withOpacity(0.12)
        ..strokeWidth = 3
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );

    // Burn rate arc
    final burnSweep = 2 * math.pi * (burnPct / 100);
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      startAngle, burnSweep, false,
      Paint()
        ..color = burnColor
        ..strokeWidth = 10
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, burnColor == _kEmerald ? 4 : 6),
    );

    // Inner draw without blur
    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: radius),
      startAngle, burnSweep, false,
      Paint()
        ..color = burnColor
        ..strokeWidth = 10
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_BudgetGaugePainter old) =>
    old.burnPct != burnPct || old.proPct != proPct;
}

// ═══════════════════════════════════════════════════════════════════════════
// Timesheet Approval Bottom Sheet
// ═══════════════════════════════════════════════════════════════════════════

class _TimesheetApprovalSheet extends StatefulWidget {
  final HearthPortalShift shift;
  final Color brandColor;
  final VoidCallback onApproved;

  const _TimesheetApprovalSheet({
    required this.shift,
    required this.brandColor,
    required this.onApproved,
  });

  @override
  State<_TimesheetApprovalSheet> createState() => _TimesheetApprovalSheetState();
}

class _TimesheetApprovalSheetState extends State<_TimesheetApprovalSheet> {
  bool _approving = false;
  bool _approved = false;

  Future<void> _approve() async {
    setState(() => _approving = true);
    HapticFeedback.mediumImpact();
    try {
      final result = await SupabaseService.client.rpc(
        'client_approve_shift',
        params: {
          'p_shift_id': widget.shift.id,
          'p_device_info': 'Flutter Mobile',
        },
      );
      if (result != null && result['ok'] == true) {
        setState(() { _approved = true; _approving = false; });
        HapticFeedback.heavyImpact();
        await Future.delayed(const Duration(milliseconds: 1200));
        if (mounted) {
          widget.onApproved();
          Navigator.pop(context);
        }
      } else {
        throw Exception(result?['error'] ?? 'Approval failed');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _approving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: _kRose),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final shift = widget.shift;
    final durationHrs = shift.endTime.difference(shift.startTime).inMinutes / 60.0;

    return Container(
      decoration: const BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: _kBorder)),
      ),
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: const Color(0xFF3F3F46), borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 20),

          // Header
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: widget.brandColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.schedule_rounded, size: 18, color: widget.brandColor),
            ),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Timesheet Approval', style: _interStyle(15, _kTextPrimary, weight: FontWeight.w600)),
              Text('Review and approve your support shift', style: _interStyle(11, _kTextMuted)),
            ]),
          ]),
          const SizedBox(height: 20),

          // Ledger
          Container(
            decoration: BoxDecoration(
              color: _kSurface2,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              if (shift.workerName != null)
                _LedgerRow(label: 'Worker', value: shift.workerName!, mono: false),
              _LedgerRow(
                label: 'Date',
                value: _formatDateShort(shift.startTime),
                mono: false,
              ),
              _LedgerRow(
                label: 'Start Time',
                value: _formatTime(shift.startTime),
              ),
              _LedgerRow(
                label: 'End Time',
                value: _formatTime(shift.endTime),
              ),
              const Divider(color: _kBorder, height: 20),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text('DURATION', style: _interStyle(10, _kTextMuted)),
                Text(
                  '${durationHrs.toStringAsFixed(1)} Hours',
                  style: _monoStyle(20, _kTextPrimary, weight: FontWeight.bold),
                ),
              ]),
            ]),
          ),

          // Shift note
          if (shift.shiftNote != null && shift.shiftNote!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _kSurface2,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kBorder),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Shift Note', style: _interStyle(10, _kTextMuted)),
                const SizedBox(height: 4),
                Text(
                  '"${shift.shiftNote}"',
                  style: _interStyle(13, const Color(0xFFD4D4D8)).copyWith(fontStyle: FontStyle.italic),
                ),
              ]),
            ),
          ],

          const SizedBox(height: 20),

          // Actions
          if (_approved)
            Container(
              width: double.infinity, height: 52,
              decoration: BoxDecoration(
                color: _kEmerald.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kEmerald.withOpacity(0.3)),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.check_circle_rounded, color: _kEmerald, size: 20),
                const SizedBox(width: 8),
                Text('Approved!', style: _interStyle(14, _kEmerald, weight: FontWeight.w600)),
              ]),
            )
          else
            Column(children: [
              SizedBox(
                width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _approving ? null : _approve,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.brandColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: _approving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text('Sign & Approve Timesheet', style: _interStyle(14, Colors.white, weight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity, height: 44,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kRose,
                    side: BorderSide(color: _kRose.withOpacity(0.3)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('Dispute Time', style: _interStyle(13, _kRose)),
                ),
              ),
            ]),
        ],
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  const _LedgerRow({required this.label, required this.value, this.mono = true});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: _interStyle(11, _kTextMuted)),
        mono
          ? Text(value, style: _monoStyle(13, _kTextSecondary))
          : Text(value, style: _interStyle(13, _kTextSecondary)),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Hearth Screen
// ═══════════════════════════════════════════════════════════════════════════

class FamilyPortalScreen extends StatefulWidget {
  const FamilyPortalScreen({super.key});

  @override
  State<FamilyPortalScreen> createState() => _FamilyPortalScreenState();
}

class _FamilyPortalScreenState extends State<FamilyPortalScreen>
    with SingleTickerProviderStateMixin {
  int _tab = 0;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _participants = [];
  String? _activeParticipantId;
  String _activeParticipantName = '';
  HearthBudgetTelemetry? _telemetry;
  List<HearthPortalShift> _roster = [];
  Color _brandColor = _kEmerald;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(duration: const Duration(milliseconds: 500), vsync: this);
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _loadBrand();
    _load();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBrand() async {
    try {
      final brand = await BrandCacheService.restore();
      if (brand != null && mounted) {
        setState(() => _brandColor = brand.primary);
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final user = SupabaseService.auth.currentUser;
    if (user == null) {
      setState(() { _loading = false; _error = 'Not authenticated'; });
      return;
    }
    try {
      final links = await SupabaseService.client
          .from('participant_network_members')
          .select('participant_id, display_name, relationship_type, participant_profiles!inner(id, preferred_name, clients!inner(name))')
          .eq('user_id', user.id)
          .eq('is_active', true);

      final mapped = (links as List).map((row) {
        final pp = row['participant_profiles'] as Map<String, dynamic>;
        final client = pp['clients'] as Map<String, dynamic>?;
        final name = (pp['preferred_name'] as String?) ??
          (client?['name'] as String?) ?? 'Participant';
        return {
          'participant_id': row['participant_id'] as String,
          'participant_name': name,
          'display_name': row['display_name'] as String?,
          'relationship_type': row['relationship_type'] as String? ?? 'guardian',
        };
      }).toList();

      final active = mapped.isNotEmpty ? mapped.first['participant_id'] as String : null;
      final activeName = mapped.isNotEmpty ? mapped.first['participant_name'] as String : '';

      setState(() {
        _participants = mapped.cast<Map<String, dynamic>>();
        _activeParticipantId = active;
        _activeParticipantName = activeName;
      });

      if (active != null) {
        await _loadParticipantData(active);
      }
    } catch (e) {
      setState(() { _loading = false; _error = 'Failed to load portal'; });
    }
  }

  Future<void> _loadParticipantData(String participantId) async {
    setState(() { _loading = true; });
    try {
      // Budget telemetry via RPC
      final telRes = await SupabaseService.client.rpc(
        'get_hearth_budget_telemetry',
        params: {'p_participant_id': participantId},
      );
      HearthBudgetTelemetry? telemetry;
      if (telRes != null && telRes['ok'] == true) {
        telemetry = HearthBudgetTelemetry.fromJson(telRes as Map<String, dynamic>);
      }

      // Roster via RPC
      final rosterRes = await SupabaseService.client.rpc(
        'get_portal_roster',
        params: {
          'p_participant_id': participantId,
          'p_from': DateTime.now().subtract(const Duration(days: 7)).toUtc().toIso8601String(),
          'p_to': DateTime.now().add(const Duration(days: 14)).toUtc().toIso8601String(),
        },
      );
      List<HearthPortalShift> roster = [];
      if (rosterRes != null) {
        roster = (rosterRes as List).map((s) => HearthPortalShift.fromJson(s as Map<String, dynamic>)).toList();
      }

      setState(() {
        _telemetry = telemetry;
        _roster = roster;
        _loading = false;
      });
      _fadeCtrl.forward(from: 0);
    } catch (e) {
      setState(() { _loading = false; _error = 'Failed to load data'; });
    }
  }

  void _switchParticipant(String participantId) {
    final p = _participants.firstWhere((x) => x['participant_id'] == participantId, orElse: () => {});
    setState(() {
      _activeParticipantId = participantId;
      _activeParticipantName = p['participant_name'] as String? ?? '';
    });
    _loadParticipantData(participantId);
  }

  void _openApprovalSheet(HearthPortalShift shift) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TimesheetApprovalSheet(
        shift: shift,
        brandColor: _brandColor,
        onApproved: () => _loadParticipantData(_activeParticipantId!),
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        child: Column(children: [
          _buildHeader(),
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator(color: _kEmerald, strokeWidth: 2))
              : _error != null
                ? _buildError()
                : FadeTransition(opacity: _fadeAnim, child: _buildBody()),
          ),
        ]),
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
      decoration: const BoxDecoration(
        color: _kBg,
        border: Border(bottom: BorderSide(color: _kBorder)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              '${_greeting()},',
              style: _interStyle(13, _kTextMuted),
            ),
            Text(
              _activeParticipantName.isNotEmpty ? _activeParticipantName : 'Loading…',
              style: _interStyle(22, _kTextPrimary, weight: FontWeight.w300),
            ),
          ]),
        ),
        if (_participants.length > 1)
          GestureDetector(
            onTap: _showParticipantSwitcher,
            child: Container(
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: _kSurface2,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _kBorder),
              ),
              child: Row(children: [
                Text('Switch', style: _interStyle(11, _kTextMuted)),
                const SizedBox(width: 4),
                const Icon(Icons.unfold_more_rounded, size: 14, color: Color(0xFF71717A)),
              ]),
            ),
          ),
      ]),
    );
  }

  void _showParticipantSwitcher() {
    showModalBottomSheet(
      context: context,
      backgroundColor: _kSurface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(width: 36, height: 4, decoration: BoxDecoration(color: _kSurface2, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          ..._participants.map((p) => ListTile(
            title: Text(p['participant_name'] as String? ?? '', style: _interStyle(14, _kTextPrimary)),
            subtitle: Text((p['relationship_type'] as String? ?? '').replaceAll('_', ' '), style: _interStyle(11, _kTextMuted)),
            trailing: _activeParticipantId == p['participant_id']
              ? Icon(Icons.check_circle_rounded, color: _brandColor, size: 18)
              : null,
            onTap: () {
              Navigator.pop(context);
              _switchParticipant(p['participant_id'] as String);
            },
          )),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline_rounded, color: _kRose, size: 32),
        const SizedBox(height: 12),
        Text(_error!, style: _interStyle(13, _kTextMuted)),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _load,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              color: _kSurface2, borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _kBorder),
            ),
            child: Text('Retry', style: _interStyle(12, _kTextPrimary)),
          ),
        ),
      ]),
    );
  }

  Widget _buildBody() {
    switch (_tab) {
      case 0: return _buildHomeTab();
      case 1: return _buildRosterTab();
      case 2: return _buildBudgetTab();
      default: return _buildHomeTab();
    }
  }

  // ── HOME TAB ─────────────────────────────────────────────────────────────

  Widget _buildHomeTab() {
    final pendingApprovals = _roster.where((s) => s.needsApproval).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      children: [
        // Pending approvals banner
        if (pendingApprovals.isNotEmpty) ...[
          _buildApprovalBanner(pendingApprovals),
          const SizedBox(height: 16),
        ],

        // Telemetry ribbon
        if (_telemetry != null) ...[
          _buildTelemetryRibbon(),
          const SizedBox(height: 16),
        ],

        // Who Is Coming card
        _buildWhoIsComingCard(),
        const SizedBox(height: 16),

        // Recent shifts
        if (_roster.isNotEmpty) ...[
          Text('Recent Shifts', style: _interStyle(11, _kTextMuted)),
          const SizedBox(height: 8),
          ..._roster
            .where((s) => s.startTime.isBefore(DateTime.now().add(const Duration(hours: 4))))
            .take(4)
            .map(_buildShiftRow),
        ],
      ],
    );
  }

  Widget _buildApprovalBanner(List<HearthPortalShift> pending) {
    return GestureDetector(
      onTap: () => _openApprovalSheet(pending.first),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _kAmber.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kAmber.withOpacity(0.25)),
        ),
        child: Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: _kAmber.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.pending_actions_rounded, color: _kAmber, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                '${pending.length} timesheet${pending.length > 1 ? 's' : ''} awaiting your approval',
                style: _interStyle(12, _kAmber, weight: FontWeight.w500),
              ),
              const SizedBox(height: 2),
              Text(
                'Tap to review and sign off on ${pending.first.workerName ?? "your support worker"}\u2019s shift',
                style: _interStyle(10, _kTextMuted),
              ),
            ]),
          ),
          const Icon(Icons.chevron_right_rounded, color: _kAmber, size: 18),
        ]),
      ),
    );
  }

  Widget _buildTelemetryRibbon() {
    final t = _telemetry!;
    final burnColor = _burnColor(t.burnStatus);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        _TelemetryCard(
          label: 'Remaining Budget',
          value: _formatAUD(t.remaining),
          color: burnColor,
        ),
        const SizedBox(width: 10),
        _TelemetryCard(
          label: 'Burn Rate',
          value: '${t.burnRatePct.toStringAsFixed(1)}%',
          color: burnColor,
          subtitle: t.burnStatus == 'over_burning'
            ? 'Warning: Over schedule'
            : t.burnStatus == 'depleted'
              ? 'Funds depleted'
              : 'On track',
        ),
        const SizedBox(width: 10),
        _TelemetryCard(
          label: 'Unbilled WIP',
          value: _formatAUD(t.unbilledWip),
          color: _kTextMuted,
        ),
      ]),
    );
  }

  Widget _buildWhoIsComingCard() {
    final next = _telemetry?.nextShift;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_kSurface, _kSurface2],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('NEXT SCHEDULED SUPPORT', style: _interStyle(9, _kTextMuted).copyWith(letterSpacing: 1.5)),
          const Spacer(),
          Container(
            width: 6, height: 6,
            decoration: BoxDecoration(color: _kEmerald, borderRadius: BorderRadius.circular(3),
              boxShadow: [BoxShadow(color: _kEmerald.withOpacity(0.6), blurRadius: 6)]),
          ),
        ]),
        const SizedBox(height: 14),
        if (next == null)
          Text('No upcoming shifts scheduled', style: _interStyle(13, _kTextMuted))
        else ...[
          Text(
            '${_formatDateShort(next.startTime)} · ${_formatTime(next.startTime)} — ${_formatTime(next.endTime)}',
            style: _monoStyle(14, _kTextPrimary),
          ),
          const SizedBox(height: 14),
          Row(children: [
            if (next.workerAvatar != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: Image.network(next.workerAvatar!, width: 56, height: 56, fit: BoxFit.cover),
              )
            else
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  color: _kSurface2,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: _kBorder),
                ),
                child: Center(
                  child: Text(
                    next.workerName.isNotEmpty ? next.workerName[0].toUpperCase() : '?',
                    style: _interStyle(20, _kTextSecondary, weight: FontWeight.w600),
                  ),
                ),
              ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  next.workerFirstName.isNotEmpty ? next.workerFirstName : next.workerName,
                  style: _interStyle(18, _kTextPrimary, weight: FontWeight.w500),
                ),
                const SizedBox(height: 4),
                Row(children: [
                  ...List.generate(5, (i) => Padding(
                    padding: const EdgeInsets.only(right: 2),
                    child: Icon(i < 4 ? Icons.star_rounded : Icons.star_border_rounded,
                      color: _kAmber, size: 14),
                  )),
                  const SizedBox(width: 4),
                  Text('4.9 / 5', style: _monoStyle(11, _kTextMuted)),
                ]),
                const SizedBox(height: 2),
                Text('Verified First Aid & CPR', style: _interStyle(10, _kTextMuted)),
              ]),
            ),
          ]),
          if (next.publicNote != null && next.publicNote!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('"${next.publicNote}"',
              style: _interStyle(12, _kTextMuted).copyWith(fontStyle: FontStyle.italic)),
          ],
        ],
      ]),
    );
  }

  Widget _buildShiftRow(HearthPortalShift shift) {
    return GestureDetector(
      onTap: shift.needsApproval ? () => _openApprovalSheet(shift) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: shift.needsApproval ? _kAmber.withOpacity(0.2) : _kBorder,
          ),
        ),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(shift.workerName ?? 'Support Worker', style: _interStyle(12, _kTextSecondary)),
            const SizedBox(height: 2),
            Text(
              '${_formatDateShort(shift.startTime)} · ${_formatTime(shift.startTime)}',
              style: _monoStyle(10, _kTextMuted),
            ),
          ])),
          if (shift.billableHours != null)
            Text('${shift.billableHours!.toStringAsFixed(1)}h', style: _monoStyle(11, _kTextMuted)),
          const SizedBox(width: 8),
          if (shift.clientApproved)
            const Icon(Icons.check_circle_rounded, color: _kEmerald, size: 16)
          else if (shift.needsApproval)
            Icon(Icons.pending_actions_rounded, color: _kAmber, size: 16)
          else
            const Icon(Icons.schedule_rounded, color: Color(0xFF3F3F46), size: 16),
        ]),
      ),
    );
  }

  // ── ROSTER TAB ───────────────────────────────────────────────────────────

  Widget _buildRosterTab() {
    if (_roster.isEmpty) {
      return Center(child: Text('No upcoming shifts', style: _interStyle(13, _kTextMuted)));
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      itemCount: _roster.length,
      itemBuilder: (_, i) {
        final shift = _roster[i];
        final isUpcoming = shift.startTime.isAfter(DateTime.now());
        return Column(children: [
          if (i == 0 || !_isSameDay(_roster[i - 1].startTime, shift.startTime)) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(_formatDateShort(shift.startTime), style: _interStyle(10, _kTextMuted).copyWith(letterSpacing: 1.2)),
            ),
            const SizedBox(height: 6),
          ],
          GestureDetector(
            onTap: shift.needsApproval ? () => _openApprovalSheet(shift) : null,
            child: Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isUpcoming ? _kSurface2 : _kSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: shift.needsApproval
                    ? _kAmber.withOpacity(0.3)
                    : isUpcoming
                      ? _brandColor.withOpacity(0.15)
                      : _kBorder,
                ),
              ),
              child: Row(children: [
                SizedBox(
                  width: 40,
                  child: Column(children: [
                    Text(_formatTime(shift.startTime), style: _monoStyle(10, isUpcoming ? _kTextPrimary : _kTextMuted)),
                    Text('—', style: _monoStyle(8, _kTextMuted)),
                    Text(_formatTime(shift.endTime), style: _monoStyle(10, isUpcoming ? _kTextPrimary : _kTextMuted)),
                  ]),
                ),
                Container(width: 1, height: 40, color: _kBorder, margin: const EdgeInsets.symmetric(horizontal: 12)),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(shift.workerName ?? 'Support Worker', style: _interStyle(13, _kTextPrimary)),
                  if (shift.shiftNote != null && shift.shiftNote!.isNotEmpty)
                    Text('"${shift.shiftNote}"', style: _interStyle(10, _kTextMuted).copyWith(fontStyle: FontStyle.italic),
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  if (shift.billableHours != null)
                    Text('${shift.billableHours!.toStringAsFixed(1)}h', style: _monoStyle(12, _kTextSecondary)),
                  const SizedBox(height: 4),
                  if (shift.clientApproved)
                    Row(children: [
                      const Icon(Icons.check_circle_rounded, color: _kEmerald, size: 12),
                      const SizedBox(width: 3),
                      Text('Approved', style: _interStyle(9, _kEmerald)),
                    ])
                  else if (shift.needsApproval)
                    Row(children: [
                      const Icon(Icons.pending_actions_rounded, color: _kAmber, size: 12),
                      const SizedBox(width: 3),
                      Text('Tap to Approve', style: _interStyle(9, _kAmber)),
                    ])
                  else
                    Text(_capitalise(shift.status), style: _interStyle(9, _kTextMuted)),
                ]),
              ]),
            ),
          ),
        ]);
      },
    );
  }

  // ── BUDGET TAB ───────────────────────────────────────────────────────────

  Widget _buildBudgetTab() {
    final t = _telemetry;
    if (t == null) {
      return Center(child: Text('No service agreement found', style: _interStyle(13, _kTextMuted)));
    }
    final burnColor = _burnColor(t.burnStatus);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      children: [
        // Gauge
        Center(
          child: SizedBox(
            width: 180, height: 180,
            child: Stack(alignment: Alignment.center, children: [
              CustomPaint(
                size: const Size(180, 180),
                painter: _BudgetGaugePainter(
                  burnPct: math.min(t.burnRatePct, 100),
                  proPct: math.min(t.proRataPct, 100),
                  burnColor: burnColor,
                ),
              ),
              Column(mainAxisSize: MainAxisSize.min, children: [
                Text(
                  '${t.burnRatePct.toStringAsFixed(1)}%',
                  style: _monoStyle(28, burnColor, weight: FontWeight.bold),
                ),
                Text('BURN RATE', style: _interStyle(9, _kTextMuted).copyWith(letterSpacing: 1.5)),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Center(child: Text(
          t.burnStatus == 'on_track' ? 'Budget on track' :
          t.burnStatus == 'over_burning' ? 'Warning: Spending faster than schedule' :
          t.burnStatus == 'depleted' ? 'Funds depleted' : 'Critical overspend',
          style: _interStyle(12, burnColor),
        )),
        const SizedBox(height: 24),

        // Ledger
        Container(
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
          ),
          padding: const EdgeInsets.all(18),
          child: Column(children: [
            _BudgetRow(label: 'Total Budget', value: _formatAUD(t.totalBudget), color: _kTextSecondary),
            const Divider(color: _kBorder, height: 16),
            _BudgetRow(label: 'Invoiced', value: '− ${_formatAUD(t.invoiced)}', color: _kTextMuted),
            _BudgetRow(label: 'Unbilled WIP', value: '− ${_formatAUD(t.unbilledWip)}', color: _kAmber),
            const Divider(color: _kBorder, height: 16),
            _BudgetRow(label: 'Remaining', value: _formatAUD(t.remaining), color: burnColor, large: true),
          ]),
        ),
        const SizedBox(height: 16),

        // Pro-rata comparison
        Container(
          decoration: BoxDecoration(
            color: _kSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _kBorder),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('PRO-RATA ANALYSIS', style: _interStyle(9, _kTextMuted).copyWith(letterSpacing: 1.5)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _ProRataBar(label: 'Plan Progress', pct: t.proRataPct, color: const Color(0xFF52525B))),
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: _ProRataBar(label: 'Budget Burn', pct: t.burnRatePct, color: burnColor)),
            ]),
            const SizedBox(height: 10),
            Text(
              '${t.proRataPct.toStringAsFixed(0)}% of plan year elapsed vs ${t.burnRatePct.toStringAsFixed(0)}% budget consumed',
              style: _interStyle(11, _kTextMuted),
            ),
          ]),
        ),
      ],
    );
  }

  bool _isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;
  String _capitalise(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: _kSurface,
        border: Border(top: BorderSide(color: _kBorder)),
      ),
      child: BottomNavigationBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        selectedItemColor: _brandColor,
        unselectedItemColor: const Color(0xFF52525B),
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
        unselectedLabelStyle: const TextStyle(fontSize: 10),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month_rounded), label: 'Roster'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_rounded), label: 'Budget'),
        ],
      ),
    );
  }
}

// ─── Supporting Widgets ──────────────────────────────────────────────────────

class _TelemetryCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final String? subtitle;

  const _TelemetryCard({
    required this.label,
    required this.value,
    required this.color,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _kSurface2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label.toUpperCase(), style: _interStyle(8, _kTextMuted).copyWith(letterSpacing: 1.2)),
        const SizedBox(height: 6),
        Text(value, style: _monoStyle(17, color, weight: FontWeight.bold)),
        if (subtitle != null) ...[
          const SizedBox(height: 3),
          Text(subtitle!, style: _interStyle(9, color.withOpacity(0.8))),
        ],
      ]),
    );
  }
}

class _BudgetRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool large;
  const _BudgetRow({required this.label, required this.value, required this.color, this.large = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: _interStyle(large ? 12 : 11, _kTextMuted)),
        Text(value, style: _monoStyle(large ? 16 : 12, color, weight: large ? FontWeight.bold : FontWeight.normal)),
      ]),
    );
  }
}

class _ProRataBar extends StatelessWidget {
  final String label;
  final double pct;
  final Color color;
  const _ProRataBar({required this.label, required this.pct, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: _interStyle(10, _kTextMuted)),
        Text('${pct.toStringAsFixed(0)}%', style: _monoStyle(10, color)),
      ]),
      const SizedBox(height: 4),
      ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          value: math.min(pct / 100, 1.0),
          backgroundColor: const Color(0xFF1A1A1A),
          valueColor: AlwaysStoppedAnimation(color),
          minHeight: 5,
        ),
      ),
    ]);
  }
}
