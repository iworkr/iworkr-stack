class TestConfig {
  static const String adminEmail = String.fromEnvironment(
    'ADMIN_EMAIL',
    defaultValue: 'qa-admin@iworkrapp.com',
  );
  static const String workerEmail = String.fromEnvironment(
    'WORKER_EMAIL',
    defaultValue: 'qa-worker@iworkrapp.com',
  );
  static const String defaultPassword = String.fromEnvironment(
    'TEST_PASSWORD',
    defaultValue: 'QATestPass123!',
  );
  static const String workerPassword = defaultPassword;
  static const String adminPassword = defaultPassword;

  static const String testEmail = String.fromEnvironment(
    'TEST_EMAIL',
    defaultValue: 'qa-test@iworkrapp.com',
  );
  static const String testPassword = String.fromEnvironment(
    'TEST_PASSWORD',
    defaultValue: 'QATestPass123!',
  );

  /// Supabase URL — must be provided via --dart-define for integration tests.
  /// Defaults to the local Supabase instance.
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'http://127.0.0.1:54321',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static const Duration shortWait = Duration(milliseconds: 500);
  static const Duration mediumWait = Duration(seconds: 2);
  static const Duration longWait = Duration(seconds: 5);
  static const Duration timeout = Duration(seconds: 15);

  static const String dockTabHome = 'Home';
  static const String dockTabJobs = 'Jobs';
  static const String dockTabTimeline = 'Timeline';
  static const String dockTabComms = 'Comms';
  static const String dockTabProfile = 'Profile';
}
