"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Camera, Building2, Globe, Receipt, Clock, MapPin } from "lucide-react";
import { SettingRow, SettingSection, Select } from "@/components/settings/settings-toggle";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useAuthStore } from "@/lib/auth-store";
import { useTeamStore } from "@/lib/team-store";
import { Shimmer } from "@/components/ui/shimmer";

const timezones = [
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST, UTC+10)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST/AEDT)" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST, UTC+8)" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide (ACST/ACDT)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
];

const currencies = [
  { value: "AUD", label: "AUD ($)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "NZD", label: "NZD ($)" },
  { value: "CAD", label: "CAD ($)" },
];

const dateFormats = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

export default function WorkspacePage() {
  const { currentOrg } = useAuthStore();
  const memberCount = useTeamStore((s) => s.members.length);
  const {
    orgName, orgSlug, orgLogoUrl, orgTrade, orgSettings, loading,
    updateOrgField, updateOrgSettingsField, updateOrgSettingsBatch,
  } = useSettingsStore();

  // Local state for controlled inputs
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [trade, setTrade] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");

  // Sync from store on load
  useEffect(() => {
    if (orgName) setName(orgName);
    if (orgSlug) setSlug(orgSlug);
    if (orgTrade) setTrade(orgTrade);
    if (orgSettings?.tax_id) setTaxId(orgSettings.tax_id);
    if (orgSettings?.address) setAddress(orgSettings.address);
  }, [orgName, orgSlug, orgTrade, orgSettings]);

  // Debounced save helpers
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSave = useCallback((fn: () => void) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(fn, 600);
  }, []);

  function handleNameBlur() {
    if (name.trim() && name !== orgName) {
      updateOrgField("name", name.trim());
    }
  }

  function handleSlugBlur() {
    const clean = slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (clean && clean !== orgSlug) {
      updateOrgField("slug", clean);
    }
  }

  function handleTradeBlur() {
    if (trade !== orgTrade) {
      updateOrgField("trade", trade);
    }
  }

  function handleTaxIdBlur() {
    if (taxId !== (orgSettings?.tax_id || "")) {
      updateOrgSettingsField("tax_id", taxId);
    }
  }

  function handleAddressBlur() {
    if (address !== (orgSettings?.address || "")) {
      updateOrgSettingsField("address", address);
    }
  }

  const tz = orgSettings?.timezone || "Australia/Brisbane";
  const currency = orgSettings?.currency || "AUD";
  const dateFormat = orgSettings?.date_format || "DD/MM/YYYY";
  const defaultTaxRate = orgSettings?.default_tax_rate ?? 10;
  const paymentTerms = orgSettings?.default_payment_terms ?? 14;

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Workspace
      </h1>

      {/* Logo + name */}
      <div className="mb-8 flex items-center gap-5">
        <div className="relative">
          <img
            src={orgLogoUrl || "/logos/logo-dark-streamline.png"}
            alt={name || "Workspace"}
            className="h-14 w-14 rounded-xl object-contain"
          />
          <button className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.15)] bg-[#141414] text-zinc-400 transition-colors hover:text-zinc-200">
            <Camera size={11} />
          </button>
        </div>
        <div>
          <div className="text-[14px] font-medium text-zinc-200">
            {name || <Shimmer className="h-4 w-32" />}
          </div>
          <div className="text-[12px] text-zinc-600">
            {memberCount > 0 ? `${memberCount} members` : <Shimmer className="inline-block h-3 w-16" />}
          </div>
        </div>
      </div>

      {/* General Information */}
      <SettingSection title="General">
        <SettingRow label="Workspace name" description="Your company or team name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            className="w-[220px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
            placeholder="Acme Electrical"
          />
        </SettingRow>
        <SettingRow label="Workspace URL" description="Your unique workspace URL slug">
          <div className="flex items-center rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px]">
            <span className="text-zinc-600">iworkr.app/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={handleSlugBlur}
              className="w-[130px] bg-transparent text-zinc-200 outline-none"
            />
          </div>
        </SettingRow>
        <SettingRow label="Trade / Industry" description="Primary service area">
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            onBlur={handleTradeBlur}
            className="w-[220px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
            placeholder="Electrical, Plumbing, HVAC..."
          />
        </SettingRow>
      </SettingSection>

      {/* Tax & Billing */}
      <SettingSection title="Tax & billing">
        <SettingRow label="Tax / ABN ID" description="Displayed on invoices and estimates">
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            onBlur={handleTaxIdBlur}
            className="w-[220px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
            placeholder="ABN 12 345 678 901"
          />
        </SettingRow>
        <SettingRow label="Default tax rate (%)" description="Applied to new invoices">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={defaultTaxRate}
            onChange={(e) => updateOrgSettingsField("default_tax_rate", parseFloat(e.target.value) || 0)}
            className="w-[100px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
          />
        </SettingRow>
        <SettingRow label="Default payment terms (days)" description="Due date calculation for invoices">
          <input
            type="number"
            min={0}
            max={365}
            value={paymentTerms}
            onChange={(e) => updateOrgSettingsField("default_payment_terms", parseInt(e.target.value) || 14)}
            className="w-[100px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
          />
        </SettingRow>
        <SettingRow label="Currency" description="Default currency for invoices">
          <Select
            value={currency}
            options={currencies}
            onChange={(v) => updateOrgSettingsField("currency", v)}
          />
        </SettingRow>
      </SettingSection>

      {/* Location & Timezone */}
      <SettingSection title="Location & time">
        <SettingRow label="Timezone" description="Used for scheduling and date display">
          <Select
            value={tz}
            options={timezones}
            onChange={(v) => updateOrgSettingsField("timezone", v)}
          />
        </SettingRow>
        <SettingRow label="Date format" description="How dates appear across the app">
          <Select
            value={dateFormat}
            options={dateFormats}
            onChange={(v) => updateOrgSettingsField("date_format", v)}
          />
        </SettingRow>
        <SettingRow label="Headquarters address" description="Main office or depot location">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={handleAddressBlur}
            className="w-[280px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
            placeholder="123 Main St, Brisbane QLD 4000"
          />
        </SettingRow>
      </SettingSection>

      {/* Danger zone */}
      <div className="mb-8">
        <div className="rounded-lg border border-red-500/20 bg-[rgba(255,255,255,0.02)] px-5 py-4">
          <h3 className="mb-1.5 text-[14px] font-medium text-red-400/80">Danger zone</h3>
          <p className="mb-3 text-[12px] text-zinc-600">
            Permanently delete this workspace and all of its data. This action cannot be undone.
          </p>
          <button className="rounded-md border border-red-500/30 px-3 py-1.5 text-[12px] text-red-400/80 transition-colors hover:bg-red-500/10">
            Delete workspace
          </button>
        </div>
      </div>
    </>
  );
}
