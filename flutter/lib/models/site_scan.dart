/// Site Scan — a visual walkthrough recon session.
///
/// Mirrors Supabase `site_scans` table.
class SiteScan {
  final String id;
  final String organizationId;
  final String userId;
  final String? jobId;
  final String? clientId;
  final DateTime scanDate;
  final String status; // in_progress, processing, completed, cancelled
  final int? durationSeconds;
  final int keyframeCount;
  final int detectionCount;
  final double totalOpportunityValue;
  final String? voiceTranscript;
  final DateTime createdAt;
  final DateTime? completedAt;

  const SiteScan({
    required this.id,
    required this.organizationId,
    required this.userId,
    this.jobId,
    this.clientId,
    required this.scanDate,
    required this.status,
    this.durationSeconds,
    this.keyframeCount = 0,
    this.detectionCount = 0,
    this.totalOpportunityValue = 0,
    this.voiceTranscript,
    required this.createdAt,
    this.completedAt,
  });

  bool get isActive => status == 'in_progress';
  bool get isProcessing => status == 'processing';
  bool get isCompleted => status == 'completed';

  String get durationLabel {
    if (durationSeconds == null) return '--';
    final m = durationSeconds! ~/ 60;
    final s = durationSeconds! % 60;
    return '${m}m ${s}s';
  }

  String get opportunityLabel => '\$${totalOpportunityValue.toStringAsFixed(0)}';

  factory SiteScan.fromJson(Map<String, dynamic> json) {
    return SiteScan(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      jobId: json['job_id'] as String?,
      clientId: json['client_id'] as String?,
      scanDate: DateTime.tryParse(json['scan_date'] as String? ?? '') ?? DateTime.now(),
      status: json['status'] as String? ?? 'in_progress',
      durationSeconds: json['duration_seconds'] as int?,
      keyframeCount: json['keyframe_count'] as int? ?? 0,
      detectionCount: json['detection_count'] as int? ?? 0,
      totalOpportunityValue: (json['total_opportunity_value'] as num?)?.toDouble() ?? 0,
      voiceTranscript: json['voice_transcript'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
      completedAt: json['completed_at'] != null ? DateTime.tryParse(json['completed_at'] as String) : null,
    );
  }
}

/// Scan Detection — an individual object/defect found during a scan.
///
/// Mirrors Supabase `scan_detections`.
class ScanDetection {
  final String id;
  final String organizationId;
  final String scanId;
  final String detectionType; // asset, hazard, defect, compliance, opportunity
  final String label;
  final double confidence;
  final String? condition; // good, fair, poor, critical, unknown
  final String? severity;
  final String? category;
  final String? make;
  final String? model;
  final int? estimatedAgeYears;
  final Map<String, dynamic>? boundingBox;
  final String? keyframeUrl;
  final String? thumbnailUrl;
  final String? voiceNote;
  final double opportunityValue;
  final String? suggestedAction;
  final bool includedInQuote;
  final DateTime detectedAt;

  const ScanDetection({
    required this.id,
    required this.organizationId,
    required this.scanId,
    required this.detectionType,
    required this.label,
    this.confidence = 0,
    this.condition,
    this.severity,
    this.category,
    this.make,
    this.model,
    this.estimatedAgeYears,
    this.boundingBox,
    this.keyframeUrl,
    this.thumbnailUrl,
    this.voiceNote,
    this.opportunityValue = 0,
    this.suggestedAction,
    this.includedInQuote = false,
    required this.detectedAt,
  });

  bool get isCritical => severity == 'critical' || condition == 'critical';
  bool get isOpportunity => detectionType == 'opportunity' || opportunityValue > 0;
  bool get isHazard => detectionType == 'hazard';
  bool get isPastEOL => estimatedAgeYears != null && estimatedAgeYears! >= 15;

  String get confidenceLabel => '${(confidence * 100).toStringAsFixed(0)}%';

  String get conditionLabel {
    switch (condition) {
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  }

  String get typeIcon {
    switch (detectionType) {
      case 'hazard': return '!';
      case 'defect': return 'X';
      case 'compliance': return 'C';
      case 'opportunity': return '\$';
      default: return 'A';
    }
  }

  factory ScanDetection.fromJson(Map<String, dynamic> json) {
    return ScanDetection(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      scanId: json['scan_id'] as String,
      detectionType: json['detection_type'] as String? ?? 'asset',
      label: json['label'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
      condition: json['condition'] as String?,
      severity: json['severity'] as String?,
      category: json['category'] as String?,
      make: json['make'] as String?,
      model: json['model'] as String?,
      estimatedAgeYears: json['estimated_age_years'] as int?,
      boundingBox: json['bounding_box'] as Map<String, dynamic>?,
      keyframeUrl: json['keyframe_url'] as String?,
      thumbnailUrl: json['thumbnail_url'] as String?,
      voiceNote: json['voice_note'] as String?,
      opportunityValue: (json['opportunity_value'] as num?)?.toDouble() ?? 0,
      suggestedAction: json['suggested_action'] as String?,
      includedInQuote: json['included_in_quote'] as bool? ?? false,
      detectedAt: DateTime.tryParse(json['detected_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Site Health Score — FICO-style score for a site scan.
///
/// Mirrors Supabase `site_health_scores`.
class SiteHealthScore {
  final String id;
  final String organizationId;
  final String scanId;
  final String? clientId;
  final int overallScore;
  final int safetyScore;
  final int efficiencyScore;
  final int complianceScore;
  final int totalDetections;
  final int criticalCount;
  final int opportunityCount;
  final double totalOpportunityValue;
  final DateTime createdAt;

  const SiteHealthScore({
    required this.id,
    required this.organizationId,
    required this.scanId,
    this.clientId,
    required this.overallScore,
    this.safetyScore = 100,
    this.efficiencyScore = 100,
    this.complianceScore = 100,
    this.totalDetections = 0,
    this.criticalCount = 0,
    this.opportunityCount = 0,
    this.totalOpportunityValue = 0,
    required this.createdAt,
  });

  String get grade {
    if (overallScore >= 90) return 'A';
    if (overallScore >= 80) return 'B';
    if (overallScore >= 70) return 'C';
    if (overallScore >= 60) return 'D';
    return 'F';
  }

  factory SiteHealthScore.fromJson(Map<String, dynamic> json) {
    return SiteHealthScore(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      scanId: json['scan_id'] as String,
      clientId: json['client_id'] as String?,
      overallScore: json['overall_score'] as int? ?? 100,
      safetyScore: json['safety_score'] as int? ?? 100,
      efficiencyScore: json['efficiency_score'] as int? ?? 100,
      complianceScore: json['compliance_score'] as int? ?? 100,
      totalDetections: json['total_detections'] as int? ?? 0,
      criticalCount: json['critical_count'] as int? ?? 0,
      opportunityCount: json['opportunity_count'] as int? ?? 0,
      totalOpportunityValue: (json['total_opportunity_value'] as num?)?.toDouble() ?? 0,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Scan Opportunity — a revenue item generated from a detection.
///
/// Mirrors Supabase `scan_opportunities`.
class ScanOpportunity {
  final String id;
  final String organizationId;
  final String scanId;
  final String? detectionId;
  final String title;
  final String? description;
  final String? category;
  final double estimatedValue;
  final double costToFix;
  final double? roiAnnual;
  final String priority;
  final String status; // suggested, accepted, quoted, declined
  final String? snapshotUrl;
  final String? inventoryItemId;
  final String? quoteId;
  final DateTime createdAt;

  const ScanOpportunity({
    required this.id,
    required this.organizationId,
    required this.scanId,
    this.detectionId,
    required this.title,
    this.description,
    this.category,
    this.estimatedValue = 0,
    this.costToFix = 0,
    this.roiAnnual,
    this.priority = 'medium',
    this.status = 'suggested',
    this.snapshotUrl,
    this.inventoryItemId,
    this.quoteId,
    required this.createdAt,
  });

  bool get isCritical => priority == 'critical';
  bool get isAccepted => status == 'accepted' || status == 'quoted';

  String get valueLabel => '\$${estimatedValue.toStringAsFixed(0)}';
  String get roiLabel => roiAnnual != null ? '\$${roiAnnual!.toStringAsFixed(0)}/yr' : '';

  factory ScanOpportunity.fromJson(Map<String, dynamic> json) {
    return ScanOpportunity(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      scanId: json['scan_id'] as String,
      detectionId: json['detection_id'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      category: json['category'] as String?,
      estimatedValue: (json['estimated_value'] as num?)?.toDouble() ?? 0,
      costToFix: (json['cost_to_fix'] as num?)?.toDouble() ?? 0,
      roiAnnual: (json['roi_annual'] as num?)?.toDouble(),
      priority: json['priority'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'suggested',
      snapshotUrl: json['snapshot_url'] as String?,
      inventoryItemId: json['inventory_item_id'] as String?,
      quoteId: json['quote_id'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
