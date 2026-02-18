/// Form template — JSON-driven compliance form definition.
/// Mirrors Supabase `form_templates` table.
class FormTemplate {
  final String id;
  final String organizationId;
  final String title;
  final String? description;
  final FormStage stage;
  final List<FormSection> sections;
  final bool isActive;
  final bool requiresSignature;
  final int version;
  final DateTime createdAt;

  const FormTemplate({
    required this.id,
    required this.organizationId,
    required this.title,
    this.description,
    required this.stage,
    this.sections = const [],
    this.isActive = true,
    this.requiresSignature = false,
    this.version = 1,
    required this.createdAt,
  });

  factory FormTemplate.fromJson(Map<String, dynamic> json) {
    final schema = json['schema'] as Map<String, dynamic>? ?? {};
    final rawSections = schema['sections'] as List? ?? [];

    return FormTemplate(
      id: json['id'] as String,
      organizationId: json['organization_id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      stage: FormStage.fromString(json['stage'] as String? ?? 'mid_job'),
      sections: rawSections
          .map((s) => FormSection.fromJson(s as Map<String, dynamic>))
          .toList(),
      isActive: json['is_active'] as bool? ?? true,
      requiresSignature: json['requires_signature'] as bool? ?? false,
      version: json['version'] as int? ?? 1,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  int get totalFields => sections.fold(0, (sum, s) => sum + s.fields.length);
}

enum FormStage {
  preJob,
  midJob,
  postJob;

  static FormStage fromString(String s) {
    switch (s) {
      case 'pre_job':
        return FormStage.preJob;
      case 'post_job':
        return FormStage.postJob;
      default:
        return FormStage.midJob;
    }
  }

  String get value {
    switch (this) {
      case FormStage.preJob:
        return 'pre_job';
      case FormStage.midJob:
        return 'mid_job';
      case FormStage.postJob:
        return 'post_job';
    }
  }

  String get label {
    switch (this) {
      case FormStage.preJob:
        return 'Pre-Job';
      case FormStage.midJob:
        return 'Mid-Job';
      case FormStage.postJob:
        return 'Post-Job';
    }
  }
}

/// A section within a form template.
class FormSection {
  final String title;
  final List<FormFieldDef> fields;

  const FormSection({required this.title, this.fields = const []});

  factory FormSection.fromJson(Map<String, dynamic> json) {
    final rawFields = json['fields'] as List? ?? [];
    return FormSection(
      title: json['title'] as String? ?? '',
      fields: rawFields
          .map((f) => FormFieldDef.fromJson(f as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// A single field definition within a form section.
class FormFieldDef {
  final String id;
  final FormFieldType type;
  final String label;
  final String? hint;
  final bool required;
  final List<String> options;

  const FormFieldDef({
    required this.id,
    required this.type,
    required this.label,
    this.hint,
    this.required = false,
    this.options = const [],
  });

  factory FormFieldDef.fromJson(Map<String, dynamic> json) {
    return FormFieldDef(
      id: json['id'] as String? ?? '',
      type: FormFieldType.fromString(json['type'] as String? ?? 'text'),
      label: json['label'] as String? ?? '',
      hint: json['hint'] as String?,
      required: json['required'] as bool? ?? false,
      options: (json['options'] as List?)?.cast<String>() ?? [],
    );
  }
}

enum FormFieldType {
  boolean,
  text,
  number,
  photo,
  dropdown,
  signature,
  date,
  yesNoNa;

  static FormFieldType fromString(String s) {
    switch (s) {
      case 'boolean':
        return FormFieldType.boolean;
      case 'text':
        return FormFieldType.text;
      case 'number':
        return FormFieldType.number;
      case 'photo':
        return FormFieldType.photo;
      case 'dropdown':
        return FormFieldType.dropdown;
      case 'signature':
        return FormFieldType.signature;
      case 'date':
        return FormFieldType.date;
      case 'yes_no_na':
        return FormFieldType.yesNoNa;
      default:
        return FormFieldType.text;
    }
  }
}

/// A submitted form response.
class FormResponse {
  final String id;
  final String formTemplateId;
  final String? jobId;
  final String submittedBy;
  final Map<String, dynamic> data;
  final String? signatureSvg;
  final String status;
  final DateTime? submittedAt;
  final DateTime createdAt;

  const FormResponse({
    required this.id,
    required this.formTemplateId,
    this.jobId,
    required this.submittedBy,
    this.data = const {},
    this.signatureSvg,
    this.status = 'draft',
    this.submittedAt,
    required this.createdAt,
  });

  bool get isSubmitted => status == 'submitted' || status == 'approved';

  factory FormResponse.fromJson(Map<String, dynamic> json) {
    return FormResponse(
      id: json['id'] as String,
      formTemplateId: json['form_template_id'] as String,
      jobId: json['job_id'] as String?,
      submittedBy: json['submitted_by'] as String,
      data: json['data'] as Map<String, dynamic>? ?? {},
      signatureSvg: json['signature_svg'] as String?,
      status: json['status'] as String? ?? 'draft',
      submittedAt: json['submitted_at'] != null
          ? DateTime.tryParse(json['submitted_at'] as String)
          : null,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
