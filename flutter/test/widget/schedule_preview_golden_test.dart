import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/features/dashboard/widgets/schedule_preview.dart';

void main() {
  testWidgets('SchedulePreview empty state shows message', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ObsidianTheme.darkTheme,
        home: const Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: SchedulePreview(blocks: []),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Clear schedule today'), findsOneWidget);
  });
}
