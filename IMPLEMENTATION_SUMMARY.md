# Mock Users Feature - Implementation Complete ✅

## Summary

The mock users (guest members) feature has been successfully implemented in Spendbee. Users can now add people to groups who don't have system accounts, allowing for flexible expense sharing with guests, visitors, or anyone who doesn't want to register.

## What Was Implemented

### Backend ✅

1. **Database Schema**
   - Added `mock_users` table with fields: id, groupId, name, createdAt
   - Added `expense_shares_mock` table to track mock user expense shares
   - Modified `settlements` table to support nullable user references for both real and mock users
   - All migrations generated and applied successfully

2. **API Endpoints**
   - `POST /mock-users` - Create a mock user in a group
   - `GET /mock-users/group/:groupId` - List all mock users in a group
   - `DELETE /mock-users/:id` - Delete a mock user

3. **Modified Endpoints**
   - `POST /expenses` - Now accepts `sharedWithMock` array
   - `GET /expenses/group/:groupId` - Returns expenses with mock user shares
   - `GET /expenses/group/:groupId/balances` - Returns balances for both real and mock users (with `isMock` flag)
   - `POST /expenses/settle` - Supports settlements with mock users via `fromMockUserId`/`toMockUserId`
   - `GET /expenses/group/:groupId/settlements` - Returns settlements including mock user info

4. **Bug Fixes**
   - Fixed NULL handling in settlement balance calculations
   - Added IS NOT NULL checks for nullable foreign keys

### Frontend ✅

1. **Group Detail Page Updates**
   - Added "Members" tab showing both registered and guest members
   - Updated group header to show guest count: "X members • Y guests"
   - Added "Add Guest Member" button and modal
   - Guest members can be deleted from the Members tab

2. **Expense Creation**
   - Expense form now includes mock user checkboxes
   - Mock users shown in separate section labeled "Guest Members"
   - "Select All" button selects both real and mock users
   - Share calculation includes both types of members
   - Mock users displayed with gray text to differentiate

3. **Expense Display**
   - Expense list shows both real and mock users in "Split with" section
   - Mock users labeled with "(guest)" suffix

4. **Balance Display**
   - Balances show both real and mock users
   - Mock users have "Guest member" label underneath their name
   - Mock users typically have negative balances (they owe money)

5. **Settlement Form**
   - Dropdown menus support both registered and guest members
   - Members organized into optgroups: "Registered Members" and "Guest Members"
   - Proper handling of mock vs real user IDs

6. **Settlement Display**  
   - Shows settlements between any combination of real/mock users
   - Mock users displayed with "(guest)" suffix

## How to Use

### Adding a Guest Member

1. Open a group
2. Click on the "Members" tab
3. Click "Add Guest Member"
4. Enter their name (e.g., "John (visiting)")
5. Click "Add"

### Creating an Expense with Guests

1. Click "Add Expense"
2. Fill in description and amount
3. Select registered members and/or guest members
4. The amount will be split equally among all selected
5. Guest shares are tracked separately in the database

### Viewing Balances

- Guests appear in the balances list with "Guest member" label
- Guests typically owe money (negative balance) since they can't pay for expenses
- Only registered users can be expense payers

### Settling Debts with Guests

1. Click "Settle Debt"
2. Select from/to from dropdowns (can be mix of registered and guests)
3. Enter amount
4. Submit

## Testing

Both backend and frontend are running:
- Backend: http://localhost:3000
- Frontend: http://localhost:5174

Test flow:
1. Register/login as a user
2. Create a group
3. Add a guest member (e.g., "Alice (visiting)")
4. Create an expense splitting between yourself and the guest
5. Check balances - you should have positive, guest should have negative
6. Record a settlement from guest to you
7. Check balances again - should be closer to zero

## Files Modified

### Backend
- `src/db/schema.ts` - Added mock user tables and relations
- `src/routes/mockUsers.ts` - New route file
- `src/routes/expenses.ts` - Updated for mock user support
- `src/index.ts` - Registered mock user routes
- `src/types/index.ts` - Added `isMock` field to Balance interface
- `drizzle.config.ts` - Removed invalid driver option

### Frontend
- `src/lib/api/index.ts` - Added mock user API methods
- `src/routes/groups/[id]/+page.svelte` - Complete overhaul with:
  - Updated interfaces for mock users
  - New state variables for mock user management
  - Members tab UI
  - Add mock user modal
  - Updated expense form with mock user checkboxes
  - Updated balance/settlement displays
  - Helper function for settlement participants

## Documentation
- `MOCK_USERS.md` - Complete feature documentation
- `README.md` - Updated features list
- This file - Implementation summary

## Notes

- Mock users cannot login or pay for expenses
- Mock users are scoped to a single group
- Deleting a mock user cascades to their shares and settlements
- Mock users can have both positive and negative balances
- The feature is fully functional and ready for testing

🐝 **Spendbee with Mock Users is ready!**
