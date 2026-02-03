# Spendbee AGENTS.md

A modern bill-splitting and expense tracking PWA built with SvelteKit and Bun.

## Overview

Spendbee helps you track bills and expenses with friends. Create groups, add expenses, and see who owes what at a glance. The app features a clean, mobile-first design with a distinctive yellow-black color scheme.

## Architecture

**Unified SvelteKit Monolith**
- **Runtime**: Bun
- **Framework**: SvelteKit 2 (frontend + API routes)
- **Database**: SQLite with Drizzle ORM and bun:sqlite (Bun's native SQLite)
- **Styling**: TailwindCSS
- **Authentication**: JWT with HTTP-only cookies
- **AI**: Mistral OCR for receipt scanning
- **PWA**: Service worker with offline support for viewing balances

## Project Structure

```
spendbee/
├── src/
│   ├── lib/
│   │   ├── api/             # API client
│   │   ├── server/          # Server-side code
│   │   │   ├── db/          # Database schema & connection
│   │   │   ├── services/    # Business logic (currency, receipt)
│   │   │   ├── auth.ts      # JWT utilities
│   │   │   └── utils.ts     # Server utilities
│   │   ├── stores/          # Svelte stores
│   │   └── types/           # TypeScript types
│   ├── routes/
│   │   ├── api/             # API endpoints
│   │   │   ├── auth/        # Authentication
│   │   │   ├── groups/      # Group management
│   │   │   ├── expenses/    # Expense & settlement tracking
│   │   │   └── notifications/ # Notifications
│   │   ├── groups/          # UI pages
│   │   ├── login/
│   │   └── register/
│   ├── service-worker.ts    # PWA service worker
│   ├── hooks.server.ts      # SvelteKit server hooks (auth middleware)
│   └── app.d.ts             # TypeScript declarations
├── static/
│   ├── site.webmanifest     # PWA manifest
│   └── uploads/             # Receipt images
├── drizzle/                 # Database migrations
├── spendbee.db              # SQLite database file
└── package.json
```

## PWA & Offline Support

Spendbee is a Progressive Web App that works offline:

- **Service Worker** (`src/service-worker.ts`) - Caches app assets and API responses
- **Offline Caching Strategy**:
  - Build files and static assets: Cache-first
  - API endpoints: Network-first with cache fallback
  - Cached API responses: Groups, expenses, and balances
- **Installation**: Users can install the app on mobile devices from the browser menu
- **Offline Capabilities**: View groups, expenses, and balances when offline

The service worker is automatically built and registered by SvelteKit. Cache versioning is managed via `kit.version` in `svelte.config.js`.

## Database Schema

- **users** - User accounts (email, password, name)
- **groups** - Expense groups with base currency
- **group_members** - Group membership (supports registered users and guests)
- **expenses** - Recorded expenses with payer, currency, optional receipt
- **expense_shares** - How expenses are split among members
- **settlements** - Debt payments between members (with currency)
- **notifications** - User notifications (group invites, etc.)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Groups
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create new group
- `GET /api/groups/:id` - Get group details
- `PATCH /api/groups/:id` - Update group settings
- `POST /api/groups/:id/invite` - Invite user to group
- `GET /api/groups/currencies` - List supported currencies
- `POST /api/groups/:id/members` - Add guest member
- `DELETE /api/groups/:groupId/members/:memberId` - Remove guest member

### Expenses
- `POST /api/expenses` - Create new expense
- `PATCH /api/expenses/:id` - Update existing expense (all group members can edit)
- `DELETE /api/expenses/:id` - Delete expense (all group members can delete)
- `POST /api/expenses/analyze-receipt` - AI-powered receipt OCR
- `GET /api/expenses/group/:groupId` - List group expenses
- `GET /api/expenses/group/:groupId/balances` - Calculate balances
- `POST /api/expenses/settle` - Record settlement
- `GET /api/expenses/group/:groupId/settlements` - List settlements

### Notifications
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/:id/accept` - Accept group invite
- `POST /api/notifications/:id/decline` - Decline group invite

## Development Commands

```bash
# Start dev server
bun --bun run dev

# Generate the production build
bun --bun run build

# Database migrations
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
```

## Guidelines

* Update the AGENTS.md whenever it feels appropriate.
* Do not create new documentation files unless explicitly asked to.
* Migrations should be named with a sequential number and a short description, e.g., `0005_currency_exchange_rates.sql`.
