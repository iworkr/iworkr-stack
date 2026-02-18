import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// Command Composer — glass input bar with action toggles.
///
/// Actions:
///   @ — mention a member (inserts @Name into text)
///   # — reference a tag
///   + — attachment menu (Poll, Camera, Photo, File, Location)
///   Send — fires the message
class CommandComposer extends StatefulWidget {
  final ValueChanged<String> onSend;
  final ValueChanged<String>? onSendPoll;
  final List<Map<String, dynamic>> members;
  final String channelId;

  const CommandComposer({
    super.key,
    required this.onSend,
    this.onSendPoll,
    this.members = const [],
    this.channelId = '',
  });

  @override
  State<CommandComposer> createState() => CommandComposerState();
}

class CommandComposerState extends State<CommandComposer> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final has = _controller.text.trim().isNotEmpty;
      if (has != _hasText) setState(() => _hasText = has);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    HapticFeedback.mediumImpact();
    widget.onSend(text);
    _controller.clear();
    _focusNode.requestFocus();
  }

  // ── @ Mention ─────────────────────────────────

  void _showMentionPicker() {
    HapticFeedback.selectionClick();
    if (widget.members.isEmpty) {
      _insertText('@');
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _MemberPickerSheet(
        members: widget.members,
        onSelect: (name) {
          Navigator.pop(ctx);
          _insertText('@$name ');
        },
      ),
    );
  }

  // ── # Tag ─────────────────────────────────────

  void _showTagMenu() {
    HapticFeedback.selectionClick();
    final tags = ['urgent', 'question', 'update', 'resolved', 'blocker', 'fyi'];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: ObsidianTheme.surface1,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Center(child: Container(width: 32, height: 4, decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(PhosphorIconsLight.hash, size: 16, color: ObsidianTheme.emerald),
                  const SizedBox(width: 8),
                  Text('Insert Tag', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: tags.map((tag) => GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(ctx);
                  _insertText('#$tag ');
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: ObsidianTheme.shimmerBase,
                    border: Border.all(color: ObsidianTheme.border),
                  ),
                  child: Text('#$tag', style: GoogleFonts.jetBrainsMono(fontSize: 12, color: ObsidianTheme.textSecondary)),
                ),
              )).toList(),
            ),
            SizedBox(height: MediaQuery.of(ctx).padding.bottom + 20),
          ],
        ),
      ),
    );
  }

  // ── / Templates (Slash Commands) ──────────────

  void _showTemplateMenu() {
    HapticFeedback.selectionClick();

    final templates = <(String, String, IconData, Color)>[
      ('/omw', "I'm on my way! ETA ~15 mins. 🚗", PhosphorIconsLight.navigationArrow, ObsidianTheme.blue),
      ('/late', "Running a bit late, apologies. Will be there shortly.", PhosphorIconsLight.clock, ObsidianTheme.amber),
      ('/done', "Job complete ✅ — all tasks finished and signed off.", PhosphorIconsLight.checkCircle, ObsidianTheme.emerald),
      ('/review', "Could you please leave us a quick review? It really helps! ⭐", PhosphorIconsLight.star, ObsidianTheme.gold),
      ('/reschedule', "We need to reschedule this appointment. What dates work for you?", PhosphorIconsLight.calendarPlus, ObsidianTheme.violet),
      ('/quote', "We've prepared a quote for you. Please review and approve at your convenience.", PhosphorIconsLight.fileText, ObsidianTheme.indigo),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: ObsidianTheme.surface1,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Center(child: Container(width: 32, height: 4, decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    const Icon(PhosphorIconsLight.lightning, size: 16, color: ObsidianTheme.emerald),
                    const SizedBox(width: 8),
                    Text('Quick Templates', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              ...templates.map((t) => _TemplateOption(
                command: t.$1,
                preview: t.$2,
                icon: t.$3,
                color: t.$4,
                onTap: () {
                  HapticFeedback.mediumImpact();
                  Navigator.pop(ctx);
                  _controller.text = t.$2;
                  _controller.selection = TextSelection.fromPosition(
                    TextPosition(offset: _controller.text.length),
                  );
                  setState(() => _hasText = true);
                  _focusNode.requestFocus();
                },
              )),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  // ── + Attach Menu ─────────────────────────────

  void _showAttachMenu() {
    HapticFeedback.selectionClick();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: ObsidianTheme.surface1,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Center(child: Container(width: 32, height: 4, decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 12),
              _AttachOption(
                icon: PhosphorIconsLight.chartBar,
                label: 'Create Poll',
                subtitle: 'Ask your team a question',
                color: ObsidianTheme.emerald,
                onTap: () {
                  Navigator.pop(ctx);
                  _showPollCreator();
                },
              ),
              _AttachOption(
                icon: PhosphorIconsLight.camera,
                label: 'Camera',
                subtitle: 'Take a photo or video',
                color: ObsidianTheme.blue,
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.lightImpact();
                },
              ),
              _AttachOption(
                icon: PhosphorIconsLight.image,
                label: 'Photo Library',
                subtitle: 'Choose from gallery',
                color: ObsidianTheme.violet,
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.lightImpact();
                },
              ),
              _AttachOption(
                icon: PhosphorIconsLight.file,
                label: 'File',
                subtitle: 'Share a document',
                color: ObsidianTheme.amber,
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.lightImpact();
                },
              ),
              _AttachOption(
                icon: PhosphorIconsLight.mapPin,
                label: 'Location',
                subtitle: 'Share your current location',
                color: ObsidianTheme.rose,
                onTap: () {
                  Navigator.pop(ctx);
                  HapticFeedback.lightImpact();
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  // ── Poll Creator ──────────────────────────────

  void _showPollCreator() {
    HapticFeedback.lightImpact();
    final questionCtrl = TextEditingController();
    final optionCtrls = [TextEditingController(), TextEditingController()];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            height: MediaQuery.of(ctx).size.height * 0.7,
            decoration: const BoxDecoration(
              color: ObsidianTheme.surface1,
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 32, height: 4, decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Icon(PhosphorIconsLight.chartBar, size: 18, color: ObsidianTheme.emerald),
                      const SizedBox(width: 10),
                      Text('Create Poll', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Question
                  Text('QUESTION', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: questionCtrl,
                    autofocus: true,
                    style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ask something...',
                      hintStyle: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textTertiary),
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Options
                  Text('OPTIONS', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary, letterSpacing: 1.5)),
                  const SizedBox(height: 6),
                  Expanded(
                    child: ListView(
                      children: [
                        ...optionCtrls.asMap().entries.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 22, height: 22,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: ObsidianTheme.border),
                                ),
                                child: Center(
                                  child: Text('${e.key + 1}', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: e.value,
                                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white),
                                  decoration: InputDecoration(
                                    hintText: 'Option ${e.key + 1}',
                                    hintStyle: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                                    border: InputBorder.none,
                                    enabledBorder: InputBorder.none,
                                    focusedBorder: InputBorder.none,
                                    isDense: true,
                                  ),
                                ),
                              ),
                              if (optionCtrls.length > 2)
                                GestureDetector(
                                  onTap: () {
                                    HapticFeedback.selectionClick();
                                    setSheetState(() => optionCtrls.removeAt(e.key));
                                  },
                                  child: const Padding(
                                    padding: EdgeInsets.only(left: 8),
                                    child: Icon(PhosphorIconsLight.x, size: 14, color: ObsidianTheme.textTertiary),
                                  ),
                                ),
                            ],
                          ),
                        )),
                        if (optionCtrls.length < 6)
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.selectionClick();
                              setSheetState(() => optionCtrls.add(TextEditingController()));
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Row(
                                children: [
                                  const Icon(PhosphorIconsLight.plus, size: 14, color: ObsidianTheme.emerald),
                                  const SizedBox(width: 8),
                                  Text('Add option', style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.emerald)),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Submit
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton(
                      onPressed: () {
                        final q = questionCtrl.text.trim();
                        final opts = optionCtrls.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList();
                        if (q.isEmpty || opts.length < 2) return;
                        HapticFeedback.mediumImpact();
                        Navigator.pop(ctx);
                        widget.onSendPoll?.call(q);
                        // The parent screen handles the actual poll creation
                        // We pass the data through the callback
                        _sendPollData(q, opts);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: ObsidianTheme.emerald,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: ObsidianTheme.radiusMd),
                      ),
                      child: Text('Send Poll', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _sendPollData(String question, List<String> options) {
    // Fire custom poll event via the onSendPoll callback
    if (_onPoll != null) {
      _onPoll!(question, options);
    }
  }

  // Allow parent to set poll callback
  void Function(String question, List<String> options)? _onPoll;
  void setPollCallback(void Function(String question, List<String> options) fn) {
    _onPoll = fn;
  }

  void _insertText(String text) {
    final sel = _controller.selection;
    final before = _controller.text.substring(0, sel.baseOffset.clamp(0, _controller.text.length));
    final after = _controller.text.substring(sel.extentOffset.clamp(0, _controller.text.length));
    _controller.text = '$before$text$after';
    _controller.selection = TextSelection.collapsed(offset: before.length + text.length);
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: ObsidianTheme.borderMedium),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _ActionButton(
                icon: PhosphorIconsLight.plus,
                onTap: _showAttachMenu,
                tooltip: 'Attach',
              ),
              _ActionButton(
                icon: PhosphorIconsLight.at,
                onTap: _showMentionPicker,
                tooltip: 'Mention',
              ),
              _ActionButton(
                icon: PhosphorIconsLight.hash,
                onTap: _showTagMenu,
                tooltip: 'Tag',
              ),
              _ActionButton(
                icon: PhosphorIconsLight.lightning,
                onTap: _showTemplateMenu,
                tooltip: 'Templates',
              ),
              const SizedBox(width: 4),
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 120),
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    maxLines: null,
                    textInputAction: TextInputAction.newline,
                    style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Transmit...',
                      hintStyle: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textTertiary),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                      isDense: true,
                    ),
                  ),
                ),
              ),
              AnimatedContainer(
                duration: ObsidianTheme.fast,
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: _hasText ? ObsidianTheme.emerald : Colors.transparent,
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: _hasText ? _handleSend : null,
                    child: Center(
                      child: AnimatedSwitcher(
                        duration: ObsidianTheme.fast,
                        child: Icon(
                          PhosphorIconsLight.paperPlaneTilt,
                          key: ValueKey(_hasText),
                          size: 18,
                          color: _hasText ? Colors.black : ObsidianTheme.textTertiary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Action Button ────────────────────────────────────

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final String tooltip;
  const _ActionButton({required this.icon, this.onTap, this.tooltip = ''});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap?.call();
      },
      child: SizedBox(
        width: 36,
        height: 36,
        child: Center(child: Icon(icon, size: 18, color: ObsidianTheme.textMuted)),
      ),
    );
  }
}

// ── Attach Option Row ────────────────────────────────

class _AttachOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _AttachOption({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: color.withValues(alpha: 0.1),
              ),
              child: Center(child: Icon(icon, size: 18, color: color)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textPrimary)),
                  Text(subtitle, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                ],
              ),
            ),
            const Icon(PhosphorIconsLight.caretRight, size: 14, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    );
  }
}

// ── Template Option Row ─────────────────────────────

class _TemplateOption extends StatelessWidget {
  final String command;
  final String preview;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _TemplateOption({
    required this.command,
    required this.preview,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: color.withValues(alpha: 0.1),
              ),
              child: Center(child: Icon(icon, size: 16, color: color)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(command, style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
                  const SizedBox(height: 1),
                  Text(
                    preview,
                    style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Member Picker Sheet ──────────────────────────────

class _MemberPickerSheet extends StatefulWidget {
  final List<Map<String, dynamic>> members;
  final ValueChanged<String> onSelect;

  const _MemberPickerSheet({required this.members, required this.onSelect});

  @override
  State<_MemberPickerSheet> createState() => _MemberPickerSheetState();
}

class _MemberPickerSheetState extends State<_MemberPickerSheet> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _search.isEmpty
        ? widget.members
        : widget.members.where((m) {
            final name = (m['name'] as String? ?? '').toLowerCase();
            return name.contains(_search);
          }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.5,
      decoration: const BoxDecoration(
        color: ObsidianTheme.surface1,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 8),
          Center(child: Container(width: 32, height: 4, decoration: BoxDecoration(color: ObsidianTheme.textTertiary.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(2)))),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(PhosphorIconsLight.at, size: 16, color: ObsidianTheme.emerald),
                const SizedBox(width: 8),
                Text('Mention', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              height: 36,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: ObsidianTheme.shimmerBase,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: TextField(
                autofocus: true,
                style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search...',
                  hintStyle: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                onChanged: (v) => setState(() => _search = v.trim().toLowerCase()),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              itemCount: filtered.length,
              itemBuilder: (context, i) {
                final m = filtered[i];
                final name = m['name'] as String? ?? 'Unknown';
                return GestureDetector(
                  onTap: () => widget.onSelect(name.split(' ').first),
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: ObsidianTheme.shimmerBase,
                          ),
                          child: Center(
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : '?',
                              style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: ObsidianTheme.textTertiary),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(name, style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textPrimary)),
                      ],
                    ),
                  ),
                ).animate().fadeIn(delay: Duration(milliseconds: 30 * i), duration: 200.ms);
              },
            ),
          ),
        ],
      ),
    );
  }
}
