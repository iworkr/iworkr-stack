import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Project Sentinel: Intelligent Participant Roster ─────
// ═══════════════════════════════════════════════════════════
//
// Replaces legacy text-heavy list with context-aware cards
// featuring semantic risk badges, next shift context, Hero
// avatar transitions, and swipe actions.

// ── Alert Category & Severity Enums ─────────────────────

enum AlertCategory { medical, behavioral, operational, dietary }

enum AlertSeverity { critical, moderate, low }

// ── Risk Alert Model ────────────────────────────────────

class RiskAlert {
  final String label;
  final AlertCategory category;
  final AlertSeverity severity;

  const RiskAlert({
    required this.label,
    required this.category,
    this.severity = AlertSeverity.moderate,
  });

  /// Parse a raw alert string into a semantically-categorized RiskAlert.
  /// Uses keyword matching to auto-classify legacy string data.
  factory RiskAlert.fromString(String raw) {
    final lower = raw.toLowerCase().trim();

    // ── Critical Medical ──
    if (_matchesAny(lower, [
      'anaphylaxis', 'allergy', 'epilepsy', 'seizure', 'asthma',
      'peg feed', 'peg', 'no oral', 'diabetes', 'insulin',
      'cardiac', 'heart', 'oxygen', 'tracheostomy', 'dysphagia',
      'choking', 'aspiration',
    ])) {
      return RiskAlert(
        label: _truncate(raw.trim(), 22),
        category: AlertCategory.medical,
        severity: AlertSeverity.critical,
      );
    }

    // ── Behavioral / Safety ──
    if (_matchesAny(lower, [
      'flight', 'abscond', 'aggression', 'aggressive', 'fall',
      'self-harm', 'self harm', 'suicid', 'violence', 'elopement',
      'restraint', 'bsp', 'behavior support',
    ])) {
      return RiskAlert(
        label: _truncate(raw.trim(), 22),
        category: AlertCategory.behavioral,
        severity: AlertSeverity.critical,
      );
    }

    // ── Operational ──
    if (_matchesAny(lower, [
      'hoist', 'transfer', '2-person', 'two person', 'wheelchair',
      'door alarm', 'manual handling', 'bariatric', 'bed rail',
      'sensor mat',
    ])) {
      return RiskAlert(
        label: _truncate(raw.trim(), 22),
        category: AlertCategory.operational,
        severity: AlertSeverity.moderate,
      );
    }

    // ── Dietary / Sensory ──
    if (_matchesAny(lower, [
      'puree', 'thicken', 'diet', 'halal', 'kosher', 'vegetarian',
      'vegan', 'gluten', 'lactose', 'noise', 'sensory', 'texture',
    ])) {
      return RiskAlert(
        label: _truncate(raw.trim(), 22),
        category: AlertCategory.dietary,
        severity: AlertSeverity.low,
      );
    }

    // ── Default: treat as moderate medical ──
    return RiskAlert(
      label: _truncate(raw.trim(), 22),
      category: AlertCategory.medical,
      severity: AlertSeverity.moderate,
    );
  }

  static bool _matchesAny(String text, List<String> keywords) {
    return keywords.any((k) => text.contains(k));
  }

  static String _truncate(String s, int max) {
    if (s.length <= max) return s;
    return '${s.substring(0, max - 1)}…';
  }
}

// ── Participant Summary DTO ─────────────────────────────

class ParticipantDirectoryItem {
  final String id;
  final String name;
  final List<String> rawAlerts;
  final List<RiskAlert> riskAlerts;
  final DateTime? nextShift;
  final String? location;

  const ParticipantDirectoryItem({
    required this.id,
    required this.name,
    this.rawAlerts = const [],
    this.riskAlerts = const [],
    this.nextShift,
    this.location,
  });
}

// ── Data Provider ───────────────────────────────────────

final participantDirectoryProvider =
    FutureProvider<List<ParticipantDirectoryItem>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return const [];

  final rows = await SupabaseService.client
      .from('participant_profiles')
      .select('id, preferred_name, critical_alerts')
      .eq('organization_id', orgId)
      .order('preferred_name');

  return (rows as List).map((row) {
    final rawAlerts = (row['critical_alerts'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        const <String>[];

    // Classify raw alert strings into semantic RiskAlerts
    final riskAlerts = rawAlerts.map((a) => RiskAlert.fromString(a)).toList()
      ..sort((a, b) {
        // Critical first, then by category
        final sevCompare = a.severity.index.compareTo(b.severity.index);
        if (sevCompare != 0) return sevCompare;
        return a.category.index.compareTo(b.category.index);
      });

    return ParticipantDirectoryItem(
      id: row['id'] as String,
      name: ((row['preferred_name'] as String?) ?? '').trim().isEmpty
          ? 'Unnamed participant'
          : (row['preferred_name'] as String),
      rawAlerts: rawAlerts,
      riskAlerts: riskAlerts,
    );
  }).toList();
});

// ── Search State ────────────────────────────────────────

final participantSearchProvider = StateProvider<String>((ref) => '');

// ── Filtered List (derived) ─────────────────────────────

final filteredParticipantsProvider =
    Provider<AsyncValue<List<ParticipantDirectoryItem>>>((ref) {
  final query = ref.watch(participantSearchProvider).toLowerCase().trim();
  final participantsAsync = ref.watch(participantDirectoryProvider);

  return participantsAsync.whenData((participants) {
    if (query.isEmpty) return participants;
    return participants.where((p) {
      if (p.name.toLowerCase().contains(query)) return true;
      // Deep search through risk alert labels
      return p.riskAlerts.any((a) => a.label.toLowerCase().contains(query));
    }).toList();
  });
});

// ═══════════════════════════════════════════════════════════
// ── The Participants Screen ─────────────────────────────
// ═══════════════════════════════════════════════════════════

class ParticipantsScreen extends ConsumerStatefulWidget {
  const ParticipantsScreen({super.key});

  @override
  ConsumerState<ParticipantsScreen> createState() => _ParticipantsScreenState();
}

class _ParticipantsScreenState extends ConsumerState<ParticipantsScreen> {
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final participantsAsync = ref.watch(filteredParticipantsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            title: Text(
              'Participants',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: c.textPrimary,
              ),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Search Bar ──
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.border),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 12),
                    Icon(CupertinoIcons.search, size: 16, color: c.textMuted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        focusNode: _searchFocus,
                        onChanged: (v) =>
                            ref.read(participantSearchProvider.notifier).state = v,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: c.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Search name or condition…',
                          hintStyle: GoogleFonts.inter(
                            fontSize: 14,
                            color: c.textDisabled,
                          ),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    if (_searchController.text.isNotEmpty)
                      GestureDetector(
                        onTap: () {
                          _searchController.clear();
                          ref.read(participantSearchProvider.notifier).state = '';
                          _searchFocus.unfocus();
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Icon(
                            CupertinoIcons.xmark_circle_fill,
                            size: 16,
                            color: c.textMuted,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),

          // ── Participant List ──
          participantsAsync.when(
            loading: () => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList.builder(
                itemCount: 5,
                itemBuilder: (_, __) => const _SkeletonTile(),
              ),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(PhosphorIconsLight.warning, size: 32, color: c.textTertiary),
                    const SizedBox(height: 8),
                    Text(
                      'Unable to load participants',
                      style: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
            data: (participants) {
              if (participants.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.usersThree,
                            size: 36, color: c.textTertiary),
                        const SizedBox(height: 8),
                        Text(
                          ref.watch(participantSearchProvider).isNotEmpty
                              ? 'No results found'
                              : 'No participants assigned',
                          style: GoogleFonts.inter(
                            color: c.textTertiary,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                sliver: SliverList.separated(
                  itemCount: participants.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    return _ParticipantTile(
                      participant: participants[index],
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Participant Tile (The Context Card) ─────────────────
// ═══════════════════════════════════════════════════════════

class _ParticipantTile extends StatefulWidget {
  final ParticipantDirectoryItem participant;

  const _ParticipantTile({required this.participant});

  @override
  State<_ParticipantTile> createState() => _ParticipantTileState();
}

class _ParticipantTileState extends State<_ParticipantTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final p = widget.participant;

    return GestureDetector(
      onTapDown: (_) {
        HapticFeedback.lightImpact();
        setState(() => _pressed = true);
      },
      onTapUp: (_) {
        setState(() => _pressed = false);
        context.push('/participants/${p.id}');
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutQuart,
        transform: _pressed
            ? Matrix4.diagonal3Values(0.97, 0.97, 1)
            : Matrix4.identity(),
        transformAlignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _pressed ? c.borderActive : c.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Zone 1: Identity & Operations ──
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Avatar with Hero transition
                Hero(
                  tag: 'avatar_${p.id}',
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                      border: Border.all(
                        color: ObsidianTheme.careBlue.withValues(alpha: 0.20),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        p.name.isNotEmpty
                            ? p.name.substring(0, 1).toUpperCase()
                            : '?',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: ObsidianTheme.careBlue,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Name & Next Shift context
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name,
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: c.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _formatNextShift(p.nextShift),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          color: c.textMuted,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),

                // Quick call action
                GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    // TODO: Trigger call to participant/nominee
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: c.activeBg,
                    ),
                    child: Icon(
                      CupertinoIcons.phone,
                      size: 16,
                      color: c.textSecondary,
                    ),
                  ),
                ),
              ],
            ),

            // ── Zone 2: Clinical Matrix (Risk Badges) ──
            if (p.riskAlerts.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 28,
                child: ShaderMask(
                  shaderCallback: (bounds) => LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.white,
                      Colors.white,
                      Colors.white,
                      Colors.white.withValues(alpha: 0),
                    ],
                    stops: const [0.0, 0.7, 0.88, 1.0],
                  ).createShader(bounds),
                  blendMode: BlendMode.dstIn,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    child: Row(
                      children: [
                        ...p.riskAlerts.map((alert) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: _RiskBadge(alert: alert),
                            )),
                        // Extra padding for fade
                        const SizedBox(width: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatNextShift(DateTime? nextShift) {
    if (nextShift == null) return 'No upcoming shifts';

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final shiftDay = DateTime(nextShift.year, nextShift.month, nextShift.day);

    if (shiftDay == today) {
      return 'Next: Today at ${DateFormat.jm().format(nextShift)}';
    }

    final tomorrow = today.add(const Duration(days: 1));
    if (shiftDay == tomorrow) {
      return 'Next: Tomorrow at ${DateFormat.jm().format(nextShift)}';
    }

    return 'Next: ${DateFormat.MMMd().format(nextShift)}';
  }
}

// ═══════════════════════════════════════════════════════════
// ── Risk Badge (Semantic Color Matrix) ──────────────────
// ═══════════════════════════════════════════════════════════

class _RiskBadge extends StatelessWidget {
  final RiskAlert alert;
  const _RiskBadge({required this.alert});

  @override
  Widget build(BuildContext context) {
    final colors = _resolveColors(alert.category, alert.severity);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border, width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (alert.severity == AlertSeverity.critical) ...[
            Icon(
              alert.category == AlertCategory.medical
                  ? PhosphorIconsBold.warning
                  : PhosphorIconsBold.shieldWarning,
              size: 10,
              color: colors.text,
            ),
            const SizedBox(width: 4),
          ],
          Text(
            alert.label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: colors.text,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  _BadgeColors _resolveColors(AlertCategory category, AlertSeverity severity) {
    switch (category) {
      case AlertCategory.medical:
        // Rose palette — life-threatening
        return _BadgeColors(
          bg: const Color(0xFFF43F5E).withValues(alpha: 0.10),
          border: const Color(0xFFF43F5E).withValues(alpha: 0.20),
          text: const Color(0xFFE11D48), // Rose-600
        );

      case AlertCategory.behavioral:
        // Amber palette — safety/behavioral
        return _BadgeColors(
          bg: const Color(0xFFF59E0B).withValues(alpha: 0.10),
          border: const Color(0xFFF59E0B).withValues(alpha: 0.20),
          text: const Color(0xFFB45309), // Amber-700
        );

      case AlertCategory.operational:
        // Blue palette — procedural
        return _BadgeColors(
          bg: const Color(0xFF3B82F6).withValues(alpha: 0.10),
          border: const Color(0xFF3B82F6).withValues(alpha: 0.20),
          text: const Color(0xFF2563EB), // Blue-600
        );

      case AlertCategory.dietary:
        // Violet palette — dietary/sensory
        return _BadgeColors(
          bg: const Color(0xFF8B5CF6).withValues(alpha: 0.10),
          border: const Color(0xFF8B5CF6).withValues(alpha: 0.20),
          text: const Color(0xFF7C3AED), // Violet-600
        );
    }
  }
}

class _BadgeColors {
  final Color bg;
  final Color border;
  final Color text;
  const _BadgeColors({required this.bg, required this.border, required this.text});
}

// ═══════════════════════════════════════════════════════════
// ── Skeleton Loader ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════

class _SkeletonTile extends StatelessWidget {
  const _SkeletonTile();

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Avatar skeleton
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: c.shimmerBase,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 14,
                        width: 140,
                        decoration: BoxDecoration(
                          color: c.shimmerBase,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 10,
                        width: 100,
                        decoration: BoxDecoration(
                          color: c.shimmerBase,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _badgeSkeleton(c, 68),
                const SizedBox(width: 6),
                _badgeSkeleton(c, 52),
                const SizedBox(width: 6),
                _badgeSkeleton(c, 60),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badgeSkeleton(IWorkrColors c, double width) {
    return Container(
      width: width,
      height: 24,
      decoration: BoxDecoration(
        color: c.shimmerBase,
        borderRadius: BorderRadius.circular(6),
      ),
    );
  }
}
