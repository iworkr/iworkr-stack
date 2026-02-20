import 'package:flutter_test/flutter_test.dart';
import 'package:iworkr_mobile/models/schedule_block.dart';

void main() {
  group('ScheduleBlock.fromJson', () {
    test('parses minimal block JSON', () {
      final json = {
        'id': 'block-1',
        'organization_id': 'org-1',
        'technician_id': 'tech-1',
        'job_id': 'job-1',
        'title': 'Service call',
        'start_time': '2024-01-01T09:00:00.000Z',
        'end_time': '2024-01-01T10:00:00.000Z',
        'status': 'scheduled',
      };
      final block = ScheduleBlock.fromJson(json);
      expect(block.id, 'block-1');
      expect(block.organizationId, 'org-1');
      expect(block.technicianId, 'tech-1');
      expect(block.jobId, 'job-1');
      expect(block.status, ScheduleBlockStatus.scheduled);
    });
  });
}
