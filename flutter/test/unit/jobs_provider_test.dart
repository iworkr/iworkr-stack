import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/jobs_provider.dart';
import 'package:iworkr_mobile/models/job.dart';

void main() {
  group('jobsProvider', () {
    test('returns empty list when organizationId is null', () async {
      final container = ProviderContainer(
        overrides: [
          organizationIdProvider.overrideWith((ref) => Future.value(null)),
        ],
      );
      addTearDown(container.dispose);

      final jobs = await container.read(jobsProvider.future);
      expect(jobs, isEmpty);
    });
  });

  group('Job.fromJson', () {
    test('parses minimal job JSON', () {
      final json = {
        'id': 'job-1',
        'organization_id': 'org-1',
        'display_id': 'JOB-001',
        'title': 'Test Job',
        'status': 'in_progress',
        'priority': 'high',
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-01-01T00:00:00.000Z',
      };
      final job = Job.fromJson(json);
      expect(job.id, 'job-1');
      expect(job.organizationId, 'org-1');
      expect(job.displayId, 'JOB-001');
      expect(job.title, 'Test Job');
      expect(job.status, JobStatus.inProgress);
      expect(job.priority, JobPriority.high);
    });

    test('parses job with client and assignee', () {
      final json = {
        'id': 'job-2',
        'organization_id': 'org-1',
        'display_id': 'JOB-002',
        'title': 'Plumbing',
        'status': 'done',
        'priority': 'none',
        'client_id': 'c1',
        'clients': {'name': 'Acme Corp'},
        'assignee_id': 'u1',
        'profiles': {'full_name': 'Jane Doe'},
        'revenue': 150.0,
        'created_at': '2024-01-01T00:00:00.000Z',
        'updated_at': '2024-01-01T00:00:00.000Z',
      };
      final job = Job.fromJson(json);
      expect(job.clientName, 'Acme Corp');
      expect(job.assigneeName, 'Jane Doe');
      expect(job.revenue, 150.0);
      expect(job.status, JobStatus.done);
    });
  });
}
