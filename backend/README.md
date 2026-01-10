# Spendbee Backend

Backend API for Spendbee bill-splitting application.

## Tech Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **ORM**: DrizzleORM
- **Database**: SQLite

## Setup

1. Install dependencies:
```bash
bun install
```

2. Generate and run database migrations:
```bash
bun run db:generate
bun run db:migrate
```

3. Start development server:
```bash
bun run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user

### Groups
- `GET /groups` - Get all groups for authenticated user
- `POST /groups` - Create a new group
- `GET /groups/:id` - Get group details
- `POST /groups/:id/join` - Join a group

### Expenses
- `POST /expenses` - Create a new expense
- `GET /expenses/group/:groupId` - Get all expenses for a group
- `GET /expenses/group/:groupId/balances` - Get balances for all group members
- `POST /expenses/settle` - Record a debt settlement
- `GET /expenses/group/:groupId/settlements` - Get all settlements for a group

## Database Schema

- **users** - User accounts
- **groups** - Expense groups
- **group_members** - Group membership
- **expenses** - Recorded expenses
- **expense_shares** - How expenses are split among users
- **settlements** - Debt payments between users
