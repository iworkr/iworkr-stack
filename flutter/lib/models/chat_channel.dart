/// Chat channel model — matches `channels` table.
class ChatChannel {
  final String id;
  final String organizationId;
  final String type; // dm, group, job_context, broadcast
  final String? name;
  final String? description;
  final String? contextId;
  final String? contextType;
  final String? createdBy;
  final bool isArchived;
  final DateTime? lastMessageAt;
  final DateTime createdAt;
  final Map<String, dynamic>? metadata;

  // Computed / joined fields
  final String? lastMessageContent;
  final String? lastMessageSenderName;
  final int unreadCount;
  final List<ChannelMember> members;

  const ChatChannel({
    required this.id,
    required this.organizationId,
    this.type = 'group',
    this.name,
    this.description,
    this.contextId,
    this.contextType,
    this.createdBy,
    this.isArchived = false,
    this.lastMessageAt,
    required this.createdAt,
    this.metadata,
    this.lastMessageContent,
    this.lastMessageSenderName,
    this.unreadCount = 0,
    this.members = const [],
  });

  factory ChatChannel.fromJson(Map<String, dynamic> json) {
    return ChatChannel(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      type: json['type'] as String? ?? 'group',
      name: json['name'] as String?,
      description: json['description'] as String?,
      contextId: json['context_id'] as String?,
      contextType: json['context_type'] as String?,
      createdBy: json['created_by'] as String?,
      isArchived: json['is_archived'] as bool? ?? false,
      lastMessageAt: json['last_message_at'] != null
          ? DateTime.parse(json['last_message_at'] as String)
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  bool get isDm => type == 'dm';
  bool get isGroup => type == 'group' || type == 'broadcast';

  /// Display name for the channel.
  String get displayName {
    if (name != null && name!.isNotEmpty) return name!;
    if (isDm && members.isNotEmpty) {
      final currentUserId = _currentUserId;
      final other = members.where((m) => m.userId != currentUserId);
      if (other.isNotEmpty) return other.first.displayName ?? 'Unknown';
      return members.first.displayName ?? 'Direct Message';
    }
    return 'Unnamed Channel';
  }

  /// The other user's name in a DM.
  ChannelMember? dmPartner(String myUserId) {
    if (!isDm) return null;
    final others = members.where((m) => m.userId != myUserId);
    return others.isNotEmpty ? others.first : members.firstOrNull;
  }

  /// Initials of the DM partner.
  String get dmInitials {
    final name = displayName;
    final parts = name.split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  ChatChannel copyWith({List<ChannelMember>? members}) {
    return ChatChannel(
      id: id,
      organizationId: organizationId,
      type: type,
      name: name,
      description: description,
      contextId: contextId,
      contextType: contextType,
      createdBy: createdBy,
      isArchived: isArchived,
      lastMessageAt: lastMessageAt,
      createdAt: createdAt,
      metadata: metadata,
      lastMessageContent: lastMessageContent,
      lastMessageSenderName: lastMessageSenderName,
      unreadCount: unreadCount,
      members: members ?? this.members,
    );
  }

  // Helper to get current user ID for displayName computation
  static String? get _currentUserId {
    try {
      // ignore: depend_on_referenced_packages
      return _cachedUserId;
    } catch (_) {
      return null;
    }
  }

  static String? _cachedUserId;
  static void setCurrentUserId(String? id) => _cachedUserId = id;
}

class ChannelMember {
  final String userId;
  final String? role;
  final bool muted;
  final DateTime? lastReadAt;
  final String? displayName;
  final String? avatarUrl;

  const ChannelMember({
    required this.userId,
    this.role,
    this.muted = false,
    this.lastReadAt,
    this.displayName,
    this.avatarUrl,
  });

  factory ChannelMember.fromJson(Map<String, dynamic> json) {
    final profile = json['profiles'] as Map<String, dynamic>?;
    return ChannelMember(
      userId: json['user_id'] as String,
      role: json['role'] as String?,
      muted: json['muted'] as bool? ?? false,
      lastReadAt: json['last_read_at'] != null
          ? DateTime.parse(json['last_read_at'] as String)
          : null,
      displayName: profile?['full_name'] as String?,
      avatarUrl: profile?['avatar_url'] as String?,
    );
  }
}
