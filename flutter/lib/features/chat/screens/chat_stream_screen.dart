import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/chat_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/core/widgets/shimmer_loading.dart';
import 'package:iworkr_mobile/features/chat/widgets/command_composer.dart';
import 'package:iworkr_mobile/features/chat/widgets/message_bubble.dart';
import 'package:iworkr_mobile/features/chat/widgets/poll_card.dart';
import 'package:iworkr_mobile/models/chat_message.dart';

/// Chat Stream — real-time message feed with rich composer.
class ChatStreamScreen extends ConsumerStatefulWidget {
  final String channelId;
  const ChatStreamScreen({super.key, required this.channelId});

  @override
  ConsumerState<ChatStreamScreen> createState() => _ChatStreamScreenState();
}

class _ChatStreamScreenState extends ConsumerState<ChatStreamScreen> {
  final _scrollController = ScrollController();
  final _composerKey = GlobalKey<CommandComposerState>();
  String? _channelName;
  String? _channelType;
  String? _dmPartnerName;

  @override
  void initState() {
    super.initState();
    ChatActions.markRead(widget.channelId);
    _loadChannelInfo();
  }

  Future<void> _loadChannelInfo() async {
    final data = await SupabaseService.client
        .from('channels')
        .select('name, type')
        .eq('id', widget.channelId)
        .maybeSingle();
    if (!mounted || data == null) return;

    setState(() {
      _channelName = data['name'] as String?;
      _channelType = data['type'] as String?;
    });

    // For DMs, load the other person's name
    if (_channelType == 'dm') {
      final currentUserId = SupabaseService.auth.currentUser?.id;
      final members = await SupabaseService.client
          .from('channel_members')
          .select('user_id, profiles:user_id(full_name)')
          .eq('channel_id', widget.channelId);

      if (mounted) {
        for (final m in members) {
          if (m['user_id'] != currentUserId) {
            final profile = m['profiles'] as Map<String, dynamic>?;
            setState(() => _dmPartnerName = profile?['full_name'] as String?);
            break;
          }
        }
      }
    }

    // Set up poll callback after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _composerKey.currentState?.setPollCallback((question, options) async {
        await ChatActions.sendPoll(
          channelId: widget.channelId,
          question: question,
          options: options,
        );
        _scrollToBottom();
      });
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutQuart,
          );
        }
      });
    }
  }

  bool get _isDm => _channelType == 'dm';

  String get _headerTitle {
    if (_isDm && _dmPartnerName != null) return _dmPartnerName!;
    return _channelName ?? 'Channel';
  }

  String get _headerSubtitle {
    if (_isDm) return 'Direct Message';
    return 'Channel';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final messagesAsync = ref.watch(messagesProvider(widget.channelId));
    final membersAsync = ref.watch(channelMembersProvider(widget.channelId));
    final currentUserId = SupabaseService.auth.currentUser?.id;

    // Build member list for @mention picker
    final membersList = membersAsync.whenOrNull(data: (members) {
      return members
          .where((m) => m.userId != currentUserId)
          .map((m) => {'name': m.displayName ?? 'Unknown', 'id': m.userId})
          .toList();
    }) ?? [];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: c.border)),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.pop();
                    },
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: Icon(PhosphorIconsLight.arrowLeft, size: 20, color: c.textSecondary),
                      ),
                    ),
                  ),

                  // Channel/DM icon
                  if (_isDm)
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                        border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                      ),
                      child: Center(
                        child: Text(
                          _dmPartnerName != null ? _getInitials(_dmPartnerName!) : '?',
                          style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald),
                        ),
                      ),
                    )
                  else
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: c.shimmerBase,
                        border: Border.all(color: c.border),
                      ),
                      child: Center(
                        child: Icon(PhosphorIconsLight.hash, size: 13, color: c.textTertiary),
                      ),
                    ),
                  const SizedBox(width: 10),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _headerTitle,
                          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                        ),
                        Text(
                          _headerSubtitle,
                          style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => HapticFeedback.lightImpact(),
                    child: Icon(PhosphorIconsLight.dotsThree, size: 20, color: c.textSecondary),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 200.ms),

            // Message stream
            Expanded(
              child: messagesAsync.when(
                data: (messages) {
                  if (messages.isEmpty) {
                    return AnimatedEmptyState(
                      type: EmptyStateType.radar,
                      title: _isDm ? 'Say Hello' : 'Channel Secure',
                      subtitle: _isDm
                          ? 'Start the conversation with ${_dmPartnerName ?? 'them'}.'
                          : 'No chatter. Send the first transmission.',
                    );
                  }

                  WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

                  return ListView.builder(
                    controller: _scrollController,
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                    itemCount: messages.length,
                    itemBuilder: (context, i) {
                      final msg = messages[i];
                      final isMe = msg.senderId == currentUserId;

                      final showSender = !_isDm && (i == 0 || messages[i - 1].senderId != msg.senderId);

                      if (msg.isPoll) {
                        return _buildPollMessage(msg);
                      }

                      return MessageBubble(
                        message: msg,
                        isMe: isMe,
                        showSender: showSender,
                        index: i,
                      );
                    },
                  );
                },
                loading: () => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: List.generate(5, (i) =>
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Align(
                          alignment: i.isEven ? Alignment.centerLeft : Alignment.centerRight,
                          child: ShimmerLoading(
                            height: 40,
                            width: MediaQuery.of(context).size.width * 0.6,
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Text('Error: $e', style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12)),
                ),
              ),
            ),

            // Composer
            Padding(
              padding: EdgeInsets.fromLTRB(12, 4, 12, MediaQuery.of(context).padding.bottom + 8),
              child: CommandComposer(
                key: _composerKey,
                channelId: widget.channelId,
                members: membersList,
                onSend: (text) async {
                  await ChatActions.sendMessage(
                    channelId: widget.channelId,
                    content: text,
                  );
                  _scrollToBottom();
                },
              ),
            ).animate().fadeIn(delay: 200.ms, duration: 300.ms).moveY(begin: 20, end: 0, duration: 300.ms, curve: Curves.easeOutQuart),
          ],
        ),
      ),
    );
  }

  Widget _buildPollMessage(ChatMessage msg) {
    final pollAsync = ref.watch(pollProvider(msg.id));

    return pollAsync.when(
      data: (poll) {
        if (poll == null) return const SizedBox.shrink();
        return PollCard(
          poll: poll,
          onVote: (index) async {
            await ChatActions.votePoll(pollId: poll.id, optionIndex: index);
            ref.invalidate(pollProvider(msg.id));
          },
        );
      },
      loading: () => const SizedBox(height: 80),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  String _getInitials(String name) {
    final parts = name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}
