// ============================================================================
// Evidence Markup Editor — Full-featured image annotation canvas
// ============================================================================

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/evidence/models/evidence_models.dart';

// ══════════════════════════════════════════════════════
// ── Markup Editor Widget ─────────────────────────────
// ══════════════════════════════════════════════════════

class MarkupEditor extends StatefulWidget {
  const MarkupEditor({
    super.key,
    required this.imageBytes,
    required this.onSave,
    this.onCancel,
  });

  /// Raw image bytes (JPEG/PNG) to annotate.
  final Uint8List imageBytes;

  /// Called with the flattened annotated image as JPEG bytes.
  final ValueChanged<Uint8List> onSave;

  /// Called when the user cancels without saving.
  final VoidCallback? onCancel;

  @override
  State<MarkupEditor> createState() => _MarkupEditorState();
}

class _MarkupEditorState extends State<MarkupEditor> {
  final GlobalKey _repaintKey = GlobalKey();

  ui.Image? _backgroundImage;
  MarkupState _markupState = const MarkupState();
  List<Offset> _currentPoints = [];
  bool _isSaving = false;
  bool _showTextInput = false;
  final TextEditingController _textController = TextEditingController();
  Offset? _pendingTextPosition;

  // ── Tool presets ───────────────────────────────────

  static const _toolPresets = <MarkupToolType, _ToolPreset>{
    MarkupToolType.pen: _ToolPreset(
      strokeWidth: 3.0,
      opacity: 1.0,
      color: Color(0xFFF43F5E), // rose
    ),
    MarkupToolType.highlighter: _ToolPreset(
      strokeWidth: 20.0,
      opacity: 0.4,
      color: Color(0xFFF59E0B), // amber / yellow
    ),
    MarkupToolType.arrow: _ToolPreset(
      strokeWidth: 3.0,
      opacity: 1.0,
      color: Color(0xFFF43F5E),
    ),
    MarkupToolType.text: _ToolPreset(
      strokeWidth: 1.0,
      opacity: 1.0,
      color: Color(0xFFFFFFFF),
    ),
    MarkupToolType.rectangle: _ToolPreset(
      strokeWidth: 2.0,
      opacity: 1.0,
      color: Color(0xFFF43F5E),
    ),
    MarkupToolType.eraser: _ToolPreset(
      strokeWidth: 20.0,
      opacity: 1.0,
      color: Color(0x00000000),
    ),
  };

  // ── Color palette ─────────────────────────────────

  static const _palette = <Color>[
    Color(0xFFF43F5E), // Red
    Color(0xFFF59E0B), // Yellow
    Color(0xFF3B82F6), // Blue
    Color(0xFFFFFFFF), // White
    Color(0xFF10B981), // Green
  ];

  @override
  void initState() {
    super.initState();
    _decodeImage();
  }

  @override
  void dispose() {
    _textController.dispose();
    _backgroundImage?.dispose();
    super.dispose();
  }

  Future<void> _decodeImage() async {
    final codec = await ui.instantiateImageCodec(widget.imageBytes);
    final frame = await codec.getNextFrame();
    if (mounted) {
      setState(() => _backgroundImage = frame.image);
    }
  }

  // ── Tool selection ────────────────────────────────

  void _selectTool(MarkupToolType tool) {
    final preset = _toolPresets[tool]!;
    setState(() {
      _markupState = _markupState.copyWith(
        activeTool: tool,
        activeStrokeWidth: preset.strokeWidth,
        activeColor: _markupState.activeColor, // keep current color
      );
    });
  }

  void _selectColor(Color color) {
    setState(() {
      _markupState = _markupState.copyWith(activeColor: color);
    });
  }

  // ── Drawing gestures ──────────────────────────────

  void _onPanStart(DragStartDetails details) {
    if (_markupState.activeTool == MarkupToolType.text) {
      setState(() {
        _pendingTextPosition = details.localPosition;
        _showTextInput = true;
      });
      return;
    }
    _currentPoints = [details.localPosition];
  }

  void _onPanUpdate(DragUpdateDetails details) {
    if (_markupState.activeTool == MarkupToolType.text) return;
    setState(() {
      _currentPoints = [..._currentPoints, details.localPosition];
    });
  }

  void _onPanEnd(DragEndDetails details) {
    if (_markupState.activeTool == MarkupToolType.text) return;
    if (_currentPoints.isEmpty) return;

    final tool = _markupState.activeTool;
    final preset = _toolPresets[tool]!;

    final action = MarkupAction(
      type: tool,
      color: tool == MarkupToolType.eraser
          ? const Color(0x00000000)
          : _markupState.activeColor,
      strokeWidth: _markupState.activeStrokeWidth,
      opacity: preset.opacity,
      points: List.from(_currentPoints),
    );

    setState(() {
      _markupState = _markupState.addAction(action);
      _currentPoints = [];
    });
  }

  void _commitText() {
    final text = _textController.text.trim();
    if (text.isEmpty || _pendingTextPosition == null) {
      setState(() {
        _showTextInput = false;
        _textController.clear();
      });
      return;
    }

    final action = MarkupAction(
      type: MarkupToolType.text,
      color: _markupState.activeColor,
      strokeWidth: 1.0,
      opacity: 1.0,
      text: text,
      textPosition: _pendingTextPosition,
      fontSize: 18.0,
    );

    setState(() {
      _markupState = _markupState.addAction(action);
      _showTextInput = false;
      _textController.clear();
      _pendingTextPosition = null;
    });
  }

  // ── Undo / Redo ───────────────────────────────────

  void _undo() {
    setState(() => _markupState = _markupState.undo());
  }

  void _redo() {
    setState(() => _markupState = _markupState.redo());
  }

  // ── Save: flatten to JPEG ─────────────────────────

  Future<void> _save() async {
    if (_isSaving) return;
    setState(() => _isSaving = true);

    try {
      final boundary = _repaintKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) return;

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );

      if (byteData != null) {
        widget.onSave(byteData.buffer.asUint8List());
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // ── Build ─────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        child: Column(
          children: [
            _buildTopBar(),
            Expanded(child: _buildCanvas()),
            if (_showTextInput) _buildTextInput(),
            _buildToolbar(),
            _buildColorPicker(),
          ],
        ),
      ),
    );
  }

  // ── Top bar (undo / redo / save) ──────────────────

  Widget _buildTopBar() {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        color: Color(0xFF0A0A0A),
        border: Border(
          bottom: BorderSide(color: Color(0x0DFFFFFF)),
        ),
      ),
      child: Row(
        children: [
          // Cancel
          GestureDetector(
            onTap: widget.onCancel ?? () => Navigator.of(context).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(
                color: Color(0xFFA1A1AA),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const Spacer(),
          // Undo
          _TopBarButton(
            icon: PhosphorIcons.arrowCounterClockwise(PhosphorIconsStyle.bold),
            enabled: _markupState.canUndo,
            onTap: _undo,
          ),
          const SizedBox(width: 8),
          // Redo
          _TopBarButton(
            icon: PhosphorIcons.arrowClockwise(PhosphorIconsStyle.bold),
            enabled: _markupState.canRedo,
            onTap: _redo,
          ),
          const SizedBox(width: 16),
          // Save
          GestureDetector(
            onTap: _isSaving ? null : _save,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(8),
              ),
              child: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.black,
                      ),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(
                        color: Colors.black,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Drawing canvas ────────────────────────────────

  Widget _buildCanvas() {
    if (_backgroundImage == null) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF10B981)),
      );
    }

    return RepaintBoundary(
      key: _repaintKey,
      child: GestureDetector(
        onPanStart: _onPanStart,
        onPanUpdate: _onPanUpdate,
        onPanEnd: _onPanEnd,
        child: ClipRect(
          child: CustomPaint(
            painter: MarkupPainter(
              backgroundImage: _backgroundImage!,
              actions: _markupState.actions,
              currentPoints: _currentPoints,
              currentTool: _markupState.activeTool,
              currentColor: _markupState.activeColor,
              currentStrokeWidth: _markupState.activeStrokeWidth,
              currentOpacity: _toolPresets[_markupState.activeTool]!.opacity,
            ),
            size: Size.infinite,
          ),
        ),
      ),
    );
  }

  // ── Text input overlay ────────────────────────────

  Widget _buildTextInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: const Color(0xFF0A0A0A),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              autofocus: true,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Enter annotation text…',
                hintStyle: TextStyle(color: Color(0xFF71717A)),
                border: InputBorder.none,
              ),
              onSubmitted: (_) => _commitText(),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _commitText,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Add',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Tool toolbar ──────────────────────────────────

  Widget _buildToolbar() {
    return Container(
      height: 56,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A0A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x0DFFFFFF)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ToolButton(
            icon: PhosphorIcons.pen(PhosphorIconsStyle.fill),
            label: 'Pen',
            isActive: _markupState.activeTool == MarkupToolType.pen,
            onTap: () => _selectTool(MarkupToolType.pen),
          ),
          _ToolButton(
            icon: PhosphorIcons.highlighter(PhosphorIconsStyle.fill),
            label: 'Highlight',
            isActive: _markupState.activeTool == MarkupToolType.highlighter,
            onTap: () => _selectTool(MarkupToolType.highlighter),
          ),
          _ToolButton(
            icon: PhosphorIcons.arrowUpRight(PhosphorIconsStyle.bold),
            label: 'Arrow',
            isActive: _markupState.activeTool == MarkupToolType.arrow,
            onTap: () => _selectTool(MarkupToolType.arrow),
          ),
          _ToolButton(
            icon: PhosphorIcons.textT(PhosphorIconsStyle.bold),
            label: 'Text',
            isActive: _markupState.activeTool == MarkupToolType.text,
            onTap: () => _selectTool(MarkupToolType.text),
          ),
          _ToolButton(
            icon: PhosphorIcons.rectangle(PhosphorIconsStyle.bold),
            label: 'Rect',
            isActive: _markupState.activeTool == MarkupToolType.rectangle,
            onTap: () => _selectTool(MarkupToolType.rectangle),
          ),
          _ToolButton(
            icon: PhosphorIcons.eraser(PhosphorIconsStyle.fill),
            label: 'Eraser',
            isActive: _markupState.activeTool == MarkupToolType.eraser,
            onTap: () => _selectTool(MarkupToolType.eraser),
          ),
        ],
      ),
    );
  }

  // ── Color picker ──────────────────────────────────

  Widget _buildColorPicker() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 16, right: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: _palette.map((color) {
          final isActive = _markupState.activeColor == color;
          return GestureDetector(
            onTap: () => _selectColor(color),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              margin: const EdgeInsets.symmetric(horizontal: 6),
              width: isActive ? 32 : 26,
              height: isActive ? 32 : 26,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isActive
                      ? const Color(0xFF10B981)
                      : const Color(0x33FFFFFF),
                  width: isActive ? 2.5 : 1.0,
                ),
                boxShadow: isActive
                    ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 8)]
                    : null,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Markup Painter (CustomPainter) ───────────────────
// ══════════════════════════════════════════════════════

class MarkupPainter extends CustomPainter {
  MarkupPainter({
    required this.backgroundImage,
    required this.actions,
    required this.currentPoints,
    required this.currentTool,
    required this.currentColor,
    required this.currentStrokeWidth,
    required this.currentOpacity,
  });

  final ui.Image backgroundImage;
  final List<MarkupAction> actions;
  final List<Offset> currentPoints;
  final MarkupToolType currentTool;
  final Color currentColor;
  final double currentStrokeWidth;
  final double currentOpacity;

  @override
  void paint(Canvas canvas, Size size) {
    // ── Draw background image (fitted) ──────────────
    final imgW = backgroundImage.width.toDouble();
    final imgH = backgroundImage.height.toDouble();
    final scale = math.min(size.width / imgW, size.height / imgH);
    final scaledW = imgW * scale;
    final scaledH = imgH * scale;
    final dx = (size.width - scaledW) / 2;
    final dy = (size.height - scaledH) / 2;

    canvas.drawImageRect(
      backgroundImage,
      Rect.fromLTWH(0, 0, imgW, imgH),
      Rect.fromLTWH(dx, dy, scaledW, scaledH),
      Paint(),
    );

    // ── Draw committed actions ──────────────────────
    for (final action in actions) {
      _paintAction(canvas, action);
    }

    // ── Draw live stroke (in-progress) ──────────────
    if (currentPoints.isNotEmpty && currentTool != MarkupToolType.text) {
      _paintAction(
        canvas,
        MarkupAction(
          type: currentTool,
          color: currentTool == MarkupToolType.eraser
              ? const Color(0x00000000)
              : currentColor,
          strokeWidth: currentStrokeWidth,
          opacity: currentOpacity,
          points: currentPoints,
        ),
      );
    }
  }

  void _paintAction(Canvas canvas, MarkupAction action) {
    switch (action.type) {
      case MarkupToolType.pen:
        _paintStroke(canvas, action, BlendMode.srcOver);
      case MarkupToolType.highlighter:
        _paintStroke(canvas, action, BlendMode.multiply);
      case MarkupToolType.arrow:
        _paintArrow(canvas, action);
      case MarkupToolType.text:
        _paintText(canvas, action);
      case MarkupToolType.rectangle:
        _paintRectangle(canvas, action);
      case MarkupToolType.eraser:
        _paintEraser(canvas, action);
    }
  }

  void _paintStroke(
      Canvas canvas, MarkupAction action, BlendMode blendMode) {
    if (action.points.length < 2) return;

    final paint = Paint()
      ..color = action.color.withValues(alpha: action.opacity)
      ..strokeWidth = action.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      ..blendMode = blendMode;

    final path = Path()..moveTo(action.points[0].dx, action.points[0].dy);
    for (var i = 1; i < action.points.length; i++) {
      path.lineTo(action.points[i].dx, action.points[i].dy);
    }
    canvas.drawPath(path, paint);
  }

  void _paintArrow(Canvas canvas, MarkupAction action) {
    if (action.points.length < 2) return;

    final start = action.points.first;
    final end = action.points.last;

    final paint = Paint()
      ..color = action.color.withValues(alpha: action.opacity)
      ..strokeWidth = action.strokeWidth
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    // Draw line
    canvas.drawLine(start, end, paint);

    // Draw arrowhead
    final angle = math.atan2(end.dy - start.dy, end.dx - start.dx);
    const arrowLength = 16.0;
    const arrowAngle = math.pi / 6; // 30 degrees

    final arrowP1 = Offset(
      end.dx - arrowLength * math.cos(angle - arrowAngle),
      end.dy - arrowLength * math.sin(angle - arrowAngle),
    );
    final arrowP2 = Offset(
      end.dx - arrowLength * math.cos(angle + arrowAngle),
      end.dy - arrowLength * math.sin(angle + arrowAngle),
    );

    final arrowPath = Path()
      ..moveTo(end.dx, end.dy)
      ..lineTo(arrowP1.dx, arrowP1.dy)
      ..lineTo(arrowP2.dx, arrowP2.dy)
      ..close();

    canvas.drawPath(
      arrowPath,
      Paint()
        ..color = action.color.withValues(alpha: action.opacity)
        ..style = PaintingStyle.fill,
    );
  }

  void _paintText(Canvas canvas, MarkupAction action) {
    if (action.text == null || action.textPosition == null) return;

    final fontSize = action.fontSize ?? 18.0;
    final pos = action.textPosition!;

    // Black outline for legibility
    final outlinePainter = TextPainter(
      text: TextSpan(
        text: action.text,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          foreground: Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3
            ..color = Colors.black,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    outlinePainter.paint(canvas, pos);

    // Foreground text
    final textPainter = TextPainter(
      text: TextSpan(
        text: action.text,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
          color: action.color.withValues(alpha: action.opacity),
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(canvas, pos);
  }

  void _paintRectangle(Canvas canvas, MarkupAction action) {
    if (action.points.length < 2) return;

    final start = action.points.first;
    final end = action.points.last;

    final paint = Paint()
      ..color = action.color.withValues(alpha: action.opacity)
      ..strokeWidth = action.strokeWidth
      ..style = PaintingStyle.stroke;

    canvas.drawRect(Rect.fromPoints(start, end), paint);
  }

  void _paintEraser(Canvas canvas, MarkupAction action) {
    if (action.points.length < 2) return;

    final paint = Paint()
      ..strokeWidth = action.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      ..blendMode = BlendMode.clear;

    final path = Path()..moveTo(action.points[0].dx, action.points[0].dy);
    for (var i = 1; i < action.points.length; i++) {
      path.lineTo(action.points[i].dx, action.points[i].dy);
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant MarkupPainter oldDelegate) => true;
}

// ══════════════════════════════════════════════════════
// ── Helper Widgets ───────────────────────────────────
// ══════════════════════════════════════════════════════

class _ToolPreset {
  const _ToolPreset({
    required this.strokeWidth,
    required this.opacity,
    required this.color,
  });

  final double strokeWidth;
  final double opacity;
  final Color color;
}

class _TopBarButton extends StatelessWidget {
  const _TopBarButton({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        opacity: enabled ? 1.0 : 0.3,
        duration: const Duration(milliseconds: 150),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFF10B981).withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 20,
              color: isActive
                  ? const Color(0xFF10B981)
                  : const Color(0xFFA1A1AA),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w500,
                color: isActive
                    ? const Color(0xFF10B981)
                    : const Color(0xFF71717A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
