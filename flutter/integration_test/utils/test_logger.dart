import 'dart:io';

enum LogLevel { info, warn, error, step, pass, fail }

class TestLogger {
  static final _buffer = StringBuffer();
  static int _stepCount = 0;
  static final _stopwatch = Stopwatch();

  static void start(String suiteName) {
    _buffer.clear();
    _stepCount = 0;
    _stopwatch
      ..reset()
      ..start();
    _write(LogLevel.info, '═══════════════════════════════════════════════');
    _write(LogLevel.info, '  iWorkr QA Suite: $suiteName');
    _write(LogLevel.info, '  Started: ${DateTime.now().toIso8601String()}');
    _write(LogLevel.info, '═══════════════════════════════════════════════');
  }

  static void step(String description) {
    _stepCount++;
    _write(LogLevel.step, '[STEP $_stepCount] $description');
  }

  static void info(String message) => _write(LogLevel.info, message);
  static void warn(String message) => _write(LogLevel.warn, message);
  static void error(String message) => _write(LogLevel.error, message);
  static void pass(String message) => _write(LogLevel.pass, message);
  static void fail(String message) => _write(LogLevel.fail, message);

  static void section(String name) {
    _write(LogLevel.info, '');
    _write(LogLevel.info, '── $name ${'─' * (45 - name.length)}');
  }

  static void finish() {
    _stopwatch.stop();
    _write(LogLevel.info, '');
    _write(LogLevel.info, '═══════════════════════════════════════════════');
    _write(
      LogLevel.info,
      '  Finished: ${DateTime.now().toIso8601String()}',
    );
    _write(
      LogLevel.info,
      '  Duration: ${_stopwatch.elapsed.inSeconds}s',
    );
    _write(LogLevel.info, '  Steps executed: $_stepCount');
    _write(LogLevel.info, '═══════════════════════════════════════════════');
  }

  static String get output => _buffer.toString();

  static Future<void> saveToFile([String path = 'test_report.log']) async {
    final file = File(path);
    await file.writeAsString(_buffer.toString());
  }

  static void _write(LogLevel level, String message) {
    final prefix = switch (level) {
      LogLevel.info  => '[INFO ]',
      LogLevel.warn  => '[WARN ]',
      LogLevel.error => '[ERROR]',
      LogLevel.step  => '[STEP ]',
      LogLevel.pass  => '[ OK  ]',
      LogLevel.fail  => '[FAIL ]',
    };
    final line = '$prefix $message';
    _buffer.writeln(line);
    // ignore: avoid_print
    print(line);
  }
}
