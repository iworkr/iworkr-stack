import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:iworkr_mobile/core/services/chat_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/models/chat_channel.dart';

/// Channels + Direct Messages — unified comms hub.
class ChannelsScreen extends ConsumerStatefulWidget {
  const ChannelsScreen({super.key});

  @override
  ConsumerState<ChannelsScreen> createState() => _ChannelsScreenState();
}

class _ChannelsScreenState extends ConsumerState<ChannelsScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    final userId = SupabaseService.auth.currentUser?.id;
    ChatChannel.setCurrentUserId(userId);
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final channelsAsync = ref.watch(channelsProvider);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Text(
                    'Comms',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: ObsidianTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const Spacer(),
                  // New DM button
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _showNewDmSheet(context, ref);
                    },
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.border),
                        color: ObsidianTheme.surface1,
                      ),
                      child: const Center(
                        child: Icon(PhosphorIconsLight.chatCircleDots, size: 16, color: ObsidianTheme.textSecondary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // New Channel button
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      _showNewChannelSheet(context, ref);
                    },
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.border),
                        color: ObsidianTheme.surface1,
                      ),
                      child: const Center(
                        child: Icon(PhosphorIconsLight.pencilSimpleLine, size: 16, color: ObsidianTheme.textSecondary),
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 12),

            // Search
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: ObsidianTheme.surface1,
                  border: Border.all(color: ObsidianTheme.border),
                ),
                child: Row(
                  children: [
                    const SizedBox(width: 12),
                    Icon(PhosphorIconsLight.magnifyingGlass, size: 14, color: ObsidianTheme.textTertiary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Search conversations...',
                          hintStyle: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    if (_query.isNotEmpty)
                      GestureDetector(
                        onTap: () => _searchController.clear(),
                        child: const Padding(
                          padding: EdgeInsets.only(right: 10),
                          child: Icon(PhosphorIconsLight.x, size: 14, color: ObsidianTheme.textTertiary),
                        ),
                      ),
                  ],
                ),
              ),
            ).animate().fadeIn(delay: 100.ms, duration: 300.ms),

            const SizedBox(height: 8),

            // Channel list with DM/Channel sections
            Expanded(
              child: channelsAsync.when(
                data: (channels) {
                  if (channels.isEmpty) {
                    return const AnimatedEmptyState(
                      type: EmptyStateType.radar,
                      title: 'Comms Silent',
                      subtitle: 'Start a conversation or create a channel.',
                    );
                  }

                  // Filter by search
                  final filtered = _query.isEmpty
                      ? channels
                      : channels.where((c) => c.displayName.toLowerCase().contains(_query)).toList();

                  // Split into DMs and channels
                  final dms = filtered.where((c) => c.isDm).toList();
                  final groups = filtered.where((c) => !c.isDm).toList();

                  if (filtered.isEmpty) {
                    return Center(
                      child: Text(
                        'No results for "$_query"',
                        style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                      ),
                    );
                  }

                  return ListView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(0, 4, 0, 120),
                    children: [
                      // Direct Messages section
                      if (dms.isNotEmpty) ...[
                        _SectionHeader(
                          label: 'DIRECT MESSAGES',
                          icon: PhosphorIconsLight.chatCircle,
                          count: dms.length,
                          index: 0,
                        ),
                        ...dms.asMap().entries.map((e) => _ChannelRow(
                          channel: e.value,
                          index: e.key,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.push('/chat/${e.value.id}');
                          },
                        )),
                        const SizedBox(height: 12),
                      ],

                      // Group Channels section
                      if (groups.isNotEmpty) ...[
                        _SectionHeader(
                          label: 'CHANNELS',
                          icon: PhosphorIconsLight.hash,
                          count: groups.length,
                          index: dms.length,
                        ),
                        ...groups.asMap().entries.map((e) => _ChannelRow(
                          channel: e.value,
                          index: e.key + dms.length + 1,
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.push('/chat/${e.value.id}');
                          },
                        )),
                      ],
                    ],
                  );
                },
                loading: () => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: List.generate(6, (i) =>
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ShimmerLoading(height: 56, borderRadius: ObsidianTheme.radiusMd),
                      ),
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Text('Error: $e', style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── New DM Sheet ──────────────────────────────

  void _showNewDmSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _NewDmSheet(parentRef: ref),
    );
  }

  // ── New Channel Sheet ─────────────────────────

  void _showNewChannelSheet(BuildContext context, WidgetRef ref) {
    final nameController = TextEditingController();

    showModalBottomSheet(
      context: context,
      backgroundColor: ObsidianTheme.surface1,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 32, height: 4,
                decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text('New Channel', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
            const SizedBox(height: 16),
            TextField(
              controller: nameController,
              autofocus: true,
              style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Channel name',
                hintStyle: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textTertiary),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: () async {
                  final name = nameController.text.trim();
                  if (name.isEmpty) return;
                  HapticFeedback.mediumImpact();

                  final userId = ref.read(currentUserIdProvider);
                  if (userId == null) return;

                  final orgData = await ref.read(userOrgIdProvider.future);
                  if (orgData == null) return;

                  final channelId = await ChatActions.createChannel(
                    organizationId: orgData,
                    name: name,
                  );

                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                    ctx.push('/chat/$channelId');
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: ObsidianTheme.radiusMd),
                ),
                child: Text('Create', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helper providers ─────────────────────────────────

final currentUserIdProvider = Provider<String?>((ref) {
  return ref.watch(currentUserProvider)?.id;
});

final userOrgIdProvider = FutureProvider<String?>((ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return null;

  final data = await ref.read(supabaseClientProvider)
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
  return data?['organization_id'] as String?;
});

final supabaseClientProvider = Provider((ref) => SupabaseService.client);
final currentUserProvider = Provider((ref) => SupabaseService.auth.currentUser);

// ── New DM Sheet (User Picker) ───────────────────────

class _NewDmSheet extends ConsumerStatefulWidget {
  final WidgetRef parentRef;
  const _NewDmSheet({required this.parentRef});

  @override
  ConsumerState<_NewDmSheet> createState() => _NewDmSheetState();
}

class _NewDmSheetState extends ConsumerState<_NewDmSheet> {
  String _search = '';
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final teammatesAsync = ref.watch(orgTeammatesProvider);
    final mq = MediaQuery.of(context);

    return Container(
      height: mq.size.height * 0.7,
      decoration: const BoxDecoration(
        color: ObsidianTheme.surface1,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          // Drag handle
          Center(
            child: Container(
              width: 32, height: 4,
              decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 12),

          // Title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(PhosphorIconsLight.chatCircleDots, size: 18, color: ObsidianTheme.emerald),
                const SizedBox(width: 10),
                Text('New Message', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: ObsidianTheme.shimmerBase,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 12),
                  Icon(PhosphorIconsLight.magnifyingGlass, size: 14, color: ObsidianTheme.textTertiary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      autofocus: true,
                      style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Search people...',
                        hintStyle: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onChanged: (v) => setState(() => _search = v.trim().toLowerCase()),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Loading overlay
          if (_loading)
            const Expanded(
              child: Center(
                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald)),
              ),
            )
          else
            Expanded(
              child: teammatesAsync.when(
                data: (teammates) {
                  final filtered = _search.isEmpty
                      ? teammates
                      : teammates.where((t) {
                          final name = (t['full_name'] as String? ?? '').toLowerCase();
                          final email = (t['email'] as String? ?? '').toLowerCase();
                          return name.contains(_search) || email.contains(_search);
                        }).toList();

                  if (filtered.isEmpty) {
                    return Center(
                      child: Text(
                        _search.isEmpty ? 'No teammates found' : 'No results for "$_search"',
                        style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                      ),
                    );
                  }

                  return ListView.builder(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(0, 4, 0, 20),
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final t = filtered[i];
                      final name = t['full_name'] as String? ?? 'Unknown';
                      final email = t['email'] as String? ?? '';
                      final initials = _getInitials(name);

                      return GestureDetector(
                        onTap: () => _openDm(t['id'] as String),
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          height: 56,
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Row(
                            children: [
                              // Avatar
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
                                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                                  border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                                ),
                                child: Center(
                                  child: Text(
                                    initials,
                                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                                      maxLines: 1, overflow: TextOverflow.ellipsis,
                                    ),
                                    if (email.isNotEmpty)
                                      Text(
                                        email,
                                        style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                                        maxLines: 1, overflow: TextOverflow.ellipsis,
                                      ),
                                  ],
                                ),
                              ),
                              const Icon(PhosphorIconsLight.chatCircle, size: 16, color: ObsidianTheme.textTertiary),
                            ],
                          ),
                        ),
                      ).animate().fadeIn(delay: Duration(milliseconds: 50 + i * 20), duration: 300.ms);
                    },
                  );
                },
                loading: () => const Center(
                  child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald)),
                ),
                error: (e, _) => Center(
                  child: Text('Error: $e', style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openDm(String otherUserId) async {
    setState(() => _loading = true);
    try {
      final orgId = await ref.read(userOrgIdProvider.future);
      if (orgId == null) return;

      final channelId = await ChatActions.getOrCreateDm(
        otherUserId: otherUserId,
        organizationId: orgId,
      );

      if (mounted) {
        Navigator.pop(context);
        context.push('/chat/$channelId');
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _getInitials(String name) {
    final parts = name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

// ── Section Header ───────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  final IconData icon;
  final int count;
  final int index;

  const _SectionHeader({required this.label, required this.icon, required this.count, required this.index});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          Icon(icon, size: 12, color: ObsidianTheme.textTertiary),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5, fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          Text(
            '$count',
            style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary),
          ),
        ],
      ),
    ).animate().fadeIn(delay: Duration(milliseconds: 80 + index * 15), duration: 400.ms);
  }
}

// ── Channel Row ──────────────────────────────────────

class _ChannelRow extends StatelessWidget {
  final ChatChannel channel;
  final int index;
  final VoidCallback onTap;

  const _ChannelRow({required this.channel, required this.index, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final currentUserId = SupabaseService.auth.currentUser?.id;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 60,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
        ),
        child: Row(
          children: [
            // Avatar / Icon
            if (channel.isDm)
              _buildDmAvatar(currentUserId)
            else
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: ObsidianTheme.shimmerBase,
                  border: Border.all(color: ObsidianTheme.border),
                ),
                child: const Center(
                  child: Icon(PhosphorIconsLight.hash, size: 16, color: ObsidianTheme.textTertiary),
                ),
              ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    channel.displayName,
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (!channel.isDm && channel.description != null && channel.description!.isNotEmpty)
                    Text(
                      channel.description!,
                      style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  if (channel.isDm)
                    Text(
                      'Direct Message',
                      style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                    ),
                ],
              ),
            ),

            // Time
            if (channel.lastMessageAt != null)
              Text(
                timeago.format(channel.lastMessageAt!, locale: 'en_short'),
                style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary),
              ),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 100 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 10, end: 0, delay: Duration(milliseconds: 100 + index * 20), duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }

  Widget _buildDmAvatar(String? currentUserId) {
    final partner = currentUserId != null ? channel.dmPartner(currentUserId) : null;
    final initials = partner?.displayName != null
        ? _getInitials(partner!.displayName!)
        : channel.dmInitials;

    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
      ),
      child: Center(
        child: Text(
          initials,
          style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
