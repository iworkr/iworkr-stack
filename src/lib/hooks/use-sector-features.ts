/**
 * @hook useSectorFeatures
 * @status NEW — Project Aegis-Resolution
 * @description Sector-aware feature flag hook that builds on useIndustryLexicon.
 *
 * Provides boolean flags for sector-specific features (NDIS, eMAR, SWMS,
 * asset registry, etc.) to enable safe conditional rendering. Components
 * use these flags to avoid mounting care-specific UI for trades workspaces
 * (and vice versa), preventing API calls to non-existent endpoints and
 * null-pointer crashes from missing sector data.
 *
 * Usage:
 *   const { isCare, isTrades, showNDIS, showSWMS } = useSectorFeatures();
 *
 *   return (
 *     <div>
 *       {showNDIS && <NDISMedicationConfig />}
 *       {showSWMS && <SWMSTemplateConfig />}
 *     </div>
 *   );
 */

import { useIndustryLexicon } from "@/lib/industry-lexicon";

export interface SectorFeatures {
  /** True if the current workspace is a care-sector workspace. */
  isCare: boolean;
  /** True if the current workspace is a trades-sector workspace. */
  isTrades: boolean;
  /** The raw industry type string from the auth store. */
  industryType: string;

  // ── Care-specific features ──
  /** Show NDIS pricing catalogue, service booking, participant intake. */
  showNDIS: boolean;
  /** Show electronic Medication Administration Record (eMAR). */
  showEMAR: boolean;
  /** Show SCHADS award interpretation and payroll mapping. */
  showSCHADS: boolean;
  /** Show participant portal and care plan management. */
  showCarePortal: boolean;
  /** Show yield profile / NDIS pricing intelligence. */
  showYieldProfiles: boolean;

  // ── Trades-specific features ──
  /** Show Safe Work Method Statements (SWMS) templates. */
  showSWMS: boolean;
  /** Show commercial asset registry and maintenance schedules. */
  showAssetRegistry: boolean;
  /** Show materials / inventory tracking. */
  showMaterials: boolean;
  /** Show equipment assignment and fleet management. */
  showFleet: boolean;
}

export function useSectorFeatures(): SectorFeatures {
  const { isCare, industryType } = useIndustryLexicon();
  const isTrades = !isCare;

  return {
    isCare,
    isTrades,
    industryType,

    // Care features
    showNDIS: isCare,
    showEMAR: isCare,
    showSCHADS: isCare,
    showCarePortal: isCare,
    showYieldProfiles: isCare,

    // Trades features
    showSWMS: isTrades,
    showAssetRegistry: isTrades,
    showMaterials: isTrades,
    showFleet: isTrades,
  };
}
