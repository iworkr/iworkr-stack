import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/billing_provider.dart';
import 'package:iworkr_mobile/core/services/team_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/team/widgets/invite_member_sheet.dart';
import 'package:iworkr_mobile/features/team/screens/member_dossier_screen.dart';

// ═══════════════════════════════════════════════════════════
// ── Team Roster — The Live Directory ─────────────────────
// ═══════════════════════════════════════════════════════════

class TeamRosterScreen extends ConsumerStatefulWidget {
  const TeamRosterScreen({super.key});

  @override
  ConsumerState<TeamRosterScreen> createState() => _TeamRosterScreenState();
}

class _TeamRosterScreenState extends ConsumerState<TeamRosterScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _openInvite() {
    HapticFeedback.mediumImpact();

    final seatData = ref.read(seatLimitProvider).valueOrNull;
    if (seatData != null && seatData.current >= seatData.max) {
      _showSeatLimitGate();
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const InviteMemberSheet(),
    );
  }

  void _showSeatLimitGate() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SeatLimitSheet(),
    );
  }

  void _openDossier(TeamMember member) {
    HapticFeedback.lightImpact();
    Navigator.of(context).push(
      CupertinoPageRoute(
        builder: (_) => MemberDossierScreen(member: member),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final teamState = ref.watch(teamProvider);
    final members = teamState.filtered;

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text(
              'Team Directory',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            actions: [
              GestureDetector(
                onTap: _openInvite,
                child: Container(
                  margin: const EdgeInsets.only(right: 16),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '+ Invite',
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black),
                  ),
                ),
              ),
            ],
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Search + Filter ────────────────────────────
          SliverPersistentHeader(
            pinned: true,
            delegate: _SearchBarDelegate(
              searchCtrl: _searchCtrl,
              onSearch: (q) => ref.read(teamProvider.notifier).setSearch(q),
              activeFilter: teamState.filter,
              onFilter: (f) => ref.read(teamProvider.notifier).setFilter(f),
            ),
          ),

          // ── Loading / Error / Empty ────────────────────
          if (teamState.loading)
            const SliverFillRemaining(
              child: Center(child: CupertinoActivityIndicator(color: ObsidianTheme.emerald)),
            )
          else if (teamState.error != null)
            SliverFillRemaining(
              child: Center(
                child: Text(teamState.error!, style: GoogleFonts.inter(color: c.textMuted, fontSize: 14)),
              ),
            )
          else if (members.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(PhosphorIconsLight.usersThree, size: 40, color: c.textTertiary),
                    const SizedBox(height: 12),
                    Text('No members found', style: GoogleFonts.inter(color: c.textMuted, fontSize: 14)),
                  ],
                ),
              ),
            )
          else
            // ── Member List ──────────────────────────────
            SliverList.builder(
              itemCount: members.length,
              itemBuilder: (context, index) {
                final member = members[index];
                return _MemberRow(
                  member: member,
                  onTap: () => _openDossier(member),
                  index: index,
                );
              },
            ),
        ],
      ),
    );
  }
}

// ── Search Bar Delegate ──────────────────────────────────

class _SearchBarDelegate extends SliverPersistentHeaderDelegate {
  final TextEditingController searchCtrl;
  final ValueChanged<String> onSearch;
  final TeamFilter activeFilter;
  final ValueChanged<TeamFilter> onFilter;

  _SearchBarDelegate({
    required this.searchCtrl,
    required this.onSearch,
    required this.activeFilter,
    required this.onFilter,
  });

  @override
  double get minExtent => 100;
  @override
  double get maxExtent => 100;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final c = context.iColors;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          color: c.canvas.withValues(alpha: 0.9),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Column(
            children: [
              // Search input
              Container(
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: c.surfaceSecondary,
                  border: Border.all(color: c.border),
                ),
                child: TextField(
                  controller: searchCtrl,
                  onChanged: onSearch,
                  style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
                  cursorColor: ObsidianTheme.emerald,
                  decoration: InputDecoration(
                    hintText: 'Search team...',
                    hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                    prefixIcon: Icon(CupertinoIcons.search, color: c.textTertiary, size: 16),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Filter chips
              SizedBox(
                height: 30,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: TeamFilter.values.map((f) {
                    final active = f == activeFilter;
                    final label = switch (f) {
                      TeamFilter.all => 'All',
                      TeamFilter.admins => 'Admins',
                      TeamFilter.techs => 'Techs',
                      TeamFilter.offline => 'Offline',
                    };
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onFilter(f);
                        },
                        child: AnimatedContainer(
                          duration: ObsidianTheme.fast,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: active ? c.activeBg : c.hoverBg,
                            border: Border.all(
                              color: active ? c.borderHover : c.border,
                            ),
                          ),
                          child: Text(
                            label,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                              color: active ? c.textPrimary : c.textMuted,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _SearchBarDelegate oldDelegate) =>
      oldDelegate.activeFilter != activeFilter;
}

// ── Member Row ───────────────────────────────────────────

class _MemberRow extends StatelessWidget {
  final TeamMember member;
  final VoidCallback onTap;
  final int index;

  const _MemberRow({required this.member, required this.onTap, required this.index});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.border)),
        ),
        child: Row(
          children: [
            // Avatar with presence dot
            Stack(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: c.surfaceSecondary,
                  backgroundImage: member.avatarUrl != null ? NetworkImage(member.avatarUrl!) : null,
                  child: member.avatarUrl == null
                      ? Text(
                          member.fullName.isNotEmpty ? member.fullName[0].toUpperCase() : '?',
                          style: GoogleFonts.inter(color: c.textSecondary, fontWeight: FontWeight.w600),
                        )
                      : null,
                ),
                if (member.isOnline)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: ObsidianTheme.emerald,
                        border: Border.all(color: c.canvas, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Name + email
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.fullName,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: member.isActive ? c.textPrimary : c.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    member.email,
                    style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Role badge
            _RoleBadge(role: member.role),
            if (!member.isActive) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: ObsidianTheme.roseDim,
                ),
                child: Text('SUSPENDED', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.rose, letterSpacing: 0.5, fontWeight: FontWeight.w600)),
              ),
            ],
            const SizedBox(width: 4),
            Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textTertiary),
          ],
        ),
      ),
    ).animate().fadeIn(delay: Duration(milliseconds: 30 * index), duration: 300.ms);
  }
}

// ── Role Badge ───────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  final String role;
  const _RoleBadge({required this.role});

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color text, String label) = switch (role) {
      'owner' => (const Color(0x1AF59E0B), const Color(0xFFF59E0B), 'OWNER'),
      'admin' => (const Color(0x1A8B5CF6), const Color(0xFF8B5CF6), 'ADMIN'),
      'manager' || 'office_admin' => (const Color(0x1A3B82F6), const Color(0xFF3B82F6), 'MANAGER'),
      'senior_tech' => (const Color(0x1A10B981), const Color(0xFF10B981), 'SENIOR'),
      _ => (const Color(0x0DFFFFFF), const Color(0xFFA1A1AA), 'TECH'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(5),
        color: bg,
        border: Border.all(color: text.withValues(alpha: 0.15)),
      ),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(fontSize: 9, fontWeight: FontWeight.w700, color: text, letterSpacing: 0.8),
      ),
    );
  }
}

// ── Seat Limit Sheet ─────────────────────────────────────

class _SeatLimitSheet extends StatelessWidget {
  const _SeatLimitSheet();

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: c.border),
          left: BorderSide(color: c.border),
          right: BorderSide(color: c.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).padding.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36, height: 4,
                decoration: BoxDecoration(color: c.borderHover, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 24),
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  color: ObsidianTheme.amberDim,
                  border: Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.2)),
                ),
                child: const Icon(PhosphorIconsBold.usersThree, size: 24, color: ObsidianTheme.amber),
              ),
              const SizedBox(height: 20),
              Text('Team Limit Reached', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.4)),
              const SizedBox(height: 8),
              Text(
                'The Free plan supports up to 3 members. Upgrade to Pro to unlock unlimited team scaling.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: c.textMuted, height: 1.5),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () {
                  Navigator.pop(context);
                  context.push('/workspace/settings');
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Center(child: Text('Manage Plan', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.black))),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('Not now', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
