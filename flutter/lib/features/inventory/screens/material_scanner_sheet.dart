import 'dart:async';
import 'dart:io';
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

/// Staging cart item — held locally until job completion.
class StagingCartItem {
  final String itemId;
  final String name;
  final String? sku;
  final String? barcode;
  final double unitCost;
  final double markupPercent;
  final String billingType;
  final String unit;
  double qty;

  StagingCartItem({
    required this.itemId,
    required this.name,
    this.sku,
    this.barcode,
    required this.unitCost,
    this.markupPercent = 20.0,
    this.billingType = 'FIXED',
    this.unit = 'each',
    this.qty = 1,
  });

  double get sellPrice => unitCost * (1 + markupPercent / 100);
  double get lineTotal => sellPrice * qty;
  double get costTotal => unitCost * qty;
  bool get isFractional => billingType != 'FIXED';

  Map<String, dynamic> toPayload() => {
        'item_id': itemId,
        'qty': qty,
        'notes': 'Scanned: $name${sku != null ? ' ($sku)' : ''}',
      };
}

/// Material Scanner Bottom Sheet — opens from the Job Execution view.
///
/// Flow: Scan barcode → lookup → add to staging cart → submit on job completion.
class MaterialScannerSheet extends ConsumerStatefulWidget {
  final String jobId;
  final String? locationId;
  final ValueChanged<List<StagingCartItem>>? onCartSubmitted;

  const MaterialScannerSheet({
    super.key,
    required this.jobId,
    this.locationId,
    this.onCartSubmitted,
  });

  @override
  ConsumerState<MaterialScannerSheet> createState() =>
      _MaterialScannerSheetState();
}

class _MaterialScannerSheetState extends ConsumerState<MaterialScannerSheet>
    with TickerProviderStateMixin {
  MobileScannerController? _cameraController;
  late AnimationController _pulseController;

  bool _cameraReady = false;
  bool _isSimulator = false;
  bool _locked = false;
  bool _showSearch = false;

  final List<StagingCartItem> _cart = [];
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _qtyController = TextEditingController(text: '1');
  DateTime? _lastScanTime;

  StagingCartItem? _pendingFractionalItem;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _initCamera();
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _pulseController.dispose();
    _searchController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  Future<void> _initCamera() async {
    if (!kIsWeb && !(Platform.isAndroid || Platform.isIOS)) {
      setState(() => _isSimulator = true);
      return;
    }

    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isIOS) {
        final ios = await deviceInfo.iosInfo;
        if (!ios.isPhysicalDevice) {
          setState(() => _isSimulator = true);
          return;
        }
      } else if (Platform.isAndroid) {
        final android = await deviceInfo.androidInfo;
        if (!android.isPhysicalDevice) {
          setState(() => _isSimulator = true);
          return;
        }
      }
    } catch (_) {}

    final status = await Permission.camera.status;
    if (!status.isGranted) {
      if (!mounted) return;
      final granted = await PermissionService.instance.requestCamera(context);
      if (!granted) return;
    }

    try {
      _cameraController = MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
        facing: CameraFacing.back,
        autoStart: false,
      );
      await _cameraController!.start();
      if (mounted) setState(() => _cameraReady = true);
    } catch (_) {}
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_locked) return;
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final code = barcodes.first.rawValue;
    if (code == null || code.isEmpty) return;

    final now = DateTime.now();
    if (_lastScanTime != null &&
        now.difference(_lastScanTime!) < const Duration(milliseconds: 600)) {
      return;
    }
    _lastScanTime = now;

    setState(() => _locked = true);
    HapticFeedback.heavyImpact();

    await _lookupAndAdd(code);

    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _locked = false);
    });
  }

  Future<void> _lookupAndAdd(String code) async {
    final orgId = await ref.read(organizationIdProvider.future);
    if (orgId == null) return;

    try {
      final result = await SupabaseService.client.rpc('barcode_lookup', params: {
        'p_org_id': orgId,
        'p_code': code,
      });

      final data =
          result is String ? (result as dynamic) : result as Map<String, dynamic>;

      if (data['found'] != true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Unknown code: $code',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.amber,
            duration: const Duration(seconds: 2),
          ));
        }
        return;
      }

      final item = StagingCartItem(
        itemId: data['id'] as String,
        name: data['name'] as String,
        sku: data['sku'] as String?,
        barcode: data['barcode'] as String?,
        unitCost: (data['unit_cost'] as num?)?.toDouble() ?? 0,
        markupPercent: (data['markup_percent'] as num?)?.toDouble() ?? 20,
        billingType: data['billing_type'] as String? ?? 'FIXED',
        unit: data['unit'] as String? ?? 'each',
      );

      if (item.isFractional) {
        // For length/volume items, prompt for quantity
        setState(() => _pendingFractionalItem = item);
        _qtyController.text = '';
      } else {
        _addToCart(item);
      }
    } catch (e) {
      debugPrint('Barcode lookup error: $e');
    }
  }

  void _addToCart(StagingCartItem item) {
    setState(() {
      final existing = _cart.indexWhere((c) => c.itemId == item.itemId);
      if (existing >= 0) {
        _cart[existing].qty += item.qty;
      } else {
        _cart.add(item);
      }
    });

    HapticFeedback.mediumImpact();

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(
        'Added: ${item.name} (+${item.qty} ${item.unit})',
        style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w500),
      ),
      backgroundColor: ObsidianTheme.emerald,
      duration: const Duration(seconds: 1),
    ));
  }

  void _confirmFractionalQty() {
    final qty = double.tryParse(_qtyController.text);
    if (qty == null || qty <= 0 || _pendingFractionalItem == null) return;

    _pendingFractionalItem!.qty = qty;
    _addToCart(_pendingFractionalItem!);
    setState(() => _pendingFractionalItem = null);
  }

  void _removeFromCart(int index) {
    HapticFeedback.lightImpact();
    setState(() => _cart.removeAt(index));
  }

  Future<void> _submitCart() async {
    if (_cart.isEmpty) return;

    HapticFeedback.heavyImpact();

    widget.onCartSubmitted?.call(List.from(_cart));

    if (mounted) {
      Navigator.of(context).pop(_cart.map((c) => c.toPayload()).toList());
    }
  }

  Future<void> _searchItem(String query) async {
    if (query.length < 2) return;
    await _lookupAndAdd(query);
    _searchController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
        child: Container(
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: BoxDecoration(
            color: c.canvas.withValues(alpha: 0.97),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border(top: BorderSide(color: ObsidianTheme.emerald.withValues(alpha: 0.3))),
          ),
          child: Column(
            children: [
              // ── Handle + Header ──
              _buildHeader(),

              // ── Camera / Scanner ──
              if (!_showSearch)
                SizedBox(
                  height: 200,
                  child: _buildCameraView(),
                ),

              // ── Search Fallback ──
              if (_showSearch) _buildSearchBar(),

              // ── Fractional Qty Prompt ──
              if (_pendingFractionalItem != null) _buildFractionalPrompt(),

              // ── Cart List ──
              Expanded(child: _buildCartList()),

              // ── Submit Bar ──
              _buildSubmitBar(bottomPad),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Column(
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: c.textTertiary,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                ),
                child: const Icon(PhosphorIconsLight.barcode,
                    color: ObsidianTheme.emerald, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ADD MATERIALS',
                      style: GoogleFonts.jetBrainsMono(
                        color: c.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Text(
                      'Scan barcodes or search items',
                      style: GoogleFonts.inter(
                          color: c.textTertiary, fontSize: 11),
                    ),
                  ],
                ),
              ),
              // Toggle search/scan
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _showSearch = !_showSearch);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: c.border,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _showSearch
                            ? PhosphorIconsLight.camera
                            : PhosphorIconsLight.magnifyingGlass,
                        size: 14,
                        color: c.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _showSearch ? 'Scan' : 'Search',
                        style: GoogleFonts.inter(
                            fontSize: 11, color: c.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildCameraView() {
    final c = context.iColors;

    if (_isSimulator) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: c.surface,
          border: Border.all(color: c.border),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(PhosphorIconsLight.desktopTower,
                  color: ObsidianTheme.indigo, size: 28),
              const SizedBox(height: 8),
              Text('Simulator — use Search',
                  style: GoogleFonts.inter(
                      color: c.textTertiary, fontSize: 12)),
            ],
          ),
        ),
      );
    }

    if (!_cameraReady) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: c.surface,
        ),
        child: const Center(
          child: CircularProgressIndicator(
              color: ObsidianTheme.emerald, strokeWidth: 2),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _locked
              ? ObsidianTheme.emerald
              : ObsidianTheme.emerald.withValues(alpha: 0.3),
          width: _locked ? 2 : 1,
        ),
      ),
      child: Stack(
        children: [
          MobileScanner(
            controller: _cameraController!,
            onDetect: _onDetect,
          ),
          // Scan indicator
          if (!_locked)
            Center(
              child: AnimatedBuilder(
                animation: _pulseController,
                builder: (_, __) {
                  return Container(
                    width: 160,
                    height: 2,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          ObsidianTheme.emerald
                              .withValues(alpha: 0.3 + _pulseController.value * 0.4),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          Container(
            width: 2,
            height: 38,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(1),
              color: ObsidianTheme.emerald.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _searchController,
              style: GoogleFonts.jetBrainsMono(
                  fontSize: 14, color: c.textPrimary),
              cursorColor: ObsidianTheme.emerald,
              decoration: InputDecoration(
                hintText: 'Enter SKU, barcode, or name...',
                hintStyle: GoogleFonts.inter(
                    fontSize: 13, color: c.textTertiary),
                border: InputBorder.none,
                isDense: true,
                suffixIcon: IconButton(
                  icon: Icon(PhosphorIconsLight.magnifyingGlass,
                      size: 18, color: c.textSecondary),
                  onPressed: () => _searchItem(_searchController.text),
                ),
              ),
              onSubmitted: _searchItem,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFractionalPrompt() {
    final c = context.iColors;
    final item = _pendingFractionalItem!;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: ObsidianTheme.amber.withValues(alpha: 0.06),
        border:
            Border.all(color: ObsidianTheme.amber.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.name,
              style: GoogleFonts.inter(
                  color: c.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text('Enter quantity in ${item.unit}',
              style:
                  GoogleFonts.inter(color: c.textTertiary, fontSize: 12)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qtyController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  style: GoogleFonts.jetBrainsMono(
                      fontSize: 20,
                      color: c.textPrimary,
                      fontWeight: FontWeight.w600),
                  cursorColor: ObsidianTheme.amber,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: '0.0',
                    hintStyle: GoogleFonts.jetBrainsMono(
                        fontSize: 20, color: c.textTertiary),
                    border: InputBorder.none,
                    suffixText: item.unit,
                    suffixStyle: GoogleFonts.inter(
                        fontSize: 12, color: c.textTertiary),
                  ),
                  onSubmitted: (_) => _confirmFractionalQty(),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: _confirmFractionalQty,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: ObsidianTheme.emerald,
                  ),
                  child: Text('Add',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () =>
                    setState(() => _pendingFractionalItem = null),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    color: c.border,
                  ),
                  child: Icon(PhosphorIconsLight.x,
                      size: 14, color: c.textTertiary),
                ),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 200.ms)
        .moveY(begin: -8, duration: 200.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildCartList() {
    final c = context.iColors;

    if (_cart.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.shoppingCart,
                color: c.textTertiary, size: 32),
            const SizedBox(height: 10),
            Text('No materials added yet',
                style: GoogleFonts.inter(
                    color: c.textTertiary, fontSize: 13)),
            const SizedBox(height: 4),
            Text('Scan a barcode or search to add items',
                style: GoogleFonts.inter(
                    color: c.textTertiary, fontSize: 11)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      itemCount: _cart.length,
      itemBuilder: (context, index) {
        final item = _cart[index];
        return _CartItemCard(
          item: item,
          index: index,
          onRemove: () => _removeFromCart(index),
          onQtyChanged: (newQty) {
            setState(() => item.qty = newQty);
          },
        );
      },
    );
  }

  Widget _buildSubmitBar(double bottomPad) {
    final c = context.iColors;
    final totalSell =
        _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final totalCost =
        _cart.fold<double>(0, (sum, item) => sum + item.costTotal);
    final margin = totalSell - totalCost;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottomPad + 12),
      decoration: BoxDecoration(
        color: c.canvas,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_cart.isNotEmpty) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${_cart.length} items',
                    style: GoogleFonts.inter(
                        color: c.textTertiary, fontSize: 12)),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('\$${totalSell.toStringAsFixed(2)}',
                        style: GoogleFonts.jetBrainsMono(
                            color: c.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700)),
                    Text(
                        'Margin: \$${margin.toStringAsFixed(2)}',
                        style: GoogleFonts.jetBrainsMono(
                            color: ObsidianTheme.emerald, fontSize: 10)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
          GestureDetector(
            onTap: _cart.isNotEmpty ? _submitCart : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: _cart.isNotEmpty
                    ? ObsidianTheme.emerald
                    : c.border,
              ),
              child: Center(
                child: Text(
                  _cart.isNotEmpty
                      ? 'SUBMIT MATERIALS'
                      : 'SCAN TO ADD',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.5,
                    color: _cart.isNotEmpty
                        ? Colors.white
                        : c.textTertiary,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Cart Item Card ───────────────────────────────────────────────

class _CartItemCard extends StatelessWidget {
  final StagingCartItem item;
  final int index;
  final VoidCallback onRemove;
  final ValueChanged<double> onQtyChanged;

  const _CartItemCard({
    required this.item,
    required this.index,
    required this.onRemove,
    required this.onQtyChanged,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: c.hoverBg,
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          // Qty badge
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: ObsidianTheme.emerald.withValues(alpha: 0.1),
            ),
            child: Center(
              child: Text(
                item.qty % 1 == 0
                    ? item.qty.toInt().toString()
                    : item.qty.toStringAsFixed(1),
                style: GoogleFonts.jetBrainsMono(
                  color: ObsidianTheme.emerald,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    style: GoogleFonts.inter(
                        color: c.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    if (item.sku != null)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(item.sku!,
                            style: GoogleFonts.jetBrainsMono(
                                color: c.textTertiary, fontSize: 9)),
                      ),
                    Text(
                      '\$${item.sellPrice.toStringAsFixed(2)}/${item.unit}',
                      style: GoogleFonts.jetBrainsMono(
                          color: ObsidianTheme.emerald, fontSize: 9,
                          fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // +/- controls
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _QtyButton(
                label: '-',
                onTap: () {
                  if (item.qty > (item.isFractional ? 0.5 : 1)) {
                    HapticFeedback.lightImpact();
                    onQtyChanged(item.qty - (item.isFractional ? 0.5 : 1));
                  }
                },
              ),
              const SizedBox(width: 4),
              _QtyButton(
                label: '+',
                onTap: () {
                  HapticFeedback.lightImpact();
                  onQtyChanged(item.qty + (item.isFractional ? 0.5 : 1));
                },
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onRemove,
                child: Icon(PhosphorIconsLight.trash,
                    size: 14, color: ObsidianTheme.rose),
              ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(
            delay: Duration(milliseconds: 50 * index), duration: 300.ms)
        .moveX(
            begin: 8,
            delay: Duration(milliseconds: 50 * index),
            duration: 300.ms,
            curve: Curves.easeOutCubic);
  }
}

class _QtyButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _QtyButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          color: c.border,
        ),
        child: Center(
          child: Text(label,
              style: GoogleFonts.jetBrainsMono(
                  color: c.textSecondary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}
