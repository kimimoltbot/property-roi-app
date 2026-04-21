import { NextRequest, NextResponse } from "next/server";
import { getPostcodeIntel } from "@/lib/intel/service";

export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode");
  if (!postcode) {
    return NextResponse.json({ error: "postcode query param is required" }, { status: 400 });
  }

  const intel = await getPostcodeIntel(postcode);
  return NextResponse.json(intel);
}
