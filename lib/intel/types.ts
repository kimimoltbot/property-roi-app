export type SourceStatus = "live" | "fallback" | "unavailable";
export type Confidence = "high" | "medium" | "low";

export interface SourceMeta {
  provider: string;
  status: SourceStatus;
  confidence: Confidence;
  fetchedAt: string;
  notes?: string;
  ttlSeconds: number;
  cacheHit?: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CrimeIntel {
  incidentsLastMonth: number | null;
  topCategories: Array<{ category: string; count: number }>;
  period: string | null;
  source: SourceMeta;
}

export interface EpcIntel {
  currentRating: string | null;
  potentialRating: string | null;
  currentEfficiency: number | null;
  potentialEfficiency: number | null;
  source: SourceMeta;
}

export interface SchoolsIntel {
  radiusMiles: number;
  totalSchoolsConsidered: number | null;
  goodOrOutstandingCount: number | null;
  outstandingCount: number | null;
  source: SourceMeta;
}

export interface ConnectivityIntel {
  ultrafastAvailable: boolean | null;
  technology: string[];
  source: SourceMeta;
}

export interface LicensingIntel {
  knownOverride: boolean;
  y1: number;
  y6: number;
  y11: number;
  notes?: string;
  source: SourceMeta;
}

export interface PostcodeIntelBundle {
  postcode: string;
  normalizedPostcode: string;
  coordinates: Coordinates | null;
  crime: CrimeIntel;
  epc: EpcIntel;
  schools: SchoolsIntel;
  connectivity: ConnectivityIntel;
  licensing: LicensingIntel;
  generatedAt: string;
}

export interface GhostDealInput {
  postcode: string;
  purchasePrice: number;
  monthlyRent: number;
}

export interface GhostDealDraft {
  dealId: string;
  scenario: "GHOST";
  comparableAnchors: ["FOX", "NEWCASTLE"];
  postcode: string;
  purchasePrice: number;
  monthlyRent: number;
  annualRent: number;
  grossYieldPct: number;
  intel: PostcodeIntelBundle;
  assumptions: {
    licensingProvision: { y1: number; y6: number; y11: number };
  };
  createdAt: string;
}
