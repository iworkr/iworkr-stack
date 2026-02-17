/// Job model — maps to public.jobs
class Job {
  final String id;
  final String organizationId;
  final String displayId;
  final String title;
  final String? description;
  final JobStatus status;
  final JobPriority priority;
  final String? clientId;
  final String? clientName;
  final String? assigneeId;
  final String? assigneeName;
  final DateTime? dueDate;
  final String? location;
  final double? locationLat;
  final double? locationLng;
  final List<String> labels;
  final double revenue;
  final double cost;
  final double estimatedHours;
  final double actualHours;
  final int? estimatedDurationMinutes;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Job({
    required this.id,
    required this.organizationId,
    required this.displayId,
    required this.title,
    this.description,
    required this.status,
    required this.priority,
    this.clientId,
    this.clientName,
    this.assigneeId,
    this.assigneeName,
    this.dueDate,
    this.location,
    this.locationLat,
    this.locationLng,
    this.labels = const [],
    this.revenue = 0,
    this.cost = 0,
    this.estimatedHours = 0,
    this.actualHours = 0,
    this.estimatedDurationMinutes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      displayId: json['display_id'] as String? ?? '',
      title: json['title'] as String,
      description: json['description'] as String?,
      status: JobStatus.fromString(json['status'] as String? ?? 'backlog'),
      priority: JobPriority.fromString(json['priority'] as String? ?? 'none'),
      clientId: json['client_id'] as String?,
      clientName: (json['clients'] as Map<String, dynamic>?)?['name'] as String?,
      assigneeId: json['assignee_id'] as String?,
      assigneeName: (json['assignee:profiles'] as Map<String, dynamic>?)?['full_name'] as String? ??
          (json['profiles'] as Map<String, dynamic>?)?['full_name'] as String?,
      dueDate: json['due_date'] != null ? DateTime.tryParse(json['due_date'] as String) : null,
      location: json['location'] as String?,
      locationLat: (json['location_lat'] as num?)?.toDouble(),
      locationLng: (json['location_lng'] as num?)?.toDouble(),
      labels: (json['labels'] as List<dynamic>?)?.cast<String>() ?? [],
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
      cost: (json['cost'] as num?)?.toDouble() ?? 0,
      estimatedHours: (json['estimated_hours'] as num?)?.toDouble() ?? 0,
      actualHours: (json['actual_hours'] as num?)?.toDouble() ?? 0,
      estimatedDurationMinutes: json['estimated_duration_minutes'] as int?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }
}

enum JobStatus {
  backlog,
  todo,
  inProgress,
  done,
  cancelled;

  static JobStatus fromString(String s) {
    switch (s) {
      case 'in_progress':
        return JobStatus.inProgress;
      case 'todo':
        return JobStatus.todo;
      case 'done':
        return JobStatus.done;
      case 'cancelled':
        return JobStatus.cancelled;
      default:
        return JobStatus.backlog;
    }
  }

  String get value {
    switch (this) {
      case JobStatus.inProgress:
        return 'in_progress';
      default:
        return name;
    }
  }

  String get label {
    switch (this) {
      case JobStatus.backlog:
        return 'Backlog';
      case JobStatus.todo:
        return 'To Do';
      case JobStatus.inProgress:
        return 'In Progress';
      case JobStatus.done:
        return 'Done';
      case JobStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum JobPriority {
  urgent,
  high,
  medium,
  low,
  none;

  static JobPriority fromString(String s) {
    return JobPriority.values.firstWhere(
      (e) => e.name == s,
      orElse: () => JobPriority.none,
    );
  }
}
