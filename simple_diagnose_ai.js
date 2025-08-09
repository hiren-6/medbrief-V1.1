// Simple AI Flow Diagnostic
// This script checks the entire AI processing flow without additional dependencies

console.log('🔍 DIAGNOSING AI PROCESSING FLOW...\n')

console.log(`
📋 STEP 1: DATABASE TRIGGERS CHECK
====================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;

Expected: Should show 4 triggers:
- trg_complete_medical_workflow
- trg_ai_summary  
- trg_manual_processing
- trg_link_files_to_appointment
`)

console.log(`
📋 STEP 2: DATABASE FUNCTIONS CHECK
====================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'trigger_ai_clinical_summary',
    'trigger_complete_medical_workflow', 
    'mark_appointment_for_processing',
    'trigger_link_files_to_appointment',
    'link_files_to_appointment',
    'get_unprocessed_files_for_appointment',
    'check_all_files_processed',
    'update_file_processing_status'
)
ORDER BY routine_name;

Expected: Should show 8 functions
`)

console.log(`
📋 STEP 3: RECENT APPOINTMENTS CHECK
=====================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    error_message,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;

Check if:
- ai_processing_status is 'pending', 'triggered', 'completed', or 'failed'
- Any appointments have error_message
- Recent appointments exist
`)

console.log(`
📋 STEP 4: PATIENT FILES CHECK
===============================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
    id,
    consultation_id,
    appointment_id,
    file_name,
    file_type,
    processed,
    extracted_text IS NOT NULL as has_extracted_text,
    created_at
FROM patient_files 
ORDER BY created_at DESC 
LIMIT 5;

Check if:
- Files have appointment_id (should be linked)
- processed status is true/false
- extracted_text exists for processed files
`)

console.log(`
📋 STEP 5: CLINICAL SUMMARIES CHECK
====================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
    id,
    consultation_id,
    patient_id,
    processing_status,
    created_at
FROM clinical_summaries 
ORDER BY created_at DESC 
LIMIT 5;

Expected: Should show clinical summaries if AI processing worked
`)

console.log(`
📋 STEP 6: EDGE FUNCTION DEPLOYMENT CHECK
=========================================

Go to Supabase Dashboard → Edge Functions

Check:
1. generate_clinical_summary function:
   - Status: "Deployed"
   - Click "Invoke" to test
   - Use test payload:
   {
     "type": "INSERT",
     "record": {
       "id": "test-id",
       "consultation_id": "test-consultation",
       "patient_id": "test-patient"
     },
     "table": "appointments"
   }

2. process_patient_files function:
   - Status: "Deployed" 
   - Click "Invoke" to test
   - Use test payload:
   {
     "appointment_id": "test-appointment-id"
   }
`)

console.log(`
📋 STEP 7: ENVIRONMENT VARIABLES CHECK
=======================================

Go to Supabase Dashboard → Settings → Edge Functions

Verify these environment variables exist:
✅ GEMINI_API_KEY (should be set to your API key)
✅ SUPABASE_URL (auto-set)
✅ SUPABASE_SERVICE_ROLE_KEY (auto-set)

If GEMINI_API_KEY is missing, that's the main issue!
`)

console.log(`
📋 STEP 8: WEBHOOK CONFIGURATION CHECK
=======================================

CRITICAL: Check if webhook is configured!

Go to Supabase Dashboard → Database → Webhooks

You should see a webhook configured for:
- Table: appointments
- Events: INSERT
- URL: https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary
- Method: POST

If no webhook exists, that's why AI processing isn't happening!
`)

console.log(`
📋 STEP 9: MANUAL TRIGGER TEST
===============================

If webhook is missing, test manually:

1. Find your appointment ID:
SELECT id, consultation_id, patient_id 
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;

2. Manually trigger processing:
UPDATE appointments 
SET ai_processing_status = 'triggered' 
WHERE id = 'YOUR_APPOINTMENT_ID';

3. Check Edge Function logs:
Go to Supabase Dashboard → Edge Functions → generate_clinical_summary → Logs

Look for:
✅ "Webhook received"
✅ "Processing appointment: {id}"
✅ "AI response received" 
✅ "Clinical summary stored"
`)

console.log(`
📋 STEP 10: COMPREHENSIVE WORKFLOW TEST
========================================

Test the complete workflow:

1. Create a new appointment with files
2. Check if webhook triggers
3. Check Edge Function logs
4. Check if clinical summary is created
5. Check if ai_processing_status changes to 'completed'

Run this SQL to monitor:
SELECT 
    a.id,
    a.ai_processing_status,
    a.error_message,
    COUNT(pf.id) as file_count,
    COUNT(cs.id) as summary_count
FROM appointments a
LEFT JOIN patient_files pf ON a.id = pf.appointment_id
LEFT JOIN clinical_summaries cs ON a.consultation_id = cs.consultation_id
WHERE a.created_at > NOW() - INTERVAL '1 hour'
GROUP BY a.id, a.ai_processing_status, a.error_message
ORDER BY a.created_at DESC;
`)

console.log(`
🎯 MOST LIKELY ISSUES (in order of probability):

1. ❌ NO WEBHOOK CONFIGURED (90% probability)
   - Database triggers exist but don't call Edge Function
   - Solution: Set up webhook in Supabase Dashboard

2. ❌ MISSING GEMINI_API_KEY (5% probability)  
   - Edge Function can't access API key
   - Solution: Set GEMINI_API_KEY in Edge Function settings

3. ❌ EDGE FUNCTION NOT DEPLOYED (3% probability)
   - Function not accessible
   - Solution: Deploy functions in Supabase Dashboard

4. ❌ DATABASE DATA MISSING (2% probability)
   - Appointment missing consultation_id
   - Consultation missing form_data
   - Solution: Check data integrity
`)

console.log(`
🔧 IMMEDIATE FIXES:

1. SET UP WEBHOOK (Most Important):
   - Go to Supabase Dashboard → Database → Webhooks
   - Create new webhook for appointments table
   - Events: INSERT
   - URL: https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary
   - Method: POST

2. VERIFY ENVIRONMENT VARIABLES:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Ensure GEMINI_API_KEY is set correctly

3. TEST THE FLOW:
   - Create new appointment
   - Check webhook triggers
   - Check Edge Function logs
   - Verify clinical summary created
`)

console.log(`
📊 SUCCESS INDICATORS:

Your AI flow is working when:
✅ Appointment creation triggers webhook
✅ Edge Function logs show "Webhook received"
✅ Edge Function logs show "AI response received"
✅ Clinical summary is created in database
✅ ai_processing_status changes to "completed"
✅ Patient/Doctor views show AI summary

If any step fails, the logs will tell you exactly what's wrong!
`)

console.log(`
🚀 NEXT STEPS:

1. Check webhook configuration in Supabase Dashboard
2. Verify GEMINI_API_KEY is set in Edge Function settings  
3. Create a new appointment to test the flow
4. Check Edge Function logs for any errors
5. Verify clinical summary is created in database
6. Test the AI summary appears in your app

The webhook is the missing piece that connects database triggers to Edge Functions!
`)

console.log('\n🎯 DIAGNOSIS COMPLETE!')
console.log('\nRun the SQL queries above in Supabase Dashboard to identify the exact issue.') 