import { NextRequest, NextResponse } from "next/server";
import { getLicensingProvision } from "@/lib/intel/service";

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "postcode query param is required" }, { status: 400 });

  return NextResponse.json(getLicensingProvision(postcode));
}
