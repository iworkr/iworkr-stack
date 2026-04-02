/**
 * @page app/dashboard/messages/[channelId]/page.tsx
 * @status STABLE
 * @description Route — dashboard/messages/[channelId]
 * @lastReview 2026-03-28
 */
"use client";

import { useParams } from "next/navigation";
import { MessagesView } from "../page";

export default function MessageChannelPage() {
  const params = useParams<{ channelId: string }>();
  const channelId = params?.channelId ?? null;

  return <MessagesView routeChannelId={channelId} />;
}
