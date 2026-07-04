# ProCrick Admin Console

A minimal Next.js 15 admin console for the ProCrick fantasy cricket API.

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your API URL (NEXT_PUBLIC_API_URL)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Screens

| Route | Purpose |
|---|---|
| `/login` | Admin login (JWT stored in localStorage) |
| `/matches` | Matches by date range, contests per match |
| `/contests/create` | Create a contest |
| `/players` | Player profiles and pricing |
| `/series` + `/series/leaderboard` | Series and leaderboards |
| `/notifications` | Registered app users with their push-enabled devices; send a test notification to a selected user |
| `/wallets` | Wallet balances and transaction history |

The **Notifications** screen calls `GET /admin/notifications/users` (paginated, searchable by name/email) and `POST /admin/notifications/test`, which reports per-device delivery results (iOS/Android via AWS SNS, web via VAPID web push).

## Structure

```
src/
├── app/                    # One folder per screen (layout.tsx wraps in Sidebar)
├── components/
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── AuthProvider.tsx    # Auth context (login/logout, user info)
│   ├── MatchCard.tsx       # Match display card
│   ├── CreateContestForm.tsx
│   └── DateRangePicker.tsx # Date range selector with quick presets
├── lib/
│   ├── api.ts              # Axios client + authApi/matchesApi/adminApi/seriesApi/ownerApi
│   └── utils.ts            # Formatters, status colours
└── types/
    └── index.ts            # Types derived from the backend OpenAPI spec
```

## Authentication

`src/lib/api.ts` stores the access token in localStorage and attaches it as a
`Bearer` header on every request; a 401 response clears it and redirects to
`/login`. Admin-only endpoints additionally require the logged-in user to have
the `ADMIN` role on the backend.

## Extending

Add new API methods to `src/lib/api.ts`, new types to `src/types/index.ts`,
a new page under `src/app/<route>/` (copy an existing `layout.tsx` to get the
sidebar), and a nav entry in `src/components/Sidebar.tsx`.
