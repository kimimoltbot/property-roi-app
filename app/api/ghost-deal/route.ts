import { NextRequest, NextResponse } from "next/server";
import { createGhostDealDraft } from "@/lib/intel/ghost-deal";
import { GhostDealInput } from "@/lib/intel/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<GhostDealInput>;

  if (!body.postcode || typeof body.purchasePrice !== "number" || typeof body.monthlyRent !== "number") {
    return NextResponse.json(
      { error: "Body must include postcode, purchasePrice, monthlyRent" },
      { status: 400 },
    );
  }

  try {
    const draft = await createGhostDealDraft({
      postcode: body.postcode,
      purchasePrice: body.purchasePrice,
      monthlyRent: body.monthlyRent,
    });

    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
