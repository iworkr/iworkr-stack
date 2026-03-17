import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:iworkr_mobile/core/services/participant_profile_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

/// The Living Dossier — Project Persona
///
/// Unified participant hub with sticky identity header, 4 tabs
/// (Overview, Clinical, History, Handover), contextual FAB, and
/// privacy-blur for sensitive fields.
class ParticipantProfileScreen extends ConsumerStatefulWidget {
  final String participantId;
  const ParticipantProfileScreen({super.key, required this.participantId});

  @override
  ConsumerState<ParticipantProfileScreen> createState() =>
      _ParticipantProfileScreenState();
}

class _ParticipantProfileScreenState
    extends ConsumerState<ParticipantProfileScreen>
    with TickerProviderStateMixin {
  late final TabController _tabCtrl;
  bool _fabExpanded = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final dossierAsync = ref.watch(participantDossierProvider(widget.participantId));

    return Scaffold(
      backgroundColor: c.canvas,
      body: dossierAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(PhosphorIconsLight.warningCircle,
                    size: 48, color: ObsidianTheme.rose),
                const SizedBox(height: 16),
                Text('Unable to load profile',
                    style: GoogleFonts.inter(
                        color: c.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text('$e',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                        color: c.textTertiary, fontSize: 12)),
                const SizedBox(height: 24),
                TextButton.icon(
                  onPressed: () => ref.invalidate(
                      participantDossierProvider(widget.participantId)),
                  icon: const Icon(PhosphorIconsLight.arrowCounterClockwise,
                      size: 16),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (dossier) => _buildContent(context, dossier),
      ),
      floatingActionButton: dossierAsync.hasValue
          ? _buildFAB(context)
          : null,
    );
  }

  Widget _buildContent(BuildContext context, ParticipantDossier d) {
    final c = context.iColors;

    return NestedScrollView(
      headerSliverBuilder: (ctx, innerBoxIsScrolled) => [
        // ── Sticky Identity Header ─────────────────────────
        SliverAppBar(
          pinned: true,
          expandedHeight: 200,
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: Icon(PhosphorIconsLight.arrowLeft,
                color: c.textPrimary, size: 20),
            onPressed: () => context.pop(),
          ),
          flexibleSpace: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
              child: FlexibleSpaceBar(
                background: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        c.surface,
                        c.canvas,
                      ],
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Avatar with Hero transition from Participant list
                          Hero(
                            tag: 'avatar_${widget.participantId}',
                            child: Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                color: ObsidianTheme.careBlue.withValues(alpha: 0.12),
                                border: Border.all(
                                  color: ObsidianTheme.careBlue.withValues(alpha: 0.20),
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  d.displayName.isNotEmpty
                                      ? d.displayName[0].toUpperCase()
                                      : '?',
                                  style: GoogleFonts.inter(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w700,
                                    color: ObsidianTheme.careBlue,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  d.displayName,
                                  style: GoogleFonts.inter(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w700,
                                    color: c.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    if (d.pronouns != null) ...[
                                      Text(d.pronouns!,
                                          style: GoogleFonts.inter(
                                              fontSize: 12,
                                              color: c.textMuted)),
                                      const SizedBox(width: 8),
                                    ],
                                    if (d.age != null)
                                      Text('${d.age} yrs',
                                          style: GoogleFonts.inter(
                                              fontSize: 12,
                                              color: c.textSecondary)),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                // Critical alert badges
                                if (d.criticalAlerts.isNotEmpty)
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: d.criticalAlerts
                                        .take(3)
                                        .map((a) => Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 3),
                                              decoration: BoxDecoration(
                                                color: ObsidianTheme.roseDim,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                                border: Border.all(
                                                    color: ObsidianTheme.rose
                                                        .withValues(
                                                            alpha: 0.3)),
                                              ),
                                              child: Text(
                                                a.toUpperCase(),
                                                style: GoogleFonts.jetBrainsMono(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w700,
                                                  color: ObsidianTheme.rose,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                            ))
                                        .toList(),
                                  ),
                                // Medical alert badges
                                if (d.medicalAlerts
                                    .any((a) => a.isCritical)) ...[
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: d.medicalAlerts
                                        .where((a) => a.isCritical)
                                        .take(3)
                                        .map((a) => Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 8,
                                                      vertical: 3),
                                              decoration: BoxDecoration(
                                                color: ObsidianTheme.roseDim,
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                      PhosphorIconsFill
                                                          .warning,
                                                      size: 10,
                                                      color:
                                                          ObsidianTheme.rose),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    a.description.toUpperCase(),
                                                    style: GoogleFonts
                                                        .jetBrainsMono(
                                                      fontSize: 9,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                      color:
                                                          ObsidianTheme.rose,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ))
                                        .toList(),
                                  ),
                                ],
                              ],
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
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(44),
            child: Container(
              color: c.canvas,
              child: TabBar(
                controller: _tabCtrl,
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: ObsidianTheme.emerald,
                unselectedLabelColor: c.textMuted,
                indicatorColor: ObsidianTheme.emerald,
                indicatorSize: TabBarIndicatorSize.label,
                dividerColor: c.border,
                labelStyle: GoogleFonts.inter(
                    fontSize: 13, fontWeight: FontWeight.w600),
                unselectedLabelStyle: GoogleFonts.inter(
                    fontSize: 13, fontWeight: FontWeight.w500),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                tabs: const [
                  Tab(text: 'Overview'),
                  Tab(text: 'Clinical'),
                  Tab(text: 'History'),
                  Tab(text: 'Handover'),
                ],
              ),
            ),
          ),
        ),
      ],
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _OverviewTab(dossier: d),
          _ClinicalTab(dossier: d),
          _HistoryTab(participantId: widget.participantId),
          _HandoverTab(participantId: widget.participantId),
        ],
      ),
    );
  }

  Widget _buildFAB(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (_fabExpanded) ...[
          _FABAction(
            label: 'Progress Note',
            icon: PhosphorIconsLight.notepad,
            color: ObsidianTheme.emerald,
            onTap: () {
              setState(() => _fabExpanded = false);
              context.push('/care/progress-notes');
            },
          ),
          const SizedBox(height: 8),
          _FABAction(
            label: 'Administer Med',
            icon: PhosphorIconsLight.pill,
            color: ObsidianTheme.careBlue,
            onTap: () {
              setState(() => _fabExpanded = false);
              context.push(
                  '/care/medications?participant_id=${widget.participantId}');
            },
          ),
          const SizedBox(height: 8),
          _FABAction(
            label: 'Log Observation',
            icon: PhosphorIconsLight.heartbeat,
            color: ObsidianTheme.amber,
            onTap: () {
              setState(() => _fabExpanded = false);
              context.push(
                  '/care/observations?participant_id=${widget.participantId}');
            },
          ),
          const SizedBox(height: 12),
        ],
        FloatingActionButton(
          backgroundColor: _fabExpanded
              ? ObsidianTheme.rose
              : ObsidianTheme.emerald,
          onPressed: () {
            HapticFeedback.lightImpact();
            setState(() => _fabExpanded = !_fabExpanded);
          },
          child: AnimatedRotation(
            turns: _fabExpanded ? 0.125 : 0,
            duration: const Duration(milliseconds: 200),
            child: Icon(
              _fabExpanded ? PhosphorIconsBold.x : PhosphorIconsBold.plus,
              color: Colors.white,
              size: 22,
            ),
          ),
        ),
      ],
    );
  }
}

class _FABAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _FABAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.borderMedium),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 8),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: c.textPrimary)),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ═══════════════════════════════════════════════════════════════════
class _OverviewTab extends StatelessWidget {
  final ParticipantDossier dossier;
  const _OverviewTab({required this.dossier});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final d = dossier;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // ── Demographics ───────────────────────────────────
        _SectionHeader(title: 'DEMOGRAPHICS & IDENTITY'),
        const SizedBox(height: 8),
        _InfoCard(children: [
          if (d.preferredName != null)
            _InfoRow(label: 'Preferred Name', value: d.preferredName!),
          if (d.pronouns != null)
            _InfoRow(label: 'Pronouns', value: d.pronouns!),
          if (d.dateOfBirth != null)
            _InfoRow(
                label: 'Date of Birth',
                value:
                    '${DateFormat.yMMMd().format(d.dateOfBirth!)} (${d.age} yrs)'),
          if (d.gender != null) _InfoRow(label: 'Gender', value: d.gender!),
          if (d.culturalBackground != null)
            _InfoRow(
                label: 'Cultural Background', value: d.culturalBackground!),
          if (d.primaryLanguage != null)
            _InfoRow(label: 'Primary Language', value: d.primaryLanguage!),
          if (d.ndisNumber != null)
            _PrivacyBlurRow(label: 'NDIS Number', value: d.ndisNumber!),
        ]),

        const SizedBox(height: 20),

        // ── Emergency & Logistics ──────────────────────────
        _SectionHeader(title: 'EMERGENCY & LOGISTICS'),
        const SizedBox(height: 8),

        if (d.emergencyContacts.isNotEmpty)
          ...d.emergencyContacts.map((ec) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _InfoCard(children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ec.name,
                                style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: c.textPrimary)),
                            Text(ec.relationship,
                                style: GoogleFonts.inter(
                                    fontSize: 12, color: c.textMuted)),
                          ],
                        ),
                      ),
                      if (ec.isPrimary)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.emeraldDim,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('PRIMARY',
                              style: GoogleFonts.jetBrainsMono(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: ObsidianTheme.emerald)),
                        ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () =>
                            launchUrl(Uri.parse('tel:${ec.phoneNumber}')),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.emeraldDim,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(PhosphorIconsFill.phone,
                              size: 16, color: ObsidianTheme.emerald),
                        ),
                      ),
                    ],
                  ),
                ]),
              )),

        if (d.address != null) ...[
          _InfoCard(children: [
            _InfoRow(label: 'Address', value: d.address!),
          ]),
          const SizedBox(height: 8),
        ],

        if (d.accessInstructions != null || d.keySafeCode != null)
          _InfoCard(children: [
            if (d.accessInstructions != null)
              _InfoRow(
                  label: 'Access Instructions', value: d.accessInstructions!),
            if (d.keySafeCode != null)
              _PrivacyBlurRow(label: 'Key Safe Code', value: d.keySafeCode!),
          ]),

        const SizedBox(height: 20),

        // ── NDIS Goals ──────────────────────────────────────
        if (d.goals.isNotEmpty) ...[
          _SectionHeader(title: 'NDIS GOALS'),
          const SizedBox(height: 8),
          ...d.goals.map((g) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _InfoCard(children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 2),
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: g.status == 'active'
                              ? ObsidianTheme.emerald
                              : c.textTertiary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.title,
                                style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: c.textPrimary)),
                            if (g.description != null) ...[
                              const SizedBox(height: 4),
                              Text(g.description!,
                                  style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: c.textSecondary,
                                      height: 1.5)),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ]),
              )),
        ],

        // ── Profile Summary ─────────────────────────────────
        if (d.profileSummary != null) ...[
          const SizedBox(height: 20),
          _SectionHeader(title: 'ABOUT'),
          const SizedBox(height: 8),
          _InfoCard(children: [
            Text(d.profileSummary!,
                style: GoogleFonts.inter(
                    fontSize: 13, color: c.textSecondary, height: 1.6)),
          ]),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: CLINICAL
// ═══════════════════════════════════════════════════════════════════
class _ClinicalTab extends StatelessWidget {
  final ParticipantDossier dossier;
  const _ClinicalTab({required this.dossier});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final d = dossier;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // ── Allergies / Critical Medical Alerts ─────────────
        if (d.medicalAlerts.any((a) => a.alertType == 'allergy')) ...[
          ...d.medicalAlerts
              .where((a) => a.alertType == 'allergy' && a.isActive)
              .map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: ObsidianTheme.rose.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: ObsidianTheme.rose.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(PhosphorIconsFill.warning,
                              size: 20, color: ObsidianTheme.rose),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('ALLERGY',
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: ObsidianTheme.rose,
                                      letterSpacing: 1,
                                    )),
                                Text(a.description,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: c.textPrimary,
                                    )),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  )),
          const SizedBox(height: 12),
        ],

        // ── Diagnoses ──────────────────────────────────────
        _SectionHeader(title: 'DIAGNOSES & DISABILITIES'),
        const SizedBox(height: 8),
        _InfoCard(children: [
          if (d.primaryDiagnosis != null)
            _InfoRow(label: 'Primary Diagnosis', value: d.primaryDiagnosis!),
          if (d.secondaryDiagnoses.isNotEmpty)
            _InfoRow(
                label: 'Secondary',
                value: d.secondaryDiagnoses.join(', ')),
        ]),

        const SizedBox(height: 20),

        // ── Medical Alerts (non-allergy) ────────────────────
        if (d.medicalAlerts
            .any((a) => a.alertType != 'allergy' && a.isActive)) ...[
          _SectionHeader(title: 'MEDICAL ALERTS'),
          const SizedBox(height: 8),
          ...d.medicalAlerts
              .where((a) => a.alertType != 'allergy' && a.isActive)
              .map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _InfoCard(children: [
                      Row(
                        children: [
                          _SeverityDot(severity: a.severity),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(a.alertType.toUpperCase(),
                                    style: GoogleFonts.jetBrainsMono(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      color: c.textMuted,
                                      letterSpacing: 1,
                                    )),
                                Text(a.description,
                                    style: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: c.textPrimary,
                                        fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ]),
                  )),
          const SizedBox(height: 12),
        ],

        // ── Mobility & Dietary ─────────────────────────────
        _SectionHeader(title: 'MOBILITY & DIETARY'),
        const SizedBox(height: 8),
        _InfoCard(children: [
          if (d.mobilityLevel != null)
            _InfoRow(
                label: 'Mobility Level',
                value: d.mobilityLevel!.replaceAll('_', ' ')),
          if (d.transferRequirement != null)
            _InfoRow(
                label: 'Transfer',
                value: d.transferRequirement!.replaceAll('_', ' ')),
          if (d.mobilityRequirements != null)
            _InfoRow(label: 'Details', value: d.mobilityRequirements!),
          if (d.dietaryRequirements.isNotEmpty)
            _InfoRow(
                label: 'Dietary',
                value: d.dietaryRequirements.join(', ')),
        ]),

        const SizedBox(height: 20),

        // ── Communication ──────────────────────────────────
        if (d.communicationType != null ||
            d.communicationPreferences != null) ...[
          _SectionHeader(title: 'COMMUNICATION'),
          const SizedBox(height: 8),
          _InfoCard(children: [
            if (d.communicationType != null)
              _InfoRow(
                  label: 'Method',
                  value: d.communicationType!.replaceAll('_', ' ')),
            if (d.communicationPreferences != null)
              _InfoRow(label: 'Preferences', value: d.communicationPreferences!),
          ]),
          const SizedBox(height: 20),
        ],

        // ── Behavioral Profile (Triggers & De-escalation) ──
        if (d.behaviors.isNotEmpty) ...[
          _SectionHeader(title: 'TRIGGERS & DE-ESCALATION'),
          const SizedBox(height: 8),
          ...d.behaviors.map((b) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: c.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (b.behaviorName != null)
                        Text(b.behaviorName!,
                            style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: c.textPrimary)),
                      if (b.requiresBsp)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: ObsidianTheme.amberDim,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text('BSP REQUIRED',
                                style: GoogleFonts.jetBrainsMono(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: ObsidianTheme.amber)),
                          ),
                        ),
                      if (b.triggerDescription != null) ...[
                        const SizedBox(height: 10),
                        Text('Known Triggers',
                            style: GoogleFonts.jetBrainsMono(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: ObsidianTheme.rose,
                                letterSpacing: 0.5)),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: b.triggerDescription!
                              .split(',')
                              .map((t) => _Chip(
                                  text: t.trim(),
                                  color: ObsidianTheme.rose))
                              .toList(),
                        ),
                      ],
                      if (b.earlyWarningSigns.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text('Early Warning Signs',
                            style: GoogleFonts.jetBrainsMono(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: ObsidianTheme.amber,
                                letterSpacing: 0.5)),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: b.earlyWarningSigns
                              .map((s) => _Chip(
                                  text: s, color: ObsidianTheme.amber))
                              .toList(),
                        ),
                      ],
                      if (b.deEscalationSteps.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text('De-escalation Strategies',
                            style: GoogleFonts.jetBrainsMono(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: ObsidianTheme.emerald,
                                letterSpacing: 0.5)),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: b.deEscalationSteps
                              .map((s) => _Chip(
                                  text: s, color: ObsidianTheme.emerald))
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              )),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: HISTORY (Unified Timeline)
// ═══════════════════════════════════════════════════════════════════
class _HistoryTab extends ConsumerStatefulWidget {
  final String participantId;
  const _HistoryTab({required this.participantId});

  @override
  ConsumerState<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends ConsumerState<_HistoryTab> {
  String? _filter; // null = all

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final timelineAsync = ref.watch(participantTimelineProvider(
        (participantId: widget.participantId, filter: _filter)));

    return Column(
      children: [
        // Filter chips
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterChip(
                    label: 'All',
                    active: _filter == null,
                    onTap: () => setState(() => _filter = null)),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Shift Notes',
                    active: _filter == 'note',
                    onTap: () => setState(() => _filter = 'note')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Meds',
                    active: _filter == 'medication',
                    onTap: () => setState(() => _filter = 'medication')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Obs',
                    active: _filter == 'observation',
                    onTap: () => setState(() => _filter = 'observation')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'Shifts',
                    active: _filter == 'shift',
                    onTap: () => setState(() => _filter = 'shift')),
                const SizedBox(width: 8),
                _FilterChip(
                    label: 'PRN Only',
                    active: _filter == 'prn',
                    onTap: () => setState(() => _filter = 'prn')),
              ],
            ),
          ),
        ),
        // Timeline
        Expanded(
          child: timelineAsync.when(
            loading: () => const Center(
                child: CircularProgressIndicator(strokeWidth: 2)),
            error: (e, _) => Center(
              child: Text('Failed to load timeline: $e',
                  style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13)),
            ),
            data: (events) {
              if (events.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.clockCounterClockwise,
                          size: 48, color: c.textTertiary),
                      const SizedBox(height: 12),
                      Text('No history yet',
                          style: GoogleFonts.inter(
                              color: c.textMuted, fontSize: 14)),
                    ],
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
                itemCount: events.length,
                separatorBuilder: (_, __) => const SizedBox(height: 6),
                itemBuilder: (context, index) {
                  final e = events[index];
                  return _TimelineCard(event: e);
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TimelineCard extends StatelessWidget {
  final TimelineEvent event;
  const _TimelineCard({required this.event});

  void _showDetail(BuildContext context) {
    final c = context.iColors;
    final data = event.metadata['submission_data'] as Map<String, dynamic>? ?? {};
    final shiftId = event.metadata['shift_id']?.toString();
    final status = event.metadata['status']?.toString();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        builder: (_, scrollCtrl) => Container(
          decoration: BoxDecoration(
            color: c.canvas,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            border: Border.all(color: c.border),
          ),
          child: ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: c.borderMedium,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Icon(
                    event.eventType == 'note' ? PhosphorIconsFill.notepad
                        : event.eventType == 'shift' ? PhosphorIconsFill.calendarCheck
                        : event.eventType == 'medication' ? PhosphorIconsFill.pill
                        : PhosphorIconsFill.heartbeat,
                    size: 20,
                    color: event.eventType == 'note' ? ObsidianTheme.emerald
                        : event.eventType == 'shift' ? ObsidianTheme.violet
                        : event.eventType == 'medication' ? ObsidianTheme.careBlue
                        : ObsidianTheme.amber,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      event.eventType == 'note' ? 'Shift Note'
                          : event.eventType == 'shift' ? 'Completed Shift'
                          : event.eventType == 'medication' ? 'Medication'
                          : 'Observation',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary),
                    ),
                  ),
                  if (status != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: status == 'submitted' ? ObsidianTheme.emeraldDim : ObsidianTheme.careBlue.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(status.toUpperCase(),
                        style: GoogleFonts.jetBrainsMono(fontSize: 9, fontWeight: FontWeight.w700,
                          color: status == 'submitted' ? ObsidianTheme.emerald : ObsidianTheme.careBlue)),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                DateFormat('EEEE, d MMMM yyyy · HH:mm').format(event.createdAt.toLocal()),
                style: GoogleFonts.inter(fontSize: 12, color: c.textTertiary),
              ),
              if (event.authorName != null) ...[
                const SizedBox(height: 2),
                Text('by ${event.authorName}',
                  style: GoogleFonts.inter(fontSize: 12, color: c.textSecondary, fontStyle: FontStyle.italic)),
              ],
              const SizedBox(height: 20),
              // Render all fields from submission_data
              if (data.isNotEmpty)
                ...data.entries.map((entry) {
                  final label = entry.key.replaceAll('_', ' ').replaceFirst(
                    entry.key[0], entry.key[0].toUpperCase(),
                  );
                  final value = entry.value?.toString() ?? '';
                  if (value.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label.toUpperCase(),
                          style: GoogleFonts.jetBrainsMono(fontSize: 10, fontWeight: FontWeight.w700, color: c.textMuted, letterSpacing: 1)),
                        const SizedBox(height: 6),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: c.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: c.border),
                          ),
                          child: Text(value,
                            style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.5)),
                        ),
                      ],
                    ),
                  );
                })
              else
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(event.summary,
                    style: GoogleFonts.inter(fontSize: 14, color: c.textPrimary, height: 1.5)),
                ),
              if (shiftId != null) ...[
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () {
                    Navigator.pop(context);
                    GoRouter.of(context).push('/care/shift/$shiftId');
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: c.borderMedium),
                    ),
                    child: Center(
                      child: Text('View Shift Details',
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: ObsidianTheme.careBlue)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    final IconData icon;
    final Color color;
    switch (event.eventType) {
      case 'note':
        icon = PhosphorIconsLight.notepad;
        color = ObsidianTheme.emerald;
        break;
      case 'shift':
        icon = PhosphorIconsLight.calendarCheck;
        color = ObsidianTheme.violet;
        break;
      case 'medication':
        icon = PhosphorIconsLight.pill;
        color = ObsidianTheme.careBlue;
        break;
      case 'observation':
        icon = PhosphorIconsLight.heartbeat;
        color = ObsidianTheme.amber;
        break;
      default:
        icon = PhosphorIconsLight.noteBlank;
        color = c.textMuted;
    }

    final isPrn = event.metadata['is_prn'] == true;

    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: isPrn
                  ? ObsidianTheme.amber.withValues(alpha: 0.3)
                  : c.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        DateFormat('HH:mm').format(event.createdAt.toLocal()),
                        style: GoogleFonts.jetBrainsMono(
                            fontSize: 11,
                            color: c.textMuted,
                            fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        DateFormat('d MMM').format(event.createdAt.toLocal()),
                        style: GoogleFonts.inter(
                            fontSize: 11, color: c.textTertiary),
                      ),
                      if (isPrn) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: ObsidianTheme.amberDim,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('PRN',
                              style: GoogleFonts.jetBrainsMono(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w700,
                                  color: ObsidianTheme.amber)),
                        ),
                      ],
                      const Spacer(),
                      Icon(PhosphorIconsLight.caretRight, size: 14, color: c.textTertiary),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(event.summary,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: c.textPrimary,
                          height: 1.4)),
                  if (event.authorName != null) ...[
                    const SizedBox(height: 4),
                    Text('— ${event.authorName}',
                        style: GoogleFonts.inter(
                            fontSize: 11,
                            color: c.textTertiary,
                            fontStyle: FontStyle.italic)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// TAB 4: HANDOVER
// ═══════════════════════════════════════════════════════════════════
class _HandoverTab extends ConsumerStatefulWidget {
  final String participantId;
  const _HandoverTab({required this.participantId});

  @override
  ConsumerState<_HandoverTab> createState() => _HandoverTabState();
}

class _HandoverTabState extends ConsumerState<_HandoverTab> {
  final _msgCtrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final messagesAsync =
        ref.watch(handoverMessagesProvider(widget.participantId));

    return Column(
      children: [
        // Messages
        Expanded(
          child: messagesAsync.when(
            loading: () => const Center(
                child: CircularProgressIndicator(strokeWidth: 2)),
            error: (e, _) => Center(
              child: Text('Unable to load handover: $e',
                  style: GoogleFonts.inter(color: c.textTertiary, fontSize: 13)),
            ),
            data: (messages) {
              if (messages.isEmpty) {
                return Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIconsLight.chatCircle,
                          size: 48, color: c.textTertiary),
                      const SizedBox(height: 12),
                      Text('No handover notes yet',
                          style: GoogleFonts.inter(
                              color: c.textMuted, fontSize: 14)),
                      const SizedBox(height: 4),
                      Text('Start a conversation about this participant',
                          style: GoogleFonts.inter(
                              color: c.textTertiary, fontSize: 12)),
                    ],
                  ),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                reverse: false,
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final m = messages[index];
                  return _HandoverBubble(message: m);
                },
              );
            },
          ),
        ),
        // Compose bar
        Container(
          padding: EdgeInsets.fromLTRB(
              16, 8, 16, MediaQuery.of(context).padding.bottom + 8),
          decoration: BoxDecoration(
            color: c.surface,
            border: Border(top: BorderSide(color: c.border)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _msgCtrl,
                  style: GoogleFonts.inter(
                      fontSize: 14, color: c.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'Write handover note...',
                    hintStyle: GoogleFonts.inter(
                        fontSize: 14, color: c.textTertiary),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: c.borderMedium),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: c.borderMedium),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          BorderSide(color: ObsidianTheme.emerald),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    isDense: true,
                    filled: true,
                    fillColor: c.canvas,
                  ),
                  maxLines: 3,
                  minLines: 1,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _sending ? null : _send,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: ObsidianTheme.emerald,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(PhosphorIconsFill.paperPlaneTilt,
                          size: 18, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await sendHandoverMessage(
        participantId: widget.participantId,
        message: text,
      );
      _msgCtrl.clear();
      ref.invalidate(handoverMessagesProvider(widget.participantId));
      if (mounted) {
        HapticFeedback.lightImpact();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }
}

class _HandoverBubble extends StatelessWidget {
  final HandoverMessage message;
  const _HandoverBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: message.isPinned
              ? ObsidianTheme.amberDim
              : c.surfaceSecondary,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: message.isPinned
                ? ObsidianTheme.amber.withValues(alpha: 0.3)
                : c.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (message.isPinned) ...[
                  Icon(PhosphorIconsFill.pushPin,
                      size: 12, color: ObsidianTheme.amber),
                  const SizedBox(width: 4),
                  Text('PINNED',
                      style: GoogleFonts.jetBrainsMono(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: ObsidianTheme.amber)),
                  const SizedBox(width: 8),
                ],
                Text(message.authorName ?? 'Staff',
                    style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: c.textSecondary)),
                const Spacer(),
                Text(DateFormat('d MMM HH:mm').format(message.createdAt.toLocal()),
                    style: GoogleFonts.inter(
                        fontSize: 11, color: c.textTertiary)),
              ],
            ),
            const SizedBox(height: 6),
            Text(message.message,
                style: GoogleFonts.inter(
                    fontSize: 13, color: c.textPrimary, height: 1.5)),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// SHARED WIDGETS
// ═══════════════════════════════════════════════════════════════════
class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Text(
      title,
      style: GoogleFonts.jetBrainsMono(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: c.textMuted,
        letterSpacing: 1.5,
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    color: c.textMuted,
                    fontWeight: FontWeight.w500)),
          ),
          Expanded(
            child: Text(value,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    color: c.textPrimary,
                    fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

class _PrivacyBlurRow extends StatefulWidget {
  final String label;
  final String value;
  const _PrivacyBlurRow({required this.label, required this.value});

  @override
  State<_PrivacyBlurRow> createState() => _PrivacyBlurRowState();
}

class _PrivacyBlurRowState extends State<_PrivacyBlurRow> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(widget.label,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    color: c.textMuted,
                    fontWeight: FontWeight.w500)),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() => _revealed = !_revealed);
              },
              child: _revealed
                  ? Text(widget.value,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: c.textPrimary,
                          fontWeight: FontWeight.w500))
                  : ClipRect(
                      child: ImageFiltered(
                        imageFilter:
                            ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                        child: Text(widget.value,
                            style: GoogleFonts.inter(
                                fontSize: 13,
                                color: c.textPrimary,
                                fontWeight: FontWeight.w500)),
                      ),
                    ),
            ),
          ),
          if (!_revealed)
            Icon(PhosphorIconsLight.eye,
                size: 14, color: c.textTertiary),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _FilterChip(
      {required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? ObsidianTheme.emeraldDim : c.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active
                ? ObsidianTheme.emerald.withValues(alpha: 0.3)
                : c.borderMedium,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            color: active ? ObsidianTheme.emerald : c.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String text;
  final Color color;
  const _Chip({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }
}

class _SeverityDot extends StatelessWidget {
  final String severity;
  const _SeverityDot({required this.severity});

  @override
  Widget build(BuildContext context) {
    final Color color;
    switch (severity) {
      case 'critical':
      case 'critical_fatal':
        color = ObsidianTheme.rose;
        break;
      case 'high':
        color = ObsidianTheme.amber;
        break;
      case 'medium':
        color = ObsidianTheme.blue;
        break;
      default:
        color = ObsidianTheme.emerald;
    }
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
