import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/ai_chat_message.dart';

/// AI chat messages for current user (most recent 50)
final aiMessagesProvider =
    FutureProvider<List<AiChatMessage>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('ai_chat_messages')
      .select()
      .eq('user_id', user.id)
      .order('created_at', ascending: false)
      .limit(50);

  return (data as List)
      .map((m) => AiChatMessage.fromJson(m as Map<String, dynamic>))
      .toList()
      .reversed
      .toList();
});

/// AI messages for a specific job context
final jobAiMessagesProvider =
    FutureProvider.family<List<AiChatMessage>, String>((ref, jobId) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('ai_chat_messages')
      .select()
      .eq('user_id', user.id)
      .eq('job_id', jobId)
      .order('created_at', ascending: true)
      .limit(100);

  return (data as List)
      .map((m) => AiChatMessage.fromJson(m as Map<String, dynamic>))
      .toList();
});

/// Send a message and get an AI response (stores both in DB)
Future<AiChatMessage?> sendAiMessage({
  required String content,
  String? jobId,
}) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return null;

  final orgRow = await SupabaseService.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

  if (orgRow == null) return null;
  final orgId = orgRow['organization_id'] as String;

  // Store user message
  await SupabaseService.client.from('ai_chat_messages').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'job_id': jobId,
    'role': 'user',
    'content': content,
  });

  // Build context for AI response
  String contextData = '';
  if (jobId != null) {
    final jobNotes = await SupabaseService.client
        .from('job_notes')
        .select('content, created_at')
        .eq('job_id', jobId)
        .order('created_at', ascending: false)
        .limit(10);

    if ((jobNotes as List).isNotEmpty) {
      contextData = 'Recent job notes:\n';
      for (final note in jobNotes) {
        contextData += '- ${note['content']}\n';
      }
    }
  }

  // INCOMPLETE:BLOCKED(OPENAI_API_KEY) — AI chat uses local placeholder response generator instead of real LLM; needs POST to /api/ai/chat or Supabase Edge Function with OpenAI key. Done when responses come from an actual LLM and [Demo] prefix is removed.
  final response = _generateLocalResponse(content, contextData);

  // Store AI response
  final row = await SupabaseService.client.from('ai_chat_messages').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'job_id': jobId,
    'role': 'assistant',
    'content': response,
    'metadata': {
      'model': 'local',
      'context_length': contextData.length,
    },
  }).select().single();

  return AiChatMessage.fromJson(row);
}

/// Local response generation (placeholder until Edge Function LLM is wired).
/// All responses are prefixed with [Demo] to make it clear this is not a real AI.
String _generateLocalResponse(String query, String context) {
  final lower = query.toLowerCase();

  if (lower.contains('code') || lower.contains('gate') || lower.contains('pin')) {
    if (context.isNotEmpty) {
      return '[Demo] Based on job history:\n$context\nI found relevant access information above.';
    }
    return '[Demo] I don\'t have access code information for this site yet. Check the job notes or ask the dispatcher.';
  }

  if (lower.contains('history') || lower.contains('previous') || lower.contains('last time')) {
    if (context.isNotEmpty) {
      return '[Demo] Here\'s what I found from previous visits:\n$context';
    }
    return '[Demo] No previous visit records found for this job. This may be a first visit.';
  }

  if (lower.contains('quote') || lower.contains('price') || lower.contains('cost')) {
    return '[Demo] I can help you draft a quote. Navigate to the job and tap "Create Quote" to get started with itemized pricing.';
  }

  if (lower.contains('note') || lower.contains('log')) {
    return '[Demo] I\'ll format that as a professional note and add it to the job diary. Just speak or type your observations.';
  }

  return '[Demo] I\'m your AI Field Agent. I can help with:\n• Retrieving site access codes\n• Reviewing job history\n• Drafting quotes\n• Taking formatted notes\n\nWhat do you need?';
}

/// Knowledge articles for the org
final knowledgeArticlesProvider =
    FutureProvider<List<KnowledgeArticle>>((ref) async {
  final orgId = await ref.watch(organizationIdProvider.future);
  if (orgId == null) return [];

  final data = await SupabaseService.client
      .from('knowledge_articles')
      .select()
      .eq('organization_id', orgId)
      .order('is_pinned', ascending: false)
      .order('title');

  return (data as List)
      .map((a) => KnowledgeArticle.fromJson(a as Map<String, dynamic>))
      .toList();
});
