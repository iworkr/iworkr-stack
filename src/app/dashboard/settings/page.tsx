import { redirect } from "next/navigation";

export default function DashboardSettingsIndexPage() {
  redirect("/settings/preferences");
}
