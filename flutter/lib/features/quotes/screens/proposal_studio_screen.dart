import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// ============================================================================
/// Project Hephaestus — Proposal Studio (Good / Better / Best)
/// ============================================================================
/// The "FlatRateNOW Killer" — a beautiful, consumer-grade Flutter interface
/// for field technicians to build tiered proposals on-site and present them
/// to homeowners on an iPad.
/// ============================================================================

class ProposalStudioScreen extends StatefulWidget {
  final String? clientId;
  final String? clientName;
  final String? siteAddress;

  const ProposalStudioScreen({
    super.key,
    this.clientId,
    this.clientName,
    this.siteAddress,
  });

  @override
  State<ProposalStudioScreen> createState() => _ProposalStudioScreenState();
}

class _ProposalStudioScreenState extends State<ProposalStudioScreen> {
  // ── State ─────────────────────────────────────────
  final List<ProposalOption> _options = [
    ProposalOption(label: 'Good', kits: []),
    ProposalOption(label: 'Better', kits: []),
    ProposalOption(label: 'Best', kits: []),
  ];

  bool _isPresentationMode = false;
  int? _selectedOption;
  String? _signedByName;
  List<dynamic> _availableKits = [];

  @override
  void initState() {
    super.initState();
    _loadKits();
  }

  Future<void> _loadKits() async {
    try {
      final supabase = Supabase.instance.client;
      final orgId = supabase.auth.currentUser?.userMetadata?['organization_id'];
      if (orgId == null) return;

      final data = await supabase
          .from('trade_kits')
          .select('*, kit_components(*)')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .order('name');

      setState(() {
        _availableKits = data as List<dynamic>;
      });
    } catch (e) {
      debugPrint('Error loading kits: $e');
    }
  }

  double _calculateOptionTotal(ProposalOption option) {
    return option.kits.fold(0.0, (sum, kit) => sum + kit.totalSell);
  }

  double _calculateOptionCost(ProposalOption option) {
    return option.kits.fold(0.0, (sum, kit) => sum + kit.totalCost);
  }

  void _addKitToOption(int optionIndex, dynamic kitData) {
    final kit = ProposalKit.fromSupabase(kitData);
    setState(() {
      _options[optionIndex].kits.add(kit);
    });
  }

  void _removeKitFromOption(int optionIndex, int kitIndex) {
    setState(() {
      _options[optionIndex].kits.removeAt(kitIndex);
    });
  }

  void _showKitPicker(int optionIndex) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0A0A0A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _KitPickerSheet(
        kits: _availableKits,
        onSelect: (kit) {
          _addKitToOption(optionIndex, kit);
          Navigator.pop(context);
        },
      ),
    );
  }

  Future<void> _submitProposal() async {
    if (_selectedOption == null) return;

    HapticFeedback.heavyImpact();

    try {
      final supabase = Supabase.instance.client;
      final orgId = supabase.auth.currentUser?.userMetadata?['organization_id'];
      if (orgId == null) return;

      // Build options JSONB
      final optionsJson = _options
          .map<Map<String, dynamic>>((opt) => <String, dynamic>{
                'label': opt.label,
                'kits': opt.kits.map((k) => k.toJson()).toList(),
                'total_cost': _calculateOptionCost(opt),
                'total_price': _calculateOptionTotal(opt),
              })
          .toList();

      // Call win_proposal RPC
      await supabase.rpc('win_proposal', params: {
        'p_proposal_id': null, // Will create inline
        'p_selected_option': _selectedOption,
        'p_signature_data': null, // Signature canvas data would go here
        'p_signed_by': _signedByName,
        'p_options': optionsJson,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Proposal accepted! Job created.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('Error submitting proposal: $e');
    }
  }

  void _togglePresentationMode() {
    HapticFeedback.mediumImpact();
    setState(() {
      _isPresentationMode = !_isPresentationMode;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isPresentationMode) {
      return _PresentationView(
        options: _options,
        calculateTotal: _calculateOptionTotal,
        onSelectOption: (i) {
          HapticFeedback.heavyImpact();
          setState(() => _selectedOption = i);
        },
        selectedOption: _selectedOption,
        onBack: _togglePresentationMode,
        onConfirm: _submitProposal,
      );
    }

    return _EditorView(
      options: _options,
      calculateTotal: _calculateOptionTotal,
      calculateCost: _calculateOptionCost,
      onAddKit: _showKitPicker,
      onRemoveKit: _removeKitFromOption,
      onPresent: _togglePresentationMode,
      clientName: widget.clientName,
      siteAddress: widget.siteAddress,
    );
  }
}

// ══════════════════════════════════════════════════════
// EDITOR VIEW (Technician Mode)
// ══════════════════════════════════════════════════════

class _EditorView extends StatelessWidget {
  final List<ProposalOption> options;
  final double Function(ProposalOption) calculateTotal;
  final double Function(ProposalOption) calculateCost;
  final void Function(int) onAddKit;
  final void Function(int, int) onRemoveKit;
  final VoidCallback onPresent;
  final String? clientName;
  final String? siteAddress;

  const _EditorView({
    required this.options,
    required this.calculateTotal,
    required this.calculateCost,
    required this.onAddKit,
    required this.onRemoveKit,
    required this.onPresent,
    this.clientName,
    this.siteAddress,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0A0A),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Proposal Studio',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
              ),
            ),
            if (clientName != null)
              Text(
                clientName!,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withOpacity(0.5),
                ),
              ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: onPresent,
            icon: const Icon(PhosphorIconsBold.presentation, size: 16),
            label: const Text('Present'),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF10B981),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: PageView.builder(
        itemCount: options.length,
        itemBuilder: (context, optionIndex) {
          final option = options[optionIndex];
          final total = calculateTotal(option);
          final cost = calculateCost(option);
          final margin = total > 0 ? ((total - cost) / total * 100) : 0;

          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0A0A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.white.withOpacity(0.06),
              ),
            ),
            child: Column(
              children: [
                // ── Option Header ──
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: Colors.white.withOpacity(0.06),
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            option.label.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 2,
                              color: _tierColor(optionIndex),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'OPTION ${optionIndex + 1}',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.white.withOpacity(0.3),
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '\$${total.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontFamily: 'JetBrains Mono',
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'Margin: ${margin.toStringAsFixed(0)}%',
                            style: TextStyle(
                              fontFamily: 'JetBrains Mono',
                              fontSize: 11,
                              color: margin >= 40
                                  ? const Color(0xFF10B981)
                                  : margin >= 25
                                      ? Colors.amber
                                      : Colors.redAccent,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // ── Kit List ──
                Expanded(
                  child: option.kits.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                PhosphorIconsLight.package,
                                size: 40,
                                color: Colors.white.withOpacity(0.15),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Add kits to this option',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.white.withOpacity(0.3),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: option.kits.length,
                          itemBuilder: (context, kitIndex) {
                            final kit = option.kits[kitIndex];
                            return _KitCard(
                              kit: kit,
                              onRemove: () => onRemoveKit(optionIndex, kitIndex),
                              onQuantityChange: (comp, qty) {
                                // Live recalculation
                                comp.quantity = qty;
                                // Force rebuild
                                (context as Element).markNeedsBuild();
                              },
                            ).animate().fadeIn(delay: (kitIndex * 50).ms);
                          },
                        ),
                ),

                // ── Add Kit Button ──
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => onAddKit(optionIndex),
                      icon: const Icon(PhosphorIconsBold.plus, size: 16),
                      label: const Text('Add Kit'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF10B981),
                        side: const BorderSide(
                          color: Color(0xFF10B981),
                          width: 0.5,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Color _tierColor(int index) {
    switch (index) {
      case 0:
        return Colors.white.withOpacity(0.6);
      case 1:
        return const Color(0xFF10B981);
      case 2:
        return const Color(0xFFE5C07B);
      default:
        return Colors.white;
    }
  }
}

// ══════════════════════════════════════════════════════
// PRESENTATION VIEW (Customer-facing)
// ══════════════════════════════════════════════════════

class _PresentationView extends StatelessWidget {
  final List<ProposalOption> options;
  final double Function(ProposalOption) calculateTotal;
  final void Function(int) onSelectOption;
  final int? selectedOption;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  const _PresentationView({
    required this.options,
    required this.calculateTotal,
    required this.onSelectOption,
    required this.selectedOption,
    required this.onBack,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      body: SafeArea(
        child: Column(
          children: [
            // ── Back button (small, subtle) ──
            Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                onPressed: onBack,
                icon: Icon(
                  PhosphorIconsLight.arrowLeft,
                  color: Colors.white.withOpacity(0.2),
                  size: 20,
                ),
              ),
            ),

            // ── Title ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: Column(
                children: [
                  Text(
                    'YOUR SERVICE OPTIONS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 3,
                      color: Colors.white.withOpacity(0.4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Choose the right option for you',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w300,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── Option Cards (Horizontal) ──
            Expanded(
              child: Row(
                children: List.generate(options.length, (i) {
                  final option = options[i];
                  final total = calculateTotal(option);
                  final isSelected = selectedOption == i;
                  final isMiddle = i == 1;

                  if (option.kits.isEmpty) return const SizedBox.shrink();

                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onSelectOption(i),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: isMiddle ? 0 : 16,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFF10B981).withOpacity(0.05)
                              : const Color(0xFF0A0A0A),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF10B981)
                                : Colors.white.withOpacity(0.06),
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            // Badge
                            if (isMiddle)
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF10B981),
                                  borderRadius: BorderRadius.vertical(
                                    top: Radius.circular(14),
                                  ),
                                ),
                                child: const Text(
                                  'RECOMMENDED',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 2,
                                    color: Colors.black,
                                  ),
                                ),
                              ),

                            Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                children: [
                                  Text(
                                    option.label.toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 2,
                                      color: _tierColor(i),
                                    ),
                                  ),
                                  const SizedBox(height: 16),

                                  // Price — JetBrains Mono per Obsidian spec
                                  Text(
                                    '\$${total.toStringAsFixed(0)}',
                                    style: TextStyle(
                                      fontFamily: 'JetBrains Mono',
                                      fontSize: isMiddle ? 32 : 28,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                  Text(
                                    'inc. GST',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Colors.white.withOpacity(0.3),
                                    ),
                                  ),
                                  const SizedBox(height: 16),

                                  // Kit names (consumer-friendly)
                                  ...option.kits.map((kit) => Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: Row(
                                      children: [
                                        Icon(
                                          PhosphorIconsFill.checkCircle,
                                          size: 14,
                                          color: const Color(0xFF10B981),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            kit.name,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.white.withOpacity(0.7),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  )),
                                ],
                              ),
                            ),

                            const Spacer(),

                            // Select button
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: () => onSelectOption(i),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: isSelected
                                        ? const Color(0xFF10B981)
                                        : Colors.white.withOpacity(0.05),
                                    foregroundColor:
                                        isSelected ? Colors.black : Colors.white,
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                  child: Text(
                                    isSelected ? 'Selected ✓' : 'Select',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ).animate().fadeIn(delay: (i * 100).ms).slideY(
                          begin: 0.1,
                          curve: Curves.easeOut,
                        ),
                  );
                }),
              ),
            ),

            // ── Confirm bar ──
            if (selectedOption != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0A0A0A),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withOpacity(0.06),
                    ),
                  ),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onConfirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.black,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: const Text(
                      'Confirm & Sign',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ).animate().fadeIn().slideY(begin: 0.3),
          ],
        ),
      ),
    );
  }

  Color _tierColor(int index) {
    switch (index) {
      case 0:
        return Colors.white.withOpacity(0.6);
      case 1:
        return const Color(0xFF10B981);
      case 2:
        return const Color(0xFFE5C07B);
      default:
        return Colors.white;
    }
  }
}

// ══════════════════════════════════════════════════════
// KIT CARD (Editor Mode — shows components)
// ══════════════════════════════════════════════════════

class _KitCard extends StatefulWidget {
  final ProposalKit kit;
  final VoidCallback onRemove;
  final void Function(KitComponent, double) onQuantityChange;

  const _KitCard({
    required this.kit,
    required this.onRemove,
    required this.onQuantityChange,
  });

  @override
  State<_KitCard> createState() => _KitCardState();
}

class _KitCardState extends State<_KitCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF141414),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    _expanded
                        ? PhosphorIconsBold.caretDown
                        : PhosphorIconsBold.caretRight,
                    size: 12,
                    color: Colors.white.withOpacity(0.3),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.kit.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  Text(
                    '\$${widget.kit.totalSell.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontFamily: 'JetBrains Mono',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: widget.onRemove,
                    child: Icon(
                      PhosphorIconsLight.x,
                      size: 14,
                      color: Colors.white.withOpacity(0.3),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Expanded components
          if (_expanded)
            Container(
              padding: const EdgeInsets.fromLTRB(32, 0, 12, 12),
              child: Column(
                children: widget.kit.components.map((comp) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            comp.label,
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.white.withOpacity(0.5),
                            ),
                          ),
                        ),
                        // Editable quantity
                        SizedBox(
                          width: 50,
                          child: TextFormField(
                            initialValue: comp.quantity.toString(),
                            keyboardType: TextInputType.number,
                            onChanged: (val) {
                              final qty = double.tryParse(val);
                              if (qty != null) {
                                widget.onQuantityChange(comp, qty);
                              }
                            },
                            style: const TextStyle(
                              fontFamily: 'JetBrains Mono',
                              fontSize: 11,
                              color: Colors.white,
                            ),
                            decoration: InputDecoration(
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 4),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(4),
                                borderSide: BorderSide(
                                  color: Colors.white.withOpacity(0.1),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 60,
                          child: Text(
                            '\$${(comp.quantity * comp.sellPrice).toStringAsFixed(2)}',
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              fontFamily: 'JetBrains Mono',
                              fontSize: 11,
                              color: Colors.white.withOpacity(0.6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
// KIT PICKER BOTTOM SHEET
// ══════════════════════════════════════════════════════

class _KitPickerSheet extends StatefulWidget {
  final List<dynamic> kits;
  final void Function(dynamic) onSelect;

  const _KitPickerSheet({required this.kits, required this.onSelect});

  @override
  State<_KitPickerSheet> createState() => _KitPickerSheetState();
}

class _KitPickerSheetState extends State<_KitPickerSheet> {
  String _search = '';

  List<dynamic> get _filtered {
    if (_search.isEmpty) return widget.kits;
    return widget.kits.where((k) {
      final name = (k['name'] as String? ?? '').toLowerCase();
      return name.contains(_search.toLowerCase());
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            // Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Search
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _search = v),
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search kits...',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                  prefixIcon: Icon(
                    PhosphorIconsLight.magnifyingGlass,
                    color: Colors.white.withOpacity(0.3),
                    size: 18,
                  ),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.04),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),

            // Results
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                itemCount: _filtered.length,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemBuilder: (context, i) {
                  final kit = _filtered[i];
                  final sellPrice = kit['fixed_sell_price'] ??
                      kit['calculated_sell'] ??
                      0.0;

                  return ListTile(
                    onTap: () => widget.onSelect(kit),
                    title: Text(
                      kit['name'] ?? '',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    subtitle: Text(
                      kit['description'] ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 11,
                      ),
                    ),
                    trailing: Text(
                      '\$${(sellPrice as num).toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontFamily: 'JetBrains Mono',
                        color: Color(0xFF10B981),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════
// DATA MODELS
// ══════════════════════════════════════════════════════

class ProposalOption {
  final String label;
  final List<ProposalKit> kits;

  ProposalOption({required this.label, required this.kits});
}

class ProposalKit {
  final String id;
  final String name;
  final String? description;
  final List<KitComponent> components;

  ProposalKit({
    required this.id,
    required this.name,
    this.description,
    required this.components,
  });

  double get totalCost =>
      components.fold(0.0, (sum, c) => sum + c.quantity * c.unitCost);

  double get totalSell =>
      components.fold(0.0, (sum, c) => sum + c.quantity * c.sellPrice);

  factory ProposalKit.fromSupabase(dynamic data) {
    final comps = (data['kit_components'] as List<dynamic>? ?? [])
        .map((c) => KitComponent(
              label: c['label'] ?? '',
              quantity: (c['quantity'] as num?)?.toDouble() ?? 1,
              unitCost: (c['unit_cost'] as num?)?.toDouble() ?? 0,
              sellPrice: (c['sell_price'] as num?)?.toDouble() ?? 0,
              itemType: c['item_type'] ?? 'INVENTORY_ITEM',
            ))
        .toList();

    return ProposalKit(
      id: data['id'] ?? '',
      name: data['name'] ?? '',
      description: data['customer_description'] ?? data['description'],
      components: comps,
    );
  }

  Map<String, dynamic> toJson() => {
        'kit_id': id,
        'name': name,
        'components': components.map((c) => c.toJson()).toList(),
        'total_cost': totalCost,
        'total_price': totalSell,
      };
}

class KitComponent {
  final String label;
  double quantity;
  final double unitCost;
  final double sellPrice;
  final String itemType;

  KitComponent({
    required this.label,
    required this.quantity,
    required this.unitCost,
    required this.sellPrice,
    required this.itemType,
  });

  Map<String, dynamic> toJson() => {
        'label': label,
        'quantity': quantity,
        'unit_cost': unitCost,
        'sell_price': sellPrice,
        'item_type': itemType,
      };
}
