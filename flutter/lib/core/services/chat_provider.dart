import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/chat_channel.dart';
import 'package:iworkr_mobile/models/chat_message.dart';
import 'package:iworkr_mobile/models/chat_poll.dart';

// ─────────────────────────────────────────────────────
// Channels Provider — REST fetch + Realtime listener
// ─────────────────────────────────────────────────────

final channelsProvider = StreamProvider<List<ChatChannel>>((ref) {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return const Stream.empty();

  final client = SupabaseService.client;
  final controller = StreamController<List<ChatChannel>>();

  // Fetch channels via REST (reliable, no Realtime dependency for initial load)
  Future<void> fetchChannels() async {
    try {
      // Get the user's channel IDs
      final memberRows = await client
          .from('channel_members')
          .select('channel_id')
          .eq('user_id', userId);

      if (memberRows.isEmpty) {
        controller.add(<ChatChannel>[]);
        return;
      }

      final channelIds = (memberRows as List)
          .map((r) => r['channel_id'] as String)
          .toList();

      final channelsData = await client
          .from('channels')
          .select()
          .inFilter('id', channelIds)
          .eq('is_archived', false)
          .order('last_message_at', ascending: false);

      var channels = (channelsData as List)
          .map((c) => ChatChannel.fromJson(c))
          .toList();

      // Hydrate DM channels with member profiles
      final dmChannels = channels.where((c) => c.type == 'dm').toList();
      if (dmChannels.isNotEmpty) {
        final dmIds = dmChannels.map((c) => c.id).toList();
        final allMembers = await client
            .from('channel_members')
            .select('channel_id, user_id, profiles:user_id(full_name, avatar_url)')
            .inFilter('channel_id', dmIds);

        final membersByChannel = <String, List<ChannelMember>>{};
        for (final m in allMembers) {
          final chId = m['channel_id'] as String;
          membersByChannel.putIfAbsent(chId, () => []).add(ChannelMember.fromJson(m));
        }

        channels = channels.map((c) {
          if (c.type == 'dm' && membersByChannel.containsKey(c.id)) {
            return c.copyWith(members: membersByChannel[c.id]!);
          }
          return c;
        }).toList();
      }

      if (!controller.isClosed) controller.add(channels);
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  // Initial fetch
  fetchChannels();

  // Listen for channel updates (new messages update last_message_at)
  final channelSub = client
      .channel('channels-realtime')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'channels',
        callback: (_) => fetchChannels(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'channel_members',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: userId,
        ),
        callback: (_) => fetchChannels(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(channelSub);
    controller.close();
  });

  return controller.stream;
});

// ─────────────────────────────────────────────────────
// Messages Provider — REST fetch + Realtime listener
// ─────────────────────────────────────────────────────

final messagesProvider = StreamProvider.family<List<ChatMessage>, String>((ref, channelId) {
  final client = SupabaseService.client;
  final controller = StreamController<List<ChatMessage>>();

  Future<void> fetchMessages() async {
    try {
      final rows = await client
          .from('messages')
          .select()
          .eq('channel_id', channelId)
          .order('created_at', ascending: true);

      if (rows.isEmpty) {
        if (!controller.isClosed) controller.add(<ChatMessage>[]);
        return;
      }

      // Batch-fetch sender profiles
      final senderIds = (rows as List)
          .map((r) => r['sender_id'] as String)
          .toSet()
          .toList();

      final profiles = await client
          .from('profiles')
          .select('id, full_name, avatar_url')
          .inFilter('id', senderIds);

      final profileMap = <String, Map<String, dynamic>>{};
      for (final p in profiles) {
        profileMap[p['id'] as String] = p;
      }

      final messages = rows.map((r) {
        final sid = r['sender_id'] as String;
        r['sender'] = profileMap[sid];
        return ChatMessage.fromJson(r);
      }).toList();

      if (!controller.isClosed) controller.add(messages);
    } catch (e) {
      if (!controller.isClosed) controller.addError(e);
    }
  }

  // Initial fetch
  fetchMessages();

  // Listen for new/updated/deleted messages in this channel
  final msgSub = client
      .channel('messages:$channelId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'messages',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'channel_id',
          value: channelId,
        ),
        callback: (_) => fetchMessages(),
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(msgSub);
    controller.close();
  });

  return controller.stream;
});

// ─────────────────────────────────────────────────────
// Channel Members Provider
// ─────────────────────────────────────────────────────

final channelMembersProvider = FutureProvider.family<List<ChannelMember>, String>((ref, channelId) async {
  final data = await SupabaseService.client
      .from('channel_members')
      .select('*, profiles:user_id(full_name, avatar_url)')
      .eq('channel_id', channelId);

  return (data as List).map((m) => ChannelMember.fromJson(m)).toList();
});

// ─────────────────────────────────────────────────────
// Poll Provider
// ─────────────────────────────────────────────────────

final pollProvider = FutureProvider.family<ChatPoll?, String>((ref, messageId) async {
  final userId = SupabaseService.auth.currentUser?.id;

  final pollData = await SupabaseService.client
      .from('polls')
      .select()
      .eq('message_id', messageId)
      .maybeSingle();

  if (pollData == null) return null;

  final poll = ChatPoll.fromJson(pollData);

  // Get votes
  final votes = await SupabaseService.client
      .from('poll_votes')
      .select('option_index, user_id')
      .eq('poll_id', poll.id);

  final voteCounts = <int, int>{};
  int? myVote;

  for (final v in votes) {
    final idx = v['option_index'] as int;
    voteCounts[idx] = (voteCounts[idx] ?? 0) + 1;
    if (v['user_id'] == userId) myVote = idx;
  }

  return ChatPoll(
    id: poll.id,
    messageId: poll.messageId,
    channelId: poll.channelId,
    question: poll.question,
    options: poll.options,
    isAnonymous: poll.isAnonymous,
    isClosed: poll.isClosed,
    closesAt: poll.closesAt,
    createdAt: poll.createdAt,
    voteCounts: voteCounts,
    myVoteIndex: myVote,
    totalVotes: votes.length,
  );
});

// ─────────────────────────────────────────────────────
// Org Teammates Provider (for DM user-picker)
// ─────────────────────────────────────────────────────

final orgTeammatesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final userId = SupabaseService.auth.currentUser?.id;
  if (userId == null) return [];

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

  if (orgRow == null) return [];
  final orgId = orgRow['organization_id'] as String;

  final members = await SupabaseService.client
      .from('organization_members')
      .select('user_id, profiles:user_id(id, full_name, avatar_url, email)')
      .eq('organization_id', orgId)
      .neq('user_id', userId);

  return (members as List).map((m) {
    final profile = m['profiles'] as Map<String, dynamic>? ?? {};
    return {
      'id': profile['id'] ?? m['user_id'],
      'full_name': profile['full_name'] ?? 'Unknown',
      'avatar_url': profile['avatar_url'],
      'email': profile['email'] ?? '',
    };
  }).toList();
});

// ─────────────────────────────────────────────────────
// Chat Actions
// ─────────────────────────────────────────────────────

class ChatActions {
  static final _client = SupabaseService.client;

  /// Send a text message.
  static Future<void> sendMessage({
    required String channelId,
    required String content,
    String type = 'text',
    String? replyToId,
    Map<String, dynamic>? metadata,
  }) async {
    final userId = SupabaseService.auth.currentUser!.id;

    await _client.from('messages').insert({
      'channel_id': channelId,
      'sender_id': userId,
      'content': content,
      'type': type,
      'reply_to_id': replyToId,
      'metadata': metadata ?? {},
    });

    // Update channel's last_message_at
    await _client.from('channels').update({
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', channelId);
  }

  /// Send a poll message.
  static Future<void> sendPoll({
    required String channelId,
    required String question,
    required List<String> options,
  }) async {
    final userId = SupabaseService.auth.currentUser!.id;

    final msgData = await _client.from('messages').insert({
      'channel_id': channelId,
      'sender_id': userId,
      'content': question,
      'type': 'poll',
    }).select().single();

    await _client.from('polls').insert({
      'message_id': msgData['id'],
      'channel_id': channelId,
      'question': question,
      'options': options,
    });

    await _client.from('channels').update({
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', channelId);
  }

  /// Vote on a poll.
  static Future<void> votePoll({
    required String pollId,
    required int optionIndex,
  }) async {
    final userId = SupabaseService.auth.currentUser!.id;

    await _client.from('poll_votes').upsert({
      'poll_id': pollId,
      'user_id': userId,
      'option_index': optionIndex,
    }, onConflict: 'poll_id,user_id');
  }

  /// Create a new channel.
  static Future<String> createChannel({
    required String organizationId,
    required String name,
    String type = 'group',
    List<String>? memberIds,
  }) async {
    final userId = SupabaseService.auth.currentUser!.id;

    final channelData = await _client.from('channels').insert({
      'organization_id': organizationId,
      'name': name,
      'type': type,
      'created_by': userId,
    }).select().single();

    final channelId = channelData['id'] as String;

    final members = <Map<String, dynamic>>[
      {'channel_id': channelId, 'user_id': userId, 'role': 'admin'},
    ];

    if (memberIds != null) {
      for (final id in memberIds) {
        if (id != userId) {
          members.add({'channel_id': channelId, 'user_id': id, 'role': 'member'});
        }
      }
    }

    await _client.from('channel_members').insert(members);

    return channelId;
  }

  /// Get or create a DM channel with another user.
  static Future<String> getOrCreateDm({
    required String otherUserId,
    required String organizationId,
  }) async {
    final result = await _client.rpc('get_or_create_dm', params: {
      'p_other_user_id': otherUserId,
      'p_organization_id': organizationId,
    });

    return result as String;
  }

  /// Send a location message.
  static Future<void> sendLocation({
    required String channelId,
    required double lat,
    required double lng,
    String? label,
  }) async {
    await sendMessage(
      channelId: channelId,
      content: label ?? 'Shared Location',
      type: 'location',
      metadata: {'lat': lat, 'lng': lng, 'label': label},
    );
  }

  /// Mark messages as read in a channel.
  static Future<void> markRead(String channelId) async {
    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) return;

    await _client.from('channel_members').update({
      'last_read_at': DateTime.now().toIso8601String(),
    }).eq('channel_id', channelId).eq('user_id', userId);
  }
}
