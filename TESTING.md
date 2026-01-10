# Spendbee Testing Guide

This guide will help you test all features of Spendbee.

## Starting the Application

### Quick Start (Recommended)
```bash
./start.sh
```
This will start both backend and frontend servers.

### Manual Start

**Backend:**
```bash
cd backend
bun run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Testing Flow

### 1. Register Users

1. Open http://localhost:5173
2. Click "Register"
3. Create first user:
   - Name: Alice
   - Email: alice@test.com
   - Password: test123

4. Logout and register second user:
   - Name: Bob
   - Email: bob@test.com
   - Password: test123

5. Register third user:
   - Name: Charlie
   - Email: charlie@test.com
   - Password: test123

### 2. Create a Group

1. Login as Alice
2. Click "Create Group"
3. Name: "Roommates"
4. Description: "Shared apartment expenses"
5. Note the Group ID (e.g., 1)

### 3. Join Group

1. Logout and login as Bob
2. Click "Join Group"
3. Enter the Group ID (1)
4. Join the group

Repeat for Charlie.

### 4. Add Expenses

Login as Alice and add an expense:
1. Go to the Roommates group
2. Click "Add Expense"
3. Description: "Groceries"
4. Amount: 120.00
5. Select all members (Alice, Bob, Charlie)
6. Submit

Login as Bob and add another expense:
1. Description: "Internet Bill"
2. Amount: 60.00
3. Select Alice and Bob only
4. Submit

### 5. Check Balances

1. Go to the "Balances" tab
2. You should see:
   - Alice: +$10.00 (paid $120, owes $40 for groceries + $30 for internet)
   - Bob: -$40.00 (owes $40 for groceries, paid $60, owes $30 for internet)
   - Charlie: -$40.00 (owes $40 for groceries)

### 6. Settle a Debt

As Charlie:
1. Click "Settle Debt"
2. From: Charlie
3. To: Alice
4. Amount: 40.00
5. Submit

Check balances again - Charlie should now show as "Settled"

### 7. View History

1. Check the "Expenses" tab to see all expenses
2. Check the "Settlements" tab to see payment history

## API Testing with curl

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User"}'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Create Group (replace TOKEN)
```bash
curl -X POST http://localhost:3000/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Test Group","description":"Testing"}'
```

### List Groups
```bash
curl http://localhost:3000/groups \
  -H "Authorization: Bearer TOKEN"
```

## Features to Test

- ✅ User registration with validation
- ✅ User login and logout
- ✅ Create groups
- ✅ Join groups by ID
- ✅ Add expenses with custom splits
- ✅ View real-time balances
- ✅ Record settlements
- ✅ View expense history
- ✅ View settlement history
- ✅ Mobile-responsive design
- ✅ Dark theme with yellow accents

## Database

You can inspect the database using:
```bash
cd backend
bun run db:studio
```

This opens Drizzle Studio to view tables and data.

## Troubleshooting

### Backend won't start
- Make sure Bun is installed: `bun --version`
- Check if port 3000 is available
- Remove and reinstall: `rm -rf node_modules bun.lockb && bun install`

### Frontend won't start
- Make sure Node.js/npm is installed
- Check if port 5173 is available
- Remove and reinstall: `rm -rf node_modules package-lock.json && npm install`

### CORS errors
- Ensure backend is running at http://localhost:3000
- Check that @elysiajs/cors is properly configured

### Database errors
- Delete `spendbee.db` and run `bun run db:migrate` again
- Check Drizzle config in `drizzle.config.ts`
