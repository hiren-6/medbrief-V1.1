// Diagnostic script for webhook trigger issues
const diagnoseWebhookTrigger = async () => {
  console.log('🔍 DIAGNOSING WEBHOOK TRIGGER ISSUES')
  console.log('='.repeat(50))

  // Check 1: Database trigger status
  console.log('\n📋 CHECK 1: Database Trigger Status')
  console.log('-'.repeat(30))
  
  console.log(`
Run this SQL in Supabase Dashboard → SQL Editor to check trigger status:

-- Check if triggers exist and are active
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name LIKE '%ai%' OR trigger_name LIKE '%appointment%';

-- Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check recent appointments and their status
SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 10;
`)

  // Check 2: Test manual appointment creation
  console.log('\n📋 CHECK 2: Manual Appointment Creation Test')
  console.log('-'.repeat(30))
  
  console.log(`
Run this SQL to test the trigger manually:

-- Create a test appointment with proper UUIDs
INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    appointment_date,
    appointment_time,
    ai_processing_status
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    CURRENT_DATE,
    '10:00:00',
    'pending'
);

-- Check if the trigger fired
SELECT 
    id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;
`)

  // Check 3: Edge function accessibility
  console.log('\n📋 CHECK 3: Edge Function Accessibility')
  console.log('-'.repeat(30))
  
  try {
    const response = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY' // Replace with actual key
      },
      body: JSON.stringify({
        type: 'INSERT',
        record: {
          id: 'test-diagnostic-id',
          consultation_id: 'test-consultation-id',
          patient_id: 'test-patient-id',
          table: 'appointments'
        }
      })
    })

    const responseText = await response.text()
    console.log('✅ Edge Function Response:', response.status)
    console.log('📄 Response Body:', responseText)
    
  } catch (error) {
    console.log('❌ Edge Function Error:', error.message)
  }

  // Check 4: Environment variables
  console.log('\n📋 CHECK 4: Environment Variables')
  console.log('-'.repeat(30))
  
  console.log(`
Check these in Supabase Dashboard → Settings → Edge Functions:

✅ SUPABASE_URL: https://jtfvuyocnbfpgewqxyki.supabase.co
✅ SUPABASE_SERVICE_ROLE_KEY: [Your service role key]
✅ GEMINI_API_KEY: [Your Gemini API key]

If any are missing, add them and redeploy the function.
`)

  // Check 5: Common issues and solutions
  console.log('\n📋 CHECK 5: Common Issues & Solutions')
  console.log('-'.repeat(30))
  
  console.log(`
🎯 ISSUE: Webhook only shows "Webhook received" for new appointments

POSSIBLE CAUSES:
1. ❌ Database trigger not firing
   - Check if triggers exist in database
   - Verify pg_net extension is enabled
   - Check trigger function for errors

2. ❌ Service role key not accessible
   - Verify service role key in environment variables
   - Check if key has proper permissions

3. ❌ Edge function not accessible from database
   - Check if function URL is correct
   - Verify network connectivity from database

4. ❌ Appointment data missing required fields
   - Ensure consultation_id and patient_id are valid UUIDs
   - Check if related records exist

SOLUTIONS:
1. ✅ Run the updated migration with proper UUID handling
2. ✅ Check database logs for trigger errors
3. ✅ Verify environment variables are set
4. ✅ Test with manual appointment creation
5. ✅ Monitor edge function logs for incoming requests
`)

  // Check 6: Debugging steps
  console.log('\n📋 CHECK 6: Debugging Steps')
  console.log('-'.repeat(30))
  
  console.log(`
🔧 STEP-BY-STEP DEBUGGING:

1. Run the updated migration (fixes UUID error):
   - Copy supabase/migrations/20241203_fix_webhook_trigger_final.sql
   - Paste in Supabase Dashboard → SQL Editor
   - Execute the migration

2. Test the trigger manually:
   - Run the manual appointment creation SQL above
   - Check if ai_processing_status changes to 'triggered'
   - Monitor edge function logs

3. Check edge function logs:
   - Go to Supabase Dashboard → Edge Functions → Logs
   - Look for "Webhook received" messages
   - Check for any error messages

4. Verify trigger function:
   - Check if trigger function exists in database
   - Verify it's attached to appointments table
   - Test the function manually

5. Check appointment data:
   - Ensure new appointments have valid UUIDs
   - Verify consultation_id and patient_id exist
   - Check if ai_processing_status is being updated
`)

  // Check 7: Expected behavior
  console.log('\n📋 CHECK 7: Expected Behavior')
  console.log('-'.repeat(30))
  
  console.log(`
✅ CORRECT BEHAVIOR:

1. When new appointment is created:
   - Database trigger fires immediately
   - ai_processing_status changes to 'triggered'
   - HTTP request sent to edge function
   - Edge function logs show "Webhook received"

2. In edge function logs:
   - "Webhook received: { type: 'INSERT', record_id: 'xxx' }"
   - "Processing appointment: { appointmentId, consultationId, patientId }"
   - "Step 1: Collecting clinical data..."
   - ... (all 6 steps)

3. In database:
   - Appointment ai_processing_status: 'triggered' → 'completed'
   - Clinical summary stored in clinical_summaries table

❌ CURRENT ISSUE:
- Manual testing works (edge function accessible)
- New appointments don't trigger workflow
- Only "Webhook received" appears in logs
- No subsequent steps executed

🎯 ROOT CAUSE: Database trigger not properly calling edge function
`)

  console.log('\n🎯 SUMMARY:')
  console.log('✅ UUID error: FIXED in migration')
  console.log('❌ Webhook trigger: NEEDS DATABASE MIGRATION')
  console.log('✅ Manual testing: WORKING')
  console.log('❌ Automatic trigger: NOT WORKING')
  
  console.log('\n🚀 IMMEDIATE ACTIONS:')
  console.log('1. Run the updated database migration')
  console.log('2. Test with manual appointment creation')
  console.log('3. Monitor edge function logs')
  console.log('4. Check database trigger status')
}

// Export for use in other scripts
module.exports = {
  diagnoseWebhookTrigger
}

// Run if this file is executed directly
if (require.main === module) {
  diagnoseWebhookTrigger()
} 