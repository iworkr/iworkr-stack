import { redirect } from "next/navigation";

export default function FleetIndexPage() {
  redirect("/dashboard/fleet/overview");
}
