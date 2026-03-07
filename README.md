# ProCrick Admin Console

A minimal Next.js 15 admin console for the ProCrick fantasy cricket API.

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout (fonts, body)
│   ├── page.tsx            # Redirects → /matches
│   └── matches/
│       ├── layout.tsx      # Sidebar layout
│       └── page.tsx        # Matches page (date range + grid)
├── components/
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── MatchCard.tsx       # Match display card
│   └── DateRangePicker.tsx # Date range selector with quick presets
├── lib/
│   ├── api.ts              # Axios client + matchesApi
│   └── utils.ts            # Formatters, status colours
└── types/
    └── index.ts            # Types derived from OpenAPI spec
```

## Adding authentication

In `src/lib/api.ts`, call `setAccessToken(token)` after login and the
interceptor will attach it as a `Bearer` header automatically.

## Extending

Add new API methods to `src/lib/api.ts` and new pages under `src/app/`.
All types are co-located in `src/types/index.ts`.
```
