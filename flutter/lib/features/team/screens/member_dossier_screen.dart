import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/team_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Member Dossier — Individual Profile + Admin Actions ──
// ═══════════════════════════════════════════════════════════

class MemberDossierScreen extends ConsumerStatefulWidget {
  final TeamMember member;
  const MemberDossierScreen({super.key, required this.member});

  @override
  ConsumerState<MemberDossierScreen> createState() => _MemberDossierScreenState();
}

class _MemberDossierScreenState extends ConsumerState<MemberDossierScreen> {
  late String _currentRole;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _currentRole = widget.member.role;
  }

  bool get _isSelf => widget.member.userId == SupabaseService.auth.currentUser?.id;

  Future<void> _updateRole(String role) async {
    if (_isSelf || role == _currentRole) return;
    final old = _currentRole;
    setState(() { _currentRole = role; _saving = true; });

    final success = await ref.read(teamProvider.notifier).updateMemberRole(widget.member.userId, role);
    if (!success && mounted) {
      setState(() => _currentRole = old);
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _suspend() async {
    HapticFeedback.heavyImpact();
    final confirmed = await _showConfirmation(
      title: 'Suspend ${widget.member.fullName}?',
      body: 'They will be immediately logged out and unable to access the workspace until reactivated.',
      actionLabel: 'Suspend',
      isDestructive: false,
    );
    if (!confirmed || !mounted) return;

    final success = await ref.read(teamProvider.notifier).suspendMember(widget.member.userId);
    if (mounted && success) Navigator.pop(context);
  }

  Future<void> _remove() async {
    HapticFeedback.heavyImpact();
    final typed = await _showRemoveConfirmation();
    if (typed != 'REMOVE' || !mounted) return;

    final success = await ref.read(teamProvider.notifier).removeMember(widget.member.userId);
    if (mounted && success) Navigator.pop(context);
  }

  Future<bool> _showConfirmation({
    required String title,
    required String body,
    required String actionLabel,
    bool isDestructive = false,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _ConfirmSheet(title: title, body: body, actionLabel: actionLabel, isDestructive: isDestructive),
    );
    return result ?? false;
  }

  Future<String?> _showRemoveConfirmation() async {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _RemoveConfirmSheet(memberName: widget.member.fullName),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final m = widget.member;

    return Scaffold(
      backgroundColor: c.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
        ),
        title: Text('Member', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: CupertinoActivityIndicator(radius: 10, color: ObsidianTheme.emerald),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        child: Column(
          children: [
            // ── Profile Header ──────────────────────────
            _buildHeader(m).animate().fadeIn(duration: 400.ms),
            const SizedBox(height: 24),

            // ── Role Manager ────────────────────────────
            if (!_isSelf)
              _buildRoleSection().animate().fadeIn(delay: 100.ms, duration: 400.ms),

            const SizedBox(height: 16),

            // ── Contact Info ────────────────────────────
            _buildInfoCard(m).animate().fadeIn(delay: 200.ms, duration: 400.ms),

            const SizedBox(height: 16),

            // ── Activity Metrics ────────────────────────
            _buildMetrics().animate().fadeIn(delay: 300.ms, duration: 400.ms),

            // ── Destructive Actions ─────────────────────
            if (!_isSelf && m.role != 'owner') ...[
              const SizedBox(height: 40),
              _buildDestructiveActions().animate().fadeIn(delay: 400.ms, duration: 400.ms),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(TeamMember m) {
    final c = context.iColors;
    return Column(
      children: [
        Stack(
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: c.surfaceSecondary,
              backgroundImage: m.avatarUrl != null ? NetworkImage(m.avatarUrl!) : null,
              child: m.avatarUrl == null
                  ? Text(m.fullName.isNotEmpty ? m.fullName[0].toUpperCase() : '?',
                      style: GoogleFonts.inter(fontSize: 28, color: c.textSecondary, fontWeight: FontWeight.w600))
                  : null,
            ),
            if (m.isOnline)
              Positioned(
                right: 2, bottom: 2,
                child: Container(
                  width: 14, height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.emerald,
                    border: Border.all(color: c.canvas, width: 3),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Text(m.fullName, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary, letterSpacing: -0.4)),
        const SizedBox(height: 6),
        _buildRoleBadge(_currentRole),
      ],
    );
  }

  Widget _buildRoleBadge(String role) {
    final c = context.iColors;
    final (Color bg, Color text, String label) = switch (role) {
      'owner' => (ObsidianTheme.amberDim, ObsidianTheme.amber, 'OWNER'),
      'admin' => (ObsidianTheme.violetDim, ObsidianTheme.violet, 'ADMIN'),
      'manager' || 'office_admin' => (ObsidianTheme.blueDim, ObsidianTheme.blue, 'MANAGER'),
      'senior_tech' => (ObsidianTheme.emeraldDim, ObsidianTheme.emerald, 'SENIOR TECH'),
      _ => (const Color(0x0DFFFFFF), c.textSecondary, 'TECHNICIAN'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        color: bg,
        border: Border.all(color: text.withValues(alpha: 0.15)),
      ),
      child: Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w700, color: text, letterSpacing: 1)),
    );
  }

  Widget _buildRoleSection() {
    final c = context.iColors;
    const roles = ['admin', 'manager', 'senior_tech', 'technician', 'apprentice'];

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ROLE ASSIGNMENT', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: roles.map((r) {
              final active = r == _currentRole;
              final label = switch (r) {
                'admin' => 'Admin',
                'manager' => 'Dispatcher',
                'senior_tech' => 'Senior Tech',
                'technician' => 'Technician',
                'apprentice' => 'Apprentice',
                _ => r,
              };
              return GestureDetector(
                onTap: () => _updateRole(r),
                child: AnimatedContainer(
                  duration: ObsidianTheme.fast,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: active ? c.activeBg : c.hoverBg,
                    border: Border.all(color: active ? c.borderHover : c.border),
                  ),
                  child: Text(
                    label,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      color: active ? c.textPrimary : c.textMuted,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(TeamMember m) {
    final c = context.iColors;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('CONTACT', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 12),
          _InfoRow(icon: PhosphorIconsLight.envelope, label: m.email),
          if (m.phone != null) ...[
            const SizedBox(height: 10),
            _InfoRow(icon: PhosphorIconsLight.phone, label: m.phone!),
          ],
          const SizedBox(height: 10),
          _InfoRow(
            icon: PhosphorIconsLight.sealCheck,
            label: m.isActive ? 'Active' : 'Suspended',
            color: m.isActive ? ObsidianTheme.emerald : ObsidianTheme.rose,
          ),
        ],
      ),
    );
  }

  Widget _buildMetrics() {
    final c = context.iColors;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ACTIVITY', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 12),
          Row(
            children: [
              _MetricCell(label: 'Jobs MTD', value: '—'),
              _MetricCell(label: 'Avg Rating', value: '—'),
              _MetricCell(label: 'Last Active', value: widget.member.lastActive != null ? _timeAgo(widget.member.lastActive!) : '—'),
            ],
          ),
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 5) return 'Now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Widget _buildDestructiveActions() {
    final c = context.iColors;
    return Column(
      children: [
        if (widget.member.isActive)
          GestureDetector(
            onTap: _suspend,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: c.activeBg,
                border: Border.all(color: c.border),
              ),
              child: Center(
                child: Text('Suspend User', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
              ),
            ),
          ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: _remove,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
            ),
            child: Center(
              child: Text('Remove from Workspace', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.rose)),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Reusable Widgets ─────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: child,
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;
  const _InfoRow({required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Row(
      children: [
        Icon(icon, size: 16, color: color ?? c.textTertiary),
        const SizedBox(width: 10),
        Expanded(child: Text(label, style: GoogleFonts.inter(fontSize: 13, color: color ?? c.textSecondary))),
      ],
    );
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final String value;
  const _MetricCell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Column(
        children: [
          Text(value, style: GoogleFonts.jetBrainsMono(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
          const SizedBox(height: 4),
          Text(label, style: GoogleFonts.inter(fontSize: 10, color: c.textTertiary)),
        ],
      ),
    );
  }
}

// ── Confirm Sheet ────────────────────────────────────────

class _ConfirmSheet extends StatelessWidget {
  final String title, body, actionLabel;
  final bool isDestructive;
  const _ConfirmSheet({required this.title, required this.body, required this.actionLabel, this.isDestructive = false});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).padding.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(title, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary)),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 14, color: c.textMuted, height: 1.5)),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () => Navigator.pop(context, true),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: isDestructive ? ObsidianTheme.rose : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(child: Text(actionLabel, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: isDestructive ? Colors.white : Colors.black))),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => Navigator.pop(context, false),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('Cancel', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Remove Confirm Sheet (type REMOVE) ───────────────────

class _RemoveConfirmSheet extends StatefulWidget {
  final String memberName;
  const _RemoveConfirmSheet({required this.memberName});

  @override
  State<_RemoveConfirmSheet> createState() => _RemoveConfirmSheetState();
}

class _RemoveConfirmSheetState extends State<_RemoveConfirmSheet> {
  final _ctrl = TextEditingController();
  bool get _canConfirm => _ctrl.text.trim().toUpperCase() == 'REMOVE';

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: const Border(top: BorderSide(color: Color(0x1AF43F5E))),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: ObsidianTheme.roseDim,
                  border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                ),
                child: const Icon(PhosphorIconsBold.userMinus, size: 24, color: ObsidianTheme.rose),
              ),
              const SizedBox(height: 16),
              Text('Remove ${widget.memberName}?', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary)),
              const SizedBox(height: 8),
              Text(
                'This will revoke all their access. Their historical job timesheets will be preserved.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: c.textMuted, height: 1.5),
              ),
              const SizedBox(height: 20),
              Text('Type REMOVE to confirm', style: GoogleFonts.jetBrainsMono(fontSize: 11, color: c.textTertiary, letterSpacing: 0.5)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: c.surfaceSecondary,
                  border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.15)),
                ),
                child: TextField(
                  controller: _ctrl,
                  onChanged: (_) => setState(() {}),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.rose, fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 4),
                  cursorColor: ObsidianTheme.rose,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              GestureDetector(
                onTap: _canConfirm ? () => Navigator.pop(context, 'REMOVE') : null,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: _canConfirm ? ObsidianTheme.rose : ObsidianTheme.rose.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      'Remove Member',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: _canConfirm ? Colors.white : Colors.white.withValues(alpha: 0.3)),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('Cancel', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted))),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
