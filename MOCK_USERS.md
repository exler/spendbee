# Mock Users Feature

## Overview

Mock users (also called "guest users") are people who don't have system accounts but participate in expense sharing. This is useful for scenarios like:

- Splitting bills with people who don't want to create an account
- Adding external participants temporarily (e.g., guests on a trip)
- Tracking expenses for people who don't use the app

## How It Works

### Backend Implementation

**New Tables:**
- `mock_users` - Stores mock user information (id, groupId, name)
- `expense_shares_mock` - Tracks expense shares for mock users (similar to `expense_shares`)

**Modified Tables:**
- `settlements` - Now supports settlements between any combination of real and mock users with nullable foreign keys:
  - `fromUserId` / `fromMockUserId` (one must be set)
  - `toUserId` / `toMockUserId` (one must be set)

**API Endpoints:**
- `POST /mock-users` - Create a mock user in a group
- `GET /mock-users/group/:groupId` - List all mock users in a group
- `DELETE /mock-users/:id` - Delete a mock user (cascades to shares and settlements)

**Modified Endpoints:**
- `POST /expenses` - Now accepts `sharedWithMock` array in addition to `sharedWith`
- `GET /expenses/group/:groupId/balances` - Returns balances for both real and mock users (includes `isMock` flag)
- `POST /expenses/settle` - Supports settlements with `fromMockUserId`/`toMockUserId`
- `GET /expenses/group/:groupId/settlements` - Returns settlements with mock user info

### Frontend Implementation

**Updated Components:**
- Group detail page now has a "Members" tab
- Expense creation form includes mock user selection
- Balance display shows mock users with a "(guest)" indicator
- Settlement form supports selecting mock users

**API Client:**
Updated `src/lib/api/index.ts` with mock user methods

## Usage Example

### 1. Add Mock Users to a Group

```bash
curl -X POST http://localhost:3000/mock-users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"groupId":1,"name":"John (visiting)"}'
```

### 2. Create Expense with Mock Users

```bash
curl -X POST http://localhost:3000/expenses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId":1,
    "description":"Restaurant",
    "amount":120,
    "sharedWith":[1,2],
    "sharedWithMock":[1]
  }'
```

This splits $120 among 3 people: users 1 & 2, and mock user 1 ($40 each).

### 3. Settle with Mock User

```bash
curl -X POST http://localhost:3000/expenses/settle \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "groupId":1,
    "fromMockUserId":1,
    "toUserId":2,
    "amount":40
  }'
```

Records that mock user 1 paid user 2 $40.

## Balance Calculation

Mock users:
- Cannot pay for expenses (only real users can be payers)
- Can owe money (negative balance)
- Can have positive balance if they've been paid more than they owe
- Balances calculated as: `0 - owed + received - paid`

Real users with mock users in group:
- Same calculation but can also be payers

## Database Migration

The feature required a new migration that adds:
1. `mock_users` table
2. `expense_shares_mock` table
3. Modified `settlements` table with nullable user references

To apply: Run `bun run db:migrate` in the backend directory.

## Frontend TODO

The backend is complete. To finish the frontend:

1. **Update Group Detail Page** (`routes/groups/[id]/+page.svelte`):
   - Add Members tab UI
   - Add "Add Mock User" button and modal
   - Update expense form to show mock user checkboxes
   - Update settlement form to support mock users (dropdowns with "Guest:" prefix)
   - Show "(guest)" indicator next to mock users in all lists

2. **Update Expense Display**:
   - Show mock users in the "Split with" list
   - Differentiate visually (e.g., gray text or icon)

3. **Update Balance Display**:
   - Show mock user balances
   - Add visual indicator for mock users

4. **Update Settlement Display**:
   - Show mock user names in settlement history
   - Handle cases where fromUser/toUser is null but fromMockUser/toMockUser is set

## Testing

1. Create a group
2. Add a mock user named "Guest Alice"
3. Create an expense splitting between you and Guest Alice
4. Check balances - you should be +$X, Guest Alice should be -$X
5. Record a settlement from Guest Alice to you
6. Check balances - both should be near $0

## Considerations

- Mock users are deleted when:
  - Explicitly deleted via API
  - The group is deleted (cascade)
- Deleting a mock user cascades to:
  - Their expense shares
  - Their settlements
- Mock users cannot:
  - Log in
  - Pay for expenses (only owe/receive)
  - Create groups
  - Add other members

## Security

- Only group members can add mock users to that group
- Only group members can delete mock users from that group
- Mock users don't have authentication credentials
- All mock user operations require valid user authentication
