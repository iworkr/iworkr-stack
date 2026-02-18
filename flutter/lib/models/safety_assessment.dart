/// Safety Assessment model — mirrors Supabase `safety_assessments` table.
///
/// Represents a mandatory risk assessment that blocks job start.
class SafetyAssessment {
  final String id;
  final String organizationId;
  final String jobId;
  final String? assessedBy;
  final String? assessorName;
  final String status; // pending, cleared, flagged
  final List<HazardEntry> hazards;
  final List<ControlMeasure> controlMeasures;
  final bool siteSafe;
  final bool loneWorkerEnabled;
  final double? locationLat;
  final double? locationLng;
  final DateTime? signedAt;
  final String? notes;
  final DateTime createdAt;

  const SafetyAssessment({
    required this.id,
    required this.organizationId,
    required this.jobId,
    this.assessedBy,
    this.assessorName,
    required this.status,
    this.hazards = const [],
    this.controlMeasures = const [],
    this.siteSafe = false,
    this.loneWorkerEnabled = false,
    this.locationLat,
    this.locationLng,
    this.signedAt,
    this.notes,
    required this.createdAt,
  });

  bool get isCleared => status == 'cleared';
  bool get isPending => status == 'pending';

  factory SafetyAssessment.fromJson(Map<String, dynamic> json) {
    final hazardsRaw = json['hazards'] as List<dynamic>? ?? [];
    final controlsRaw = json['control_measures'] as List<dynamic>? ?? [];

    return SafetyAssessment(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      jobId: json['job_id'] as String,
      assessedBy: json['assessed_by'] as String?,
      assessorName: json['assessor_name'] as String?,
      status: json['status'] as String? ?? 'pending',
      hazards: hazardsRaw.map((h) => HazardEntry.fromJson(h as Map<String, dynamic>)).toList(),
      controlMeasures: controlsRaw.map((c) => ControlMeasure.fromJson(c as Map<String, dynamic>)).toList(),
      siteSafe: json['site_safe'] as bool? ?? false,
      loneWorkerEnabled: json['lone_worker_enabled'] as bool? ?? false,
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      signedAt: json['signed_at'] != null ? DateTime.tryParse(json['signed_at'] as String) : null,
      notes: json['notes'] as String?,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// A single hazard entry in the assessment
class HazardEntry {
  final String key;
  final String label;
  final String icon;
  final bool selected;

  const HazardEntry({required this.key, required this.label, this.icon = '', this.selected = false});

  factory HazardEntry.fromJson(Map<String, dynamic> json) {
    return HazardEntry(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
      selected: json['selected'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {'key': key, 'label': label, 'icon': icon, 'selected': selected};
}

/// A control measure linked to a hazard
class ControlMeasure {
  final String hazardKey;
  final String measure;

  const ControlMeasure({required this.hazardKey, required this.measure});

  factory ControlMeasure.fromJson(Map<String, dynamic> json) {
    return ControlMeasure(
      hazardKey: json['hazard_key'] as String? ?? '',
      measure: json['measure'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'hazard_key': hazardKey, 'measure': measure};
}

/// Standard hazard catalog for the Hazard Matrix
class HazardCatalog {
  static const List<HazardEntry> standard = [
    HazardEntry(key: 'heights', label: 'Working at Heights', icon: 'ladder'),
    HazardEntry(key: 'electrical', label: 'Live Electrical', icon: 'lightning'),
    HazardEntry(key: 'confined', label: 'Confined Space', icon: 'cube'),
    HazardEntry(key: 'chemical', label: 'Hazardous Chemicals', icon: 'flask'),
    HazardEntry(key: 'heat', label: 'Extreme Heat', icon: 'fire'),
    HazardEntry(key: 'noise', label: 'Excessive Noise', icon: 'speaker'),
    HazardEntry(key: 'manual', label: 'Manual Handling', icon: 'person'),
    HazardEntry(key: 'traffic', label: 'Traffic / Vehicles', icon: 'car'),
    HazardEntry(key: 'asbestos', label: 'Asbestos Risk', icon: 'warning'),
    HazardEntry(key: 'fall', label: 'Slip / Trip / Fall', icon: 'warning'),
    HazardEntry(key: 'weather', label: 'Weather Exposure', icon: 'cloud'),
    HazardEntry(key: 'other', label: 'Other Hazard', icon: 'dots'),
  ];

  /// Control measures per hazard type
  static const Map<String, List<String>> controls = {
    'heights': ['Safety harness', 'Scaffolding', 'Edge protection', 'EWP platform'],
    'electrical': ['Isolation switch', 'Lock-out tag-out', 'Insulated tools', 'PPE gloves'],
    'confined': ['Atmospheric monitor', 'Ventilation', 'Rescue plan', 'Standby person'],
    'chemical': ['SDS reviewed', 'PPE worn', 'Ventilation', 'Spill kit available'],
    'heat': ['Hydration plan', 'Shade provision', 'Frequent breaks', 'Buddy system'],
    'noise': ['Hearing protection', 'Barrier installed', 'Time limits', 'Signage'],
    'manual': ['Mechanical aids', 'Two-person lift', 'Correct technique', 'Pre-lift stretch'],
    'traffic': ['Traffic management plan', 'Hi-vis clothing', 'Barriers', 'Spotter'],
    'asbestos': ['Licensed assessor', 'Encapsulation', 'No disturbance', 'PPE respirator'],
    'fall': ['Non-slip footwear', 'Housekeeping', 'Signage', 'Wet area treatment'],
    'weather': ['Monitor forecast', 'UV protection', 'Wind assessment', 'Lightning protocol'],
    'other': ['Risk assessment', 'Supervisor approval', 'PPE as required'],
  };
}
