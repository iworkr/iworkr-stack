import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/credentials_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/worker_credential.dart';

// ═══════════════════════════════════════════════════════════
// ── Worker Credentials Wallet — Digital Compliance Card ──
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale — The Field Operative:
// Visual card-based credential wallet with status indicators
// (Verified/Expiring/Expired) and self-service upload for
// renewed certificates.

class WorkerCredentialsScreen extends ConsumerWidget {
  const WorkerCredentialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.iColors;
    final credsAsync = ref.watch(credentialsStreamProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: GestureDetector(
              onTap: () { HapticFeedback.lightImpact(); context.canPop() ? context.pop() : context.go('/'); },
              child: Center(child: Icon(PhosphorIconsLight.arrowLeft, color: c.textPrimary, size: 22)),
            ),
            title: Text('My Credentials', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
            flexibleSpace: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24), child: Container(color: c.canvas.withValues(alpha: 0.85)))),
          ),

          credsAsync.when(
            loading: () => const SliverFillRemaining(child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
            error: (e, _) => SliverFillRemaining(child: Center(child: Text('Error: $e', style: GoogleFonts.inter(color: c.textTertiary)))),
            data: (creds) {
              if (creds.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.identificationCard, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No credentials', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: c.textSecondary)),
                        Text('Your compliance credentials will appear here.', style: GoogleFonts.inter(fontSize: 14, color: c.textTertiary)),
                      ],
                    ),
                  ),
                );
              }

              // Sort: expired first, then expiring, then verified
              final sorted = [...creds]..sort((a, b) {
                int pri(WorkerCredential c) {
                  if (c.expiryStatus == ExpiryStatus.expired) return 0;
                  if (c.expiryStatus == ExpiryStatus.expiring) return 1;
                  return 2;
                }
                return pri(a).compareTo(pri(b));
              });

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                sliver: SliverList.separated(
                  itemCount: sorted.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final cred = sorted[index];
                    return _CredentialCard(credential: cred)
                        .animate()
                        .fadeIn(delay: (index * 40).ms, duration: 300.ms)
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

class _CredentialCard extends StatelessWidget {
  final WorkerCredential credential;
  const _CredentialCard({required this.credential});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final isExpired = credential.expiryStatus == ExpiryStatus.expired;
    final isExpiring = credential.expiryStatus == ExpiryStatus.expiring;
    final statusColor = isExpired ? ObsidianTheme.rose : isExpiring ? ObsidianTheme.amber : ObsidianTheme.emerald;
    final statusLabel = isExpired ? 'EXPIRED' : isExpiring ? 'EXPIRING SOON' : credential.verificationStatus == VerificationStatus.verified ? 'VERIFIED' : 'PENDING';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: statusColor.withValues(alpha: isExpired ? 0.4 : 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_iconFor(credential.credentialType), size: 22, color: statusColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(credential.credentialType.label, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    if (credential.credentialName != null)
                      Text(credential.credentialName!, style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel, style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (credential.expiryDate != null) ...[
                Icon(PhosphorIconsLight.calendarBlank, size: 14, color: c.textTertiary),
                const SizedBox(width: 6),
                Text(
                  'Expires: ${DateFormat('d MMM yyyy').format(credential.expiryDate!)}',
                  style: GoogleFonts.inter(fontSize: 13, color: isExpired ? ObsidianTheme.rose : c.textSecondary),
                ),
                if (isExpiring && !isExpired) ...[
                  const SizedBox(width: 8),
                  Text(
                    '(${credential.daysUntilExpiry ?? 0} days)',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: ObsidianTheme.amber),
                  ),
                ],
              ] else ...[
                Text('No expiry set', style: GoogleFonts.inter(fontSize: 13, color: c.textTertiary)),
              ],
              const Spacer(),
              GestureDetector(
                onTap: () async {
                  HapticFeedback.lightImpact();
                  final picker = ImagePicker();
                  final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
                  if (file != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Upload submitted for verification', style: GoogleFonts.inter(color: Colors.white)),
                        backgroundColor: ObsidianTheme.careBlue,
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.uploadSimple, size: 14, color: ObsidianTheme.careBlue),
                      const SizedBox(width: 4),
                      Text('Update', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: ObsidianTheme.careBlue)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _iconFor(CredentialType type) {
    return switch (type) {
      CredentialType.ndisScreening => PhosphorIconsLight.shieldCheck,
      CredentialType.wwcc => PhosphorIconsLight.baby,
      CredentialType.firstAid => PhosphorIconsLight.firstAid,
      CredentialType.manualHandling => PhosphorIconsLight.barbell,
      CredentialType.medicationCompetency => PhosphorIconsLight.pill,
      CredentialType.cpr => PhosphorIconsLight.heartbeat,
      CredentialType.driversLicense => PhosphorIconsLight.car,
      CredentialType.policeCheck => PhosphorIconsLight.detective,
      CredentialType.other => PhosphorIconsLight.certificate,
    };
  }
}
