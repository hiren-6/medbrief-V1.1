# Task 1: Database & Security Migration

## Overview
This migration sets up the database structure and security policies needed for the AI Clinical Summary feature. It prepares the foundation for storing AI-processed medical data securely.

## What This Migration Does

### 1. **Patient Files Table Updates**
- Adds `parsed_text` column to store extracted PDF content
- Adds `processed` boolean flag to track PDF processing status
- Adds `inserted_at` timestamp for audit trails
- Creates foreign key constraint to consultations table
- Adds index for efficient lookups

### 2. **Clinical Summaries Table**
- Creates new table to store AI-generated clinical summaries
- Includes JSONB column for flexible summary data
- Tracks model version and prompt version for auditability
- Includes processing status and error handling
- Has proper foreign key relationships

### 3. **Row Level Security (RLS) Policies**
- **Patient Files**: Patients can manage their own files, doctors can read assigned consultations
- **Clinical Summaries**: Patients can read their own summaries, doctors can read assigned consultations
- Edge Functions bypass RLS automatically with service-role key

### 4. **Appointments Table Updates**
- Adds `ai_processing_status` column to track AI processing state
- Enables status tracking: pending → triggered → completed

### 5. **Helper Functions & Views**
- Age calculation function from date of birth
- AI data collection view for Edge Function use
- Trigger function framework (activated in Task 2)

## How to Apply This Migration

### Option 1: Supabase Dashboard (Recommended for beginners)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire content of `database_migration_task1.sql`
4. Paste and run the SQL
5. Verify the migration worked by running the verification queries at the bottom

### Option 2: Supabase CLI (For advanced users)
```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Direct Database Connection
```bash
# Connect to your Supabase database and run the SQL
psql "postgresql://postgres:[password]@[host]:5432/postgres"
```

## Verification Steps

After running the migration, verify it worked by running these queries in Supabase SQL Editor:

```sql
-- Check if new columns were added to patient_files
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patient_files' 
AND column_name IN ('parsed_text', 'processed', 'inserted_at');

-- Check if clinical_summaries table was created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'clinical_summaries';

-- Check if RLS policies were created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('patient_files', 'clinical_summaries');
```

## Security Features Implemented

### 🔒 **Data Protection**
- RLS ensures patients only see their own data
- Doctors can only access data for their assigned consultations
- Edge Functions use service-role key (bypasses RLS for AI processing)

### 📊 **Audit Trail**
- Timestamps on all new records
- Model and prompt version tracking
- Processing status tracking
- Error message storage

### 🔗 **Data Integrity**
- Foreign key constraints prevent orphaned records
- Cascade deletes maintain referential integrity
- Indexes ensure efficient queries

## Next Steps

After successfully applying this migration:

1. **Test the security policies** by trying to access data with different user roles
2. **Verify the view works** by checking `ai_clinical_data` view
3. **Proceed to Task 2** where we'll create the Edge Function

## Troubleshooting

### Common Issues:

**Error: "relation does not exist"**
- Make sure you're connected to the correct database
- Check if the base tables (`profiles`, `consultations`, `appointments`) exist

**Error: "permission denied"**
- Ensure you're using the correct database role
- Check if you have the necessary permissions

**Error: "duplicate key value"**
- The migration uses `IF NOT EXISTS` clauses, so this shouldn't happen
- If it does, the constraint/column already exists

### Getting Help:
- Check Supabase logs in the dashboard
- Verify your database connection
- Ensure all base tables exist before running this migration

## Production Considerations

### 🚀 **Before Going Live**
- Test with real data in staging environment
- Verify RLS policies work correctly with your user roles
- Ensure backup strategy covers new tables
- Monitor performance impact of new indexes

### 📈 **Monitoring**
- Watch for any RLS policy violations in logs
- Monitor storage usage for parsed text
- Track AI processing status changes

---

**Ready for Task 2?** Once this migration is successfully applied, we'll move on to creating the Supabase Edge Function that will handle the AI processing. 