import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/models/site_scan.dart';

/// Recent site scans for the current user
final recentScansProvider = FutureProvider<List<SiteScan>>((ref) async {
  final user = SupabaseService.client.auth.currentUser;
  if (user == null) return [];

  final data = await SupabaseService.client
      .from('site_scans')
      .select()
      .eq('user_id', user.id)
      .order('scan_date', ascending: false)
      .limit(20);

  return (data as List).map((s) => SiteScan.fromJson(s as Map<String, dynamic>)).toList();
});

/// Detections for a specific scan
final scanDetectionsProvider =
    FutureProvider.family<List<ScanDetection>, String>((ref, scanId) async {
  final data = await SupabaseService.client
      .from('scan_detections')
      .select()
      .eq('scan_id', scanId)
      .order('detected_at', ascending: false);

  return (data as List)
      .map((d) => ScanDetection.fromJson(d as Map<String, dynamic>))
      .toList();
});

/// Health score for a specific scan
final scanHealthProvider =
    FutureProvider.family<SiteHealthScore?, String>((ref, scanId) async {
  final data = await SupabaseService.client
      .from('site_health_scores')
      .select()
      .eq('scan_id', scanId)
      .limit(1)
      .maybeSingle();

  if (data == null) return null;
  return SiteHealthScore.fromJson(data);
});

/// Opportunities for a specific scan
final scanOpportunitiesProvider =
    FutureProvider.family<List<ScanOpportunity>, String>((ref, scanId) async {
  final data = await SupabaseService.client
      .from('scan_opportunities')
      .select()
      .eq('scan_id', scanId)
      .order('estimated_value', ascending: false);

  return (data as List)
      .map((o) => ScanOpportunity.fromJson(o as Map<String, dynamic>))
      .toList();
});

/// Start a new site scan
Future<SiteScan?> startSiteScan({String? jobId, String? clientId}) async {
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

  final row = await SupabaseService.client.from('site_scans').insert({
    'organization_id': orgId,
    'user_id': user.id,
    'job_id': jobId,
    'client_id': clientId,
    'status': 'in_progress',
  }).select().single();

  return SiteScan.fromJson(row);
}

/// Add a detection to a scan
Future<ScanDetection?> addDetection({
  required String scanId,
  required String detectionType,
  required String label,
  double confidence = 0.85,
  String? condition,
  String? severity,
  String? category,
  String? make,
  String? model,
  int? estimatedAgeYears,
  Map<String, dynamic>? boundingBox,
  String? keyframeUrl,
  String? voiceNote,
  double opportunityValue = 0,
  String? suggestedAction,
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

  final row = await SupabaseService.client.from('scan_detections').insert({
    'organization_id': orgId,
    'scan_id': scanId,
    'detection_type': detectionType,
    'label': label,
    'confidence': confidence,
    'condition': condition,
    'severity': severity,
    'category': category,
    'make': make,
    'model': model,
    'estimated_age_years': estimatedAgeYears,
    'bounding_box': boundingBox,
    'keyframe_url': keyframeUrl,
    'voice_note': voiceNote,
    'opportunity_value': opportunityValue,
    'suggested_action': suggestedAction,
  }).select().single();

  // Update scan counts
  final detections = await SupabaseService.client
      .from('scan_detections')
      .select('id, opportunity_value')
      .eq('scan_id', scanId);
  final detList = detections as List;
  double totalOpp = 0;
  for (final d in detList) {
    totalOpp += (d['opportunity_value'] as num?)?.toDouble() ?? 0;
  }
  await SupabaseService.client.from('site_scans').update({
    'detection_count': detList.length,
    'total_opportunity_value': totalOpp,
  }).eq('id', scanId);

  return ScanDetection.fromJson(row);
}

/// Complete a scan and generate health score
Future<SiteHealthScore?> completeScan(String scanId) async {
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

  // Get all detections for scoring
  final detections = await SupabaseService.client
      .from('scan_detections')
      .select()
      .eq('scan_id', scanId);
  final detList = (detections as List)
      .map((d) => ScanDetection.fromJson(d as Map<String, dynamic>))
      .toList();

  // Calculate health scores
  int safetyScore = 100;
  int efficiencyScore = 100;
  int complianceScore = 100;
  int criticalCount = 0;
  int opportunityCount = 0;
  double totalOppValue = 0;

  for (final d in detList) {
    final penalty = _conditionPenalty(d.condition);

    if (d.detectionType == 'hazard') {
      safetyScore = (safetyScore - penalty * 2).clamp(0, 100);
    } else if (d.detectionType == 'compliance') {
      complianceScore = (complianceScore - penalty).clamp(0, 100);
    } else {
      efficiencyScore = (efficiencyScore - penalty).clamp(0, 100);
    }

    if (d.isCritical) criticalCount++;
    if (d.opportunityValue > 0) {
      opportunityCount++;
      totalOppValue += d.opportunityValue;
    }
  }

  final overall = ((safetyScore * 0.4) + (efficiencyScore * 0.35) + (complianceScore * 0.25)).round();

  // Save health score
  final scoreRow = await SupabaseService.client.from('site_health_scores').insert({
    'organization_id': orgId,
    'scan_id': scanId,
    'overall_score': overall,
    'safety_score': safetyScore,
    'efficiency_score': efficiencyScore,
    'compliance_score': complianceScore,
    'total_detections': detList.length,
    'critical_count': criticalCount,
    'opportunity_count': opportunityCount,
    'total_opportunity_value': totalOppValue,
  }).select().single();

  // Generate opportunities from detections
  for (final d in detList) {
    if (d.opportunityValue > 0 || d.condition == 'poor' || d.condition == 'critical') {
      await SupabaseService.client.from('scan_opportunities').insert({
        'organization_id': orgId,
        'scan_id': scanId,
        'detection_id': d.id,
        'title': d.suggestedAction ?? 'Replace ${d.label}',
        'description': '${d.conditionLabel} condition detected. ${d.make ?? ''} ${d.model ?? ''}'.trim(),
        'category': d.category,
        'estimated_value': d.opportunityValue > 0 ? d.opportunityValue : _defaultOpportunityValue(d),
        'priority': d.severity ?? 'medium',
        'snapshot_url': d.keyframeUrl,
      });
    }
  }

  // Mark scan completed
  await SupabaseService.client.from('site_scans').update({
    'status': 'completed',
    'completed_at': DateTime.now().toIso8601String(),
    'total_opportunity_value': totalOppValue,
  }).eq('id', scanId);

  return SiteHealthScore.fromJson(scoreRow);
}

/// Accept an opportunity (include in quote)
Future<void> acceptOpportunity(String opportunityId) async {
  await SupabaseService.client
      .from('scan_opportunities')
      .update({'status': 'accepted'})
      .eq('id', opportunityId);
}

/// Decline an opportunity
Future<void> declineOpportunity(String opportunityId) async {
  await SupabaseService.client
      .from('scan_opportunities')
      .update({'status': 'declined'})
      .eq('id', opportunityId);
}

int _conditionPenalty(String? condition) {
  switch (condition) {
    case 'critical': return 15;
    case 'poor': return 10;
    case 'fair': return 5;
    default: return 0;
  }
}

double _defaultOpportunityValue(ScanDetection d) {
  if (d.isCritical) return 500;
  if (d.condition == 'poor') return 250;
  if (d.isPastEOL) return 1000;
  return 150;
}
