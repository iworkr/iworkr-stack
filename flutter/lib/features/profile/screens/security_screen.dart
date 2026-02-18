import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/biometric_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/subscription_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/stealth_icon.dart';

/// Security & Billing — "The Fortress"
///
/// Modules:
/// 1. Password Management
/// 2. Biometrics (FaceID/TouchID)
/// 3. Active Sessions (Forensic Log)
/// 4. Subscription Status (Polar.sh)
class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  // Password
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _passwordLoading = false;
  String? _passwordError;
  String? _passwordSuccess;

  // Biometrics
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _appLockEnabled = false;
  bool _hasPinCode = false;

  // Sessions
  List<Map<String, dynamic>> _sessions = [];
  bool _sessionsLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBiometricState();
    _loadSessions();
  }

  @override
  void dispose() {
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadBiometricState() async {
    final available = await BiometricService.isAvailable;
    final enabled = await BiometricService.isEnabled;
    final appLock = await BiometricService.isAppLockEnabled;
    final hasPin = await BiometricService.hasPinCode;
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _biometricEnabled = enabled;
        _appLockEnabled = appLock;
        _hasPinCode = hasPin;
      });
    }
  }

  Future<void> _loadSessions() async {
    setState(() => _sessionsLoading = true);
    try {
      // Use Supabase auth to get current session info
      final user = SupabaseService.auth.currentUser;
      if (user == null) return;

      // Build session list from current device info
      final deviceInfo = DeviceInfoPlugin();
      String deviceName = 'This Device';
      try {
        final info = await deviceInfo.deviceInfo;
        deviceName = info.data['name'] as String? ?? info.data['model'] as String? ?? 'Mobile Device';
      } catch (_) {}

      if (mounted) {
        setState(() {
          _sessions = [
            {
              'id': 'current',
              'device': deviceName,
              'location': 'Current Session',
              'last_active': 'Now',
              'is_current': true,
            },
          ];
          _sessionsLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _sessionsLoading = false);
    }
  }

  // ── Password Handler ────────────────────────────────

  Future<void> _handleSetPassword() async {
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (newPassword.length < 8) {
      HapticFeedback.heavyImpact();
      setState(() => _passwordError = 'Password must be at least 8 characters');
      return;
    }
    if (newPassword != confirmPassword) {
      HapticFeedback.heavyImpact();
      setState(() => _passwordError = 'Passwords do not match');
      return;
    }

    setState(() { _passwordLoading = true; _passwordError = null; _passwordSuccess = null; });
    HapticFeedback.mediumImpact();

    try {
      await ref.read(authNotifierProvider.notifier).updatePassword(newPassword);
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() {
          _passwordLoading = false;
          _passwordSuccess = 'Password updated successfully';
          _newPasswordController.clear();
          _confirmPasswordController.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        setState(() { _passwordLoading = false; _passwordError = e.toString(); });
      }
    }
  }

  // ── Biometric Handlers ──────────────────────────────

  Future<void> _toggleBiometric(bool enable) async {
    if (enable) {
      final success = await BiometricService.enroll();
      if (success) {
        HapticFeedback.mediumImpact();
        setState(() => _biometricEnabled = true);
      }
    } else {
      await BiometricService.disable();
      HapticFeedback.mediumImpact();
      setState(() { _biometricEnabled = false; _appLockEnabled = false; });
    }
  }

  Future<void> _toggleAppLock(bool enable) async {
    await BiometricService.setAppLock(enable);
    HapticFeedback.mediumImpact();
    setState(() => _appLockEnabled = enable);
  }

  // ── PIN Setup ──────────────────────────────────────

  Future<void> _showPinSetup() async {
    HapticFeedback.lightImpact();
    final pin = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _PinSetupSheet(),
    );
    if (pin != null && pin.length >= 4) {
      await BiometricService.setPin(pin);
      HapticFeedback.heavyImpact();
      if (mounted) setState(() => _hasPinCode = true);
    }
  }

  // ── Session Revoke ──────────────────────────────────

  Future<void> _revokeAllSessions() async {
    final confirmed = await BiometricService.authenticate(reason: 'Confirm to log out all devices');
    if (!confirmed) return;

    HapticFeedback.heavyImpact();
    await ref.read(authNotifierProvider.notifier).signOut();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () { HapticFeedback.lightImpact(); context.pop(); },
                    child: Container(
                      width: 32, height: 32,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        border: Border.all(color: ObsidianTheme.border),
                      ),
                      child: const Center(child: Icon(PhosphorIconsLight.arrowLeft, size: 16, color: ObsidianTheme.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  const StealthIcon(PhosphorIconsLight.shieldCheck, size: 20, isActive: true),
                  const SizedBox(width: 8),
                  Text('Security', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: ObsidianTheme.textPrimary, letterSpacing: -0.3)),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1)),

            const SizedBox(height: 20),

            Expanded(
              child: ListView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                children: [
                  // ═══ PASSWORD ════════════════════════════
                  _buildSectionLabel('APP PASSWORD', 0),
                  const SizedBox(height: 8),
                  _buildPasswordSection(),

                  const SizedBox(height: 28),

                  // ═══ BIOMETRICS ══════════════════════════
                  _buildSectionLabel('BIOMETRICS', 1),
                  const SizedBox(height: 8),
                  _buildBiometricSection(),

                  const SizedBox(height: 28),

                  // ═══ ACTIVE SESSIONS ═════════════════════
                  _buildSectionLabel('ACTIVE SESSIONS', 2),
                  const SizedBox(height: 8),
                  _buildSessionsSection(),

                  const SizedBox(height: 28),

                  // ═══ SUBSCRIPTION ════════════════════════
                  _buildSectionLabel('SUBSCRIPTION', 3),
                  const SizedBox(height: 8),
                  _buildBillingSection(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text, int index) {
    return Text(
      text,
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
    ).animate().fadeIn(delay: Duration(milliseconds: 100 + index * 80), duration: 300.ms);
  }

  // ── Password Section ────────────────────────────────

  Widget _buildPasswordSection() {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(borderRadius: ObsidianTheme.radiusMd, color: ObsidianTheme.emeraldDim),
                child: const Center(child: Icon(PhosphorIconsLight.key, size: 16, color: ObsidianTheme.emerald)),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('App Password', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white)),
                  Text('Set for quick login without magic links', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          _buildPasswordField(
            controller: _newPasswordController,
            hint: 'New password (min 8 chars)',
            obscured: _obscureNew,
            onToggle: () => setState(() => _obscureNew = !_obscureNew),
          ),
          const SizedBox(height: 12),
          _buildPasswordField(
            controller: _confirmPasswordController,
            hint: 'Confirm password',
            obscured: _obscureConfirm,
            onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
            onSubmitted: (_) => _handleSetPassword(),
          ),

          if (_passwordError != null) ...[
            const SizedBox(height: 12),
            _buildStatusBanner(_passwordError!, isError: true),
          ],
          if (_passwordSuccess != null) ...[
            const SizedBox(height: 12),
            _buildStatusBanner(_passwordSuccess!, isError: false),
          ],

          const SizedBox(height: 18),

          GestureDetector(
            onTap: _passwordLoading ? null : _handleSetPassword,
            child: AnimatedContainer(
              duration: ObsidianTheme.fast,
              width: double.infinity, height: 44,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: _passwordLoading ? ObsidianTheme.surface2 : Colors.white,
              ),
              child: Center(
                child: _passwordLoading
                    ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))
                    : Text('Update Password', style: GoogleFonts.inter(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 14)),
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 150.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 10, end: 0);
  }

  // ── Biometric Section ───────────────────────────────

  Widget _buildBiometricSection() {
    return GlassCard(
      padding: EdgeInsets.zero,
      borderRadius: ObsidianTheme.radiusLg,
      child: Column(
        children: [
          // Enable biometrics
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: _biometricEnabled ? ObsidianTheme.emeraldDim : ObsidianTheme.shimmerBase,
                  ),
                  child: Center(child: Icon(
                    PhosphorIconsLight.fingerprint, size: 18,
                    color: _biometricEnabled ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                  )),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Face ID / Touch ID', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white)),
                      Text(
                        _biometricAvailable
                            ? (_biometricEnabled ? 'Enrolled & Active' : 'Available on this device')
                            : 'Not available on this device',
                        style: GoogleFonts.inter(fontSize: 11, color: _biometricEnabled ? ObsidianTheme.emerald : ObsidianTheme.textTertiary),
                      ),
                    ],
                  ),
                ),
                if (_biometricAvailable)
                  _ObsidianSwitch(value: _biometricEnabled, onChanged: _toggleBiometric),
                if (!_biometricAvailable)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusFull,
                      color: ObsidianTheme.shimmerBase,
                      border: Border.all(color: ObsidianTheme.border),
                    ),
                    child: Text('N/A', style: GoogleFonts.jetBrainsMono(fontSize: 9, color: ObsidianTheme.textTertiary)),
                  ),
              ],
            ),
          ),

          // App Lock toggle (only when biometrics are enabled)
          if (_biometricEnabled) ...[
            const Divider(height: 1, color: ObsidianTheme.border),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  StealthIcon(PhosphorIconsLight.lockSimple, size: 18, isActive: _appLockEnabled),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('App Lock', style: GoogleFonts.inter(fontSize: 14, color: Colors.white)),
                        Text('Require biometrics on every cold start', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
                      ],
                    ),
                  ),
                  _ObsidianSwitch(value: _appLockEnabled, onChanged: _toggleAppLock),
                ],
              ),
            ),
            // PIN Code setup (fallback for biometric failures)
            if (_appLockEnabled) ...[
              const Divider(height: 1, color: ObsidianTheme.border),
              GestureDetector(
                onTap: _showPinSetup,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      StealthIcon(PhosphorIconsLight.numpad, size: 18, isActive: _hasPinCode),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Backup PIN', style: GoogleFonts.inter(fontSize: 14, color: Colors.white)),
                            Text(
                              _hasPinCode ? 'PIN set — tap to change' : 'Set a fallback PIN code',
                              style: GoogleFonts.inter(fontSize: 11, color: _hasPinCode ? ObsidianTheme.emerald : ObsidianTheme.textTertiary),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        _hasPinCode ? PhosphorIconsBold.checkCircle : PhosphorIconsLight.caretRight,
                        size: 16,
                        color: _hasPinCode ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    ).animate().fadeIn(delay: 250.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 10, end: 0);
  }

  // ── Sessions Section ────────────────────────────────

  Widget _buildSessionsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_sessionsLoading)
          GlassCard(
            padding: const EdgeInsets.all(20),
            borderRadius: ObsidianTheme.radiusLg,
            child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))),
          )
        else ...[
          // Session cards
          ..._sessions.asMap().entries.map((entry) {
            final session = entry.value;
            final isCurrent = session['is_current'] as bool? ?? false;

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GlassCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                borderRadius: ObsidianTheme.radiusLg,
                borderColor: isCurrent ? ObsidianTheme.emerald.withValues(alpha: 0.3) : null,
                child: Row(
                  children: [
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: isCurrent ? ObsidianTheme.emeraldDim : ObsidianTheme.shimmerBase,
                      ),
                      child: Center(child: Icon(
                        PhosphorIconsLight.deviceMobile, size: 18,
                        color: isCurrent ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                      )),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  session['device'] as String,
                                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white),
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (isCurrent) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(4),
                                    color: ObsidianTheme.emeraldDim,
                                  ),
                                  child: Text('THIS', style: GoogleFonts.jetBrainsMono(fontSize: 8, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${session['location']} • ${session['last_active']}',
                            style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    if (!isCurrent)
                      GestureDetector(
                        onTap: () {
                          HapticFeedback.heavyImpact();
                          setState(() => _sessions.removeAt(entry.key));
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: ObsidianTheme.radiusMd,
                            border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.3)),
                          ),
                          child: Text('Revoke', style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.rose, fontWeight: FontWeight.w500)),
                        ),
                      ),
                  ],
                ),
              ),
            )
                .animate()
                .fadeIn(delay: Duration(milliseconds: 300 + entry.key * 60), duration: 400.ms)
                .moveY(begin: 8, end: 0, delay: Duration(milliseconds: 300 + entry.key * 60), duration: 400.ms, curve: Curves.easeOutQuart);
          }),

          const SizedBox(height: 8),

          // Kill switch
          GestureDetector(
            onTap: _revokeAllSessions,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                color: ObsidianTheme.rose.withValues(alpha: 0.05),
              ),
              child: Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(PhosphorIconsLight.signOut, size: 14, color: ObsidianTheme.rose),
                    const SizedBox(width: 8),
                    Text('Log Out Everywhere', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500, color: ObsidianTheme.rose)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  // ── Billing Section ─────────────────────────────────

  Widget _buildBillingSection() {
    final subAsync = ref.watch(subscriptionProvider);
    final seatAsync = ref.watch(seatCountProvider);

    return subAsync.when(
      data: (sub) {
        final isPro = sub.isPro && sub.isActive;
        final seats = seatAsync.valueOrNull ?? 0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Subscription badge card
            GlassCard(
              padding: const EdgeInsets.all(20),
              borderRadius: ObsidianTheme.radiusLg,
              borderColor: isPro ? ObsidianTheme.emerald.withValues(alpha: 0.3) : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(
                          borderRadius: ObsidianTheme.radiusMd,
                          color: isPro ? ObsidianTheme.emeraldDim : ObsidianTheme.shimmerBase,
                          boxShadow: isPro ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 12)] : null,
                        ),
                        child: Center(child: Icon(
                          isPro ? PhosphorIconsLight.crown : PhosphorIconsLight.package,
                          size: 20, color: isPro ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                        )),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  isPro ? 'Pro Plan' : 'Starter Plan',
                                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  width: 8, height: 8,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isPro ? ObsidianTheme.emerald : ObsidianTheme.textTertiary,
                                    boxShadow: isPro ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.5), blurRadius: 6)] : null,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              isPro
                                  ? (sub.isCanceling ? 'Cancels at period end' : 'All features unlocked')
                                  : 'Basic features',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: sub.isCanceling ? ObsidianTheme.amber : ObsidianTheme.textTertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  // Usage bars
                  _buildUsageBar('Team Seats', seats, isPro ? 25 : 5),
                  const SizedBox(height: 8),
                  _buildUsageBar('Storage', 120, isPro ? 5000 : 500, unit: 'MB'),

                  if (sub.periodEnd != null) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Icon(PhosphorIconsLight.calendarBlank, size: 12, color: ObsidianTheme.textTertiary),
                        const SizedBox(width: 6),
                        Text(
                          'Renews ${_formatDate(sub.periodEnd!)}',
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 18),

                  // Manage / Upgrade button
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      _showUpgradeSheet(isPro);
                    },
                    child: Container(
                      width: double.infinity, height: 44,
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusMd,
                        color: isPro ? ObsidianTheme.surface2 : Colors.white,
                        border: isPro ? Border.all(color: ObsidianTheme.borderMedium) : null,
                      ),
                      child: Center(
                        child: Text(
                          isPro ? 'Manage Subscription' : 'Upgrade to Pro',
                          style: GoogleFonts.inter(
                            fontSize: 14, fontWeight: FontWeight.w600,
                            color: isPro ? ObsidianTheme.textSecondary : Colors.black,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ).animate().fadeIn(delay: 400.ms, duration: 500.ms, curve: const Cubic(0.16, 1, 0.3, 1)).moveY(begin: 10, end: 0);
      },
      loading: () => GlassCard(
        padding: const EdgeInsets.all(20),
        borderRadius: ObsidianTheme.radiusLg,
        child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 1.5, color: ObsidianTheme.emerald))),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  String _formatDate(DateTime date) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  void _showUpgradeSheet(bool isPro) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _UpgradeSheet(isPro: isPro),
    );
  }

  Widget _buildUsageBar(String label, int current, int max, {String? unit}) {
    final pct = (current / max).clamp(0.0, 1.0);
    final isHigh = pct > 0.8;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary)),
            const Spacer(),
            Text(
              unit != null ? '$current$unit / $max$unit' : '$current / $max',
              style: GoogleFonts.jetBrainsMono(fontSize: 10, color: isHigh ? ObsidianTheme.amber : ObsidianTheme.textTertiary),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          height: 3,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(2),
            color: ObsidianTheme.shimmerBase,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: pct,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: isHigh ? ObsidianTheme.amber : ObsidianTheme.emerald,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Shared Widgets ──────────────────────────────────

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String hint,
    required bool obscured,
    required VoidCallback onToggle,
    ValueChanged<String>? onSubmitted,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscured,
      style: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textPrimary, fontSize: 14),
      cursorColor: ObsidianTheme.emerald,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.jetBrainsMono(color: ObsidianTheme.textDisabled, fontSize: 14),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(right: 12),
          child: Icon(PhosphorIconsLight.lock, size: 16, color: ObsidianTheme.textTertiary),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
        suffixIcon: GestureDetector(
          onTap: onToggle,
          child: Icon(obscured ? PhosphorIconsLight.eye : PhosphorIconsLight.eyeSlash, size: 16, color: ObsidianTheme.textTertiary),
        ),
        suffixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 0),
      ),
      onSubmitted: onSubmitted,
    );
  }

  Widget _buildStatusBanner(String text, {required bool isError}) {
    final color = isError ? ObsidianTheme.rose : ObsidianTheme.emerald;
    final bg = isError ? ObsidianTheme.roseDim : ObsidianTheme.emeraldDim;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: bg,
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(isError ? PhosphorIconsLight.warning : PhosphorIconsBold.check, size: 14, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: GoogleFonts.inter(color: color, fontSize: 12))),
        ],
      ),
    );
  }
}

// ── Upgrade Sheet (Paywall) ──────────────────────────

class _UpgradeSheet extends StatelessWidget {
  final bool isPro;
  const _UpgradeSheet({required this.isPro});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: const BoxDecoration(
        color: ObsidianTheme.void_,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          const SizedBox(height: 12),
          Container(width: 36, height: 4, decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: ObsidianTheme.textTertiary)),
          const SizedBox(height: 24),

          // Header
          if (isPro) ...[
            const Icon(PhosphorIconsLight.crown, size: 28, color: ObsidianTheme.emerald),
            const SizedBox(height: 12),
            Text('Manage Your Subscription', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white)),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                'Update payment methods, download invoices, or change your plan via the Polar.sh portal.',
                style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...[
            // Shield animation for upgrade
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: ObsidianTheme.emeraldDim,
                border: Border.all(color: ObsidianTheme.emerald.withValues(alpha: 0.3)),
                boxShadow: [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.2), blurRadius: 20)],
              ),
              child: const Center(child: Icon(PhosphorIconsLight.rocketLaunch, size: 24, color: ObsidianTheme.emerald)),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .scaleXY(begin: 1.0, end: 1.08, duration: 2000.ms, curve: Curves.easeInOut),
            const SizedBox(height: 16),
            Text('Upgrade to Pro', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: -0.3)),
            const SizedBox(height: 4),
            Text('\$29/mo', style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.emerald, fontWeight: FontWeight.w500)),
          ],

          const SizedBox(height: 24),

          // Feature grid (Bento)
          if (!isPro)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: _FeatureCard(icon: PhosphorIconsLight.usersThree, label: 'Up to 25 Seats')),
                      const SizedBox(width: 8),
                      Expanded(child: _FeatureCard(icon: PhosphorIconsLight.lightning, label: 'Automations')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: _FeatureCard(icon: PhosphorIconsLight.chartLine, label: 'Advanced Reports')),
                      const SizedBox(width: 8),
                      Expanded(child: _FeatureCard(icon: PhosphorIconsLight.shieldCheck, label: 'Priority Support')),
                    ],
                  ),
                ],
              ),
            ),

          const SizedBox(height: 24),

          // CTA
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.heavyImpact();
                Navigator.pop(context);
                // In production: open Polar.sh checkout or customer portal
              },
              child: Container(
                width: double.infinity, height: 48,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: isPro ? ObsidianTheme.surface2 : Colors.white,
                  border: isPro ? Border.all(color: ObsidianTheme.borderMedium) : null,
                ),
                child: Center(
                  child: Text(
                    isPro ? 'Open Billing Portal' : 'Upgrade via Polar',
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: isPro ? Colors.white : Colors.black),
                  ),
                ),
              ),
            ),
          ),

          SizedBox(height: MediaQuery.of(context).padding.bottom + 20),
        ],
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final IconData icon;
  final String label;
  const _FeatureCard({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: ObsidianTheme.surface1,
        border: Border.all(color: ObsidianTheme.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: ObsidianTheme.emerald),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: GoogleFonts.inter(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

// ── Obsidian Switch (Custom Toggle) ──────────────────

// ── PIN Setup Sheet ──────────────────────────────────

class _PinSetupSheet extends StatefulWidget {
  const _PinSetupSheet();

  @override
  State<_PinSetupSheet> createState() => _PinSetupSheetState();
}

class _PinSetupSheetState extends State<_PinSetupSheet> {
  String _pin = '';
  String? _firstPin;
  bool _confirming = false;
  String? _error;

  void _onDigit(String d) {
    if (_pin.length >= 6) return;
    HapticFeedback.lightImpact();
    setState(() {
      _pin += d;
      _error = null;
    });
    if (_pin.length == 6) _onComplete();
  }

  void _onDelete() {
    if (_pin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  void _onComplete() {
    if (!_confirming) {
      setState(() {
        _firstPin = _pin;
        _pin = '';
        _confirming = true;
      });
    } else {
      if (_pin == _firstPin) {
        Navigator.pop(context, _pin);
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _pin = '';
          _firstPin = null;
          _confirming = false;
          _error = 'PINs didn\'t match. Try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, mq.padding.bottom + 20),
      decoration: const BoxDecoration(
        color: ObsidianTheme.void_,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: ObsidianTheme.borderMedium)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            _confirming ? 'CONFIRM PIN' : 'SET NEW PIN',
            style: GoogleFonts.jetBrainsMono(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: ObsidianTheme.emerald,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _confirming ? 'Enter your PIN again' : 'Choose a 6-digit PIN',
            style: GoogleFonts.inter(fontSize: 13, color: ObsidianTheme.textTertiary),
          ),
          const SizedBox(height: 24),

          // Dots
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(6, (i) {
              final filled = i < _pin.length;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                margin: const EdgeInsets.symmetric(horizontal: 8),
                width: filled ? 14 : 12,
                height: filled ? 14 : 12,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: filled ? ObsidianTheme.emerald : Colors.transparent,
                  border: Border.all(
                    color: filled ? ObsidianTheme.emerald : Colors.white.withValues(alpha: 0.15),
                    width: 1.5,
                  ),
                ),
              );
            }),
          ),

          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose)),
          ],

          const SizedBox(height: 28),

          // Number grid
          SizedBox(
            width: 260,
            child: Column(
              children: [
                _pinRow(['1', '2', '3']),
                const SizedBox(height: 10),
                _pinRow(['4', '5', '6']),
                const SizedBox(height: 10),
                _pinRow(['7', '8', '9']),
                const SizedBox(height: 10),
                _pinRow(['', '0', 'del']),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pinRow(List<String> keys) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: keys.map((k) {
        if (k.isEmpty) return const SizedBox(width: 64, height: 64);
        if (k == 'del') {
          return GestureDetector(
            onTap: _onDelete,
            child: SizedBox(
              width: 64, height: 64,
              child: Center(
                child: Icon(PhosphorIconsLight.backspace, size: 20, color: ObsidianTheme.textSecondary),
              ),
            ),
          );
        }
        return GestureDetector(
          onTap: () => _onDigit(k),
          child: Container(
            width: 64, height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withValues(alpha: 0.03),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Center(
              child: Text(
                k,
                style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w300, color: Colors.white),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _ObsidianSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _ObsidianSwitch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: ObsidianTheme.standard,
        width: 40, height: 22,
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(11),
          color: value ? ObsidianTheme.emerald : const Color(0xFF27272A),
          border: Border.all(color: value ? ObsidianTheme.emerald.withValues(alpha: 0.5) : ObsidianTheme.borderMedium),
        ),
        child: AnimatedAlign(
          duration: ObsidianTheme.standard,
          curve: Curves.easeOutBack,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 16, height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle, color: Colors.white,
              boxShadow: value ? [BoxShadow(color: ObsidianTheme.emerald.withValues(alpha: 0.3), blurRadius: 4)] : null,
            ),
          ),
        ),
      ),
    );
  }
}
