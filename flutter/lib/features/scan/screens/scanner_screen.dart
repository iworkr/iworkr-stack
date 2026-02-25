import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:ui';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/auth_provider.dart';
import 'package:iworkr_mobile/core/services/permission_service.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ══════════════════════════════════════════════════════
// ── Data Types ───────────────────────────────────────
// ══════════════════════════════════════════════════════

enum ScanMatchType { asset, stock, unknown }

class ScanResult {
  final ScanMatchType type;
  final String code;
  final String? id;
  final String? name;
  final String? subtitle;
  final String? status;
  final String? assignedTo;
  final int? quantity;
  final String? location;
  final Map<String, dynamic>? raw;

  const ScanResult({
    required this.type,
    required this.code,
    this.id,
    this.name,
    this.subtitle,
    this.status,
    this.assignedTo,
    this.quantity,
    this.location,
    this.raw,
  });
}

// ══════════════════════════════════════════════════════
// ── Camera State Machine ─────────────────────────────
// ══════════════════════════════════════════════════════

enum _CameraState {
  initializing,
  ready,
  permissionDenied,
  permissionPermanentlyDenied,
  error,
  simulator,
}

// ══════════════════════════════════════════════════════
// ── Scanner Screen ───────────────────────────────────
// ══════════════════════════════════════════════════════

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  MobileScannerController? _cameraController;
  late AnimationController _breatheController;
  late AnimationController _lockController;

  _CameraState _cameraState = _CameraState.initializing;
  String? _errorMessage;

  bool _torchOn = false;
  bool _batchMode = false;
  bool _locked = false;
  ScanResult? _currentResult;
  final List<ScanResult> _batchResults = [];
  DateTime? _lastScanTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _breatheController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    _lockController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    _initCameraWithPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController?.dispose();
    _breatheController.dispose();
    _lockController.dispose();
    super.dispose();
  }

  // ── Lifecycle Management ────────────────────────────

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_cameraState == _CameraState.simulator) return;

    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
        _cameraController?.stop();
      case AppLifecycleState.resumed:
        if (_cameraState == _CameraState.ready) {
          _cameraController?.start();
        } else if (_cameraState == _CameraState.permissionDenied ||
            _cameraState == _CameraState.permissionPermanentlyDenied) {
          _initCameraWithPermissions();
        }
      default:
        break;
    }
  }

  // ── Permission Gate ─────────────────────────────────

  Future<void> _initCameraWithPermissions() async {
    if (!mounted) return;

    if (!kIsWeb && !(Platform.isAndroid || Platform.isIOS)) {
      setState(() => _cameraState = _CameraState.simulator);
      return;
    }

    final isSimulator = await _checkSimulator();
    if (isSimulator) {
      if (mounted) setState(() => _cameraState = _CameraState.simulator);
      return;
    }

    setState(() => _cameraState = _CameraState.initializing);

    final status = await Permission.camera.status;

    if (status.isGranted) {
      await _startCamera();
      return;
    }

    if (status.isPermanentlyDenied) {
      if (mounted) {
        setState(() => _cameraState = _CameraState.permissionPermanentlyDenied);
      }
      return;
    }

    // JIT soft prompt before the native OS dialog
    if (!mounted) return;
    final granted = await PermissionService.instance.requestCamera(context);

    if (granted) {
      await _startCamera();
    } else {
      final afterStatus = await Permission.camera.status;
      if (mounted) {
        setState(() => _cameraState = afterStatus.isPermanentlyDenied
            ? _CameraState.permissionPermanentlyDenied
            : _CameraState.permissionDenied);
      }
    }
  }

  Future<bool> _checkSimulator() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await deviceInfo.iosInfo;
        return !ios.isPhysicalDevice;
      } else if (Platform.isAndroid) {
        final android = await deviceInfo.androidInfo;
        return !android.isPhysicalDevice;
      }
    } catch (_) {}
    return false;
  }

  Future<void> _startCamera() async {
    try {
      _cameraController?.dispose();
      _cameraController = MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
        facing: CameraFacing.back,
        torchEnabled: false,
        autoStart: false,
      );

      await _cameraController!.start();

      if (mounted) {
        setState(() {
          _cameraState = _CameraState.ready;
          _errorMessage = null;
        });
      }
    } on MobileScannerException catch (e) {
      if (mounted) {
        setState(() {
          _cameraState = e.errorCode == MobileScannerErrorCode.permissionDenied
              ? _CameraState.permissionDenied
              : _CameraState.error;
          _errorMessage = e.errorDetails?.message ?? 'Camera initialization failed';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _cameraState = _CameraState.error;
          _errorMessage = 'Unexpected camera error';
        });
      }
    }
  }

  Future<void> _retryCamera() async {
    HapticFeedback.mediumImpact();
    await _initCameraWithPermissions();
  }

  // ── Intelligence Engine ─────────────────────────────

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_locked) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final code = barcodes.first.rawValue;
    if (code == null || code.isEmpty) return;

    final now = DateTime.now();
    if (_lastScanTime != null && now.difference(_lastScanTime!) < const Duration(milliseconds: 500)) {
      return;
    }
    _lastScanTime = now;

    setState(() => _locked = true);
    HapticFeedback.selectionClick();
    _lockController.forward();

    final result = await _lookupCode(code);

    if (mounted) {
      setState(() => _currentResult = result);
      HapticFeedback.heavyImpact();

      if (_batchMode) {
        setState(() {
          _batchResults.add(result);
          Future.delayed(const Duration(milliseconds: 800), () {
            if (mounted) {
              setState(() { _locked = false; _currentResult = null; });
              _lockController.reverse();
            }
          });
        });
      }
    }
  }

  Future<ScanResult> _lookupCode(String code) async {
    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) {
      return ScanResult(type: ScanMatchType.unknown, code: code);
    }

    try {
      final assetData = await SupabaseService.client
          .from('assets')
          .select('*, profiles!assets_assigned_to_fkey(full_name)')
          .eq('organization_id', orgId)
          .or('barcode.eq.$code,serial_number.eq.$code')
          .maybeSingle();

      if (assetData != null) {
        final assignee = (assetData['profiles'] as Map<String, dynamic>?)?['full_name'] as String?;
        return ScanResult(
          type: ScanMatchType.asset,
          code: code,
          id: assetData['id'] as String,
          name: assetData['name'] as String,
          subtitle: '${assetData['make'] ?? ''} ${assetData['model'] ?? ''}'.trim(),
          status: assetData['status'] as String?,
          assignedTo: assignee,
          location: assetData['location'] as String?,
          raw: assetData,
        );
      }
    } catch (_) {}

    try {
      final stockData = await SupabaseService.client
          .from('inventory_items')
          .select()
          .eq('organization_id', orgId)
          .or('barcode.eq.$code,sku.eq.$code')
          .maybeSingle();

      if (stockData != null) {
        return ScanResult(
          type: ScanMatchType.stock,
          code: code,
          id: stockData['id'] as String,
          name: stockData['name'] as String,
          subtitle: stockData['sku'] as String?,
          quantity: stockData['quantity'] as int?,
          location: stockData['location'] as String?,
          raw: stockData,
        );
      }
    } catch (_) {}

    return ScanResult(type: ScanMatchType.unknown, code: code);
  }

  void _dismissResult() {
    HapticFeedback.lightImpact();
    setState(() { _currentResult = null; _locked = false; });
    _lockController.reverse();
  }

  void _toggleTorch() {
    HapticFeedback.lightImpact();
    setState(() => _torchOn = !_torchOn);
    _cameraController?.toggleTorch();
  }

  void _showManualEntry() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ManualEntrySheet(
        onSubmit: (code) {
          Navigator.pop(context);
          _onManualCode(code);
        },
      ),
    );
  }

  Future<void> _onManualCode(String code) async {
    setState(() => _locked = true);
    HapticFeedback.selectionClick();
    _lockController.forward();
    final result = await _lookupCode(code);
    if (mounted) {
      setState(() => _currentResult = result);
      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ── Layer 0: Camera Preview / State View ────
          Positioned.fill(
            child: _buildCameraLayer(),
          ),

          // ── Layer 1: Vignette ──────────────────────
          if (_cameraState == _CameraState.ready)
            Positioned.fill(
              child: IgnorePointer(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.9,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.5),
                        Colors.black.withValues(alpha: 0.85),
                      ],
                      stops: const [0.3, 0.7, 1.0],
                    ),
                  ),
                ),
              ),
            ),

          // ── Layer 2: Reticle ───────────────────────
          if (_cameraState == _CameraState.ready)
            Center(
              child: AnimatedBuilder(
                animation: Listenable.merge([_breatheController, _lockController]),
                builder: (_, __) {
                  final breathe = 1.0 + (_breatheController.value * 0.05);
                  final lockShrink = 1.0 - (_lockController.value * 0.08);
                  final scale = _locked ? lockShrink : breathe;

                  Color bracketColor;
                  if (_currentResult != null) {
                    switch (_currentResult!.type) {
                      case ScanMatchType.asset:
                        bracketColor = ObsidianTheme.emerald;
                      case ScanMatchType.stock:
                        bracketColor = ObsidianTheme.blue;
                      case ScanMatchType.unknown:
                        bracketColor = ObsidianTheme.amber;
                    }
                  } else if (_locked) {
                    bracketColor = c.textPrimary;
                  } else {
                    bracketColor = ObsidianTheme.emerald;
                  }

                  return Transform.scale(
                    scale: scale,
                    child: SizedBox(
                      width: 220,
                      height: 220,
                      child: CustomPaint(
                        painter: _ReticlePainter(color: bracketColor),
                      ),
                    ),
                  );
                },
              ),
            ),

          // ── Layer 3: Scanning Laser ────────────────
          if (_cameraState == _CameraState.ready && !_locked)
            Center(
              child: SizedBox(
                width: 180,
                height: 180,
                child: const _ScanLaserLine(),
              ),
            ),

          // ── Layer 4: Top Controls ──────────────────
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16, right: 16,
            child: Row(
              children: [
                _HudButton(
                  icon: PhosphorIconsLight.x,
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.pop(context);
                  },
                ),
                const Spacer(),

                if (_cameraState == _CameraState.ready) ...[
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _batchMode = !_batchMode);
                    },
                    child: AnimatedContainer(
                      duration: ObsidianTheme.fast,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusFull,
                        color: _batchMode
                            ? ObsidianTheme.emeraldDim
                            : Colors.black.withValues(alpha: 0.6),
                        border: Border.all(
                          color: _batchMode
                              ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                              : c.borderHover,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            PhosphorIconsLight.stack,
                            size: 14,
                            color: _batchMode ? ObsidianTheme.emerald : c.textPrimary,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Batch',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: _batchMode ? ObsidianTheme.emerald : c.textPrimary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _HudButton(
                    icon: _torchOn ? PhosphorIconsFill.flashlight : PhosphorIconsLight.flashlight,
                    active: _torchOn,
                    onTap: _toggleTorch,
                  ),
                ],
              ],
            ).animate().fadeIn(duration: 300.ms),
          ),

          // ── Layer 5: Bottom Controls ──────────────
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 24,
            left: 16, right: 16,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_batchMode && _batchResults.isNotEmpty) _buildBatchTray(),

                if (_currentResult == null)
                  GestureDetector(
                    onTap: _showManualEntry,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusFull,
                        color: Colors.black.withValues(alpha: 0.6),
                        border: Border.all(color: c.borderHover),
                      ),
                      child: Text(
                        '[ ENTER CODE MANUALLY ]',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          color: c.textSecondary,
                          letterSpacing: 2,
                        ),
                      ),
                    ),
                  ).animate().fadeIn(delay: 400.ms, duration: 300.ms),
              ],
            ),
          ),

          // ── Layer 6: Result Card Overlay ───────────
          if (_currentResult != null && !_batchMode)
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: _ResultCard(
                result: _currentResult!,
                onDismiss: _dismissResult,
                onAction: (action) => _handleAction(action, _currentResult!),
              ),
            ),
        ],
      ),
    );
  }

  // ── Camera Layer (State Machine) ──────────────────

  Widget _buildCameraLayer() {
    switch (_cameraState) {
      case _CameraState.initializing:
        return _InitializingView();

      case _CameraState.permissionDenied:
        return _VisualCortexOffline(
          isPermanent: false,
          onRetry: _retryCamera,
          onManualEntry: _showManualEntry,
        );

      case _CameraState.permissionPermanentlyDenied:
        return _VisualCortexOffline(
          isPermanent: true,
          onRetry: () async {
            HapticFeedback.mediumImpact();
            await openAppSettings();
          },
          onManualEntry: _showManualEntry,
        );

      case _CameraState.error:
        return _CameraErrorView(
          message: _errorMessage ?? 'Camera hardware unavailable',
          onRetry: _retryCamera,
          onManualEntry: _showManualEntry,
        );

      case _CameraState.simulator:
        return _SimulatorView(onManualEntry: _showManualEntry);

      case _CameraState.ready:
        return MobileScanner(
          controller: _cameraController!,
          onDetect: _onDetect,
          errorBuilder: (context, error, child) {
            return _CameraErrorView(
              message: error.errorDetails?.message ?? 'Camera feed interrupted',
              onRetry: _retryCamera,
              onManualEntry: _showManualEntry,
            );
          },
        );
    }
  }

  // ── Batch Tray ──────────────────────────────────────

  Widget _buildBatchTray() {
    final c = context.iColors;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: Colors.black.withValues(alpha: 0.8),
        border: Border.all(color: c.borderHover),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              borderRadius: ObsidianTheme.radiusFull,
              color: ObsidianTheme.emeraldDim,
            ),
            child: Text(
              '${_batchResults.length}',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12, color: ObsidianTheme.emerald, fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SizedBox(
              height: 28,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _batchResults.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (_, i) {
                  final r = _batchResults[_batchResults.length - 1 - i];
                  Color dotColor;
                  switch (r.type) {
                    case ScanMatchType.asset:
                      dotColor = ObsidianTheme.emerald;
                    case ScanMatchType.stock:
                      dotColor = ObsidianTheme.blue;
                    case ScanMatchType.unknown:
                      dotColor = ObsidianTheme.amber;
                  }
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      borderRadius: ObsidianTheme.radiusSm,
                      color: const Color(0x1AFFFFFF),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: dotColor)),
                        const SizedBox(width: 6),
                        Text(
                          r.name ?? (r.code.length > 8 ? r.code.substring(0, 8) : r.code),
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textPrimary),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              setState(() => _batchResults.clear());
            },
            child: Icon(PhosphorIconsLight.trash, size: 16, color: c.textTertiary),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 200.ms);
  }

  void _handleAction(String action, ScanResult result) {
    HapticFeedback.mediumImpact();
    _dismissResult();
  }
}

// ══════════════════════════════════════════════════════
// ── Initializing View ────────────────────────────────
// ══════════════════════════════════════════════════════

class _InitializingView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      color: c.canvas,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 48, height: 48,
              child: CustomPaint(painter: _LensPulse()),
            )
                .animate(onPlay: (c) => c.repeat())
                .scaleXY(begin: 0.9, end: 1.1, duration: 1200.ms, curve: Curves.easeInOut)
                .then()
                .scaleXY(begin: 1.1, end: 0.9, duration: 1200.ms, curve: Curves.easeInOut),
            const SizedBox(height: 20),
            Text(
              'Engaging Visual Cortex...',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12, color: ObsidianTheme.emerald,
                letterSpacing: 1.5,
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
                .fadeIn(duration: 800.ms)
                .then()
                .fadeOut(duration: 800.ms),
          ],
        ),
      ),
    );
  }
}

class _LensPulse extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;

    final outerPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, r, outerPaint);

    final innerPaint = Paint()
      ..color = ObsidianTheme.emerald.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(center, r * 0.65, innerPaint);

    final dotPaint = Paint()..color = ObsidianTheme.emerald;
    canvas.drawCircle(center, 3, dotPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ══════════════════════════════════════════════════════
// ── Visual Cortex Offline (Permission Denied) ────────
// ══════════════════════════════════════════════════════

class _VisualCortexOffline extends StatelessWidget {
  final bool isPermanent;
  final VoidCallback onRetry;
  final VoidCallback onManualEntry;

  const _VisualCortexOffline({
    required this.isPermanent,
    required this.onRetry,
    required this.onManualEntry,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      color: c.canvas,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 96, height: 96,
                child: _BrokenLensAnimation(),
              ),
              const SizedBox(height: 28),
              Text(
                'Visual Cortex Offline',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 16, fontWeight: FontWeight.w600,
                  color: ObsidianTheme.amber, letterSpacing: 1,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                isPermanent
                    ? 'Camera permission was denied. Please enable it in your device Settings to scan barcodes and QR codes.'
                    : 'iWorkr needs camera access to scan assets, barcodes, and QR codes.',
                style: GoogleFonts.inter(
                  fontSize: 13, color: c.textTertiary,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              GestureDetector(
                onTap: onRetry,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: Colors.white,
                  ),
                  child: Center(
                    child: Text(
                      isPermanent ? 'Open Settings' : 'Grant Permission',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onManualEntry,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    border: Border.all(color: c.borderMedium),
                  ),
                  child: Center(
                    child: Text(
                      'Enter Code Manually',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 500.ms);
  }
}

/// Animated "broken lens" — a cracked circle with pulsing shards
class _BrokenLensAnimation extends StatefulWidget {
  @override
  State<_BrokenLensAnimation> createState() => _BrokenLensAnimationState();
}

class _BrokenLensAnimationState extends State<_BrokenLensAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) {
        return CustomPaint(
          painter: _BrokenLensPainter(progress: _controller.value),
          size: const Size(96, 96),
        );
      },
    );
  }
}

class _BrokenLensPainter extends CustomPainter {
  final double progress;
  _BrokenLensPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 4;
    final pulse = 0.8 + 0.2 * progress;

    // Outer ring
    final ringPaint = Paint()
      ..color = ObsidianTheme.amber.withValues(alpha: 0.3 * pulse)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, r, ringPaint);

    // Glow ring
    final glowPaint = Paint()
      ..color = ObsidianTheme.amber.withValues(alpha: 0.08 * pulse)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    canvas.drawCircle(center, r + 4, glowPaint);

    // Crack lines radiating from center
    final crackPaint = Paint()
      ..color = ObsidianTheme.amber.withValues(alpha: 0.5 * pulse)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    final angles = [0.0, 0.8, 1.6, 2.5, 3.6, 4.5, 5.3];
    for (final angle in angles) {
      final len = r * (0.3 + 0.4 * ((angle * 7) % 1));
      final dx = cos(angle) * len;
      final dy = sin(angle) * len;
      canvas.drawLine(center, Offset(center.dx + dx, center.dy + dy), crackPaint);
    }

    // Center "eye" dot
    final eyePaint = Paint()..color = ObsidianTheme.amber.withValues(alpha: pulse);
    canvas.drawCircle(center, 4, eyePaint);

    // Inner "iris" ring
    final irisPaint = Paint()
      ..color = ObsidianTheme.amber.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(center, r * 0.35, irisPaint);
  }

  @override
  bool shouldRepaint(covariant _BrokenLensPainter old) => old.progress != progress;
}

// ══════════════════════════════════════════════════════
// ── Camera Error View ────────────────────────────────
// ══════════════════════════════════════════════════════

class _CameraErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final VoidCallback onManualEntry;

  const _CameraErrorView({
    required this.message,
    required this.onRetry,
    required this.onManualEntry,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      color: c.canvas,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.rose.withValues(alpha: 0.1),
                  border: Border.all(color: ObsidianTheme.rose.withValues(alpha: 0.2)),
                ),
                child: const Icon(PhosphorIconsLight.cameraSlash, size: 28, color: ObsidianTheme.rose),
              )
                  .animate(onPlay: (ctrl) => ctrl.repeat(reverse: true))
                  .scaleXY(begin: 1.0, end: 1.04, duration: 2500.ms),
              const SizedBox(height: 24),
              Text(
                'Camera Unavailable',
                style: GoogleFonts.inter(
                  fontSize: 18, fontWeight: FontWeight.w600,
                  color: c.textPrimary, letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                message,
                style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              GestureDetector(
                onTap: onRetry,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: Colors.white,
                  ),
                  child: Center(
                    child: Text('Retry', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onManualEntry,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    border: Border.all(color: c.borderMedium),
                  ),
                  child: Center(
                    child: Text('Enter Code Manually', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms);
  }
}

// ══════════════════════════════════════════════════════
// ── Simulator View ───────────────────────────────────
// ══════════════════════════════════════════════════════

class _SimulatorView extends StatelessWidget {
  final VoidCallback onManualEntry;
  const _SimulatorView({required this.onManualEntry});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      color: c.surface,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80, height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ObsidianTheme.indigo.withValues(alpha: 0.1),
                  border: Border.all(color: ObsidianTheme.indigo.withValues(alpha: 0.2)),
                ),
                child: const Icon(PhosphorIconsLight.desktopTower, size: 32, color: ObsidianTheme.indigo),
              ),
              const SizedBox(height: 24),
              Text(
                'Simulation Mode',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 14, fontWeight: FontWeight.w600,
                  color: ObsidianTheme.indigo, letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Camera hardware is not available on the simulator. Use manual entry to test scanning.',
                style: GoogleFonts.inter(
                  fontSize: 13, color: c.textTertiary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              GestureDetector(
                onTap: () {
                  HapticFeedback.lightImpact();
                  onManualEntry();
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: ObsidianTheme.indigo,
                  ),
                  child: Center(
                    child: Text(
                      'Enter Code Manually',
                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms);
  }
}

// ══════════════════════════════════════════════════════
// ── Reticle Painter ──────────────────────────────────
// ══════════════════════════════════════════════════════

class _ReticlePainter extends CustomPainter {
  final Color color;
  _ReticlePainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const len = 30.0;
    final w = size.width;
    final h = size.height;

    canvas.drawLine(const Offset(0, len), Offset.zero, paint);
    canvas.drawLine(Offset.zero, const Offset(len, 0), paint);

    canvas.drawLine(Offset(w - len, 0), Offset(w, 0), paint);
    canvas.drawLine(Offset(w, 0), Offset(w, len), paint);

    canvas.drawLine(Offset(0, h - len), Offset(0, h), paint);
    canvas.drawLine(Offset(0, h), Offset(len, h), paint);

    canvas.drawLine(Offset(w, h - len), Offset(w, h), paint);
    canvas.drawLine(Offset(w - len, h), Offset(w, h), paint);
  }

  @override
  bool shouldRepaint(covariant _ReticlePainter old) => old.color != color;
}

// ══════════════════════════════════════════════════════
// ── Scan Laser Line ──────────────────────────────────
// ══════════════════════════════════════════════════════

class _ScanLaserLine extends StatefulWidget {
  const _ScanLaserLine();

  @override
  State<_ScanLaserLine> createState() => _ScanLaserLineState();
}

class _ScanLaserLineState extends State<_ScanLaserLine>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 2500))
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) {
        return CustomPaint(
          painter: _LaserPainter(progress: _controller.value),
          size: Size.infinite,
        );
      },
    );
  }
}

class _LaserPainter extends CustomPainter {
  final double progress;
  _LaserPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height * progress;
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          ObsidianTheme.emerald.withValues(alpha: 0.3),
          ObsidianTheme.emerald.withValues(alpha: 0.5),
          ObsidianTheme.emerald.withValues(alpha: 0.3),
          Colors.transparent,
        ],
        stops: const [0.0, 0.2, 0.5, 0.8, 1.0],
      ).createShader(Rect.fromLTWH(0, y - 1, size.width, 2))
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    canvas.drawLine(Offset(10, y), Offset(size.width - 10, y), paint);
  }

  @override
  bool shouldRepaint(covariant _LaserPainter old) => old.progress != progress;
}

// ══════════════════════════════════════════════════════
// ── HUD Button ───────────────────────────────────────
// ══════════════════════════════════════════════════════

class _HudButton extends StatelessWidget {
  final IconData icon;
  final bool active;
  final VoidCallback onTap;
  const _HudButton({required this.icon, this.active = false, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? Colors.white : Colors.black.withValues(alpha: 0.6),
          border: Border.all(color: active ? Colors.transparent : const Color(0x33FFFFFF)),
          boxShadow: active
              ? [BoxShadow(color: Colors.white.withValues(alpha: 0.3), blurRadius: 12)]
              : null,
        ),
        child: Center(
          child: Icon(icon, size: 18, color: active ? Colors.black : Colors.white),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Result Card ──────────────────────────────────────
// ══════════════════════════════════════════════════════

class _ResultCard extends StatelessWidget {
  final ScanResult result;
  final VoidCallback onDismiss;
  final ValueChanged<String> onAction;
  const _ResultCard({required this.result, required this.onDismiss, required this.onAction});

  Color get _accentColor {
    switch (result.type) {
      case ScanMatchType.asset:
        return ObsidianTheme.emerald;
      case ScanMatchType.stock:
        return ObsidianTheme.blue;
      case ScanMatchType.unknown:
        return ObsidianTheme.amber;
    }
  }

  String get _typeLabel {
    switch (result.type) {
      case ScanMatchType.asset:
        return 'ASSET VERIFIED';
      case ScanMatchType.stock:
        return 'STOCK ITEM';
      case ScanMatchType.unknown:
        return 'UNKNOWN CODE';
    }
  }

  IconData get _typeIcon {
    switch (result.type) {
      case ScanMatchType.asset:
        return PhosphorIconsLight.wrench;
      case ScanMatchType.stock:
        return PhosphorIconsLight.package;
      case ScanMatchType.unknown:
        return PhosphorIconsLight.question;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return GestureDetector(
      onVerticalDragUpdate: (d) {
        if (d.primaryDelta! > 10) onDismiss();
      },
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
          child: Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPad + 16),
            decoration: BoxDecoration(
              color: c.canvas.withValues(alpha: 0.95),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(top: BorderSide(color: _accentColor.withValues(alpha: 0.3))),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: c.textTertiary,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        borderRadius: ObsidianTheme.radiusFull,
                        color: _accentColor.withValues(alpha: 0.1),
                        border: Border.all(color: _accentColor.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_typeIcon, size: 12, color: _accentColor),
                          const SizedBox(width: 6),
                          Text(
                            _typeLabel,
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 9, color: _accentColor,
                              fontWeight: FontWeight.w600, letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      result.code.length > 20 ? '${result.code.substring(0, 20)}...' : result.code,
                      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  result.name ?? 'Unregistered Item',
                  style: GoogleFonts.inter(
                    fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3,
                  ),
                ),
                if (result.subtitle != null && result.subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(result.subtitle!, style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary)),
                ],
                const SizedBox(height: 14),
                _buildDetailsRow(),
                const SizedBox(height: 16),
                _buildActions(),
              ],
            ),
          ),
        ),
      ),
    ).animate()
        .moveY(begin: 60, end: 0, duration: 350.ms, curve: Curves.easeOutQuart)
        .fadeIn(duration: 250.ms);
  }

  Widget _buildDetailsRow() {
    final items = <Widget>[];
    if (result.status != null) items.add(_DetailChip(label: 'STATUS', value: result.status!));
    if (result.assignedTo != null) items.add(_DetailChip(label: 'ASSIGNED', value: result.assignedTo!));
    if (result.quantity != null) items.add(_DetailChip(label: 'QTY', value: '${result.quantity}'));
    if (result.location != null) items.add(_DetailChip(label: 'LOCATION', value: result.location!));
    if (items.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: items);
  }

  Widget _buildActions() {
    List<_ActionButton> actions;
    switch (result.type) {
      case ScanMatchType.asset:
        final isCheckedOut = result.assignedTo != null;
        actions = [
          if (isCheckedOut) _ActionButton(label: 'Check In', color: ObsidianTheme.emerald, onTap: () => onAction('check_in')),
          if (!isCheckedOut) _ActionButton(label: 'Assign to Me', color: ObsidianTheme.emerald, onTap: () => onAction('assign')),
          _ActionButton(label: 'View History', color: null, onTap: () => onAction('history')),
        ];
      case ScanMatchType.stock:
        actions = [
          _ActionButton(label: '+ Add to Job', color: ObsidianTheme.emerald, onTap: () => onAction('add_to_job')),
          _ActionButton(label: 'Adjust Stock', color: null, onTap: () => onAction('adjust')),
        ];
      case ScanMatchType.unknown:
        final isUrl = result.code.startsWith('http');
        actions = [
          if (isUrl) _ActionButton(label: 'Open Link', color: ObsidianTheme.blue, onTap: () => onAction('open_link')),
          _ActionButton(label: 'Create Asset', color: ObsidianTheme.emerald, onTap: () => onAction('create_asset')),
          _ActionButton(label: 'Register Stock', color: null, onTap: () => onAction('register_stock')),
        ];
    }
    return Row(
      children: actions.map((a) => Expanded(
        child: Padding(
          padding: EdgeInsets.only(right: a != actions.last ? 8 : 0),
          child: a,
        ),
      )).toList(),
    );
  }
}

class _DetailChip extends StatelessWidget {
  final String label;
  final String value;
  const _DetailChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: ObsidianTheme.radiusMd,
        color: c.surface,
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.jetBrainsMono(fontSize: 8, color: c.textTertiary, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(value, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: c.textPrimary)),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final Color? color;
  final VoidCallback onTap;
  const _ActionButton({required this.label, this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isPrimary = color != null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
          color: isPrimary ? color : Colors.transparent,
          border: isPrimary ? null : Border.all(color: c.borderMedium),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13, fontWeight: FontWeight.w600,
              color: isPrimary ? Colors.white : c.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// ── Manual Entry Sheet ───────────────────────────────
// ══════════════════════════════════════════════════════

class _ManualEntrySheet extends StatefulWidget {
  final ValueChanged<String> onSubmit;
  const _ManualEntrySheet({required this.onSubmit});

  @override
  State<_ManualEntrySheet> createState() => _ManualEntrySheetState();
}

class _ManualEntrySheetState extends State<_ManualEntrySheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16),
          decoration: BoxDecoration(
            color: c.canvas.withValues(alpha: 0.97),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            border: Border(top: BorderSide(color: c.borderMedium)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: c.textTertiary),
                ),
              ),
              const SizedBox(height: 16),
              Text('Manual Code Entry', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
              const SizedBox(height: 4),
              Text(
                'Enter a barcode, serial number, or SKU',
                style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 2, height: 38,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(1),
                      color: ObsidianTheme.emerald.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: true,
                      style: GoogleFonts.jetBrainsMono(fontSize: 16, color: c.textPrimary),
                      cursorColor: ObsidianTheme.emerald,
                      decoration: InputDecoration(
                        hintText: 'ABC-123456',
                        hintStyle: GoogleFonts.jetBrainsMono(fontSize: 16, color: c.textTertiary),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                      onSubmitted: (v) {
                        if (v.trim().isNotEmpty) widget.onSubmit(v.trim());
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () {
                  if (_controller.text.trim().isNotEmpty) {
                    widget.onSubmit(_controller.text.trim());
                  }
                },
                child: Container(
                  width: double.infinity, height: 48,
                  decoration: BoxDecoration(
                    borderRadius: ObsidianTheme.radiusMd,
                    color: Colors.white,
                  ),
                  child: Center(
                    child: Text('Look Up', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
