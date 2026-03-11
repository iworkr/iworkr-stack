import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/progress_notes_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/progress_note.dart';

// ═══════════════════════════════════════════════════════════
// ── Progress Notes — Shift Reports ───────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View shift completion reports with
// EVV (Electronic Visit Verification) GPS data.

class ProgressNotesScreen extends ConsumerWidget {
  const ProgressNotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final notesAsync = ref.watch(progressNotesStreamProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          // ── Glass App Bar ──────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/');
                }
              },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text(
              'Progress Notes',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Notes List ─────────────────────────────────
          notesAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
            ),
            data: (notes) {
              if (notes.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.notepad, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No progress notes yet', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                sliver: SliverList.separated(
                  itemCount: notes.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final note = notes[index];
                    return _ProgressNoteCard(note: note)
                        .animate()
                        .fadeIn(delay: (index * 30).ms, duration: 300.ms)
                        .moveY(begin: 12, end: 0);
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ProgressNoteCard extends StatelessWidget {
  final ProgressNote note;
  const _ProgressNoteCard({required this.note});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(PhosphorIconsLight.notepad, size: 20, color: ObsidianTheme.emerald),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (note.workerName != null)
                      Text(note.workerName!, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    Text(
                      _formatDateTime(note.createdAt),
                      style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
                    ),
                  ],
                ),
              ),
              if (note.hasEVV)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.emerald.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.mapPin, size: 12, color: ObsidianTheme.emerald),
                      const SizedBox(width: 4),
                      Text('EVV', style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: ObsidianTheme.emerald)),
                    ],
                  ),
                ),
            ],
          ),

          // Summary
          if (note.summary != null && note.summary!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              note.summary!,
              style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.4),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],

          // Meta chips
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (note.formattedDuration != '--')
                _MetaChip(icon: PhosphorIconsLight.timer, text: note.formattedDuration),
              if (note.participantMood != null)
                _MetaChip(icon: PhosphorIconsLight.smiley, text: note.participantMood!),
              if (note.participantPresent == true)
                _MetaChip(icon: PhosphorIconsLight.checkCircle, text: 'Present'),
              if (note.goalsAddressed != null)
                _MetaChip(icon: PhosphorIconsLight.target, text: 'Goals addressed'),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dt) {
    return '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MetaChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: c.textTertiary),
          const SizedBox(width: 4),
          Text(text, style: GoogleFonts.inter(fontSize: 12, color: c.textSecondary)),
        ],
      ),
    );
  }
}
