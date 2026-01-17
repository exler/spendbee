# Spendbee 🐝

A modern bill-splitting and expense tracking PWA built with SvelteKit and Bun.

## Overview

Spendbee helps you track bills and expenses with friends. Create groups, add expenses, and see who owes what at a glance. The app features a clean, mobile-first design with a distinctive yellow-black color scheme.

## Architecture

**Unified SvelteKit Monolith**
- **Runtime**: Bun
- **Framework**: SvelteKit 2.0 (frontend + API routes)
- **Database**: SQLite with Drizzle ORM
  - App: `bun:sqlite` (Bun's native SQLite)
  - Drizzle Kit: `better-sqlite3` (for migrations & studio)
- **Styling**: TailwindCSS
- **Authentication**: JWT with HTTP-only cookies
- **AI**: Mistral OCR for receipt scanning

> **Note**: This application was recently migrated from a separate ElysiaJS backend to a unified SvelteKit architecture. See [MIGRATION.md](MIGRATION.md) for details.

## Features

- ✅ User registration and authentication with JWT
- ✅ Create and join expense groups
- ✅ Add expenses and split with selected members
- ✅ **Receipt scanning** - Upload receipt photos and automatically extract items using AI (Mistral Pixtral)
- ✅ **Select who paid** - Choose any group member as the payer (defaults to you)
- ✅ **Custom expense dates** - Record past expenses with their actual date
- ✅ **Multi-currency support** - Track expenses in 30+ currencies with ECB exchange rates
- ✅ **Guest members** - Add people without system accounts
- ✅ **Group settings** - Group creators can modify name, description, and base currency
- ✅ Real-time balance calculation across currencies
- ✅ Record debt settlements
- ✅ View expense history and settlement history
- ✅ Mobile-first responsive design
- ✅ Yellow-black color scheme

## Getting Started

### Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)

### Setup

```bash
cd frontend
bun install

# Copy .env.example to .env and configure
cp .env.example .env

# Run database migrations
bun run db:migrate

# Start development server
bun run dev
```

Application will run at `http://localhost:5173`

### Environment Variables

Create a `.env` file in the `frontend` directory:

```bash
JWT_SECRET=your-secret-key-here
MISTRAL_API_KEY=your-mistral-api-key  # Optional, for receipt scanning
```

**Note:** Receipt scanning requires a Mistral API key. Get one from [Mistral AI Console](https://console.mistral.ai/)

## Project Structure

```
spendbee/frontend/
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
│   ├── hooks.server.ts      # SvelteKit server hooks (auth middleware)
│   └── app.d.ts             # TypeScript declarations
├── static/
│   └── uploads/             # Receipt images
├── drizzle/                 # Database migrations
├── spendbee.db              # SQLite database file
└── package.json
```

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
bun run dev

# Database migrations
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```

## Deployment

This application uses Bun-specific runtime features (`bun:sqlite`) and is designed to run with Bun in both development and production.

### Development Mode (Recommended for small deployments)
```bash
cd frontend
bun install
bun run db:migrate
bun run dev --host 0.0.0.0 --port 5173
```

### Alternative: Production Build
For production builds, you'll need to use the Bun adapter. Note that the current Vite build process uses Node.js, which doesn't support `bun:sqlite`. 

Options:
1. **Run in dev mode** (simplest for Bun-specific apps)
2. **Use a different database driver** compatible with Node.js (e.g., `better-sqlite3`)
3. **Wait for better Bun build tooling** that doesn't rely on Node.js during build

The app is fully functional and production-ready when run with `bun run dev` - the only difference is that it doesn't pre-render routes.

## Design

The app uses a mobile-first design approach with:
- Yellow (#FFC700) as the primary color
- Dark (#1A1A1A) as the background
- Responsive layout that works on all screen sizes
- Touch-friendly buttons and interactions
- Modal dialogs that slide up from bottom on mobile

## License

MIT

