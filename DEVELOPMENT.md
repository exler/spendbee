# Development Guide

## Project Overview

Spendbee is a bill-splitting application similar to Splitwise, built with modern technologies:

- **Backend**: Bun runtime with ElysiaJS framework and DrizzleORM
- **Frontend**: SvelteKit 5 with TailwindCSS
- **Database**: SQLite (using bun:sqlite)
- **Design**: Mobile-first with yellow-black color scheme

## Architecture Decisions

### Backend
- **Bun**: Fast JavaScript runtime, native SQLite support
- **ElysiaJS**: Lightweight, type-safe web framework
- **DrizzleORM**: Type-safe SQL ORM with great TypeScript support
- **JWT**: Token-based authentication
- **SQLite**: Lightweight, serverless database perfect for this use case

### Frontend
- **SvelteKit**: Fast, modern framework with great DX
- **Svelte 5**: Latest version with improved reactivity
- **TailwindCSS**: Utility-first CSS framework
- **Stores**: Client-side state management for auth

## Code Organization

### Backend Structure
```
backend/src/
├── db/
│   ├── schema.ts      # Database tables and relations
│   └── index.ts       # Database connection
├── routes/
│   ├── auth.ts        # User registration/login
│   ├── groups.ts      # Group CRUD operations
│   └── expenses.ts    # Expenses, balances, settlements
├── types/
│   └── index.ts       # TypeScript interfaces
└── index.ts           # Main app, middleware setup
```

### Frontend Structure
```
frontend/src/
├── lib/
│   ├── api/
│   │   └── index.ts   # API client wrapper
│   └── stores/
│       └── auth.ts    # Authentication state
├── routes/
│   ├── +page.svelte            # Landing page
│   ├── +layout.svelte          # Root layout
│   ├── login/+page.svelte      # Login form
│   ├── register/+page.svelte   # Registration form
│   ├── groups/+page.svelte     # Groups list
│   └── groups/[id]/+page.svelte # Group detail page
├── app.css            # Tailwind imports
└── app.html           # HTML template
```

## Key Features Implementation

### Authentication
- Passwords are hashed with bcrypt
- JWT tokens stored in localStorage
- Token sent in Authorization header
- Middleware validates tokens on protected routes

### Balance Calculation
The balance for each user is calculated as:
```
Balance = Total Paid - Total Owed + Settlements Received - Settlements Paid
```

- Positive balance: User is owed money
- Negative balance: User owes money
- Zero: All settled up

### Expense Splitting
Expenses are split equally among selected members:
```
Share per person = Total Amount / Number of Members
```

## Database Schema Details

### Relations
- Users can be members of multiple groups (many-to-many via group_members)
- Expenses belong to one group and have one payer
- Each expense has multiple shares (one per participating member)
- Settlements link two users within a group

### Timestamps
All tables use INTEGER timestamps (Unix epoch) for SQLite compatibility.

## Extending the Application

### Adding a New Feature

1. **Backend**: Add route handler in appropriate file
2. **Frontend**: Add API method in `lib/api/index.ts`
3. **UI**: Create/update Svelte component
4. **Database**: Modify schema if needed, generate migration

### Example: Adding Categories

1. Backend schema:
```typescript
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});
```

2. Add field to expenses:
```typescript
categoryId: integer("category_id").references(() => categories.id)
```

3. Generate migration: `bun run db:generate`
4. Apply migration: `bun run db:migrate`
5. Add API endpoints and frontend UI

## Performance Considerations

### Backend
- SQLite is fast for reads, good for this use case
- Indexes on foreign keys improve join performance
- DrizzleORM generates efficient queries

### Frontend
- Svelte compiles to vanilla JavaScript (small bundle)
- TailwindCSS purges unused styles
- API calls are cached in component state
- Use SvelteKit's load functions for SSR if needed

## Security Best Practices

### Current Implementation
- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens for authentication
- ✅ CORS enabled for frontend
- ✅ Input validation with Elysia's type system
- ✅ SQL injection prevented by DrizzleORM

### Production Recommendations
- Change JWT_SECRET to a strong random value
- Use HTTPS in production
- Add rate limiting
- Implement token refresh mechanism
- Add email verification
- Use environment variables for all secrets
- Add input sanitization
- Implement proper error logging

## Mobile-First Design

### Breakpoints (TailwindCSS)
- Default: Mobile (< 640px)
- sm: 640px
- md: 768px
- lg: 1024px

### Mobile Patterns
- Bottom modals (slide up from bottom)
- Touch-friendly buttons (min height 44px)
- Fixed navigation at top
- Swipeable tabs
- Large tap targets

## Color Scheme

Primary Yellow: #FFC700 (bee yellow)
- Use for: CTAs, highlights, positive balances
- Contrast well with dark backgrounds

Dark: #1A1A1A
- Use for: backgrounds, text on light surfaces
- Create depth with lighter shades (#262626, #333333)

## Common Development Tasks

### Adding a new route
1. Create file in `backend/src/routes/`
2. Import in `backend/src/index.ts`
3. Use `.use(newRoutes)` to register

### Creating a new page
1. Create `+page.svelte` in `frontend/src/routes/your-route/`
2. Add link in navigation
3. Add route guard if authentication required

### Debugging
- Backend: Bun has built-in debugger
- Frontend: Use Chrome DevTools
- Database: Use `bun run db:studio`

## Testing Strategy

### Manual Testing
See TESTING.md for comprehensive testing guide

### Automated Testing (Future)
- Backend: Bun has built-in test runner
- Frontend: Vitest for unit tests, Playwright for E2E
- API: Test endpoints with curl or Postman

## Deployment

### Backend
- Build: Not needed, Bun runs TypeScript directly
- Run: `bun src/index.ts`
- Environment: Set JWT_SECRET, database path

### Frontend
- Build: `npm run build`
- Preview: `npm run preview`
- Deploy: Use adapter-auto for various platforms (Vercel, Netlify, etc.)

### Database
- SQLite file needs to be persisted
- Back up regularly
- Consider PostgreSQL for production scale

## Contributing

When adding features:
1. Keep backend logic separate from frontend
2. Validate data on backend
3. Use TypeScript types
4. Follow mobile-first design
5. Test on multiple screen sizes
6. Update documentation

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [ElysiaJS Documentation](https://elysiajs.com)
- [DrizzleORM Documentation](https://orm.drizzle.team)
- [SvelteKit Documentation](https://kit.svelte.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
