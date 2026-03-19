// ============================================================================
// Athena SOP Knowledge Base — Data Models
// ============================================================================
// Data models for the Knowledge Base / SOP system.
// Supports articles (text + video), contextual SOP recommendations,
// and read receipt / acknowledgement tracking.
// ============================================================================

/// A knowledge base article or SOP document.
class KnowledgeArticle {
  const KnowledgeArticle({
    required this.id,
    required this.title,
    this.description,
    this.category,
    this.contentHtml,
    this.videoHlsUrl,
    this.videoDurationSeconds,
    this.authorId,
    this.viewCount = 0,
    this.isMandatoryRead = false,
    this.isOfflineCritical = false,
    this.status = 'published',
    this.estimatedReadMinutes,
    this.difficultyLevel,
    this.tags,
    this.thumbnailUrl,
    required this.createdAt,
    this.authorName,
  });

  final String id;
  final String title;
  final String? description;
  final String? category;
  final String? contentHtml;
  final String? videoHlsUrl;
  final int? videoDurationSeconds;
  final String? authorId;
  final int viewCount;
  final bool isMandatoryRead;
  final bool isOfflineCritical;

  /// One of: 'draft', 'published', 'archived'
  final String status;

  final int? estimatedReadMinutes;
  final String? difficultyLevel;
  final List<String>? tags;
  final String? thumbnailUrl;
  final String createdAt;
  final String? authorName;

  /// Whether this article has a video component.
  bool get hasVideo => videoHlsUrl != null && videoHlsUrl!.isNotEmpty;

  factory KnowledgeArticle.fromJson(Map<String, dynamic> json) {
    return KnowledgeArticle(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      contentHtml: json['content_html'] as String?,
      videoHlsUrl: json['video_hls_url'] as String?,
      videoDurationSeconds: json['video_duration_seconds'] as int?,
      authorId: json['author_id'] as String?,
      viewCount: json['view_count'] as int? ?? 0,
      isMandatoryRead: json['is_mandatory_read'] as bool? ?? false,
      isOfflineCritical: json['is_offline_critical'] as bool? ?? false,
      status: json['status'] as String? ?? 'published',
      estimatedReadMinutes: json['estimated_read_minutes'] as int?,
      difficultyLevel: json['difficulty_level'] as String?,
      tags: (json['tags'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      thumbnailUrl: json['thumbnail_url'] as String?,
      createdAt: json['created_at'] as String,
      authorName: json['author_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'category': category,
        'content_html': contentHtml,
        'video_hls_url': videoHlsUrl,
        'video_duration_seconds': videoDurationSeconds,
        'author_id': authorId,
        'view_count': viewCount,
        'is_mandatory_read': isMandatoryRead,
        'is_offline_critical': isOfflineCritical,
        'status': status,
        'estimated_read_minutes': estimatedReadMinutes,
        'difficulty_level': difficultyLevel,
        'tags': tags,
        'thumbnail_url': thumbnailUrl,
        'created_at': createdAt,
        'author_name': authorName,
      };

  KnowledgeArticle copyWith({
    String? id,
    String? title,
    String? description,
    String? category,
    String? contentHtml,
    String? videoHlsUrl,
    int? videoDurationSeconds,
    String? authorId,
    int? viewCount,
    bool? isMandatoryRead,
    bool? isOfflineCritical,
    String? status,
    int? estimatedReadMinutes,
    String? difficultyLevel,
    List<String>? tags,
    String? thumbnailUrl,
    String? createdAt,
    String? authorName,
  }) {
    return KnowledgeArticle(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      category: category ?? this.category,
      contentHtml: contentHtml ?? this.contentHtml,
      videoHlsUrl: videoHlsUrl ?? this.videoHlsUrl,
      videoDurationSeconds: videoDurationSeconds ?? this.videoDurationSeconds,
      authorId: authorId ?? this.authorId,
      viewCount: viewCount ?? this.viewCount,
      isMandatoryRead: isMandatoryRead ?? this.isMandatoryRead,
      isOfflineCritical: isOfflineCritical ?? this.isOfflineCritical,
      status: status ?? this.status,
      estimatedReadMinutes: estimatedReadMinutes ?? this.estimatedReadMinutes,
      difficultyLevel: difficultyLevel ?? this.difficultyLevel,
      tags: tags ?? this.tags,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      createdAt: createdAt ?? this.createdAt,
      authorName: authorName ?? this.authorName,
    );
  }
}

/// A recommended SOP matched to a job via tag or semantic search.
class RecommendedSop {
  const RecommendedSop({
    required this.id,
    required this.title,
    this.description,
    this.videoHlsUrl,
    this.videoDurationSeconds,
    this.isMandatoryRead = false,
    this.estimatedReadMinutes,
    this.thumbnailUrl,
    this.contentHtml,
    this.matchType = 'tag',
    this.matchScore,
  });

  final String id;
  final String title;
  final String? description;
  final String? videoHlsUrl;
  final int? videoDurationSeconds;
  final bool isMandatoryRead;
  final int? estimatedReadMinutes;
  final String? thumbnailUrl;
  final String? contentHtml;

  /// How this SOP was matched: 'tag' (exact tag match) or 'semantic' (AI embedding match).
  final String matchType;

  /// Similarity score (0.0–1.0) for semantic matches, null for tag matches.
  final double? matchScore;

  /// Whether this SOP has a video component.
  bool get hasVideo => videoHlsUrl != null && videoHlsUrl!.isNotEmpty;

  factory RecommendedSop.fromJson(Map<String, dynamic> json) {
    return RecommendedSop(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      videoHlsUrl: json['video_hls_url'] as String?,
      videoDurationSeconds: json['video_duration_seconds'] as int?,
      isMandatoryRead: json['is_mandatory_read'] as bool? ?? false,
      estimatedReadMinutes: json['estimated_read_minutes'] as int?,
      thumbnailUrl: json['thumbnail_url'] as String?,
      contentHtml: json['content_html'] as String?,
      matchType: json['match_type'] as String? ?? 'tag',
      matchScore: (json['match_score'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'video_hls_url': videoHlsUrl,
        'video_duration_seconds': videoDurationSeconds,
        'is_mandatory_read': isMandatoryRead,
        'estimated_read_minutes': estimatedReadMinutes,
        'thumbnail_url': thumbnailUrl,
        'content_html': contentHtml,
        'match_type': matchType,
        'match_score': matchScore,
      };

  /// Convert a RecommendedSop into a KnowledgeArticle for the viewer screen.
  KnowledgeArticle toArticle() {
    return KnowledgeArticle(
      id: id,
      title: title,
      description: description,
      videoHlsUrl: videoHlsUrl,
      videoDurationSeconds: videoDurationSeconds,
      isMandatoryRead: isMandatoryRead,
      estimatedReadMinutes: estimatedReadMinutes,
      thumbnailUrl: thumbnailUrl,
      contentHtml: contentHtml,
      createdAt: DateTime.now().toIso8601String(),
    );
  }
}

/// A read receipt / acknowledgement record for a knowledge article.
class ReadReceipt {
  const ReadReceipt({
    required this.id,
    required this.articleId,
    required this.workerId,
    this.contextJobId,
    this.watchTimeSeconds = 0,
    this.completionPercentage = 0.0,
    this.acknowledgedAt,
  });

  final String id;
  final String articleId;
  final String workerId;
  final String? contextJobId;
  final int watchTimeSeconds;
  final double completionPercentage;
  final String? acknowledgedAt;

  /// Whether the article has been formally acknowledged.
  bool get isAcknowledged => acknowledgedAt != null;

  factory ReadReceipt.fromJson(Map<String, dynamic> json) {
    return ReadReceipt(
      id: json['id'] as String,
      articleId: json['article_id'] as String,
      workerId: json['worker_id'] as String,
      contextJobId: json['context_job_id'] as String?,
      watchTimeSeconds: json['watch_time_seconds'] as int? ?? 0,
      completionPercentage:
          (json['completion_percentage'] as num?)?.toDouble() ?? 0.0,
      acknowledgedAt: json['acknowledged_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'article_id': articleId,
        'worker_id': workerId,
        'context_job_id': contextJobId,
        'watch_time_seconds': watchTimeSeconds,
        'completion_percentage': completionPercentage,
        'acknowledged_at': acknowledgedAt,
      };
}
