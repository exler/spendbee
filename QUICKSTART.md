# Spendbee - Quick Start Guide

## What is Spendbee?

Spendbee is a bill-splitting app that helps you track expenses with friends. Create groups, add expenses, see who owes what, and record payments. Think Splitwise, but with a bee theme! 🐝

## Installation

### Prerequisites
- [Bun](https://bun.sh) (for backend)
- [Node.js](https://nodejs.org) (for frontend)

### One-Command Setup
```bash
./start.sh
```

This script will:
1. Install all dependencies
2. Set up the database
3. Start both backend and frontend servers

## Usage

1. **Open your browser**: http://localhost:5173
2. **Register an account**: Create your user
3. **Create a group**: Name it (e.g., "Roommates")
4. **Share the Group ID**: Friends join using this ID
5. **Add expenses**: Who paid? How much? Split with whom?
6. **Check balances**: See who owes what
7. **Settle up**: Record payments between members

## Example Scenario

### Setup
1. Alice registers and creates "Weekend Trip" group (ID: 1)
2. Bob joins group using ID 1
3. Charlie joins group using ID 1

### Adding Expenses
1. Alice pays $120 for hotel → Split between all 3 → Each owes $40
2. Bob pays $60 for dinner → Split between all 3 → Each owes $20
3. Charlie pays $30 for gas → Split between all 3 → Each owes $10

### Balances
- Alice: +$50 (paid $120, owes $60)
- Bob: +$0 (paid $60, owes $60)
- Charlie: -$50 (paid $30, owes $80)

### Settlement
Charlie pays Alice $50 → All settled! ✅

## Project Structure

```
spendbee/
├── backend/          # Bun + ElysiaJS + DrizzleORM
│   └── src/
├── frontend/         # SvelteKit + TailwindCSS
│   └── src/
├── start.sh          # Launch script
├── README.md         # Full documentation
├── TESTING.md        # Testing guide
└── DEVELOPMENT.md    # Developer guide
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Backend | ElysiaJS |
| Database | SQLite (bun:sqlite) |
| ORM | DrizzleORM |
| Frontend | SvelteKit 5 |
| Styling | TailwindCSS |
| Auth | JWT |

## Color Scheme

- **Primary**: Yellow (#FFC700) - Like a bee! 🐝
- **Background**: Dark (#1A1A1A) - Easy on the eyes
- **Design**: Mobile-first, responsive

## Key Features

✅ User registration & authentication  
✅ Create & join groups  
✅ Add expenses with custom splits  
✅ Real-time balance calculation  
✅ Record debt settlements  
✅ Mobile-friendly design  

## URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Database Studio**: `cd backend && bun run db:studio`

## Need Help?

- **Testing Guide**: See `TESTING.md` for detailed testing instructions
- **Development**: See `DEVELOPMENT.md` for architecture and extending the app
- **Full Docs**: See `README.md` for complete documentation

## Quick Commands

```bash
# Start everything
./start.sh

# Backend only
cd backend && bun run dev

# Frontend only
cd frontend && npm run dev

# Database management
cd backend
bun run db:generate    # Create migration
bun run db:migrate     # Apply migration
bun run db:studio      # Visual database editor
```

## License

MIT

---

Made with ❤️ and ��
