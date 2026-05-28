# GORKH Web

Vercel-ready marketing site for GORKH.

## Local

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Vercel

Create a Vercel project from this repository and set:

- Root Directory: `apps/web`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

The included `vercel.json` adds an SPA rewrite so direct visits to `/about`,
`/privacy`, and `/contact` work.

This app is static. It does not need backend secrets, provider keys, OAuth
tokens, or database credentials.
