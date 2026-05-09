# Property ROI App

> **Status: Paused intentionally (2026-05-09).**
> See [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) for pause context, frozen state, and resume checklist.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Phase 2: Postcode Intelligence + Ghost Deal APIs

### New API Endpoints

- `GET /api/intel?postcode=SW1A%201AA`
- `GET /api/intel/crime?postcode=SW1A%201AA`
- `GET /api/intel/epc?postcode=SW1A%201AA`
- `GET /api/intel/schools?postcode=SW1A%201AA`
- `GET /api/intel/connectivity?postcode=SW1A%201AA`
- `GET /api/intel/licensing?postcode=SW1A%201AA`
- `POST /api/ghost-deal`

### Ghost Deal Draft Request

```bash
curl -X POST http://localhost:3000/api/ghost-deal \
  -H 'content-type: application/json' \
  -d '{"postcode":"SW1A 1AA","purchasePrice":225000,"monthlyRent":1450}'
```

### Optional Environment Variables

- `EPC_API_KEY`: API key for EPC Open Data Communities API
- `SCHOOLS_API_BASE_URL`: adapter endpoint expected to return school summary counts within radius
- `CONNECTIVITY_API_URL`: adapter endpoint expected to return ultrafast + technology summary
- `LICENSING_OVERRIDES_JSON`: JSON object keyed by normalized postcode with override values, e.g.
  `{"SW1A 1AA":{"y1":1000,"y6":1000,"y11":1200}}`

When optional sources are not configured or unavailable, the service returns robust fallback payloads with `status`, `confidence`, and source notes.
