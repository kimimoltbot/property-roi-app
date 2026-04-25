import { NextRequest, NextResponse } from 'next/server'
import { extractListingFromUrl } from '@/lib/intel/url-extract'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string }
    const url = body.url?.trim()

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only http(s) URLs are supported' }, { status: 400 })
    }

    const extracted = await extractListingFromUrl(parsed.toString())
    return NextResponse.json(extracted)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to extract listing URL' },
      { status: 500 },
    )
  }
}
