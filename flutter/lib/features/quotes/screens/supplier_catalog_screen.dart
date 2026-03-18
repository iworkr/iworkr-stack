import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Project Forge-Link — Supplier Catalog Search & Live Stock Check
/// 
/// A full-screen search interface for browsing supplier catalogs with
/// pg_trgm-powered fuzzy search and live branch stock availability.
/// Used from the quote builder when adding supplier-linked items.
class SupplierCatalogScreen extends StatefulWidget {
  final String? supplierId;
  final String? supplierEnum;
  final Function(Map<String, dynamic> item)? onItemSelected;

  const SupplierCatalogScreen({
    super.key,
    this.supplierId,
    this.supplierEnum,
    this.onItemSelected,
  });

  @override
  State<SupplierCatalogScreen> createState() => _SupplierCatalogScreenState();
}

class _SupplierCatalogScreenState extends State<SupplierCatalogScreen> {
  final _supabase = Supabase.instance.client;
  final _searchController = TextEditingController();
  final _debounce = ValueNotifier<Timer?>(null);

  List<Map<String, dynamic>> _results = [];
  List<Map<String, dynamic>> _suppliers = [];
  bool _loading = false;
  bool _initialLoad = true;
  String? _selectedSupplier;
  String? _selectedCategory;
  Map<String, dynamic>? _stockCheckItem;
  Map<String, dynamic>? _stockData;
  bool _checkingStock = false;

  // Obsidian palette
  static const _canvas = Color(0xFF050505);
  static const _surface1 = Color(0xFF0A0A0A);
  static const _surface2 = Color(0xFF141414);
  static const _border = Color(0x0DFFFFFF);
  static const _borderActive = Color(0x1FFFFFFF);
  static const _textPrimary = Color(0xFFEDEDED);
  static const _textMuted = Color(0xFF71717A);
  static const _emerald = Color(0xFF10B981);
  static const _amber = Color(0xFFF59E0B);

  String? get _orgId =>
      _supabase.auth.currentUser?.userMetadata?['organization_id'] as String?;

  @override
  void initState() {
    super.initState();
    _loadSuppliers();
    _selectedSupplier = widget.supplierEnum;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce.value?.cancel();
    super.dispose();
  }

  Future<void> _loadSuppliers() async {
    final orgId = _orgId;
    if (orgId == null) return;

    final data = await _supabase
        .from('workspace_suppliers')
        .select('id, supplier, display_name, preferred_branch_id, preferred_branch')
        .eq('organization_id', orgId)
        .eq('sync_status', 'ACTIVE');

    if (mounted) {
      setState(() {
        _suppliers = List<Map<String, dynamic>>.from(data);
        _initialLoad = false;
      });
    }
  }

  void _onSearchChanged(String query) {
    _debounce.value?.cancel();
    if (query.length < 2) {
      setState(() => _results = []);
      return;
    }
    _debounce.value = Timer(const Duration(milliseconds: 300), () {
      _search(query);
    });
  }

  Future<void> _search(String query) async {
    final orgId = _orgId;
    if (orgId == null || query.length < 2) return;

    setState(() => _loading = true);

    try {
      final data = await _supabase.rpc('search_supplier_catalog', params: {
        'p_org_id': orgId,
        'p_query': query,
        'p_supplier': _selectedSupplier,
        'p_category': _selectedCategory,
        'p_limit': 30,
      });

      if (mounted) {
        setState(() {
          _results = List<Map<String, dynamic>>.from(data ?? []);
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Search error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _checkStock(Map<String, dynamic> item) async {
    HapticFeedback.mediumImpact();
    setState(() {
      _stockCheckItem = item;
      _stockData = null;
      _checkingStock = true;
    });

    final orgId = _orgId;
    if (orgId == null) return;

    try {
      // Find the preferred branch for this supplier
      final supplier = _suppliers.firstWhere(
        (s) => s['supplier'] == item['supplier'],
        orElse: () => <String, dynamic>{},
      );

      final response = await _supabase.functions.invoke(
        'live-price-check',
        body: {
          'organization_id': orgId,
          'supplier': item['supplier'],
          'skus': [item['sku']],
          'branch_id': supplier['preferred_branch_id'],
        },
      );

      if (mounted && response.data != null) {
        final items = response.data['items'] as List?;
        setState(() {
          _stockData = items?.isNotEmpty == true
              ? Map<String, dynamic>.from(items!.first)
              : null;
          _checkingStock = false;
        });
      }
    } catch (e) {
      debugPrint('Stock check error: $e');
      if (mounted) setState(() => _checkingStock = false);
    }
  }

  void _selectItem(Map<String, dynamic> item) {
    HapticFeedback.heavyImpact();
    widget.onItemSelected?.call(item);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: _canvas,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildSupplierPills(),
            _buildSearchBar(),
            Expanded(
              child: _loading
                  ? _buildLoadingState()
                  : _results.isEmpty
                      ? _buildEmptyState()
                      : _buildResultsList(),
            ),
            SizedBox(height: bottomPad),
          ],
        ),
      ),
      bottomSheet: _stockCheckItem != null
          ? _buildStockBottomSheet(bottomPad)
          : null,
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
            },
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _surface2,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _border),
              ),
              child: const Icon(PhosphorIconsLight.x, color: _textMuted, size: 18),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SUPPLIER CATALOG',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: _emerald,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Search & Add Materials',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: _textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms).moveY(begin: -8, end: 0);
  }

  Widget _buildSupplierPills() {
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          _buildPill('All', null),
          ..._suppliers.map((s) => _buildPill(
            s['display_name'] ?? s['supplier'],
            s['supplier'] as String?,
          )),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms, delay: 100.ms);
  }

  Widget _buildPill(String label, String? value) {
    final isSelected = _selectedSupplier == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _selectedSupplier = value);
        if (_searchController.text.length >= 2) {
          _search(_searchController.text);
        }
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? _emerald.withValues(alpha: 0.15) : _surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? _emerald.withValues(alpha: 0.3) : _border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? _emerald : _textMuted,
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Container(
        decoration: BoxDecoration(
          color: _surface1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _borderActive),
        ),
        child: TextField(
          controller: _searchController,
          onChanged: _onSearchChanged,
          autofocus: true,
          style: const TextStyle(color: _textPrimary, fontSize: 15),
          decoration: InputDecoration(
            hintText: 'Search catalog (e.g. "15mm copper", "LED downlight")...',
            hintStyle: const TextStyle(color: _textMuted, fontSize: 14),
            prefixIcon: Icon(
              _loading ? PhosphorIconsLight.circleNotch : PhosphorIconsLight.magnifyingGlass,
              color: _textMuted, size: 20,
            ),
            suffixIcon: _searchController.text.isNotEmpty
                ? GestureDetector(
                    onTap: () {
                      _searchController.clear();
                      setState(() => _results = []);
                    },
                    child: const Icon(PhosphorIconsLight.x, color: _textMuted, size: 18),
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms, delay: 150.ms);
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 24, height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: _emerald,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Searching catalog...',
            style: TextStyle(color: _textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    final hasQuery = _searchController.text.length >= 2;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            hasQuery ? PhosphorIconsLight.magnifyingGlass : PhosphorIconsLight.package,
            size: 48,
            color: _textMuted.withValues(alpha: 0.3),
          ),
          const SizedBox(height: 16),
          Text(
            hasQuery ? 'No items found' : 'Search the supplier catalog',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: _textMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            hasQuery
                ? 'Try a different search term or supplier filter'
                : 'Type at least 2 characters to search',
            style: TextStyle(fontSize: 13, color: _textMuted.withValues(alpha: 0.6)),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: _results.length,
      itemBuilder: (context, index) {
        final item = _results[index];
        return _buildResultCard(item, index);
      },
    );
  }

  Widget _buildResultCard(Map<String, dynamic> item, int index) {
    final tradePrice = (item['trade_price'] as num?)?.toDouble() ?? 0;
    final retailPrice = (item['retail_price'] as num?)?.toDouble();
    final savings = retailPrice != null && retailPrice > tradePrice
        ? retailPrice - tradePrice
        : null;

    return GestureDetector(
      onTap: () => _checkStock(item),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _surface1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _emerald.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          item['supplier']?.toString() ?? '',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: _emerald,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item['sku']?.toString() ?? '',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          color: _textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item['name']?.toString() ?? '',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: _textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (item['category'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${item['category']}${item['brand'] != null ? ' · ${item['brand']}' : ''}',
                      style: TextStyle(fontSize: 12, color: _textMuted),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(width: 12),

            // Price column
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '\$${tradePrice.toStringAsFixed(2)}',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item['uom']?.toString() ?? 'EACH',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 10,
                    color: _textMuted,
                  ),
                ),
                if (savings != null && savings > 0) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _emerald.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '-\$${savings.toStringAsFixed(2)}',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: _emerald,
                      ),
                    ),
                  ),
                ],
              ],
            ),

            const SizedBox(width: 8),
            Icon(
              PhosphorIconsLight.caretRight,
              size: 16,
              color: _textMuted.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 200.ms, delay: Duration(milliseconds: index * 30)).moveY(begin: 6, end: 0);
  }

  Widget _buildStockBottomSheet(double bottomPad) {
    final item = _stockCheckItem!;
    final tradePrice = (item['trade_price'] as num?)?.toDouble() ?? 0;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomPad + 20),
      decoration: BoxDecoration(
        color: _surface1,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        border: Border(top: BorderSide(color: _borderActive)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 40,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: _textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Item header
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['name']?.toString() ?? '',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: _textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          item['sku']?.toString() ?? '',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 12, color: _textMuted,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _emerald.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item['supplier']?.toString() ?? '',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: _emerald,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'TRADE COST',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: _textMuted,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '\$${tradePrice.toStringAsFixed(2)}',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: _textPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 16),
          Container(height: 1, color: _border),
          const SizedBox(height: 16),

          // Stock availability
          if (_checkingStock)
            Row(
              children: [
                SizedBox(
                  width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: _emerald),
                ),
                const SizedBox(width: 10),
                Text(
                  'Checking live stock availability...',
                  style: TextStyle(fontSize: 13, color: _textMuted),
                ),
              ],
            )
          else if (_stockData != null) ...[
            Text(
              'STOCK AVAILABILITY',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: _textMuted,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 10),
            _buildStockRow(
              icon: PhosphorIconsFill.checkCircle,
              color: (_stockData!['stock_at_branch'] ?? 0) > 0 ? _emerald : const Color(0xFFF43F5E),
              label: _stockData!['branch_name']?.toString() ?? 'Local Branch',
              count: _stockData!['stock_at_branch'] ?? 0,
            ),
            const SizedBox(height: 8),
            _buildStockRow(
              icon: PhosphorIconsFill.truck,
              color: _amber,
              label: '${_stockData!['dc_name'] ?? 'Distribution Center'} (1-day lead)',
              count: _stockData!['stock_at_dc'] ?? 0,
            ),
            if (_stockData!['live_cost'] != null &&
                _stockData!['live_cost'] != tradePrice) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: _amber.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _amber.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    Icon(PhosphorIconsFill.warning, size: 16, color: _amber),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Live price: \$${(_stockData!['live_cost'] as num).toStringAsFixed(2)} '
                        '(${(_stockData!['cost_delta'] as num? ?? 0) > 0 ? '+' : ''}'
                        '\$${(_stockData!['cost_delta'] as num? ?? 0).toStringAsFixed(2)})',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _amber,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ] else
            Text(
              'Stock data unavailable — no API credentials configured',
              style: TextStyle(fontSize: 13, color: _textMuted),
            ),

          const SizedBox(height: 20),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() {
                      _stockCheckItem = null;
                      _stockData = null;
                    });
                  },
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: _surface2,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _border),
                    ),
                    child: const Center(
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _textMuted,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: () => _selectItem(item),
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: _emerald,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(PhosphorIconsBold.plus, size: 16, color: Colors.white),
                        const SizedBox(width: 8),
                        const Text(
                          'Add to Quote',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStockRow({
    required IconData icon,
    required Color color,
    required String label,
    required int count,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, color: _textPrimary),
          ),
        ),
        Text(
          '$count units',
          style: GoogleFonts.jetBrainsMono(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: count > 0 ? _emerald : const Color(0xFFF43F5E),
          ),
        ),
      ],
    );
  }
}
