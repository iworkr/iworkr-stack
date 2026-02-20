import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iworkr_mobile/core/widgets/status_pip.dart';
import 'package:iworkr_mobile/models/job.dart';

void main() {
  testWidgets('StatusPip golden — inProgress (active)', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: StatusPip(
              color: Color(0xFF10B981),
              pulse: true,
              size: 6,
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await expectLater(
      find.byType(StatusPip),
      matchesGoldenFile('goldens/status_pip_in_progress.png'),
    );
  });

  testWidgets('StatusPip golden — done (static)', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: StatusPip(
              color: Color(0xFF10B981),
              pulse: false,
              size: 6,
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await expectLater(
      find.byType(StatusPip),
      matchesGoldenFile('goldens/status_pip_done.png'),
    );
  });

  testWidgets('StatusPip.fromJobStatus renders for inProgress', (tester) async {
    final pip = StatusPip.fromJobStatus(JobStatus.inProgress);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: pip,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(StatusPip), findsOneWidget);
  });
}
