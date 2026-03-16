import 'package:flutter/material.dart';
import 'package:iworkr_mobile/core/services/supabase_service.dart';

class FamilyPortalScreen extends StatefulWidget {
  const FamilyPortalScreen({super.key});

  @override
  State<FamilyPortalScreen> createState() => _FamilyPortalScreenState();
}

class _FamilyPortalScreenState extends State<FamilyPortalScreen> {
  int _tab = 0;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _participants = [];
  String? _activeParticipantId;
  List<Map<String, dynamic>> _roster = [];
  List<Map<String, dynamic>> _messages = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final user = SupabaseService.auth.currentUser;
    if (user == null) {
      setState(() {
        _loading = false;
        _error = 'Not authenticated';
      });
      return;
    }
    try {
      final links = await SupabaseService.client
          .from('participant_network_members')
          .select('participant_id, participant_profiles!inner(id, preferred_name, clients!inner(name))')
          .eq('user_id', user.id);

      final mapped = (links as List).map((row) {
        final pp = row['participant_profiles'] as Map<String, dynamic>;
        final clients = pp['clients'] as Map<String, dynamic>?;
        final name = (pp['preferred_name'] as String?) ?? (clients?['name'] as String?) ?? 'Participant';
        return {
          'participant_id': row['participant_id'] as String,
          'participant_name': name,
        };
      }).toList();

      final active = mapped.isNotEmpty ? mapped.first['participant_id'] as String : null;

      List<Map<String, dynamic>> roster = [];
      List<Map<String, dynamic>> messages = [];
      if (active != null) {
        final now = DateTime.now().toUtc().toIso8601String();
        final shifts = await SupabaseService.client
            .from('schedule_blocks')
            .select('id, title, start_time, end_time, status')
            .eq('participant_id', active)
            .gte('start_time', now)
            .order('start_time', ascending: true)
            .limit(30);
        roster = (shifts as List).cast<Map<String, dynamic>>();

        final channel = await SupabaseService.client
            .from('care_chat_channels')
            .select('id')
            .eq('participant_id', active)
            .eq('channel_type', 'house_external')
            .maybeSingle();
        if (channel != null) {
          final msgs = await SupabaseService.client
              .from('care_chat_messages')
              .select('id, content, created_at')
              .eq('channel_id', channel['id'])
              .eq('is_deleted', false)
              .order('created_at', ascending: false)
              .limit(20);
          messages = (msgs as List).cast<Map<String, dynamic>>();
        }
      }

      setState(() {
        _participants = mapped.cast<Map<String, dynamic>>();
        _activeParticipantId = active;
        _roster = roster;
        _messages = messages;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Failed to load portal';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      appBar: AppBar(
        backgroundColor: const Color(0xFF050505),
        title: const Text('Family Portal'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.white70)))
              : Column(
                  children: [
                    if (_participants.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: DropdownButtonFormField<String>(
                          initialValue: _activeParticipantId,
                          decoration: const InputDecoration(
                            filled: true,
                            fillColor: Color(0xFF111111),
                            border: OutlineInputBorder(),
                          ),
                          dropdownColor: const Color(0xFF111111),
                          items: _participants
                              .map((p) => DropdownMenuItem<String>(
                                    value: p['participant_id'] as String,
                                    child: Text(p['participant_name'] as String),
                                  ))
                              .toList(),
                          onChanged: (_) {},
                        ),
                      ),
                    Expanded(child: _buildTab()),
                  ],
                ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF0A0A0A),
        selectedItemColor: const Color(0xFF3B82F6),
        unselectedItemColor: Colors.white60,
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today_outlined), label: 'Roster'),
          BottomNavigationBarItem(icon: Icon(Icons.people_alt_outlined), label: 'Care Team'),
        ],
      ),
    );
  }

  Widget _buildTab() {
    if (_tab == 0) {
      final next = _roster.isNotEmpty ? _roster.first : null;
      return ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            color: const Color(0xFF111111),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: next == null
                  ? const Text('No upcoming shifts', style: TextStyle(color: Colors.white70))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('What is happening next?', style: TextStyle(color: Colors.white54)),
                        const SizedBox(height: 8),
                        Text(next['title']?.toString() ?? 'Support Shift', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(next['start_time']?.toString() ?? '', style: const TextStyle(color: Colors.white70)),
                      ],
                    ),
            ),
          ),
        ],
      );
    }
    if (_tab == 1) {
      return ListView.builder(
        itemCount: _roster.length,
        itemBuilder: (context, index) {
          final shift = _roster[index];
          return ListTile(
            title: Text(shift['title']?.toString() ?? 'Support Shift', style: const TextStyle(color: Colors.white)),
            subtitle: Text(shift['start_time']?.toString() ?? '', style: const TextStyle(color: Colors.white70)),
          );
        },
      );
    }
    return ListView.builder(
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final msg = _messages[index];
        return ListTile(
          title: Text(msg['content']?.toString() ?? '', style: const TextStyle(color: Colors.white)),
          subtitle: Text(msg['created_at']?.toString() ?? '', style: const TextStyle(color: Colors.white70)),
        );
      },
    );
  }
}
