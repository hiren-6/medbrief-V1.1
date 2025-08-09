// ===================================
// QUICK TEST FOR AI FEATURE
// Run this to quickly check if everything is set up correctly
// ===================================

console.log(`
🚀 QUICK AI FEATURE TEST
========================

This will help you quickly identify the most common issues.
Follow the steps below:
`)

// Step 1: Check if you have the migration file
console.log(`
📋 STEP 1: Check Migration File
- Look for file: supabase/migrations/20241201_activate_ai_trigger.sql
- If missing, the database trigger won't work
`)

// Step 2: Check if Edge Function exists
console.log(`
📋 STEP 2: Check Edge Function
- Look for folder: supabase/functions/generate_clinical_summary/
- If missing, the AI processing won't work
`)

// Step 3: Most Common Issue - Missing API Key
console.log(`
📋 STEP 3: MOST COMMON ISSUE - Missing Gemini API Key
- Go to: https://makersuite.google.com/app/apikey
- Create a new API key
- Go to Supabase Dashboard → Settings → Edge Functions
- Add environment variable:
  Name: GEMINI_API_KEY
  Value: Your API key (starts with "AIza...")
`)

// Step 4: Quick Database Check
console.log(`
📋 STEP 4: Quick Database Check
Go to Supabase Dashboard → SQL Editor and run:

SELECT 
  trigger_name,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'trg_ai_summary';

Expected: Should show "trg_ai_summary" trigger
`)

// Step 5: Check Recent Appointments
console.log(`
📋 STEP 5: Check Your Appointments
Go to Supabase Dashboard → SQL Editor and run:

SELECT 
  id,
  ai_processing_status,
  created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 3;

Expected: Should show your appointments with ai_processing_status
`)

// Step 6: Manual Test
console.log(`
📋 STEP 6: Manual Test
If nothing is working, try this:

1. Find your appointment ID:
SELECT id FROM appointments ORDER BY created_at DESC LIMIT 1;

2. Manually trigger processing:
UPDATE appointments SET ai_processing_status = 'triggered' WHERE id = 'YOUR_APPOINTMENT_ID';

3. Check Edge Function logs:
Go to Supabase Dashboard → Edge Functions → generate_clinical_summary → Logs
`)

// Step 7: Edge Function Test
console.log(`
📋 STEP 7: Test Edge Function Directly
Go to Supabase Dashboard → Edge Functions → generate_clinical_summary
Click "Invoke" and use this test payload:

{
  "type": "INSERT",
  "record": {
    "id": "test-id",
    "consultation_id": "test-consultation",
    "patient_id": "test-patient",
    "table": "appointments"
  }
}

Expected: Should return success (even if test data fails)
`)

console.log(`
🎯 MOST LIKELY ISSUES (in order of probability):

1. ❌ Missing Gemini API Key (90% of issues)
   - Get from: https://makersuite.google.com/app/apikey
   - Add to Supabase Dashboard → Settings → Edge Functions

2. ❌ Database migration not applied
   - Run: supabase/migrations/20241201_activate_ai_trigger.sql
   - In Supabase Dashboard → SQL Editor

3. ❌ Edge Function not deployed
   - Run: npx supabase functions deploy generate_clinical_summary

4. ❌ Trigger not working
   - Check if trigger exists in database
   - Verify appointment creation triggers the function

5. ❌ API key permissions
   - Verify API key is active
   - Check if API key has proper permissions
`)

console.log(`
✅ SUCCESS INDICATORS:

When working correctly, you should see:
- Appointment creation triggers AI processing
- Edge Function logs show "Processing appointment"
- Clinical summary created in database
- ai_processing_status changes to "completed"
- Patient/Doctor views show AI summary
`)

console.log(`
🚀 NEXT STEPS:

1. Set the Gemini API Key (most important!)
2. Run the database migration if not done
3. Deploy the Edge Function if not done
4. Test manually using the steps above
5. Create a new appointment to test the full flow

Need help? Check the logs in Supabase Dashboard → Edge Functions
`) 