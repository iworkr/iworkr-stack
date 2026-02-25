import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/ai_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/widgets/animated_empty_state.dart';
import 'package:iworkr_mobile/models/ai_chat_message.dart';

class KnowledgeScreen extends ConsumerWidget {
  const KnowledgeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final articlesAsync = ref.watch(knowledgeArticlesProvider);
    final mq = MediaQuery.of(context);

    return Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _KnowledgeHeader(),
            const SizedBox(height: 6),
            Expanded(
              child: articlesAsync.when(
                loading: () => Center(
                  child: CircularProgressIndicator(color: ObsidianTheme.indigo, strokeWidth: 2),
                ),
                error: (e, _) => Center(
                  child: Text(
                    'Failed to load articles',
                    style: GoogleFonts.inter(color: c.textTertiary),
                  ),
                ),
                data: (articles) {
                  if (articles.isEmpty) {
                    return const AnimatedEmptyState(
                      type: EmptyStateType.crate,
                      title: 'No Manuals Yet',
                      subtitle: 'Equipment manuals and schematics\nwill appear here.',
                    );
                  }

                  final grouped = <String, List<KnowledgeArticle>>{};
                  for (final a in articles) {
                    final key = a.manufacturer ?? 'General';
                    grouped.putIfAbsent(key, () => []).add(a);
                  }
                  final keys = grouped.keys.toList()..sort();

                  return ListView.builder(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: EdgeInsets.fromLTRB(20, 8, 20, mq.padding.bottom + 20),
                    itemCount: keys.length,
                    itemBuilder: (context, index) {
                      final mfg = keys[index];
                      final items = grouped[mfg]!;
                      return _ManufacturerSection(
                        manufacturer: mfg,
                        articles: items,
                        delay: index,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Header ──────────────────────────────────────────
class _KnowledgeHeader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: c.border,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(PhosphorIconsLight.arrowLeft, color: c.textSecondary, size: 20),
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'THE ARCHIVE',
                    style: GoogleFonts.jetBrainsMono(
                      color: c.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.5,
                    ),
                  ),
                  Text(
                    'Knowledge Base & Manuals',
                    style: GoogleFonts.inter(color: c.textTertiary, fontSize: 12),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: ObsidianTheme.indigo.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(PhosphorIconsLight.magnifyingGlass, color: ObsidianTheme.indigo, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search manuals, schematics, guides...',
              hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 13),
              filled: true,
              fillColor: Colors.transparent,
              contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 12),
              prefixIcon: Icon(PhosphorIconsLight.magnifyingGlass, color: c.textTertiary, size: 18),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .moveY(begin: -8, duration: 400.ms, curve: Curves.easeOutCubic);
  }
}

// ── Manufacturer Section ────────────────────────────
class _ManufacturerSection extends StatelessWidget {
  final String manufacturer;
  final List<KnowledgeArticle> articles;
  final int delay;

  const _ManufacturerSection({
    required this.manufacturer,
    required this.articles,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (delay > 0) const SizedBox(height: 20),
        Text(
          manufacturer.toUpperCase(),
          style: GoogleFonts.jetBrainsMono(
            color: c.textTertiary,
            fontSize: 11,
            fontWeight: FontWeight.w500,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 10),
        ...articles.asMap().entries.map((entry) {
          final idx = entry.key;
          final article = entry.value;
          return _ArticleCard(article: article)
              .animate()
              .fadeIn(
                delay: Duration(milliseconds: 100 * delay + 60 * idx),
                duration: 400.ms,
              )
              .moveX(
                begin: 16,
                delay: Duration(milliseconds: 100 * delay + 60 * idx),
                duration: 400.ms,
                curve: Curves.easeOutCubic,
              );
        }),
      ],
    );
  }
}

// ── Article Card ────────────────────────────────────
class _ArticleCard extends StatelessWidget {
  final KnowledgeArticle article;
  const _ArticleCard({required this.article});

  IconData get _fileIcon {
    switch (article.fileType) {
      case 'pdf':
        return PhosphorIconsLight.filePdf;
      case 'image':
        return PhosphorIconsLight.fileImage;
      default:
        return PhosphorIconsLight.file;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: c.hoverBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            HapticFeedback.lightImpact();
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: ObsidianTheme.indigo.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_fileIcon, color: ObsidianTheme.indigo, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        article.title,
                        style: GoogleFonts.inter(
                          color: c.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          if (article.modelNumber != null) ...[
                            Text(
                              article.modelNumber!,
                              style: GoogleFonts.jetBrainsMono(
                                color: c.textTertiary,
                                fontSize: 11,
                              ),
                            ),
                            _Dot(),
                          ],
                          Text(
                            article.fileSizeLabel.isNotEmpty
                                ? article.fileSizeLabel
                                : article.fileType.toUpperCase(),
                            style: GoogleFonts.jetBrainsMono(
                              color: c.textTertiary,
                              fontSize: 11,
                            ),
                          ),
                          if (article.isPinned) ...[
                            _Dot(),
                            Icon(PhosphorIconsLight.pushPin, color: ObsidianTheme.emerald, size: 12),
                            const SizedBox(width: 3),
                            Text(
                              'PINNED',
                              style: GoogleFonts.jetBrainsMono(
                                color: ObsidianTheme.emerald,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(PhosphorIconsLight.caretRight, color: c.textTertiary, size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Container(
        width: 3,
        height: 3,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: c.textTertiary.withValues(alpha: 0.5),
        ),
      ),
    );
  }
}
