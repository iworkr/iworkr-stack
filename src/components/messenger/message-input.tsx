/**
 * @component MessageInput
 * @status COMPLETE
 * @description Backward-compatible messenger composer wrapper
 * @lastAudit 2026-03-26
 */
"use client";

import { ChatInput } from "@/components/chat/ChatInput";

interface MessageInputProps {
  channelId: string;
  userId: string;
  userProfile: { id: string; full_name: string; avatar_url: string | null };
}

export function MessageInput({ channelId, userId, userProfile }: MessageInputProps) {
  return <ChatInput channelId={channelId} userId={userId} userProfile={userProfile} />;
}
