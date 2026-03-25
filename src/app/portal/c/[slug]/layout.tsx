/**
 * @layout PortalTenantLayout
 * @status COMPLETE
 * @description White-labeled tenant portal layout with dynamic branding injection,
 *   idle timeout, and entity switcher for multi-grant portal users.
 * @lastAudit 2026-03-24
 */
import { getWorkspacePortalConfig } from "@/app/actions/portal-client";
import { PortalTenantShell } from "@/components/portal/portal-tenant-shell";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = await getWorkspacePortalConfig(slug);
  return {
    title: config.ok
      ? `${config.app_name} — Client Portal`
      : "Portal Not Found",
    description: config.ok
      ? `Secure client portal for ${config.name}`
      : "This portal is not available.",
  };
}

export default async function PortalTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = await getWorkspacePortalConfig(slug);

  if (!config.ok) {
    notFound();
  }

  return (
    <PortalTenantShell config={config} slug={slug}>
      {children}
    </PortalTenantShell>
  );
}
