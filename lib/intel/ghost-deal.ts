import { GhostDealDraft, GhostDealInput } from "@/lib/intel/types";
import { getPostcodeIntel } from "@/lib/intel/service";

function validateInput(input: GhostDealInput): { valid: boolean; error?: string } {
  if (!input.postcode?.trim()) return { valid: false, error: "postcode is required" };
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice <= 0) {
    return { valid: false, error: "purchasePrice must be a positive number" };
  }
  if (!Number.isFinite(input.monthlyRent) || input.monthlyRent <= 0) {
    return { valid: false, error: "monthlyRent must be a positive number" };
  }
  return { valid: true };
}

export async function createGhostDealDraft(input: GhostDealInput): Promise<GhostDealDraft> {
  const check = validateInput(input);
  if (!check.valid) throw new Error(check.error);

  const intel = await getPostcodeIntel(input.postcode);
  const annualRent = input.monthlyRent * 12;
  const grossYieldPct = Number(((annualRent / input.purchasePrice) * 100).toFixed(2));

  return {
    dealId: `ghost-${Date.now()}`,
    scenario: "GHOST",
    comparableAnchors: ["FOX", "NEWCASTLE"],
    postcode: intel.normalizedPostcode,
    purchasePrice: input.purchasePrice,
    monthlyRent: input.monthlyRent,
    annualRent,
    grossYieldPct,
    intel,
    assumptions: {
      licensingProvision: {
        y1: intel.licensing.y1,
        y6: intel.licensing.y6,
        y11: intel.licensing.y11,
      },
    },
    createdAt: new Date().toISOString(),
  };
}
