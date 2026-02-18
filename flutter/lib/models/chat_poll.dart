/// Poll model — matches `polls` table.
class ChatPoll {
  final String id;
  final String messageId;
  final String channelId;
  final String question;
  final List<String> options;
  final bool isAnonymous;
  final bool isClosed;
  final DateTime? closesAt;
  final DateTime createdAt;

  // Joined vote data
  final Map<int, int> voteCounts; // optionIndex -> count
  final int? myVoteIndex;
  final int totalVotes;

  const ChatPoll({
    required this.id,
    required this.messageId,
    required this.channelId,
    required this.question,
    required this.options,
    this.isAnonymous = false,
    this.isClosed = false,
    this.closesAt,
    required this.createdAt,
    this.voteCounts = const {},
    this.myVoteIndex,
    this.totalVotes = 0,
  });

  factory ChatPoll.fromJson(Map<String, dynamic> json) {
    final optionsRaw = json['options'] as List<dynamic>? ?? [];
    return ChatPoll(
      id: json['id'] as String,
      messageId: json['message_id'] as String,
      channelId: json['channel_id'] as String,
      question: json['question'] as String,
      options: optionsRaw.map((o) => o.toString()).toList(),
      isAnonymous: json['is_anonymous'] as bool? ?? false,
      isClosed: json['is_closed'] as bool? ?? false,
      closesAt: json['closes_at'] != null ? DateTime.parse(json['closes_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  double votePercentage(int index) {
    if (totalVotes == 0) return 0;
    return (voteCounts[index] ?? 0) / totalVotes;
  }
}
