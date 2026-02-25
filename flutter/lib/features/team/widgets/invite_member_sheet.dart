import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:iworkr_mobile/core/services/team_provider.dart';
import 'package:iworkr_mobile/core/theme/iworkr_colors.dart';
import 'package:iworkr_mobile/core/theme/obsidian_theme.dart';

// ═══════════════════════════════════════════════════════════
// ── Invite Member Bottom Sheet ───────────────────────────
// ═══════════════════════════════════════════════════════════

class InviteMemberSheet extends ConsumerStatefulWidget {
  const InviteMemberSheet({super.key});

  @override
  ConsumerState<InviteMemberSheet> createState() => _InviteMemberSheetState();
}

class _InviteMemberSheetState extends ConsumerState<InviteMemberSheet> {
  final _emailCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  String _selectedRole = 'technician';
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _emailCtrl.text.trim();
    final name = _nameCtrl.text.trim();

    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Please enter a valid email address.');
      return;
    }
    if (name.isEmpty) {
      setState(() => _error = 'Please enter the team member\'s name.');
      return;
    }

    setState(() { _sending = true; _error = null; });

    final success = await ref.read(teamProvider.notifier).inviteMember(
      email: email,
      fullName: name,
      role: _selectedRole,
    );

    if (mounted) {
      if (success) {
        HapticFeedback.heavyImpact();
        Navigator.pop(context);
      } else {
        setState(() { _sending = false; _error = 'Failed to send invite. Please try again.'; });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    final mq = MediaQuery.of(context);

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(
          top: BorderSide(color: c.border),
          left: BorderSide(color: c.border),
          right: BorderSide(color: c.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 24, mq.viewInsets.bottom + mq.padding.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(color: c.borderHover, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 20),
              Text('Invite Team Member', style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary, letterSpacing: -0.3)),
              const SizedBox(height: 4),
              Text('They\'ll receive a magic link to join your workspace.', style: GoogleFonts.inter(fontSize: 13, color: c.textMuted)),
              const SizedBox(height: 20),

              _StealthField(controller: _emailCtrl, label: 'Email Address', keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 14),

              _StealthField(controller: _nameCtrl, label: 'Full Name'),
              const SizedBox(height: 14),

              Text('ROLE', style: GoogleFonts.jetBrainsMono(fontSize: 10, color: c.textTertiary, letterSpacing: 1.5)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  _RoleChip(label: 'Admin', value: 'admin', selected: _selectedRole == 'admin', onTap: () => setState(() => _selectedRole = 'admin')),
                  _RoleChip(label: 'Dispatcher', value: 'manager', selected: _selectedRole == 'manager', onTap: () => setState(() => _selectedRole = 'manager')),
                  _RoleChip(label: 'Technician', value: 'technician', selected: _selectedRole == 'technician', onTap: () => setState(() => _selectedRole = 'technician')),
                ],
              ),

              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: GoogleFonts.inter(fontSize: 12, color: ObsidianTheme.rose)),
              ],

              const SizedBox(height: 24),

              GestureDetector(
                onTap: _sending ? null : _send,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: _sending ? Colors.white70 : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: _sending
                        ? const CupertinoActivityIndicator(color: Colors.black)
                        : Text('Send Invite', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.black)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Stealth Field ────────────────────────────────────────

class _StealthField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final TextInputType keyboardType;

  const _StealthField({
    required this.controller,
    required this.label,
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: c.surfaceSecondary,
        border: Border.all(color: c.border),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: GoogleFonts.inter(color: c.textPrimary, fontSize: 14),
        cursorColor: ObsidianTheme.emerald,
        decoration: InputDecoration(
          hintText: label,
          hintStyle: GoogleFonts.inter(color: c.textTertiary, fontSize: 14),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    );
  }
}

// ── Role Chip ────────────────────────────────────────────

class _RoleChip extends StatelessWidget {
  final String label;
  final String value;
  final bool selected;
  final VoidCallback onTap;

  const _RoleChip({required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.iColors;
    return GestureDetector(
      onTap: () { HapticFeedback.selectionClick(); onTap(); },
      child: AnimatedContainer(
        duration: ObsidianTheme.fast,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: selected ? Colors.white.withValues(alpha: 0.1) : c.hoverBg,
          border: Border.all(color: selected ? c.borderHover : c.border),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: selected ? c.textPrimary : c.textMuted,
          ),
        ),
      ),
    );
  }
}
