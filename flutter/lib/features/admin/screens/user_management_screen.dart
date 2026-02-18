import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/admin_provider.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/models/profile.dart';

class UserManagementScreen extends ConsumerStatefulWidget {
  const UserManagementScreen({super.key});

  @override
  ConsumerState<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends ConsumerState<UserManagementScreen> {
  void _showInviteSheet() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _InviteSheet(ref: ref),
    );
  }

  @override
  Widget build(BuildContext context) {
    final membersAsync = ref.watch(orgMembersProvider);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () { HapticFeedback.lightImpact(); Navigator.pop(context); },
                    child: Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle, color: ObsidianTheme.hoverBg,
                        border: Border.all(color: ObsidianTheme.border),
                      ),
                      child: const Center(child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text('Team', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
                  const Spacer(),
                  GestureDetector(
                    onTap: _showInviteSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: Colors.white,
                      ),
                      child: Row(
                        children: [
                          const Icon(PhosphorIconsBold.plus, size: 12, color: Colors.black),
                          const SizedBox(width: 4),
                          Text('Invite', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.black)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms),

            const SizedBox(height: 20),

            Expanded(
              child: membersAsync.when(
                data: (members) {
                  if (members.isEmpty) {
                    return Center(child: Text('No team members', style: GoogleFonts.inter(color: ObsidianTheme.textTertiary)));
                  }

                  return ListView.builder(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                    itemCount: members.length,
                    itemBuilder: (context, index) {
                      final m = members[index];
                      return _MemberCard(member: m, index: index, ref: ref);
                    },
                  );
                },
                loading: () => const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))),
                error: (_, __) => const Center(child: Text('Error loading team', style: TextStyle(color: ObsidianTheme.textTertiary))),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Member Card ──────────────────────────────────────

class _MemberCard extends StatelessWidget {
  final OrganizationMember member;
  final int index;
  final WidgetRef ref;

  const _MemberCard({required this.member, required this.index, required this.ref});

  Color get _statusColor {
    switch (member.status) {
      case 'active': return ObsidianTheme.emerald;
      case 'suspended': return ObsidianTheme.rose;
      case 'pending': return ObsidianTheme.amber;
      default: return ObsidianTheme.textTertiary;
    }
  }

  Color get _roleColor {
    switch (member.role) {
      case 'owner': return ObsidianTheme.emerald;
      case 'admin': return ObsidianTheme.blue;
      case 'manager': return ObsidianTheme.amber;
      default: return ObsidianTheme.textTertiary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      borderRadius: ObsidianTheme.radiusMd,
      child: Row(
        children: [
          // Avatar
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ObsidianTheme.shimmerBase,
              border: Border.all(color: _statusColor.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: Text(
                (member.profile?.displayName ?? 'U')[0].toUpperCase(),
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: _statusColor),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(member.profile?.displayName ?? 'Unknown', style: GoogleFonts.inter(fontSize: 14, color: Colors.white, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusFull,
                        color: _roleColor.withValues(alpha: 0.1),
                        border: Border.all(color: _roleColor.withValues(alpha: 0.2)),
                      ),
                      child: Text(member.role, style: GoogleFonts.jetBrainsMono(fontSize: 8, color: _roleColor, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    ),
                    if (member.branch != null) ...[
                      const SizedBox(width: 6),
                      Text(member.branch!, style: GoogleFonts.inter(fontSize: 10, color: ObsidianTheme.textTertiary)),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // Status dot
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: _statusColor),
          ),

          // Actions
          if (member.role != 'owner') ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _showActions(context),
              child: const Icon(PhosphorIconsLight.dotsThreeVertical, size: 16, color: ObsidianTheme.textTertiary),
            ),
          ],
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 50 * index), duration: 400.ms)
        .moveY(begin: 8, end: 0, delay: Duration(milliseconds: 50 * index), duration: 400.ms);
  }

  void _showActions(BuildContext context) {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: BoxDecoration(
          color: ObsidianTheme.surface1,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          border: const Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(width: 36, height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.textTertiary)),
            const SizedBox(height: 16),
            Text(member.profile?.displayName ?? 'User', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
            const SizedBox(height: 16),
            if (member.status == 'active')
              _ActionItem(
                icon: PhosphorIconsLight.lockSimple,
                label: 'Suspend User',
                color: ObsidianTheme.rose,
                onTap: () async {
                  Navigator.pop(context);
                  HapticFeedback.heavyImpact();
                  await suspendMember(organizationId: member.organizationId, userId: member.userId);
                  ref.invalidate(orgMembersProvider);
                },
              ),
            if (member.status == 'suspended')
              _ActionItem(
                icon: PhosphorIconsLight.lockSimpleOpen,
                label: 'Reactivate User',
                color: ObsidianTheme.emerald,
                onTap: () async {
                  Navigator.pop(context);
                  HapticFeedback.mediumImpact();
                  await reactivateMember(organizationId: member.organizationId, userId: member.userId);
                  ref.invalidate(orgMembersProvider);
                },
              ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
          ],
        ),
      ),
    );
  }
}

class _ActionItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionItem({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 12),
            Text(label, style: GoogleFonts.inter(fontSize: 14, color: color, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════
// ── Invite Sheet ──────────────────────────────────────
// ═══════════════════════════════════════════════════════

class _InviteSheet extends StatefulWidget {
  final WidgetRef ref;
  const _InviteSheet({required this.ref});

  @override
  State<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends State<_InviteSheet> {
  final _emailController = TextEditingController();
  String _role = 'technician';
  bool _sending = false;
  bool _sent = false;

  Future<void> _send() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;

    setState(() => _sending = true);
    HapticFeedback.mediumImpact();

    final orgId = await widget.ref.read(organizationIdProvider.future);
    if (orgId == null) { setState(() => _sending = false); return; }

    await sendInvite(organizationId: orgId, email: email, role: _role);

    if (mounted) {
      setState(() { _sending = false; _sent = true; });
      HapticFeedback.heavyImpact();
      Future.delayed(const Duration(seconds: 1), () { if (mounted) Navigator.pop(context); });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16),
      decoration: BoxDecoration(
        color: ObsidianTheme.surface1,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: const Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.textTertiary))),
          const SizedBox(height: 20),
          Text('Invite Team Member', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
          const SizedBox(height: 16),

          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
            cursorColor: ObsidianTheme.emerald,
            decoration: InputDecoration(
              hintText: 'Email address',
              hintStyle: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textDisabled),
              prefixIcon: const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(PhosphorIconsLight.envelope, size: 16, color: ObsidianTheme.textTertiary),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 24, minHeight: 0),
            ),
          ),

          const SizedBox(height: 16),

          Text('ROLE', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
          const SizedBox(height: 8),

          Wrap(
            spacing: 8,
            children: ['technician', 'manager', 'admin'].map((r) {
              final selected = r == _role;
              return GestureDetector(
                onTap: () { HapticFeedback.selectionClick(); setState(() => _role = r); },
                child: AnimatedContainer(
                  duration: ObsidianTheme.fast,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: selected ? ObsidianTheme.emeraldDim : Colors.transparent,
                    border: Border.all(color: selected ? ObsidianTheme.emerald.withValues(alpha: 0.3) : ObsidianTheme.borderMedium),
                  ),
                  child: Text(r[0].toUpperCase() + r.substring(1), style: GoogleFonts.inter(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: selected ? ObsidianTheme.emerald : ObsidianTheme.textSecondary,
                  )),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 20),

          GestureDetector(
            onTap: !_sending && !_sent ? _send : null,
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              height: 44,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: _sent ? ObsidianTheme.emeraldDim : Colors.white,
                border: _sent ? Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)) : null,
              ),
              child: Center(
                child: _sending
                    ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))
                    : Text(
                        _sent ? 'Invite Sent' : 'Send Magic Link',
                        style: GoogleFonts.inter(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: _sent ? ObsidianTheme.emerald : Colors.black,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
