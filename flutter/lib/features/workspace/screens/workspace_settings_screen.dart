import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'package:iworkr_mobile/core/services/supabase_service.dart';
import 'package:iworkr_mobile/core/services/workspace_provider.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';
import 'package:iworkr_mobile/core/widgets/glass_card.dart';
import 'package:iworkr_mobile/core/widgets/stealth_icon.dart';

/// Workspace Settings — Admin-only branding, billing, and danger zone.
class WorkspaceSettingsScreen extends ConsumerStatefulWidget {
  const WorkspaceSettingsScreen({super.key});

  @override
  ConsumerState<WorkspaceSettingsScreen> createState() =>
      _WorkspaceSettingsScreenState();
}

class _WorkspaceSettingsScreenState
    extends ConsumerState<WorkspaceSettingsScreen> {
  final _nameCtrl = TextEditingController();
  final _tradeCtrl = TextEditingController();
  bool _saving = false;
  bool _loaded = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _tradeCtrl.dispose();
    super.dispose();
  }

  void _populateFields(Workspace ws) {
    if (_loaded) return;
    _nameCtrl.text = ws.name;
    _tradeCtrl.text = ws.trade ?? '';
    _loaded = true;
  }

  Future<void> _saveChanges(Workspace ws) async {
    if (_saving) return;
    setState(() => _saving = true);
    HapticFeedback.mediumImpact();

    try {
      await SupabaseService.client
          .from('organizations')
          .update({
            'name': _nameCtrl.text.trim(),
            'trade': _tradeCtrl.text.trim().isEmpty
                ? null
                : _tradeCtrl.text.trim(),
          })
          .eq('id', ws.organizationId);

      ref.invalidate(allWorkspacesProvider);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Workspace updated',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.emerald,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.rose,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showLeaveConfirm(Workspace ws) {
    HapticFeedback.heavyImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ObsidianTheme.surface2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Leave Workspace?',
          style: GoogleFonts.inter(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: ObsidianTheme.textPrimary,
          ),
        ),
        content: Text(
          'You will lose access to "${ws.name}" and all its data. This action cannot be undone.',
          style: GoogleFonts.inter(
            fontSize: 13,
            color: ObsidianTheme.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: ObsidianTheme.textMuted)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _leaveWorkspace(ws);
            },
            child: Text('Leave',
                style: GoogleFonts.inter(color: ObsidianTheme.rose)),
          ),
        ],
      ),
    );
  }

  Future<void> _leaveWorkspace(Workspace ws) async {
    HapticFeedback.heavyImpact();
    final userId = SupabaseService.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await SupabaseService.client
          .from('organization_members')
          .update({'status': 'inactive'})
          .eq('organization_id', ws.organizationId)
          .eq('user_id', userId);

      ref.invalidate(allWorkspacesProvider);

      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error leaving workspace: $e',
              style: GoogleFonts.inter(color: Colors.white)),
          backgroundColor: ObsidianTheme.rose,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final wsAsync = ref.watch(activeWorkspaceProvider);

    return Scaffold(
      backgroundColor: ObsidianTheme.void_,
      body: SafeArea(
        bottom: false,
        child: wsAsync.when(
          data: (ws) {
            if (ws == null) {
              return Center(
                child: Text(
                  'No active workspace',
                  style: GoogleFonts.inter(
                      fontSize: 14, color: ObsidianTheme.textMuted),
                ),
              );
            }

            _populateFields(ws);

            if (!ws.isAdmin) {
              return _buildReadOnly(ws);
            }

            return _buildAdminView(ws);
          },
          loading: () => const Center(
            child: CircularProgressIndicator(
                strokeWidth: 2, color: ObsidianTheme.emerald),
          ),
          error: (e, _) => Center(
            child: Text('Error: $e',
                style: GoogleFonts.inter(
                    fontSize: 13, color: ObsidianTheme.rose)),
          ),
        ),
      ),
    );
  }

  Widget _buildAdminView(Workspace ws) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      children: [
        // ── Header ──
        Row(
          children: [
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).pop();
              },
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  border: Border.all(color: ObsidianTheme.border),
                  color: ObsidianTheme.surface1,
                ),
                child: const Center(
                  child: Icon(PhosphorIconsLight.arrowLeft,
                      size: 18, color: ObsidianTheme.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Workspace Settings',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: ObsidianTheme.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
            ),
          ],
        )
            .animate()
            .fadeIn(duration: 300.ms, curve: Curves.easeOutCubic),

        const SizedBox(height: 24),

        // ── Branding Section ──
        _sectionLabel('BRANDING'),
        const SizedBox(height: 10),

        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Logo preview
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                    border: Border.all(
                        color:
                            ObsidianTheme.emerald.withValues(alpha: 0.2)),
                    image: ws.logoUrl != null
                        ? DecorationImage(
                            image: NetworkImage(ws.logoUrl!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: ws.logoUrl == null
                      ? Center(
                          child: Text(
                            ws.initials,
                            style: GoogleFonts.inter(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: ObsidianTheme.emerald,
                            ),
                          ),
                        )
                      : null,
                ),
              ),

              const SizedBox(height: 20),

              // Name field
              Text('Company Name',
                  style: GoogleFonts.inter(
                      fontSize: 11, color: ObsidianTheme.textMuted)),
              const SizedBox(height: 6),
              TextField(
                controller: _nameCtrl,
                style: GoogleFonts.inter(
                    fontSize: 14, color: ObsidianTheme.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Enter company name',
                  hintStyle: GoogleFonts.inter(
                      fontSize: 14, color: ObsidianTheme.textDisabled),
                ),
              ),

              const SizedBox(height: 16),

              // Trade field
              Text('Trade / Industry',
                  style: GoogleFonts.inter(
                      fontSize: 11, color: ObsidianTheme.textMuted)),
              const SizedBox(height: 6),
              TextField(
                controller: _tradeCtrl,
                style: GoogleFonts.inter(
                    fontSize: 14, color: ObsidianTheme.textPrimary),
                decoration: InputDecoration(
                  hintText: 'e.g. Plumbing, Electrical',
                  hintStyle: GoogleFonts.inter(
                      fontSize: 14, color: ObsidianTheme.textDisabled),
                ),
              ),

              const SizedBox(height: 20),

              // Save button
              GestureDetector(
                onTap: _saving ? null : () => _saveChanges(ws),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: ObsidianTheme.emerald,
                  ),
                  child: Center(
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'Save Changes',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: 100.ms, duration: 400.ms)
            .moveY(begin: 12, delay: 100.ms, duration: 400.ms),

        const SizedBox(height: 28),

        // ── Members Count ──
        _sectionLabel('TEAM'),
        const SizedBox(height: 10),

        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              const StealthIcon(PhosphorIconsLight.users, size: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Manage Team Members',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: ObsidianTheme.textPrimary,
                  ),
                ),
              ),
              const Icon(PhosphorIconsLight.caretRight,
                  size: 14, color: ObsidianTheme.textTertiary),
            ],
          ),
          onTap: () {
            HapticFeedback.lightImpact();
          },
        )
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms)
            .moveY(begin: 12, delay: 200.ms, duration: 400.ms),

        const SizedBox(height: 28),

        // ── Danger Zone ──
        _sectionLabel('DANGER ZONE'),
        const SizedBox(height: 10),

        GlassCard(
          borderColor: ObsidianTheme.rose.withValues(alpha: 0.15),
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _dangerRow(
                icon: PhosphorIconsLight.signOut,
                label: 'Leave Workspace',
                sublabel:
                    'You will lose access to all data in this workspace.',
                onTap: () => _showLeaveConfirm(ws),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: 300.ms, duration: 400.ms)
            .moveY(begin: 12, delay: 300.ms, duration: 400.ms),
      ],
    );
  }

  Widget _buildReadOnly(Workspace ws) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                Navigator.of(context).pop();
              },
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  borderRadius: ObsidianTheme.radiusMd,
                  border: Border.all(color: ObsidianTheme.border),
                  color: ObsidianTheme.surface1,
                ),
                child: const Center(
                  child: Icon(PhosphorIconsLight.arrowLeft,
                      size: 18, color: ObsidianTheme.textSecondary),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Workspace Info',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: ObsidianTheme.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
            ),
          ],
        )
            .animate()
            .fadeIn(duration: 300.ms),

        const SizedBox(height: 24),

        GlassCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                  border: Border.all(
                      color: ObsidianTheme.emerald.withValues(alpha: 0.2)),
                  image: ws.logoUrl != null
                      ? DecorationImage(
                          image: NetworkImage(ws.logoUrl!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: ws.logoUrl == null
                    ? Center(
                        child: Text(
                          ws.initials,
                          style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: ObsidianTheme.emerald,
                          ),
                        ),
                      )
                    : null,
              ),
              const SizedBox(height: 16),
              Text(
                ws.name,
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: ObsidianTheme.textPrimary,
                ),
              ),
              if (ws.trade != null) ...[
                const SizedBox(height: 4),
                Text(
                  ws.trade!,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: ObsidianTheme.textMuted,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: ObsidianTheme.emerald.withValues(alpha: 0.1),
                ),
                child: Text(
                  ws.role.toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: ObsidianTheme.emerald,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: 100.ms, duration: 400.ms)
            .moveY(begin: 12, delay: 100.ms, duration: 400.ms),

        const SizedBox(height: 28),

        _sectionLabel('DANGER ZONE'),
        const SizedBox(height: 10),

        GlassCard(
          borderColor: ObsidianTheme.rose.withValues(alpha: 0.15),
          padding: const EdgeInsets.all(16),
          child: _dangerRow(
            icon: PhosphorIconsLight.signOut,
            label: 'Leave Workspace',
            sublabel:
                'You will lose access to all data in this workspace.',
            onTap: () => _showLeaveConfirm(ws),
          ),
        )
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms)
            .moveY(begin: 12, delay: 200.ms, duration: 400.ms),
      ],
    );
  }

  Widget _sectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: ObsidianTheme.textTertiary,
          letterSpacing: 1.5,
        ),
      ),
    );
  }

  Widget _dangerRow({
    required IconData icon,
    required String label,
    required String sublabel,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          StealthIcon(icon, size: 18, isDestructive: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: ObsidianTheme.rose,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  sublabel,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: ObsidianTheme.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
