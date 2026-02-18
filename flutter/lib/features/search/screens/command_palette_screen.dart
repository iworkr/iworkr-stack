import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:iworkr_mobile/core/services/search_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/features/jobs/screens/create_job_sheet.dart';
import 'package:iworkr_mobile/features/scan/screens/scanner_screen.dart';

/// Shows the Command Palette as a full-screen glass overlay.
void showCommandPalette(BuildContext context) {
  HapticFeedback.lightImpact();
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: false,
      pageBuilder: (_, __, ___) => const CommandPaletteScreen(),
      transitionsBuilder: (_, animation, __, child) {
        return FadeTransition(opacity: animation, child: child);
      },
      transitionDuration: const Duration(milliseconds: 150),
      reverseTransitionDuration: const Duration(milliseconds: 100),
    ),
  );
}

class CommandPaletteScreen extends ConsumerStatefulWidget {
  const CommandPaletteScreen({super.key});

  @override
  ConsumerState<CommandPaletteScreen> createState() => _CommandPaletteScreenState();
}

class _CommandPaletteScreenState extends ConsumerState<CommandPaletteScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    // Reset query on exit
    Future.microtask(() {
      if (mounted) return;
    });
    super.dispose();
  }

  void _onQueryChanged(String value) {
    ref.read(searchQueryProvider.notifier).state = value;
  }

  void _onResultTap(SearchResult result) {
    HapticFeedback.lightImpact();
    Navigator.of(context).pop();

    // Reset search state
    ref.read(searchQueryProvider.notifier).state = '';

    if (result.type == SearchResultType.action && result.id == 'action-new-job') {
      showCreateJobSheet(context);
      return;
    }

    if (result.route != null) {
      context.push(result.route!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(searchQueryProvider);
    final resultsAsync = ref.watch(searchResultsProvider);

    return GestureDetector(
      onTap: () {
        Navigator.of(context).pop();
        ref.read(searchQueryProvider.notifier).state = '';
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              color: ObsidianTheme.void_.withValues(alpha: 0.92),
              child: SafeArea(
                child: GestureDetector(
                  onTap: () {},
                  child: Column(
                    children: [
                      // ── Search Input ────────────────────
                      _buildSearchInput(query),

                      // ── Results / Zero State ────────────
                      Expanded(
                        child: query.isEmpty
                            ? _buildZeroState()
                            : resultsAsync.when(
                                data: (results) => results.isEmpty
                                    ? _buildEmptyResults()
                                    : _buildResultsList(results, query),
                                loading: () => _buildResultsList([], query),
                                error: (_, __) => _buildEmptyResults(),
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Search Input ────────────────────────────────────

  Widget _buildSearchInput(String query) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: ObsidianTheme.border)),
      ),
      child: Row(
        children: [
          AnimatedSwitcher(
            duration: ObsidianTheme.fast,
            child: Icon(
              PhosphorIconsLight.magnifyingGlass,
              key: ValueKey(query.isNotEmpty),
              size: 20,
              color: query.isNotEmpty ? Colors.white : ObsidianTheme.textTertiary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              onChanged: _onQueryChanged,
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: Colors.white,
                letterSpacing: -0.3,
              ),
              cursorColor: ObsidianTheme.emerald,
              cursorWidth: 2,
              decoration: InputDecoration(
                hintText: 'Type a command or search...',
                hintStyle: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  color: ObsidianTheme.textTertiary,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
              ),
            ),
          ),
          if (query.isNotEmpty)
            GestureDetector(
              onTap: () {
                _controller.clear();
                _onQueryChanged('');
              },
              child: Container(
                width: 24, height: 24,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  color: ObsidianTheme.shimmerBase,
                ),
                child: const Center(child: Icon(PhosphorIconsLight.x, size: 12, color: ObsidianTheme.textTertiary)),
              ),
            ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () {
              Navigator.of(context).pop();
              ref.read(searchQueryProvider.notifier).state = '';
            },
            child: Text(
              'Cancel',
              style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textSecondary),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 150.ms);
  }

  // ── Zero State (Recent + Quick Actions) ─────────────

  Widget _buildZeroState() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
      children: [
        // Quick Actions
        _buildSectionHeader('QUICK ACTIONS'),
        const SizedBox(height: 10),
        _buildQuickActionChips(),

        const SizedBox(height: 28),

        // Suggested Commands
        _buildSectionHeader('COMMANDS'),
        const SizedBox(height: 8),
        ...quickActions.asMap().entries.map((entry) {
          return _buildResultRow(entry.value, '', entry.key);
        }),

        const SizedBox(height: 28),

        // Keyboard shortcut hint
        Center(
          child: Text(
            'Start typing to search jobs, clients, assets & team',
            style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textTertiary),
          ),
        ).animate().fadeIn(delay: 300.ms, duration: 400.ms),
      ],
    );
  }

  Widget _buildQuickActionChips() {
    final chips = [
      ('New Job', PhosphorIconsLight.plus, () => showCreateJobSheet(context)),
      ('My Schedule', PhosphorIconsLight.calendarBlank, () { Navigator.pop(context); context.go('/schedule'); }),
      ('Scan QR', PhosphorIconsLight.qrCode, () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ScannerScreen()))),
    ];

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (label, icon, action) = chips[i];
          return GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
              ref.read(searchQueryProvider.notifier).state = '';
              action();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusFull,
                color: ObsidianTheme.shimmerBase,
                border: Border.all(color: ObsidianTheme.border),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 14, color: ObsidianTheme.textSecondary),
                  const SizedBox(width: 8),
                  Text(label, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.textSecondary, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ).animate().fadeIn(delay: Duration(milliseconds: 100 + i * 60), duration: 300.ms);
        },
      ),
    );
  }

  // ── Results List ────────────────────────────────────

  Widget _buildResultsList(List<SearchResult> results, String query) {
    // Group by type
    final grouped = <SearchResultType, List<SearchResult>>{};
    for (final r in results) {
      grouped.putIfAbsent(r.type, () => []).add(r);
    }

    final sections = grouped.entries.toList();
    int globalIndex = 0;

    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (n is ScrollUpdateNotification && _focusNode.hasFocus) {
          _focusNode.unfocus();
        }
        return false;
      },
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        itemCount: sections.fold<int>(0, (sum, s) => sum + 1 + s.value.length),
        itemBuilder: (_, index) {
          int offset = 0;
          for (final section in sections) {
            if (index == offset) {
              return Padding(
                padding: EdgeInsets.only(top: offset > 0 ? 16 : 0, bottom: 6),
                child: _buildSectionHeader(_typeLabel(section.key)),
              );
            }
            offset++;
            for (int i = 0; i < section.value.length; i++) {
              if (index == offset) {
                return _buildResultRow(section.value[i], query, globalIndex++);
              }
              offset++;
              globalIndex++;
            }
          }
          return const SizedBox.shrink();
        },
      ),
    );
  }

  String _typeLabel(SearchResultType type) {
    switch (type) {
      case SearchResultType.action:
        return 'ACTIONS';
      case SearchResultType.job:
        return 'JOBS';
      case SearchResultType.client:
        return 'CLIENTS';
      case SearchResultType.asset:
        return 'ASSETS';
      case SearchResultType.team:
        return 'TEAM';
    }
  }

  Widget _buildSectionHeader(String text) {
    return Text(
      text,
      style: GoogleFonts.jetBrainsMono(fontSize: 10, color: ObsidianTheme.textTertiary, letterSpacing: 1.5),
    );
  }

  // ── Result Row ──────────────────────────────────────

  Widget _buildResultRow(SearchResult result, String query, int index) {
    IconData icon;
    Color iconColor;
    switch (result.type) {
      case SearchResultType.job:
        icon = PhosphorIconsLight.briefcase;
        iconColor = ObsidianTheme.blue;
      case SearchResultType.client:
        icon = PhosphorIconsLight.user;
        iconColor = ObsidianTheme.textSecondary;
      case SearchResultType.asset:
        icon = PhosphorIconsLight.cube;
        iconColor = ObsidianTheme.amber;
      case SearchResultType.team:
        icon = PhosphorIconsLight.userCircle;
        iconColor = ObsidianTheme.emerald;
      case SearchResultType.action:
        icon = PhosphorIconsLight.lightning;
        iconColor = ObsidianTheme.emerald;
    }

    return GestureDetector(
      onTap: () => _onResultTap(result),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        margin: const EdgeInsets.only(bottom: 2),
        decoration: BoxDecoration(
          borderRadius: ObsidianTheme.radiusMd,
        ),
        child: Row(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                borderRadius: ObsidianTheme.radiusMd,
                color: iconColor.withValues(alpha: 0.1),
              ),
              child: Center(child: Icon(icon, size: 16, color: iconColor)),
            ),
            const SizedBox(width: 12),

            // Mono ID (if available)
            if (result.mono != null) ...[
              Text(
                result.mono!,
                style: GoogleFonts.jetBrainsMono(fontSize: 11, color: ObsidianTheme.textTertiary),
              ),
              const SizedBox(width: 8),
            ],

            // Title with highlight
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHighlightedText(result.title, query),
                  if (result.subtitle.isNotEmpty)
                    Text(
                      result.subtitle,
                      style: GoogleFonts.inter(fontSize: 11, color: ObsidianTheme.textTertiary),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),

            // Arrow
            Icon(PhosphorIconsLight.caretRight, size: 14, color: ObsidianTheme.textTertiary),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: 30 + index * 20), duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1))
        .moveY(begin: 6, end: 0, delay: Duration(milliseconds: 30 + index * 20), duration: 300.ms, curve: const Cubic(0.16, 1, 0.3, 1));
  }

  /// Highlights matched query text as White/Bold, rest as Zinc-400
  Widget _buildHighlightedText(String text, String query) {
    if (query.isEmpty) {
      return Text(
        text,
        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white),
        maxLines: 1, overflow: TextOverflow.ellipsis,
      );
    }

    final lowerText = text.toLowerCase();
    final lowerQuery = query.toLowerCase();
    final matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex < 0) {
      return Text(
        text,
        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500, color: ObsidianTheme.textSecondary),
        maxLines: 1, overflow: TextOverflow.ellipsis,
      );
    }

    return RichText(
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: GoogleFonts.inter(fontSize: 14, color: ObsidianTheme.textSecondary),
        children: [
          if (matchIndex > 0)
            TextSpan(text: text.substring(0, matchIndex)),
          TextSpan(
            text: text.substring(matchIndex, matchIndex + query.length),
            style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.white),
          ),
          if (matchIndex + query.length < text.length)
            TextSpan(text: text.substring(matchIndex + query.length)),
        ],
      ),
    );
  }

  // ── Empty Results ───────────────────────────────────

  Widget _buildEmptyResults() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AnimatedEmptyState(
            type: EmptyStateType.radar,
            title: 'No signal found in sector',
            subtitle: 'Try a different search term.',
          ),
        ],
      ),
    );
  }
}
