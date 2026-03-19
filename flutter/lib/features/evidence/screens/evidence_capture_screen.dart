// ============================================================================
// Evidence Capture Screen — Camera → AI Tag → Annotate → Save
// ============================================================================

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:supabase_flutter/supabase_flutter.dart' show FileOptions;

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/evidence/models/evidence_models.dart';
import 'package:iworkr_mobile/features/evidence/widgets/ai_tag_chips.dart';
import 'package:iworkr_mobile/features/evidence/widgets/markup_editor.dart';

// ══════════════════════════════════════════════════════
// ── Screen State ─────────────────────────────────────
// ══════════════════════════════════════════════════════

enum _CapturePhase { camera, review, annotate, saving }

// ══════════════════════════════════════════════════════
// ── Evidence Capture Screen ──────────────────────────
// ══════════════════════════════════════════════════════

class EvidenceCaptureScreen extends ConsumerStatefulWidget {
  const EvidenceCaptureScreen({
    super.key,
    required this.jobId,
    required this.workspaceId,
  });

  final String jobId;
  final String workspaceId;

  @override
  ConsumerState<EvidenceCaptureScreen> createState() =>
      _EvidenceCaptureScreenState();
}

class _EvidenceCaptureScreenState
    extends ConsumerState<EvidenceCaptureScreen> {
  final _imagePicker = ImagePicker();

  _CapturePhase _phase = _CapturePhase.camera;
  Uint8List? _imageBytes;
  Uint8List? _annotatedBytes;
  List<String> _aiTags = [];
  Map<String, double> _aiConfidence = {};
  List<String> _manualTags = [];
  String _caption = '';
  bool _isClientVisible = true;
  bool _isDefect = false;

  @override
  void initState() {
    super.initState();
    // Auto-open camera on mount
    WidgetsBinding.instance.addPostFrameCallback((_) => _capturePhoto());
  }

  // ── Camera capture ────────────────────────────────

  Future<void> _capturePhoto() async {
    final xFile = await _imagePicker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 2048,
      maxHeight: 2048,
    );

    if (xFile == null) {
      // User cancelled — pop back
      if (mounted) Navigator.of(context).pop();
      return;
    }

    final bytes = await xFile.readAsBytes();

    setState(() {
      _imageBytes = bytes;
      _phase = _CapturePhase.review;
    });

    // Run AI tagging (mocked for now)
    _runAiTagging(bytes);
  }

  // ── AI Tagging (mock) ─────────────────────────────

  /// Mock AI tagging — in production this would call MLKit or a cloud
  /// vision API. Returns plausible field-service tags.
  Future<void> _runAiTagging(Uint8List bytes) async {
    // Simulate network/ML processing delay
    await Future<void>.delayed(const Duration(milliseconds: 800));

    if (!mounted) return;

    // Mock tags based on common field-service evidence patterns
    setState(() {
      _aiTags = ['Pipe', 'Copper', 'Indoor', 'Residential'];
      _aiConfidence = {
        'Pipe': 0.94,
        'Copper': 0.87,
        'Indoor': 0.82,
        'Residential': 0.76,
      };
    });
  }

  // ── Tag management ────────────────────────────────

  void _removeTag(String tag) {
    setState(() {
      _aiTags.remove(tag);
      _aiConfidence.remove(tag);
      _manualTags.remove(tag);
    });
  }

  void _addTag(String tag) {
    if (_aiTags.contains(tag) || _manualTags.contains(tag)) return;
    setState(() {
      _manualTags.add(tag);
    });
  }

  // ── Navigate to markup editor ─────────────────────

  void _openAnnotateEditor() {
    if (_imageBytes == null) return;
    setState(() => _phase = _CapturePhase.annotate);
  }

  void _onAnnotationSaved(Uint8List annotated) {
    setState(() {
      _annotatedBytes = annotated;
      _phase = _CapturePhase.review;
    });
  }

  void _onAnnotationCancelled() {
    setState(() => _phase = _CapturePhase.review);
  }

  // ── Save evidence ─────────────────────────────────

  Future<void> _saveEvidence() async {
    if (_imageBytes == null) return;

    setState(() => _phase = _CapturePhase.saving);

    try {
      final client = SupabaseService.client;
      final user = SupabaseService.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      final id = const Uuid().v4();
      final now = DateTime.now().toUtc();
      final storagePath =
          '${widget.workspaceId}/${widget.jobId}/$id.jpg';

      // Upload original image
      await client.storage.from('evidence').uploadBinary(
            storagePath,
            _imageBytes!,
            fileOptions: const FileOptions(contentType: 'image/jpeg'),
          );

      // Upload annotated image if exists
      String? annotatedStoragePath;
      if (_annotatedBytes != null) {
        annotatedStoragePath =
            '${widget.workspaceId}/${widget.jobId}/${id}_annotated.png';
        await client.storage.from('evidence').uploadBinary(
              annotatedStoragePath,
              _annotatedBytes!,
              fileOptions: const FileOptions(contentType: 'image/png'),
            );
      }

      // Create database record
      final evidence = EvidenceItem(
        id: id,
        workspaceId: widget.workspaceId,
        jobId: widget.jobId,
        workerId: user.id,
        originalPath: storagePath,
        annotatedPath: annotatedStoragePath,
        aiTags: _aiTags,
        aiConfidence: _aiConfidence,
        manualTags: _manualTags,
        manualCaption: _caption.isNotEmpty ? _caption : null,
        isClientVisible: _isClientVisible,
        isDefect: _isDefect,
        fileSizeBytes: _imageBytes!.length,
        capturedAt: now,
        createdAt: now,
      );

      await client.from('evidence').insert(evidence.toJson());

      if (mounted) {
        Navigator.of(context).pop(evidence);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _phase = _CapturePhase.review);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save evidence: $e'),
            backgroundColor: ObsidianTheme.rose,
          ),
        );
      }
    }
  }

  // ── Retake ────────────────────────────────────────

  void _retake() {
    setState(() {
      _imageBytes = null;
      _annotatedBytes = null;
      _aiTags = [];
      _aiConfidence = {};
      _manualTags = [];
      _caption = '';
      _phase = _CapturePhase.camera;
    });
    _capturePhoto();
  }

  // ── Build ─────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Annotate phase renders the markup editor full-screen
    if (_phase == _CapturePhase.annotate && _imageBytes != null) {
      return MarkupEditor(
        imageBytes: _imageBytes!,
        onSave: _onAnnotationSaved,
        onCancel: _onAnnotationCancelled,
      );
    }

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      appBar: _buildAppBar(),
      body: _buildBody(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: ObsidianTheme.void_,
      leading: IconButton(
        icon: Icon(
          PhosphorIcons.arrowLeft(PhosphorIconsStyle.bold),
          color: ObsidianTheme.textSecondary,
          size: 20,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: const Text('Capture Evidence'),
      actions: [
        if (_phase == _CapturePhase.review)
          IconButton(
            icon: Icon(
              PhosphorIcons.cameraRotate(PhosphorIconsStyle.bold),
              color: ObsidianTheme.textSecondary,
              size: 20,
            ),
            onPressed: _retake,
            tooltip: 'Retake',
          ),
      ],
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _CapturePhase.camera:
        return _buildCameraPlaceholder();
      case _CapturePhase.review:
        return _buildReview();
      case _CapturePhase.saving:
        return _buildSaving();
      case _CapturePhase.annotate:
        return const SizedBox.shrink(); // handled above
    }
  }

  // ── Camera placeholder (while picker is open) ─────

  Widget _buildCameraPlaceholder() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            PhosphorIcons.camera(PhosphorIconsStyle.duotone),
            size: 64,
            color: ObsidianTheme.textMuted,
          ),
          const SizedBox(height: 16),
          const Text(
            'Opening camera…',
            style: TextStyle(
              color: Color(0xFFA1A1AA),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  // ── Review phase ──────────────────────────────────

  Widget _buildReview() {
    final displayBytes = _annotatedBytes ?? _imageBytes;
    if (displayBytes == null) return const SizedBox.shrink();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Image preview
          ClipRRect(
            borderRadius: ObsidianTheme.radiusLg,
            child: Image.memory(
              displayBytes,
              fit: BoxFit.cover,
              height: 300,
              width: double.infinity,
            ),
          )
              .animate()
              .fadeIn(duration: const Duration(milliseconds: 400))
              .scale(
                begin: const Offset(0.95, 0.95),
                end: const Offset(1.0, 1.0),
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeOutCubic,
              ),

          const SizedBox(height: 16),

          // Annotated badge
          if (_annotatedBytes != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Icon(
                    PhosphorIcons.pencilSimple(PhosphorIconsStyle.fill),
                    size: 14,
                    color: ObsidianTheme.emerald,
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Annotated',
                    style: TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

          // AI Tags section
          _buildSection(
            title: 'AI Tags',
            icon: PhosphorIcons.sparkle(PhosphorIconsStyle.fill),
            iconColor: ObsidianTheme.indigo,
            child: AiTagChips(
              tags: [..._aiTags, ..._manualTags],
              confidence: _aiConfidence,
              onRemove: _removeTag,
              onAdd: _addTag,
            ),
          ),

          const SizedBox(height: 16),

          // Caption field
          _buildSection(
            title: 'Caption',
            icon: PhosphorIcons.textAa(PhosphorIconsStyle.bold),
            iconColor: ObsidianTheme.textSecondary,
            child: TextField(
              onChanged: (v) => _caption = v,
              maxLines: 2,
              style: const TextStyle(
                color: Color(0xFFEDEDED),
                fontSize: 14,
              ),
              decoration: InputDecoration(
                hintText: 'Describe what this evidence shows…',
                hintStyle: const TextStyle(
                  color: Color(0xFF71717A),
                  fontSize: 14,
                ),
                filled: true,
                fillColor: const Color(0xFF0A0A0A),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0x0DFFFFFF)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0x0DFFFFFF)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0x4D10B981)),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Toggles
          _buildToggleRow(
            icon: PhosphorIcons.eye(PhosphorIconsStyle.bold),
            label: 'Client visible',
            value: _isClientVisible,
            onChanged: (v) => setState(() => _isClientVisible = v),
          ),
          const SizedBox(height: 8),
          _buildToggleRow(
            icon: PhosphorIcons.warning(PhosphorIconsStyle.bold),
            label: 'Mark as defect',
            value: _isDefect,
            onChanged: (v) => setState(() => _isDefect = v),
            activeColor: ObsidianTheme.rose,
          ),

          const SizedBox(height: 24),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: _ObsidianButton(
                  label: 'Annotate',
                  icon: PhosphorIcons.pencilSimple(PhosphorIconsStyle.bold),
                  onTap: _openAnnotateEditor,
                  variant: _ButtonVariant.secondary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ObsidianButton(
                  label: 'Save Evidence',
                  icon: PhosphorIcons.cloudArrowUp(PhosphorIconsStyle.bold),
                  onTap: _saveEvidence,
                  variant: _ButtonVariant.primary,
                ),
              ),
            ],
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ── Saving indicator ──────────────────────────────

  Widget _buildSaving() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: Color(0xFF10B981),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Compressing & uploading…',
            style: TextStyle(
              color: Color(0xFFA1A1AA),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      )
          .animate(onPlay: (c) => c.repeat())
          .shimmer(
            duration: const Duration(seconds: 2),
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
          ),
    );
  }

  // ── Helpers ───────────────────────────────────────

  Widget _buildSection({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: iconColor),
            const SizedBox(width: 6),
            Text(
              title,
              style: const TextStyle(
                color: Color(0xFFA1A1AA),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }

  Widget _buildToggleRow({
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
    Color activeColor = const Color(0xFF10B981),
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0A0A0A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0x0DFFFFFF)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFFA1A1AA)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFFEDEDED),
                fontSize: 14,
              ),
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: activeColor.withValues(alpha: 0.5),
            thumbColor: WidgetStateProperty.resolveWith((states) =>
                states.contains(WidgetState.selected)
                    ? activeColor
                    : const Color(0xFF71717A)),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Obsidian Button ──────────────────────────────────
// ══════════════════════════════════════════════════════

enum _ButtonVariant { primary, secondary }

class _ObsidianButton extends StatelessWidget {
  const _ObsidianButton({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.variant,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final _ButtonVariant variant;

  @override
  Widget build(BuildContext context) {
    final isPrimary = variant == _ButtonVariant.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: isPrimary
              ? const Color(0xFF10B981)
              : const Color(0xFF141414),
          borderRadius: BorderRadius.circular(10),
          border: isPrimary
              ? null
              : Border.all(color: const Color(0x0DFFFFFF)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isPrimary ? Colors.black : const Color(0xFFEDEDED),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: isPrimary ? Colors.black : const Color(0xFFEDEDED),
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
