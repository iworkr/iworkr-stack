/// NotificationItem model — maps to public.notifications
class NotificationItem {
  final String id;
  final String organizationId;
  final String userId;
  final String type;
  final String title;
  final String? body;
  final String? senderName;
  final bool read;
  final bool archived;
  final DateTime? snoozedUntil;
  final String? relatedJobId;
  final String? actionLink;
  final DateTime createdAt;

  const NotificationItem({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.type,
    required this.title,
    this.body,
    this.senderName,
    this.read = false,
    this.archived = false,
    this.snoozedUntil,
    this.relatedJobId,
    this.actionLink,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      senderName: json['sender_name'] as String?,
      read: json['read'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
      snoozedUntil: json['snoozed_until'] != null
          ? DateTime.tryParse(json['snoozed_until'] as String)
          : null,
      relatedJobId: json['related_job_id'] as String?,
      actionLink: json['action_link'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
