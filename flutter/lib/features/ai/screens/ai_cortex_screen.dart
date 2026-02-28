import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/ai_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Shows the AI Cortex as a translucent overlay sheet.
void showAiCortex(BuildContext context, {String? jobId}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => AiCortexSheet(jobId: jobId),
  );
}

class AiCortexSheet extends ConsumerStatefulWidget {
  final String? jobId;
  const AiCortexSheet({super.key, this.jobId});

  @override
  ConsumerState<AiCortexSheet> createState() => _AiCortexSheetState();
}

class _AiCortexSheetState extends ConsumerState<AiCortexSheet>
    with TickerProviderStateMixin {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<_LocalMessage> _messages = [];
  bool _sending = false;
  late AnimationController _orbPulse;
  late AnimationController _particleRotation;

  @override
  void initState() {
    super.initState();
    _orbPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
    _particleRotation = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _orbPulse.dispose();
    _particleRotation.dispose();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    HapticFeedback.lightImpact();
    _controller.clear();
    setState(() {
      _messages.add(_LocalMessage(role: 'user', content: text));
      _sending = true;
    });
    _scrollToBottom();

    final response = await sendAiMessage(content: text, jobId: widget.jobId);

    if (!mounted) return;
    setState(() {
      _sending = false;
      if (response != null) {
        _messages.add(_LocalMessage(role: 'assistant', content: response.content));
      }
    });
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);
    final height = mq.size.height * 0.85;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: c.canvas.withValues(alpha: 0.94),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: ObsidianTheme.indigo.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          _buildHeader(),
          if (_messages.isEmpty) _buildHeroOrb(),
          Expanded(child: _buildMessagesList()),
          _buildInputBar(mq),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: ObsidianTheme.indigo.withValues(alpha: 0.1)),
        ),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: c.borderHover,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      ObsidianTheme.indigo.withValues(alpha: 0.3),
                      const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(PhosphorIconsLight.brain, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CORTEX',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.indigo,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                    ),
                  ),
                  Text(
                    'AI Field Agent',
                    style: GoogleFonts.inter(
                      color: c.textTertiary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              if (widget.jobId != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.indigo.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'JOB CONTEXT',
                    style: GoogleFonts.jetBrainsMono(
                      color: ObsidianTheme.indigo,
                      fontSize: 9,
                      letterSpacing: 1,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -6, duration: 400.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildHeroOrb() {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: AnimatedBuilder(
              animation: _orbPulse,
              builder: (context, child) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer glow
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            ObsidianTheme.indigo.withValues(alpha: 0.08 + _orbPulse.value * 0.06),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                    // Middle ring
                    Container(
                      width: 80 + _orbPulse.value * 8,
                      height: 80 + _orbPulse.value * 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: ObsidianTheme.indigo.withValues(alpha: 0.15 + _orbPulse.value * 0.1),
                          width: 1,
                        ),
                      ),
                    ),
                    // Core
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            ObsidianTheme.indigo.withValues(alpha: 0.5),
                            const Color(0xFF8B5CF6).withValues(alpha: 0.5),
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: ObsidianTheme.indigo.withValues(alpha: 0.2 + _orbPulse.value * 0.15),
                            blurRadius: 20 + _orbPulse.value * 10,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(PhosphorIconsLight.brain, color: Colors.white, size: 20),
                    ),
                    // Orbiting particles
                    AnimatedBuilder(
                      animation: _particleRotation,
                      builder: (_, __) => Transform.rotate(
                        angle: _particleRotation.value * math.pi * 2,
                        child: SizedBox(
                          width: 100,
                          height: 100,
                          child: Stack(
                            children: [
                              Positioned(
                                top: 0,
                                left: 44,
                                child: Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: ObsidianTheme.indigo.withValues(alpha: 0.6),
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 10,
                                right: 5,
                                child: Container(
                                  width: 4,
                                  height: 4,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'How can I help?',
            style: GoogleFonts.inter(
              color: c.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Ask about site history, access codes, or\nlet me help draft notes and quotes.',
            style: GoogleFonts.inter(
              color: c.textTertiary,
              fontSize: 13,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          // Quick suggestions
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              _SuggestionChip(
                label: 'Gate code?',
                onTap: () => _quickSend('What is the gate code for this site?'),
              ),
              _SuggestionChip(
                label: 'Job history',
                onTap: () => _quickSend('Show me the history of this job'),
              ),
              _SuggestionChip(
                label: 'Take a note',
                onTap: () => _quickSend('Take a note'),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: 200.ms, duration: 600.ms)
        .scale(begin: const Offset(0.9, 0.9), delay: 200.ms, duration: 600.ms, curve: Curves.easeOutCubic);
  }

  void _quickSend(String text) {
    _controller.text = text;
    _send();
  }

  Widget _buildMessagesList() {
    if (_messages.isEmpty) return const SizedBox.shrink();

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _messages.length + (_sending ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == _messages.length && _sending) {
          return _buildTypingIndicator();
        }
        final msg = _messages[index];
        return _MessageBubble(message: msg)
            .animate()
            .fadeIn(duration: 300.ms)
            .moveY(begin: 10, duration: 300.ms, curve: Curves.easeOutCubic);
      },
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: ObsidianTheme.indigo.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(3, (i) {
                return Container(
                  margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ObsidianTheme.indigo.withValues(alpha: 0.5),
                  ),
                )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .moveY(
                      begin: 0,
                      end: -6,
                      delay: Duration(milliseconds: 150 * i),
                      duration: 500.ms,
                      curve: Curves.easeInOut,
                    );
              }),
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 300.ms);
  }

  Widget _buildInputBar(MediaQueryData mq) {
    final c = context.iColors;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, mq.viewInsets.bottom > 0 ? 12 : mq.padding.bottom + 12),
      decoration: BoxDecoration(
        color: c.hoverBg,
        border: Border(
          top: BorderSide(color: c.border),
        ),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              // INCOMPLETE:TODO — Voice input not implemented; microphone button does nothing. Needs speech_to_text package integration. Done when tapping starts speech recognition and inserts transcribed text into the chat input.
            },
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: ObsidianTheme.indigo.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(PhosphorIconsLight.microphone, color: ObsidianTheme.indigo, size: 18),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _controller,
              style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Ask the Cortex...',
                hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
                filled: true,
                fillColor: Colors.transparent,
                contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 12),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _send,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [ObsidianTheme.indigo, const Color(0xFF8B5CF6)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(PhosphorIconsLight.paperPlaneTilt, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Message Bubble ──────────────────────────────────
class _MessageBubble extends StatelessWidget {
  final _LocalMessage message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isUser = message.role == 'user';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              width: 28,
              height: 28,
              margin: const EdgeInsets.only(top: 4, right: 8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    ObsidianTheme.indigo.withValues(alpha: 0.3),
                    const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                  ],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(PhosphorIconsLight.brain, color: Colors.white, size: 14),
            ),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isUser
                    ? ObsidianTheme.indigo.withValues(alpha: 0.15)
                    : c.border,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(isUser ? 16 : 4),
                  topRight: Radius.circular(isUser ? 4 : 16),
                  bottomLeft: const Radius.circular(16),
                  bottomRight: const Radius.circular(16),
                ),
                border: Border.all(
                  color: isUser
                      ? ObsidianTheme.indigo.withValues(alpha: 0.2)
                      : c.border,
                ),
              ),
              child: Text(
                message.content,
                style: isUser
                    ? GoogleFonts.inter(color: c.textPrimary, fontSize: 14, height: 1.45)
                    : GoogleFonts.jetBrainsMono(color: c.textPrimary, fontSize: 13, height: 1.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Suggestion Chip ─────────────────────────────────
class _SuggestionChip extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _SuggestionChip({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: ObsidianTheme.indigo.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: ObsidianTheme.indigo.withValues(alpha: 0.15)),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            color: ObsidianTheme.indigo,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ── Local message model (before persistence) ────────
class _LocalMessage {
  final String role;
  final String content;
  _LocalMessage({required this.role, required this.content});
}
