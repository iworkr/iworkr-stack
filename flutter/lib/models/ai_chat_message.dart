/// AI Chat Message model — mirrors Supabase `ai_chat_messages` table.
class AiChatMessage {
  final String id;
  final String organizationId;
  final String userId;
  final String? jobId;
  final String role; // user, assistant, system
  final String content;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;

  const AiChatMessage({
    required this.id,
    required this.organizationId,
    required this.userId,
    this.jobId,
    required this.role,
    required this.content,
    this.metadata = const {},
    required this.createdAt,
  });

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';

  factory AiChatMessage.fromJson(Map<String, dynamic> json) {
    return AiChatMessage(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      jobId: json['job_id'] as String?,
      role: json['role'] as String? ?? 'user',
      content: json['content'] as String? ?? '',
      metadata: json['metadata'] as Map<String, dynamic>? ?? {},
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Knowledge article model — mirrors `knowledge_articles` table.
class KnowledgeArticle {
  final String id;
  final String organizationId;
  final String title;
  final String category;
  final String? manufacturer;
  final String? modelNumber;
  final String? fileUrl;
  final String fileType;
  final int? fileSizeBytes;
  final String? thumbnailUrl;
  final bool isPinned;
  final List<String> tags;
  final DateTime createdAt;

  const KnowledgeArticle({
    required this.id,
    required this.organizationId,
    required this.title,
    this.category = 'general',
    this.manufacturer,
    this.modelNumber,
    this.fileUrl,
    this.fileType = 'pdf',
    this.fileSizeBytes,
    this.thumbnailUrl,
    this.isPinned = false,
    this.tags = const [],
    required this.createdAt,
  });

  String get fileSizeLabel {
    if (fileSizeBytes == null) return '';
    final mb = fileSizeBytes! / (1024 * 1024);
    if (mb >= 1) return '${mb.toStringAsFixed(1)} MB';
    final kb = fileSizeBytes! / 1024;
    return '${kb.toStringAsFixed(0)} KB';
  }

  factory KnowledgeArticle.fromJson(Map<String, dynamic> json) {
    final tagsRaw = json['tags'] as List<dynamic>? ?? [];
    return KnowledgeArticle(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? 'general',
      manufacturer: json['manufacturer'] as String?,
      modelNumber: json['model_number'] as String?,
      fileUrl: json['file_url'] as String?,
      fileType: json['file_type'] as String? ?? 'pdf',
      fileSizeBytes: json['file_size_bytes'] as int?,
      thumbnailUrl: json['thumbnail_url'] as String?,
      isPinned: json['is_pinned'] as bool? ?? false,
      tags: tagsRaw.map((t) => t.toString()).toList(),
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
