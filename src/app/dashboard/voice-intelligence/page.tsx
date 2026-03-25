/**
 * @page /dashboard/voice-intelligence
 * @status COMPLETE
 * @description Project Siren-Voice — AI Voice Intelligence dashboard for call history,
 *   AI receptionist actions audit, transcripts, and telephony analytics
 * @dataSource server-action
 * @lastAudit 2026-03-24
 */

import { AiCallPanel } from "@/components/cti/ai-call-panel";

export default function VoiceIntelligencePage() {
  return <AiCallPanel />;
}
