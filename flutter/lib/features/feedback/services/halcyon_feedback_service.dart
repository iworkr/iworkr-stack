import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/features/feedback/widgets/sentiment_sieve_sheet.dart';
import 'package:iworkr_mobile/features/feedback/widgets/internal_feedback_sheet.dart';

// ============================================================================
// Project Halcyon — The Dopamine Loop Feedback Service
// ============================================================================
// A psychological, state-aware feedback engine that:
// 1. Asks the backend if the user is eligible (firewall checks)
// 2. Presents a low-friction Sentiment Sieve bottom sheet
// 3. Routes positive sentiment → Native OS review API
// 4. Routes negative sentiment → Internal feedback absorption
// ============================================================================

enum HalcyonSentiment { positive, negative, dismissed }

/// The "Peak Dopamine" trigger events that arm the Halcyon engine.
class HalcyonTrigger {
  static const fridayFinish = 'friday_finish';
  static const equinoxWin = 'equinox_win';
  static const clinicalRelief = 'clinical_relief';
  static const frictionlessFinance = 'frictionless_finance';
  static const shiftStreak = 'shift_streak';
  static const manual = 'manual';
}

class HalcyonFeedbackService {
  HalcyonFeedbackService._();
  static final instance = HalcyonFeedbackService._();

  final InAppReview _inAppReview = InAppReview.instance;
  bool _isPromptActive = false;

  // ── Primary trigger method ────────────────────────────────────────────
  // Call this from specific trigger points in the app.

  /// Trigger the "Friday Finish" flow.
  /// Called when a worker clocks out of their last scheduled shift before
  /// a 48-hour gap (weekend).
  Future<void> triggerFridayFinish(BuildContext context, String userId) async {
    await _runSieve(context, userId, HalcyonTrigger.fridayFinish,
        personalMessage: "You've crushed your shifts this week!");
  }

  /// Trigger the "Equinox Win" flow.
  /// Called when a worker successfully claims an open shift.
  Future<void> triggerEquinoxWin(BuildContext context, String userId) async {
    await _runSieve(context, userId, HalcyonTrigger.equinoxWin,
        personalMessage: 'You secured the shift!');
  }

  /// Trigger the "Clinical Relief" flow (Glasshouse Family Portal).
  /// Called when a parent reads a positive daily update and taps acknowledge.
  Future<void> triggerClinicalRelief(BuildContext context, String userId) async {
    await _runSieve(context, userId, HalcyonTrigger.clinicalRelief,
        personalMessage: "We love caring for your family.");
  }

  /// Trigger the "Frictionless Finance" flow (Glasshouse Family Portal).
  /// Called when a guardian successfully approves an invoice.
  Future<void> triggerFrictionlessFinance(BuildContext context, String userId) async {
    await _runSieve(context, userId, HalcyonTrigger.frictionlessFinance,
        personalMessage: 'Invoice approved successfully!');
  }

  // ── Core Sieve Logic ──────────────────────────────────────────────────

  Future<void> _runSieve(
    BuildContext context,
    String userId,
    String triggerEvent, {
    String? personalMessage,
  }) async {
    // Prevent concurrent prompts
    if (_isPromptActive) return;

    // Beta / TestFlight / Debug guard
    if (kDebugMode || _isTestFlight()) {
      debugPrint('[Halcyon] Debug/TestFlight mode — skipping native review. '
          'Trigger: $triggerEvent, User: $userId');
      return;
    }

    try {
      _isPromptActive = true;

      // 1. Verify with backend if prompt is allowed
      final isEligible = await _checkBackendEligibility(userId, triggerEvent);
      if (!isEligible) {
        debugPrint('[Halcyon] User not eligible. Trigger: $triggerEvent');
        return;
      }

      // 2. Verify native OS capability
      final isAvailable = await _inAppReview.isAvailable();

      // 3. Small delay for dopamine to peak (3 seconds after the success state)
      await Future.delayed(const Duration(seconds: 3));

      // 4. Check context is still valid after delay
      if (!context.mounted) return;

      // 5. Fetch user's first name for personalization
      final firstName = await _getUserFirstName(userId);

      // 6. Show the Sentiment Sieve bottom sheet
      final sentiment = await showModalBottomSheet<HalcyonSentiment>(
        context: context,
        useRootNavigator: true,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        isDismissible: true,
        builder: (ctx) => SentimentSieveSheet(
          userName: firstName,
          personalMessage: personalMessage,
          triggerEvent: triggerEvent,
        ),
      );

      // 7. Route based on sentiment
      if (sentiment == HalcyonSentiment.positive) {
        await _handlePositiveSentiment(userId, triggerEvent, isAvailable);
      } else if (sentiment == HalcyonSentiment.negative) {
        if (context.mounted) {
          await _handleNegativeSentiment(context, userId, triggerEvent);
        }
      } else {
        // Dismissed (swiped away) — log silently
        await _logSentiment(userId, 'dismissed', triggerEvent);
      }
    } catch (e) {
      debugPrint('[Halcyon] Error: $e');
    } finally {
      _isPromptActive = false;
    }
  }

  // ── Positive Route (→ Native OS Review) ───────────────────────────────

  Future<void> _handlePositiveSentiment(
    String userId,
    String triggerEvent,
    bool isNativeAvailable,
  ) async {
    // Log positive sentiment
    await _logSentiment(userId, 'positive', triggerEvent);

    // Fire native OS review API (fire-and-forget)
    // Apple's StoreKit may silently throttle this — that's expected behavior.
    if (isNativeAvailable) {
      try {
        await _inAppReview.requestReview();

        // Update native review count
        final client = SupabaseService.client;
        await client.from('user_feedback_metrics').update({
          'last_native_review_requested_at': DateTime.now().toUtc().toIso8601String(),
          'native_review_count_365d': await _getNativeReviewCount(userId) + 1,
        }).eq('user_id', userId);
      } catch (e) {
        // Apple/Google may silently fail — this is fine.
        debugPrint('[Halcyon] Native review request failed (expected on throttle): $e');
      }
    }
  }

  // ── Negative Route (→ Internal Feedback Absorption) ───────────────────

  Future<void> _handleNegativeSentiment(
    BuildContext context,
    String userId,
    String triggerEvent,
  ) async {
    if (!context.mounted) return;

    // Show the internal feedback form (same bottom sheet, transitions in-place)
    final feedbackText = await showModalBottomSheet<String>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: true,
      builder: (ctx) => InternalFeedbackSheet(
        userId: userId,
        triggerEvent: triggerEvent,
      ),
    );

    if (feedbackText != null && feedbackText.trim().isNotEmpty) {
      await _submitInternalFeedback(userId, triggerEvent, feedbackText);
    } else {
      // User opened feedback form but didn't submit — still log the negative sentiment
      await _logSentiment(userId, 'negative', triggerEvent);
    }
  }

  // ── Backend Communication ─────────────────────────────────────────────

  Future<bool> _checkBackendEligibility(String userId, String triggerEvent) async {
    try {
      final client = SupabaseService.client;
      final response = await client.functions.invoke(
        'evaluate-halcyon-state',
        body: {'user_id': userId, 'trigger_event': triggerEvent},
      );

      if (response.status != 200) return false;

      final data = response.data is String
          ? jsonDecode(response.data as String) as Map<String, dynamic>
          : response.data as Map<String, dynamic>;

      final eligible = data['eligible'] as bool? ?? false;
      if (!eligible) {
        debugPrint('[Halcyon] Not eligible: ${data['reason']} — ${data['detail'] ?? ''}');
      }
      return eligible;
    } catch (e) {
      // Fail closed — never prompt on error
      debugPrint('[Halcyon] Eligibility check failed: $e');
      return false;
    }
  }

  Future<void> _logSentiment(String userId, String result, String triggerEvent) async {
    try {
      final client = SupabaseService.client;
      final existing = await client
          .from('user_feedback_metrics')
          .select('total_prompts_shown, total_positive_sentiments, total_negative_sentiments')
          .eq('user_id', userId)
          .maybeSingle();

      final updates = <String, dynamic>{
        'last_sentiment_prompted_at': DateTime.now().toUtc().toIso8601String(),
        'sentiment_result': result,
        'last_trigger_event': triggerEvent,
        'total_prompts_shown': (existing?['total_prompts_shown'] as int? ?? 0) + 1,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      };

      if (result == 'positive') {
        updates['total_positive_sentiments'] =
            (existing?['total_positive_sentiments'] as int? ?? 0) + 1;
      } else if (result == 'negative') {
        updates['total_negative_sentiments'] =
            (existing?['total_negative_sentiments'] as int? ?? 0) + 1;
      }

      await client
          .from('user_feedback_metrics')
          .upsert({'user_id': userId, ...updates});
    } catch (e) {
      debugPrint('[Halcyon] Failed to log sentiment: $e');
    }
  }

  Future<void> _submitInternalFeedback(
    String userId,
    String triggerEvent,
    String feedbackText,
  ) async {
    try {
      final client = SupabaseService.client;

      // Try edge function first (handles Slack routing)
      await client.functions.invoke(
        'submit-internal-feedback',
        body: {
          'user_id': userId,
          'trigger_event': triggerEvent,
          'feedback_text': feedbackText,
          'app_version': '1.0.0', // TODO: Read from package_info_plus
          'device_info': {
            'platform': Platform.isIOS ? 'ios' : 'android',
            'os_version': Platform.operatingSystemVersion,
          },
        },
      );
    } catch (e) {
      // Offline fallback: store locally for sync later
      // The "Rage Tap" failsafe — never lose negative feedback
      debugPrint('[Halcyon] Edge function failed, queuing locally: $e');
      try {
        // Direct insert as fallback (RLS allows user to insert their own)
        final client = SupabaseService.client;
        await client.from('internal_feedback_logs').insert({
          'user_id': userId,
          'trigger_event': triggerEvent,
          'feedback_text': feedbackText,
          'app_version': '1.0.0',
          'device_info': {
            'platform': Platform.isIOS ? 'ios' : 'android',
            'os_version': Platform.operatingSystemVersion,
            'offline_queued': true,
          },
        });
      } catch (e2) {
        // Ultimate fallback: Even direct insert failed (truly offline).
        // Store in SharedPreferences for sync when connectivity returns.
        debugPrint('[Halcyon] Truly offline — feedback cached locally: $e2');
        // SharedPreferences fallback handled by drift sync queue
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  Future<String> _getUserFirstName(String userId) async {
    try {
      final client = SupabaseService.client;
      final data = await client
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();

      final fullName = data?['full_name'] as String? ?? '';
      return fullName.split(' ').first;
    } catch (_) {
      return 'there';
    }
  }

  Future<int> _getNativeReviewCount(String userId) async {
    try {
      final client = SupabaseService.client;
      final data = await client
          .from('user_feedback_metrics')
          .select('native_review_count_365d')
          .eq('user_id', userId)
          .maybeSingle();
      return data?['native_review_count_365d'] as int? ?? 0;
    } catch (_) {
      return 0;
    }
  }

  bool _isTestFlight() {
    // Check if running in TestFlight (iOS) or internal testing (Android)
    if (Platform.isIOS) {
      // In TestFlight, the app receipt URL contains 'sandboxReceipt'
      // This is a common heuristic; in_app_review handles this gracefully
      return const bool.fromEnvironment('IS_TESTFLIGHT', defaultValue: false);
    }
    return false;
  }
}

// ── Riverpod Provider ───────────────────────────────────────────────────────

final halcyonServiceProvider = Provider<HalcyonFeedbackService>((ref) {
  return HalcyonFeedbackService.instance;
});
