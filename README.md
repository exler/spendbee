<p align="center">
    <img src="static/logo.png" width="180">
    <h3 align="center">Spendbee</h3>
    <p align="center">🐝 A bill-splitting and expense tracking app </p>
</p>

## Overview

Spendbee helps you track bills and expenses with friends. Create groups, add expenses, and see who owes what at a glance.

### Features

- User authentication
- Create and join expense groups
- Add expenses and split with selected members
- **Receipt scanning** - Upload receipt photos and automatically extract items using AI (Mistral Document AI)
- **Multi-currency support** - Track expenses in 30+ currencies with ECB exchange rates
- Guest members - Add people without user accounts
- Real-time balance calculation across currencies
- Record debt settlements
- View expense history and settlement history

## Getting Started

### Prerequisites

- Bun >= 1.3.5

### Development server setup

```bash
# Install dependencies
bun install

# Copy .env.example to .env and configure
cp .env.example .env

# Run database migrations
bun run db:migrate

# Start development server
bun --bun run dev
```

Application will run at `http://localhost:5173`

### Production build setup

```bash
# Install dependencies
bun install

# Copy .env.example to .env and configure
cp .env.example .env

# Run database migrations
bun run db:migrate

# Build the application

# Start production build
bun --bun run build/index.js
```

Application will run at `http://localhost:3000`

### Docker setup

Build and run the Docker container:
```bash
# Build and run the Docker image
docker-compose up -d

# Run the migrations
docker compose exec spendbee bun run db:migrate
```

Application will run at `http://localhost:3000`
