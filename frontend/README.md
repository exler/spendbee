# Spendbee Frontend

Mobile-first frontend for Spendbee bill-splitting application.

## Tech Stack

- **Framework**: SvelteKit 5
- **Styling**: TailwindCSS
- **Language**: TypeScript

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Features

- User registration and authentication
- Create and join expense groups
- Add expenses and split with group members
- View balances (who owes whom)
- Record debt settlements
- Mobile-first responsive design
- Yellow-black color scheme

## Environment

Make sure the backend is running at `http://localhost:3000` or update the API_URL in `src/lib/api/index.ts`
