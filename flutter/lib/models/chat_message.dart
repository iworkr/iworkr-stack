/// Chat message model — matches `messages` table.
class ChatMessage {
  final String id;
  final String channelId;
  final String senderId;
  final String content;
  final String type; // text, image, file, voice, location, poll, system
  final Map<String, dynamic>? metadata;
  final Map<String, dynamic>? reactions;
  final String? replyToId;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final DateTime createdAt;

  // Joined sender info
  final String? senderName;
  final String? senderAvatarUrl;

  // Local state
  final MessageStatus status;

  const ChatMessage({
    required this.id,
    required this.channelId,
    required this.senderId,
    required this.content,
    this.type = 'text',
    this.metadata,
    this.reactions,
    this.replyToId,
    this.editedAt,
    this.deletedAt,
    required this.createdAt,
    this.senderName,
    this.senderAvatarUrl,
    this.status = MessageStatus.sent,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    return ChatMessage(
      id: json['id'] as String,
      channelId: json['channel_id'] as String,
      senderId: json['sender_id'] as String,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      metadata: json['metadata'] as Map<String, dynamic>?,
      reactions: json['reactions'] as Map<String, dynamic>?,
      replyToId: json['reply_to_id'] as String?,
      editedAt: json['edited_at'] != null ? DateTime.parse(json['edited_at'] as String) : null,
      deletedAt: json['deleted_at'] != null ? DateTime.parse(json['deleted_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      senderName: sender?['full_name'] as String?,
      senderAvatarUrl: sender?['avatar_url'] as String?,
      status: MessageStatus.sent,
    );
  }

  bool get isDeleted => deletedAt != null;
  bool get isEdited => editedAt != null;
  bool get isSystem => type == 'system';
  bool get isPoll => type == 'poll';

  /// Sender initials for avatar fallback.
  String get senderInitials {
    if (senderName == null || senderName!.isEmpty) return '?';
    final parts = senderName!.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return parts[0][0].toUpperCase();
  }
}

enum MessageStatus { sending, sent, delivered, read }
