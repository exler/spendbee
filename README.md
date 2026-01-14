# Spendbee 🐝

A modern bill-splitting and expense tracking application to replace Splitwise.

## Overview

Spendbee helps you track bills and expenses with friends. Create groups, add expenses, and see who owes what at a glance. The app features a clean, mobile-first design with a distinctive yellow-black color scheme.

## Architecture

- **Backend**: Bun + ElysiaJS + DrizzleORM + SQLite
- **Frontend**: SvelteKit + TailwindCSS + TypeScript

## Features

- ✅ User registration and authentication with JWT
- ✅ Create and join expense groups
- ✅ Add expenses and split with selected members
- ✅ **Select who paid** - Choose any group member as the payer (defaults to you)
- ✅ **Custom expense dates** - Record past expenses with their actual date
- ✅ **Multi-currency support** - Track expenses in 30+ currencies with ECB exchange rates
- ✅ **Mock users (guests)** - Add people without system accounts
- ✅ **Group settings** - Group creators can modify name, description, and base currency
- ✅ Real-time balance calculation
- ✅ Record debt settlements
- ✅ View expense history and settlement history
- ✅ Mobile-first responsive design
- ✅ Yellow-black color scheme

## Getting Started

### Backend Setup

```bash
cd backend
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

Backend will run at `http://localhost:3000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at `http://localhost:5173`

## Project Structure

```
spendbee/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts      # Database schema
│   │   │   └── index.ts       # Database connection
│   │   ├── routes/
│   │   │   ├── auth.ts        # Authentication routes
│   │   │   ├── groups.ts      # Group management routes
│   │   │   └── expenses.ts    # Expense and settlement routes
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript types
│   │   └── index.ts           # Main app entry
│   └── package.json
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── api/
    │   │   │   └── index.ts   # API client
    │   │   └── stores/
    │   │       └── auth.ts    # Auth state management
    │   ├── routes/
    │   │   ├── +page.svelte           # Landing page
    │   │   ├── login/+page.svelte     # Login page
    │   │   ├── register/+page.svelte  # Register page
    │   │   ├── groups/+page.svelte    # Groups list
    │   │   └── groups/[id]/+page.svelte # Group detail
    │   ├── app.css            # Global styles
    │   └── app.html           # HTML template
    └── package.json
```

## Database Schema

- **users** - User accounts (email, password, name)
- **groups** - Expense groups (with base currency)
- **group_members** - Group membership associations
- **expenses** - Recorded expenses with payer (with currency)
- **expense_shares** - How expenses are split among users
- **expense_shares_mock** - Expense shares for mock/guest users
- **mock_users** - Guest members without system accounts
- **settlements** - Debt payments between users (with currency)

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

### Groups
- `GET /groups` - List user's groups
- `POST /groups` - Create new group
- `GET /groups/:id` - Get group details
- `PATCH /groups/:id` - Update group settings (name, description, base currency)
- `POST /groups/:id/join` - Join existing group
- `GET /groups/currencies` - Get list of supported currencies

### Expenses
- `POST /expenses` - Create new expense
- `GET /expenses/group/:groupId` - List group expenses
- `GET /expenses/group/:groupId/balances` - Get member balances
- `POST /expenses/settle` - Record debt settlement
- `GET /expenses/group/:groupId/settlements` - List settlements

## Design

The app uses a mobile-first design approach with:
- Yellow (#FFC700) as the primary color
- Dark (#1A1A1A) as the background
- Responsive layout that works on all screen sizes
- Touch-friendly buttons and interactions
- Modal dialogs that slide up from bottom on mobile

## License

MIT
