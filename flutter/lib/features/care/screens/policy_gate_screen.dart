import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iworkr_mobile/core/services/governance_policy_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:local_auth/local_auth.dart';
import 'package:url_launcher/url_launcher.dart';

class PolicyGateScreen extends StatefulWidget {
  const PolicyGateScreen({super.key});

  @override
  State<PolicyGateScreen> createState() => _PolicyGateScreenState();
}

class _PolicyGateScreenState extends State<PolicyGateScreen> {
  final ScrollController _scroll = ScrollController();
  final LocalAuthentication _auth = LocalAuthentication();
  List<PendingPolicyTask> _pending = const [];
  bool _loading = true;
  int _index = 0;
  bool _scrolledBottom = false;
  bool _declared = false;
  bool _biometricVerified = false;
  DateTime? _enteredAt;
  String _error = '';
  final Map<int, String> _quizAnswers = {};

  PendingPolicyTask? get _task =>
      (_pending.isNotEmpty && _index < _pending.length) ? _pending[_index] : null;

  @override
  void initState() {
    super.initState();
    _enteredAt = DateTime.now();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final max = _scroll.position.maxScrollExtent;
    final current = _scroll.position.pixels;
    if (max <= 0) return;
    if (current / max >= 0.95 && !_scrolledBottom) {
      setState(() => _scrolledBottom = true);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final tasks = await fetchMyPendingPolicies();
      setState(() {
        _pending = tasks;
        _loading = false;
        _index = 0;
        _scrolledBottom = false;
        _declared = false;
        _biometricVerified = false;
        _quizAnswers.clear();
        _enteredAt = DateTime.now();
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _verifyBiometric() async {
    try {
      final can = await _auth.canCheckBiometrics;
      if (!can) return;
      final ok = await _auth.authenticate(
        localizedReason: 'Confirm you have read and understood this policy',
        options: const AuthenticationOptions(biometricOnly: true),
      );
      if (ok) setState(() => _biometricVerified = true);
    } catch (_) {}
  }

  bool _isDwellSatisfied() {
    final entered = _enteredAt;
    if (entered == null) return false;
    return DateTime.now().difference(entered).inSeconds >= 45;
  }

  bool _evaluateQuiz(PendingPolicyTask task) {
    if (task.quizPayload.isEmpty) return true;
    for (var i = 0; i < task.quizPayload.length; i++) {
      final row = task.quizPayload[i];
      final correct = row['correct_answer']?.toString() ?? '';
      if ((_quizAnswers[i] ?? '') != correct) return false;
    }
    return true;
  }

  Future<void> _ackNow() async {
    final task = _task;
    if (task == null) return;
    final quizPass = _evaluateQuiz(task);
    if (!quizPass) {
      setState(() {
        _error = 'Quiz must score 100% before signing.';
      });
      return;
    }
    await acknowledgePolicyTask(
      acknowledgementId: task.acknowledgementId,
      quizPassed: true,
      quizScore: 100,
      biometricToken: _biometricVerified ? 'biometric-ok' : null,
    );

    HapticFeedback.heavyImpact();
    if (_index < _pending.length - 1) {
      setState(() {
        _index += 1;
        _scrolledBottom = false;
        _declared = false;
        _biometricVerified = false;
        _quizAnswers.clear();
        _enteredAt = DateTime.now();
      });
      _scroll.jumpTo(0);
      return;
    }
    if (!mounted) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final task = _task;
    final canAcknowledge = task != null &&
        _scrolledBottom &&
        _declared &&
        _isDwellSatisfied() &&
        (task.quizPayload.isEmpty || _evaluateQuiz(task));

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : task == null
                ? Center(
                    child: Text(
                      'No pending policy tasks',
                      style: GoogleFonts.inter(color: Colors.white70),
                    ),
                  )
                : Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF101010),
                          border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.shield, color: Colors.amber, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${task.title} • v${task.versionNumber}',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            Text(
                              '${_index + 1}/${_pending.length}',
                              style: GoogleFonts.jetBrainsMono(color: Colors.white60, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: SingleChildScrollView(
                          controller: _scroll,
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (task.documentUrl != null && task.documentUrl!.isNotEmpty)
                                Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                    color: Colors.white.withValues(alpha: 0.02),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'PDF attachment detected. Open and review, then return to sign.',
                                          style: GoogleFonts.inter(color: Colors.white70, fontSize: 12),
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () async {
                                          final uri = Uri.tryParse(task.documentUrl!);
                                          if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                                        },
                                        child: const Text('Open PDF'),
                                      ),
                                    ],
                                  ),
                                ),
                              Text(
                                task.richTextContent?.isNotEmpty == true
                                    ? task.richTextContent!
                                    : 'Policy text is attached as PDF. Please open and review the document. '
                                      'For compliance, scroll this page to the end and complete declaration.',
                                style: GoogleFonts.inter(color: Colors.white, height: 1.45, fontSize: 14),
                              ),
                              const SizedBox(height: 24),
                              if (task.quizPayload.isNotEmpty) ...[
                                Text(
                                  'Comprehension Quiz (100% required)',
                                  style: GoogleFonts.inter(
                                    color: Colors.amber.shade300,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                ...task.quizPayload.asMap().entries.map((entry) {
                                  final idx = entry.key;
                                  final row = entry.value;
                                  final options = ((row['options'] as List?) ?? const []).map((e) => e.toString()).toList();
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          row['question']?.toString() ?? 'Question',
                                          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
                                        ),
                                        const SizedBox(height: 6),
                                        // ignore: deprecated_member_use
                                        ...options.map((opt) => RadioListTile<String>(
                                              dense: true,
                                              contentPadding: EdgeInsets.zero,
                                              value: opt,
                                              // ignore: deprecated_member_use
                                              groupValue: _quizAnswers[idx],
                                              activeColor: ObsidianTheme.careBlue,
                                              title: Text(opt, style: GoogleFonts.inter(color: Colors.white70, fontSize: 13)),
                                              // ignore: deprecated_member_use
                                              onChanged: (value) => setState(() => _quizAnswers[idx] = value ?? ''),
                                            )),
                                      ],
                                    ),
                                  );
                                }),
                                TextButton(
                                  onPressed: () {
                                    final pass = _evaluateQuiz(task);
                                    setState(() {
                                      _error = pass ? '' : 'Quiz failed. Re-read and retry for 100%.';
                                    });
                                    if (pass) HapticFeedback.mediumImpact();
                                  },
                                  child: const Text('Check Answers'),
                                ),
                                const SizedBox(height: 8),
                              ],
                              CheckboxListTile(
                                value: _declared,
                                activeColor: ObsidianTheme.careBlue,
                                onChanged: (v) => setState(() => _declared = v ?? false),
                                title: Text(
                                  'I declare I have read, understood and agree to this policy.',
                                  style: GoogleFonts.inter(color: Colors.white, fontSize: 13),
                                ),
                              ),
                              Row(
                                children: [
                                  OutlinedButton.icon(
                                    onPressed: _verifyBiometric,
                                    icon: const Icon(Icons.fingerprint),
                                    label: Text(_biometricVerified ? 'Biometric verified' : 'Verify biometrics'),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              if (_error.isNotEmpty)
                                Text(_error, style: GoogleFonts.inter(color: ObsidianTheme.rose, fontSize: 12)),
                              Text(
                                !_scrolledBottom
                                    ? 'Scroll to the end to unlock acknowledgement.'
                                    : !_isDwellSatisfied()
                                        ? 'Remain on this policy for at least 45 seconds.'
                                        : 'Ready to acknowledge.',
                                style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0C0C0C),
                          border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: canAcknowledge ? _ackNow : null,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: ObsidianTheme.careBlue,
                                  disabledBackgroundColor: Colors.white24,
                                  minimumSize: const Size.fromHeight(46),
                                ),
                                child: Text(
                                  'Acknowledge Policy',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}

