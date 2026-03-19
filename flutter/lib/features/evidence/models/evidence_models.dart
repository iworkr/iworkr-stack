// ============================================================================
// Evidence Markup System — Data Models
// ============================================================================

import 'dart:ui';

/// A single piece of captured evidence linked to a job.
class EvidenceItem {
  const EvidenceItem({
    required this.id,
    required this.workspaceId,
    required this.jobId,
    required this.workerId,
    required this.originalPath,
    this.annotatedPath,
    this.thumbnailPath,
    this.aiTags = const [],
    this.aiConfidence = const {},
    this.manualCaption,
    this.manualTags = const [],
    this.locationLat,
    this.locationLng,
    this.fileSizeBytes,
    this.imageWidth,
    this.imageHeight,
    this.isClientVisible = true,
    this.isDefect = false,
    this.faceDetected = false,
    this.faceObfuscated = false,
    this.watermarkData = const {},
    this.deviceInfo = const {},
    required this.capturedAt,
    this.syncedAt,
    required this.createdAt,
  });

  final String id;
  final String workspaceId;
  final String jobId;
  final String workerId;
  final String originalPath;
  final String? annotatedPath;
  final String? thumbnailPath;
  final List<String> aiTags;
  final Map<String, double> aiConfidence;
  final String? manualCaption;
  final List<String> manualTags;
  final double? locationLat;
  final double? locationLng;
  final int? fileSizeBytes;
  final int? imageWidth;
  final int? imageHeight;
  final bool isClientVisible;
  final bool isDefect;
  final bool faceDetected;
  final bool faceObfuscated;
  final Map<String, dynamic> watermarkData;
  final Map<String, dynamic> deviceInfo;
  final DateTime capturedAt;
  final DateTime? syncedAt;
  final DateTime createdAt;

  factory EvidenceItem.fromJson(Map<String, dynamic> json) {
    return EvidenceItem(
      id: json['id'] as String,
      workspaceId: json['workspace_id'] as String,
      jobId: json['job_id'] as String,
      workerId: json['worker_id'] as String,
      originalPath: json['original_path'] as String,
      annotatedPath: json['annotated_path'] as String?,
      thumbnailPath: json['thumbnail_path'] as String?,
      aiTags: (json['ai_tags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      aiConfidence: (json['ai_confidence'] as Map<String, dynamic>?)?.map(
            (k, v) => MapEntry(k, (v as num).toDouble()),
          ) ??
          const {},
      manualCaption: json['manual_caption'] as String?,
      manualTags: (json['manual_tags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      fileSizeBytes: json['file_size_bytes'] as int?,
      imageWidth: json['image_width'] as int?,
      imageHeight: json['image_height'] as int?,
      isClientVisible: json['is_client_visible'] as bool? ?? true,
      isDefect: json['is_defect'] as bool? ?? false,
      faceDetected: json['face_detected'] as bool? ?? false,
      faceObfuscated: json['face_obfuscated'] as bool? ?? false,
      watermarkData:
          (json['watermark_data'] as Map<String, dynamic>?) ?? const {},
      deviceInfo: (json['device_info'] as Map<String, dynamic>?) ?? const {},
      capturedAt: DateTime.parse(json['captured_at'] as String),
      syncedAt: json['synced_at'] != null
          ? DateTime.parse(json['synced_at'] as String)
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'workspace_id': workspaceId,
        'job_id': jobId,
        'worker_id': workerId,
        'original_path': originalPath,
        'annotated_path': annotatedPath,
        'thumbnail_path': thumbnailPath,
        'ai_tags': aiTags,
        'ai_confidence': aiConfidence,
        'manual_caption': manualCaption,
        'manual_tags': manualTags,
        'location_lat': locationLat,
        'location_lng': locationLng,
        'file_size_bytes': fileSizeBytes,
        'image_width': imageWidth,
        'image_height': imageHeight,
        'is_client_visible': isClientVisible,
        'is_defect': isDefect,
        'face_detected': faceDetected,
        'face_obfuscated': faceObfuscated,
        'watermark_data': watermarkData,
        'device_info': deviceInfo,
        'captured_at': capturedAt.toIso8601String(),
        'synced_at': syncedAt?.toIso8601String(),
        'created_at': createdAt.toIso8601String(),
      };

  EvidenceItem copyWith({
    String? id,
    String? workspaceId,
    String? jobId,
    String? workerId,
    String? originalPath,
    String? annotatedPath,
    String? thumbnailPath,
    List<String>? aiTags,
    Map<String, double>? aiConfidence,
    String? manualCaption,
    List<String>? manualTags,
    double? locationLat,
    double? locationLng,
    int? fileSizeBytes,
    int? imageWidth,
    int? imageHeight,
    bool? isClientVisible,
    bool? isDefect,
    bool? faceDetected,
    bool? faceObfuscated,
    Map<String, dynamic>? watermarkData,
    Map<String, dynamic>? deviceInfo,
    DateTime? capturedAt,
    DateTime? syncedAt,
    DateTime? createdAt,
  }) {
    return EvidenceItem(
      id: id ?? this.id,
      workspaceId: workspaceId ?? this.workspaceId,
      jobId: jobId ?? this.jobId,
      workerId: workerId ?? this.workerId,
      originalPath: originalPath ?? this.originalPath,
      annotatedPath: annotatedPath ?? this.annotatedPath,
      thumbnailPath: thumbnailPath ?? this.thumbnailPath,
      aiTags: aiTags ?? this.aiTags,
      aiConfidence: aiConfidence ?? this.aiConfidence,
      manualCaption: manualCaption ?? this.manualCaption,
      manualTags: manualTags ?? this.manualTags,
      locationLat: locationLat ?? this.locationLat,
      locationLng: locationLng ?? this.locationLng,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      imageWidth: imageWidth ?? this.imageWidth,
      imageHeight: imageHeight ?? this.imageHeight,
      isClientVisible: isClientVisible ?? this.isClientVisible,
      isDefect: isDefect ?? this.isDefect,
      faceDetected: faceDetected ?? this.faceDetected,
      faceObfuscated: faceObfuscated ?? this.faceObfuscated,
      watermarkData: watermarkData ?? this.watermarkData,
      deviceInfo: deviceInfo ?? this.deviceInfo,
      capturedAt: capturedAt ?? this.capturedAt,
      syncedAt: syncedAt ?? this.syncedAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

// ── Markup Tool Types ──────────────────────────────────

enum MarkupToolType { pen, highlighter, arrow, text, rectangle, eraser }

// ── Markup Action (single drawing operation) ───────────

class MarkupAction {
  const MarkupAction({
    required this.type,
    required this.color,
    this.strokeWidth = 3.0,
    this.opacity = 1.0,
    this.points = const [],
    this.text,
    this.textPosition,
    this.fontSize,
  });

  final MarkupToolType type;
  final Color color;
  final double strokeWidth;
  final double opacity;
  final List<Offset> points;
  final String? text;
  final Offset? textPosition;
  final double? fontSize;

  MarkupAction copyWith({
    MarkupToolType? type,
    Color? color,
    double? strokeWidth,
    double? opacity,
    List<Offset>? points,
    String? text,
    Offset? textPosition,
    double? fontSize,
  }) {
    return MarkupAction(
      type: type ?? this.type,
      color: color ?? this.color,
      strokeWidth: strokeWidth ?? this.strokeWidth,
      opacity: opacity ?? this.opacity,
      points: points ?? this.points,
      text: text ?? this.text,
      textPosition: textPosition ?? this.textPosition,
      fontSize: fontSize ?? this.fontSize,
    );
  }
}

// ── Markup State (undo/redo stack) ─────────────────────

class MarkupState {
  const MarkupState({
    this.actions = const [],
    this.redoStack = const [],
    this.activeTool = MarkupToolType.pen,
    this.activeColor = const Color(0xFFF43F5E), // rose / red
    this.activeStrokeWidth = 3.0,
  });

  final List<MarkupAction> actions;
  final List<MarkupAction> redoStack;
  final MarkupToolType activeTool;
  final Color activeColor;
  final double activeStrokeWidth;

  bool get canUndo => actions.isNotEmpty;
  bool get canRedo => redoStack.isNotEmpty;

  MarkupState addAction(MarkupAction action) {
    return MarkupState(
      actions: [...actions, action],
      redoStack: const [], // clear redo on new action
      activeTool: activeTool,
      activeColor: activeColor,
      activeStrokeWidth: activeStrokeWidth,
    );
  }

  MarkupState undo() {
    if (!canUndo) return this;
    final last = actions.last;
    return MarkupState(
      actions: actions.sublist(0, actions.length - 1),
      redoStack: [...redoStack, last],
      activeTool: activeTool,
      activeColor: activeColor,
      activeStrokeWidth: activeStrokeWidth,
    );
  }

  MarkupState redo() {
    if (!canRedo) return this;
    final last = redoStack.last;
    return MarkupState(
      actions: [...actions, last],
      redoStack: redoStack.sublist(0, redoStack.length - 1),
      activeTool: activeTool,
      activeColor: activeColor,
      activeStrokeWidth: activeStrokeWidth,
    );
  }

  MarkupState clear() {
    return MarkupState(
      activeTool: activeTool,
      activeColor: activeColor,
      activeStrokeWidth: activeStrokeWidth,
    );
  }

  MarkupState copyWith({
    List<MarkupAction>? actions,
    List<MarkupAction>? redoStack,
    MarkupToolType? activeTool,
    Color? activeColor,
    double? activeStrokeWidth,
  }) {
    return MarkupState(
      actions: actions ?? this.actions,
      redoStack: redoStack ?? this.redoStack,
      activeTool: activeTool ?? this.activeTool,
      activeColor: activeColor ?? this.activeColor,
      activeStrokeWidth: activeStrokeWidth ?? this.activeStrokeWidth,
    );
  }
}
