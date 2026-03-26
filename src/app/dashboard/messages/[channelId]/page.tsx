"use client";

import { useParams } from "next/navigation";
import { MessagesView } from "../page";

export default function MessageChannelPage() {
  const params = useParams<{ channelId: string }>();
  const channelId = params?.channelId ?? null;

  return <MessagesView routeChannelId={channelId} />;
}
