// ============================================================================
// AI Tag Chips — Interactive confidence-scored tag display
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Displays AI-detected tags as interactive chips with confidence scores.
///
/// Each chip shows the tag label + confidence percentage. Tapping a chip
/// removes it via [onRemove]. A trailing "+ Add Tag" chip allows manual entry.
class AiTagChips extends StatefulWidget {
  const AiTagChips({
    super.key,
    required this.tags,
    required this.confidence,
    this.onRemove,
    this.onAdd,
  });

  /// Current list of tag labels.
  final List<String> tags;

  /// Confidence scores keyed by tag label (0.0–1.0).
  final Map<String, double> confidence;

  /// Called when a tag chip is tapped for removal.
  final ValueChanged<String>? onRemove;

  /// Called when a new tag is manually added.
  final ValueChanged<String>? onAdd;

  @override
  State<AiTagChips> createState() => _AiTagChipsState();
}

class _AiTagChipsState extends State<AiTagChips> {
  bool _showInput = false;
  final _inputController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _inputController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submitTag() {
    final text = _inputController.text.trim();
    if (text.isNotEmpty) {
      widget.onAdd?.call(text);
      _inputController.clear();
    }
    setState(() => _showInput = false);
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        // Tag chips with staggered animation
        ...widget.tags.asMap().entries.map((entry) {
          final index = entry.key;
          final tag = entry.value;
          final conf = widget.confidence[tag];
          final confText =
              conf != null ? ' ${(conf * 100).toStringAsFixed(0)}%' : '';

          return _AnimatedChip(
            index: index,
            child: InputChip(
              label: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    tag,
                    style: const TextStyle(
                      color: Color(0xFFEDEDED),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (confText.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Text(
                      confText,
                      style: const TextStyle(
                        color: Color(0xFF71717A),
                        fontSize: 10,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ],
              ),
              avatar: Icon(
                PhosphorIcons.sparkle(PhosphorIconsStyle.fill),
                size: 14,
                color: const Color(0xFF6366F1), // indigo for AI
              ),
              deleteIcon: Icon(
                PhosphorIcons.x(PhosphorIconsStyle.bold),
                size: 12,
                color: const Color(0xFFA1A1AA),
              ),
              onDeleted: () => widget.onRemove?.call(tag),
              onPressed: () => widget.onRemove?.call(tag),
              backgroundColor: const Color(0xFF141414),
              side: const BorderSide(color: Color(0x0DFFFFFF)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          );
        }),

        // "+ Add Tag" chip / inline text field
        if (_showInput)
          SizedBox(
            width: 140,
            height: 36,
            child: TextField(
              controller: _inputController,
              focusNode: _focusNode,
              autofocus: true,
              style: const TextStyle(color: Color(0xFFEDEDED), fontSize: 12),
              decoration: InputDecoration(
                hintText: 'Tag name…',
                hintStyle: const TextStyle(
                  color: Color(0xFF71717A),
                  fontSize: 12,
                ),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                filled: true,
                fillColor: const Color(0xFF141414),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF10B981)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0x4D10B981)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF10B981)),
                ),
              ),
              onSubmitted: (_) => _submitTag(),
              onTapOutside: (_) => _submitTag(),
            ),
          )
        else
          ActionChip(
            label: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  PhosphorIcons.plus(PhosphorIconsStyle.bold),
                  size: 14,
                  color: const Color(0xFF10B981),
                ),
                const SizedBox(width: 4),
                const Text(
                  'Add Tag',
                  style: TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            onPressed: () {
              setState(() => _showInput = true);
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _focusNode.requestFocus();
              });
            },
            backgroundColor: const Color(0xFF10B981).withValues(alpha: 0.1),
            side: const BorderSide(color: Color(0x4D10B981)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
      ],
    );
  }
}

// ── Stagger animation wrapper ───────────────────────

class _AnimatedChip extends StatelessWidget {
  const _AnimatedChip({
    required this.index,
    required this.child,
  });

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return child
        .animate()
        .fadeIn(
          delay: Duration(milliseconds: 40 * index),
          duration: const Duration(milliseconds: 300),
        )
        .slideX(
          begin: 0.1,
          end: 0,
          delay: Duration(milliseconds: 40 * index),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
  }
}
