import { redirect } from "next/navigation";

export default async function LegacySettingsBridge({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  redirect(`/dashboard/settings/${slug.join("/")}`);
}
