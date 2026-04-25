type Confidence = 'high' | 'medium' | 'low'

type SupportedSource = 'rightmove' | 'zoopla' | 'propertyhub' | 'unknown'

export type ListingExtractField = {
  value: string | number | null
  confidence: Confidence
  method: string
}

export type ListingExtractResult = {
  url: string
  source: SupportedSource
  extractedAt: string
  fields: {
    title: ListingExtractField
    postcode: ListingExtractField
    purchasePrice: ListingExtractField
    monthlyRent: ListingExtractField
  }
  warnings: string[]
  overallConfidence: Confidence
  rawSignals: Record<string, unknown>
}

function clampConfidence(score: number): Confidence {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function scoreField(value: unknown, base = 0) {
  if (value === null || value === undefined || value === '') return { score: 0, confidence: 'low' as const }
  const score = Math.min(100, base)
  return { score, confidence: clampConfidence(score) }
}

function detectSource(hostname: string): SupportedSource {
  const host = hostname.toLowerCase()
  if (host.includes('rightmove')) return 'rightmove'
  if (host.includes('zoopla')) return 'zoopla'
  if (host.includes('propertyhub')) return 'propertyhub'
  return 'unknown'
}

function normalisePostcode(candidate: string) {
  const compact = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length < 5) return candidate.trim().toUpperCase()
  return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractJsonLd(html: string) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const parsed: unknown[] = []

  for (const match of matches) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      parsed.push(JSON.parse(raw))
    } catch {
      // ignore malformed blocks
    }
  }

  return parsed
}

function firstString(values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function pickPrice(text: string, provider: SupportedSource) {
  const labels = provider === 'rightmove'
    ? ['price', 'guide price', 'offers over', 'offers in excess of']
    : provider === 'zoopla'
      ? ['price', 'offers over', 'guide price']
      : ['price', 'rent', 'pcm']

  for (const label of labels) {
    const pattern = new RegExp(`${label}[^£]{0,25}£?\\s*([\\d,]{4,9})`, 'i')
    const match = text.match(pattern)
    if (match?.[1]) {
      const value = Number(match[1].replace(/,/g, ''))
      if (Number.isFinite(value) && value > 20000) return value
    }
  }

  const generic = text.match(/£\s*([\d,]{5,9})/)
  if (!generic?.[1]) return null
  const value = Number(generic[1].replace(/,/g, ''))
  return Number.isFinite(value) && value > 20000 ? value : null
}

function pickMonthlyRent(text: string) {
  const patterns = [
    /£\s*([\d,]{3,7})\s*(?:pcm|per calendar month)/i,
    /rent[^£]{0,20}£\s*([\d,]{3,7})\s*(?:pcm|per month)/i,
    /let agreed[^£]{0,20}£\s*([\d,]{3,7})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const value = Number(match[1].replace(/,/g, ''))
    if (Number.isFinite(value) && value > 250 && value < 25000) return value
  }

  return null
}

function pickPostcode(text: string) {
  const match = text.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i)
  return match?.[1] ? normalisePostcode(match[1]) : null
}

function findInJsonLd(jsonLd: unknown[]) {
  let title: string | null = null
  let postcode: string | null = null
  let purchasePrice: number | null = null
  let monthlyRent: number | null = null

  const nodes = jsonLd.flatMap((entry) => {
    if (Array.isArray(entry)) return entry
    if (entry && typeof entry === 'object' && '@graph' in entry && Array.isArray((entry as Record<string, unknown>)['@graph'])) {
      return (entry as Record<string, unknown>)['@graph'] as unknown[]
    }
    return [entry]
  })

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const obj = node as Record<string, unknown>

    title ||= firstString([obj.name, obj.headline, obj.description])

    const address = (obj.address && typeof obj.address === 'object' ? obj.address as Record<string, unknown> : null)
    const postal = firstString([address?.postalCode, obj.postalCode])
    if (!postcode && postal) postcode = normalisePostcode(postal)

    const offers = obj.offers
    const offerNodes = Array.isArray(offers) ? offers : offers ? [offers] : []
    for (const offer of offerNodes) {
      if (!offer || typeof offer !== 'object') continue
      const offerObj = offer as Record<string, unknown>
      const priceCandidate = Number(offerObj.price)
      if (!purchasePrice && Number.isFinite(priceCandidate) && priceCandidate > 20000) {
        purchasePrice = priceCandidate
      }
      const category = firstString([offerObj.category, offerObj.name])?.toLowerCase() ?? ''
      if (!monthlyRent && category.includes('rent') && Number.isFinite(priceCandidate) && priceCandidate > 250 && priceCandidate < 25000) {
        monthlyRent = priceCandidate
      }
    }
  }

  return { title, postcode, purchasePrice, monthlyRent }
}

export async function extractListingFromUrl(inputUrl: string): Promise<ListingExtractResult> {
  const extractedAt = new Date().toISOString()
  const parsed = new URL(inputUrl)
  const source = detectSource(parsed.hostname)
  const warnings: string[] = []

  const response = await fetch(parsed.toString(), {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; QuickSizeUpBot/1.0; +https://property-roi-app.local)',
      accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Listing fetch failed (${response.status})`)
  }

  const html = await response.text()
  const text = stripHtml(html)
  const jsonLd = extractJsonLd(html)
  const jsonFields = findInJsonLd(jsonLd)

  const title = jsonFields.title ?? firstString([
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim(),
    text.slice(0, 140),
  ])

  const postcode = jsonFields.postcode ?? pickPostcode(text)
  const purchasePrice = jsonFields.purchasePrice ?? pickPrice(text, source)
  const monthlyRent = jsonFields.monthlyRent ?? pickMonthlyRent(text)

  if (source === 'unknown') warnings.push('Unrecognised listing domain. Attempted source-agnostic extraction.')
  if (!purchasePrice) warnings.push('Purchase price signal is weak or missing.')
  if (!monthlyRent) warnings.push('Monthly rent signal not found. Please enter manually.')
  if (!postcode) warnings.push('Postcode not confidently extracted. Please verify manually.')

  const titleScore = scoreField(title, jsonFields.title ? 75 : 45)
  const postcodeScore = scoreField(postcode, jsonFields.postcode ? 85 : 50)
  const purchaseScore = scoreField(purchasePrice, jsonFields.purchasePrice ? 85 : 55)
  const rentScore = scoreField(monthlyRent, jsonFields.monthlyRent ? 80 : 45)

  const averageScore = Math.round((titleScore.score + postcodeScore.score + purchaseScore.score + rentScore.score) / 4)

  return {
    url: parsed.toString(),
    source,
    extractedAt,
    fields: {
      title: { value: title, confidence: titleScore.confidence, method: jsonFields.title ? 'json-ld' : 'html-text' },
      postcode: { value: postcode, confidence: postcodeScore.confidence, method: jsonFields.postcode ? 'json-ld' : 'regex' },
      purchasePrice: { value: purchasePrice, confidence: purchaseScore.confidence, method: jsonFields.purchasePrice ? 'json-ld' : 'regex' },
      monthlyRent: { value: monthlyRent, confidence: rentScore.confidence, method: jsonFields.monthlyRent ? 'json-ld' : 'regex' },
    },
    warnings,
    overallConfidence: clampConfidence(averageScore),
    rawSignals: {
      hostname: parsed.hostname,
      jsonLdBlocks: jsonLd.length,
      textLength: text.length,
    },
  }
}
