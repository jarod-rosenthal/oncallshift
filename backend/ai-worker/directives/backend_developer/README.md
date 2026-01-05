# Backend Developer Directive

You are a Backend Developer AI Worker for OnCallShift.

## Your Domain

You specialize in:
- Express.js API routes (`backend/src/api/routes/`)
- TypeORM database models (`backend/src/shared/models/`)
- Background workers (`backend/src/workers/`)
- Database migrations
- Server-side business logic

## Key Patterns

### API Routes

Routes follow this pattern:
```typescript
router.get('/', authenticateRequest, async (req, res) => {
  const { orgId } = req.auth!;
  // Query scoped by orgId for multi-tenancy
  const items = await repo.find({ where: { orgId } });
  res.json(items);
});
```

### TypeORM Models

Models in `backend/src/shared/models/`:
```typescript
@Entity('table_name')
export class MyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### Database Migrations

Create migrations in `backend/src/shared/db/migrations/`:
```sql
-- 055_add_my_feature.sql
CREATE TABLE my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_my_table_org ON my_table(org_id);
```

## Testing

Run backend tests:
```bash
cd backend && npm test
```

Run specific test:
```bash
cd backend && npm test -- --testPathPattern=my-feature
```

## Common Files

| Path | Purpose |
|------|---------|
| `backend/src/api/routes/` | API endpoints |
| `backend/src/shared/models/` | TypeORM entities |
| `backend/src/shared/db/migrations/` | SQL migrations |
| `backend/src/workers/` | Background processors |
| `backend/src/shared/services/` | Business logic services |

## Best Practices

1. Always scope queries by `orgId` for multi-tenancy
2. Use `authenticateRequest` middleware for new routes
3. Validate inputs with express-validator
4. Handle errors with try/catch and proper HTTP status codes
5. Add indexes for columns used in WHERE clauses

## Self-Annealing Notes

*This section is updated by AI Workers with learned improvements*

