import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/credentials_provider.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/models/worker_credential.dart';

// ═══════════════════════════════════════════════════════════
// ── Credentials Management Screen ────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Project Nightingale: View and manage worker compliance
// credentials (NDIS screening, WWCC, First Aid, etc.)

class CredentialsScreen extends ConsumerStatefulWidget {
  const CredentialsScreen({super.key});

  @override
  ConsumerState<CredentialsScreen> createState() => _CredentialsScreenState();
}

class _CredentialsScreenState extends ConsumerState<CredentialsScreen> {
  String _searchQuery = '';
  VerificationStatus? _filterStatus;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final credentialsAsync = ref.watch(credentialsStreamProvider);
    final stats = ref.watch(credentialStatsProvider);

    return Scaffold(
      backgroundColor: c.canvas,
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddCredentialSheet(context),
        backgroundColor: ObsidianTheme.emerald,
        child: const Icon(PhosphorIconsFill.plus, color: Colors.black, size: 24),
      ),
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
              'Credentials',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3),
            ),
            flexibleSpace: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(color: c.canvas.withValues(alpha: 0.85)),
              ),
            ),
          ),

          // ── Stats Row ────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  _StatChip(label: 'Total', value: stats.total, color: ObsidianTheme.textSecondary),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Verified', value: stats.verified, color: ObsidianTheme.emerald),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Expiring', value: stats.expiring, color: ObsidianTheme.amber),
                  const SizedBox(width: 8),
                  _StatChip(label: 'Expired', value: stats.expired, color: ObsidianTheme.rose),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms).moveY(begin: 8, end: 0),
          ),

          // ── Search + Filter ─────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: c.border),
                      ),
                      child: TextField(
                        onChanged: (v) => setState(() => _searchQuery = v),
                        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Search credentials...',
                          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
                          prefixIcon: Icon(PhosphorIconsLight.magnifyingGlass, size: 18, color: c.textTertiary),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: _filterStatus?.name ?? 'All',
                    isActive: _filterStatus != null,
                    onTap: () {
                      setState(() {
                        if (_filterStatus == null) {
                          _filterStatus = VerificationStatus.pending;
                        } else if (_filterStatus == VerificationStatus.pending) {
                          _filterStatus = VerificationStatus.verified;
                        } else if (_filterStatus == VerificationStatus.verified) {
                          _filterStatus = VerificationStatus.expired;
                        } else {
                          _filterStatus = null;
                        }
                      });
                    },
                  ),
                ],
              ),
            ),
          ),

          // ── Credential List ─────────────────────────
          credentialsAsync.when(
            loading: () => const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (e, _) => SliverFillRemaining(
              child: Center(child: Text('Error: $e', style: TextStyle(color: c.textTertiary))),
            ),
            data: (credentials) {
              var filtered = credentials;
              if (_searchQuery.isNotEmpty) {
                filtered = filtered.where((c) =>
                    (c.credentialName ?? c.credentialType.label).toLowerCase().contains(_searchQuery.toLowerCase()) ||
                    (c.workerName ?? '').toLowerCase().contains(_searchQuery.toLowerCase())).toList();
              }
              if (_filterStatus != null) {
                filtered = filtered.where((c) => c.verificationStatus == _filterStatus).toList();
              }

              if (filtered.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(PhosphorIconsLight.shieldCheck, size: 48, color: c.textDisabled),
                        const SizedBox(height: 12),
                        Text('No credentials found', style: GoogleFonts.inter(color: c.textTertiary, fontSize: 15)),
                      ],
                    ),
                  ),
                );
              }

              return SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                sliver: SliverList.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final cred = filtered[index];
                    return _CredentialCard(credential: cred)
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

  void _showAddCredentialSheet(BuildContext context) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _AddCredentialSheet(),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _StatChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Text('$value', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 11, color: c.textTertiary)),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.15) : c.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isActive ? ObsidianTheme.emerald.withValues(alpha: 0.3) : c.border),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIconsLight.funnel, size: 16, color: isActive ? ObsidianTheme.emerald : c.textTertiary),
            const SizedBox(width: 6),
            Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500,
                color: isActive ? ObsidianTheme.emerald : c.textSecondary)),
          ],
        ),
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
    final expiry = credential.expiryStatus;
    final statusColor = switch (credential.verificationStatus) {
      VerificationStatus.verified => ObsidianTheme.emerald,
      VerificationStatus.pending => ObsidianTheme.amber,
      VerificationStatus.rejected => ObsidianTheme.rose,
      VerificationStatus.expired => ObsidianTheme.rose,
    };
    final expiryColor = switch (expiry) {
      ExpiryStatus.valid => ObsidianTheme.emerald,
      ExpiryStatus.expiring => ObsidianTheme.amber,
      ExpiryStatus.expired => ObsidianTheme.rose,
      ExpiryStatus.unknown => c.textTertiary,
    };

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
          Row(
            children: [
              Icon(PhosphorIconsLight.shieldCheck, size: 20, color: statusColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  credential.credentialName ?? credential.credentialType.label,
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  credential.verificationStatus.name.toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (credential.workerName != null) ...[
                Icon(PhosphorIconsLight.user, size: 14, color: c.textTertiary),
                const SizedBox(width: 4),
                Text(credential.workerName!, style: GoogleFonts.inter(fontSize: 13, color: c.textSecondary)),
                const SizedBox(width: 12),
              ],
              if (credential.expiryDate != null) ...[
                Icon(PhosphorIconsLight.calendar, size: 14, color: expiryColor),
                const SizedBox(width: 4),
                Text(
                  credential.daysUntilExpiry != null
                      ? (credential.daysUntilExpiry! < 0
                          ? 'Expired ${-credential.daysUntilExpiry!}d ago'
                          : '${credential.daysUntilExpiry!}d remaining')
                      : '--',
                  style: GoogleFonts.inter(fontSize: 13, color: expiryColor),
                ),
              ],
            ],
          ),
          if (credential.credentialType != CredentialType.other) ...[
            const SizedBox(height: 6),
            Text(
              credential.credentialType.label,
              style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
            ),
          ],
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// ── Add Credential Bottom Sheet ──────────────────────────
// ═══════════════════════════════════════════════════════════

class _AddCredentialSheet extends ConsumerStatefulWidget {
  const _AddCredentialSheet();

  @override
  ConsumerState<_AddCredentialSheet> createState() => _AddCredentialSheetState();
}

class _AddCredentialSheetState extends ConsumerState<_AddCredentialSheet> {
  final _nameCtrl = TextEditingController();
  final _authorityCtrl = TextEditingController();
  CredentialType _selectedType = CredentialType.firstAid;
  DateTime? _issueDate;
  DateTime? _expiryDate;
  bool _submitting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _authorityCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate({required bool isIssue}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isIssue
          ? (_issueDate ?? DateTime.now())
          : (_expiryDate ?? DateTime.now().add(const Duration(days: 365))),
      firstDate: DateTime(2000),
      lastDate: DateTime(2040),
      builder: (context, child) {
        final c = context.iColors;
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.dark(
              primary: ObsidianTheme.emerald,
              onPrimary: Colors.black,
              surface: c.canvas,
              onSurface: c.textPrimary,
            ),
            dialogTheme: DialogThemeData(
              backgroundColor: c.canvas,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isIssue) {
          _issueDate = picked;
        } else {
          _expiryDate = picked;
        }
      });
    }
  }

  String _formatDate(DateTime dt) =>
      '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) return;

    setState(() => _submitting = true);
    try {
      final user = SupabaseService.auth.currentUser;
      if (user == null) throw Exception('Not authenticated');

      await createCredential(
        userId: user.id,
        credentialType: _selectedType,
        credentialName: _nameCtrl.text.trim(),
        issuedDate: _issueDate,
        expiryDate: _expiryDate,
        notes: _authorityCtrl.text.trim().isNotEmpty
            ? 'Issuing Authority: ${_authorityCtrl.text.trim()}'
            : null,
      );

      HapticFeedback.mediumImpact();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Credential added',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.emerald,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add credential: $e',
                style: GoogleFonts.inter(color: Colors.white)),
            backgroundColor: ObsidianTheme.rose,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: BoxDecoration(
        color: c.canvas,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: c.borderMedium, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          Text('Add Credential', style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
          const SizedBox(height: 20),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                // ── Credential Type Selector ──────────────
                Text('CREDENTIAL TYPE', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: CredentialType.values.map((type) {
                    final isSelected = _selectedType == type;
                    return GestureDetector(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _selectedType = type);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? ObsidianTheme.emerald.withValues(alpha: 0.15) : c.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected ? ObsidianTheme.emerald.withValues(alpha: 0.4) : c.border,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              PhosphorIconsLight.shieldCheck,
                              size: 14,
                              color: isSelected ? ObsidianTheme.emerald : c.textTertiary,
                            ),
                            const SizedBox(width: 6),
                            Text(type.label, style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: isSelected ? ObsidianTheme.emerald : c.textSecondary,
                            )),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // ── Credential Name ───────────────────────
                Text('CREDENTIAL NAME', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _CredTextField(
                  controller: _nameCtrl,
                  hint: 'e.g. HLTAID011 First Aid Certificate',
                ),
                const SizedBox(height: 16),

                // ── Issuing Authority ─────────────────────
                Text('ISSUING AUTHORITY', style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                const SizedBox(height: 6),
                _CredTextField(
                  controller: _authorityCtrl,
                  hint: 'e.g. St John Ambulance',
                ),
                const SizedBox(height: 16),

                // ── Date Pickers ──────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('ISSUE DATE', style: GoogleFonts.jetBrainsMono(
                              fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () => _pickDate(isIssue: true),
                            child: Container(
                              height: 48,
                              decoration: BoxDecoration(
                                color: c.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: c.border),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              alignment: Alignment.centerLeft,
                              child: Row(
                                children: [
                                  Icon(PhosphorIconsLight.calendar, size: 16, color: c.textTertiary),
                                  const SizedBox(width: 8),
                                  Text(
                                    _issueDate != null ? _formatDate(_issueDate!) : 'Select',
                                    style: GoogleFonts.inter(fontSize: 14,
                                        color: _issueDate != null ? c.textPrimary : c.textTertiary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('EXPIRY DATE', style: GoogleFonts.jetBrainsMono(
                              fontSize: 11, fontWeight: FontWeight.w600, color: c.textTertiary, letterSpacing: 0.8)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () => _pickDate(isIssue: false),
                            child: Container(
                              height: 48,
                              decoration: BoxDecoration(
                                color: c.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: c.border),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 14),
                              alignment: Alignment.centerLeft,
                              child: Row(
                                children: [
                                  Icon(PhosphorIconsLight.calendarX, size: 16,
                                      color: _expiryDate != null && _expiryDate!.isBefore(DateTime.now())
                                          ? ObsidianTheme.rose
                                          : c.textTertiary),
                                  const SizedBox(width: 8),
                                  Text(
                                    _expiryDate != null ? _formatDate(_expiryDate!) : 'Select',
                                    style: GoogleFonts.inter(fontSize: 14,
                                        color: _expiryDate != null ? c.textPrimary : c.textTertiary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),

          // ── Submit Button ──────────────────────────────
          Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ObsidianTheme.emerald,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                    : Text('Add Credential', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CredTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final int maxLines;

  const _CredTextField({
    required this.controller,
    required this.hint,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(fontSize: 14, color: c.textTertiary),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }
}
