/// Profile model — maps to public.profiles
class Profile {
  // Default timezone for Australian-focused app; overridden by user profile settings
  static const String defaultTimezone = 'Australia/Brisbane';

  final String id;
  final String email;
  final String? fullName;
  final String? avatarUrl;
  final String? phone;
  final String timezone;
  final bool onboardingCompleted;
  final DateTime createdAt;

  const Profile({
    required this.id,
    required this.email,
    this.fullName,
    this.avatarUrl,
    this.phone,
    this.timezone = defaultTimezone,
    this.onboardingCompleted = false,
    required this.createdAt,
  });

  String get displayName => fullName ?? email.split('@').first;
  String get initials {
    final parts = displayName.split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return displayName.substring(0, displayName.length.clamp(0, 2)).toUpperCase();
  }

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      fullName: json['full_name'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      phone: json['phone'] as String?,
      timezone: json['timezone'] as String? ?? defaultTimezone,
      onboardingCompleted: json['onboarding_completed'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

/// Organization member model
class OrganizationMember {
  final String organizationId;
  final String userId;
  final String role;
  final String status;
  final String? branch;
  final Profile? profile;

  const OrganizationMember({
    required this.organizationId,
    required this.userId,
    required this.role,
    required this.status,
    this.branch,
    this.profile,
  });

  factory OrganizationMember.fromJson(Map<String, dynamic> json) {
    return OrganizationMember(
      organizationId: json['organization_id'] as String,
      userId: json['user_id'] as String,
      role: json['role'] as String? ?? 'technician',
      status: json['status'] as String? ?? 'active',
      branch: json['branch'] as String?,
      profile: json['profiles'] != null
          ? Profile.fromJson(json['profiles'] as Map<String, dynamic>)
          : null,
    );
  }
}
