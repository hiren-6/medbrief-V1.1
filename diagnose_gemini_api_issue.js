// ===================================
// DIAGNOSE GEMINI API ISSUE
// Check why Gemini API is not being called despite webhook working
// ===================================

console.log(`
🔍 DIAGNOSE GEMINI API ISSUE
============================

Since the webhook is triggering but Gemini API tokens aren't being used,
let's check the Edge Function logs to see where it's failing.
`)

// Step 1: Check Edge Function logs
console.log(`
📋 STEP 1: Check Edge Function Logs
===================================

Go to Supabase Dashboard → Edge Functions → generate_clinical_summary → Logs

Look for these specific log messages in order:

✅ GOOD FLOW:
1. "Webhook received: { type: 'INSERT', record_id: 'xxx' }"
2. "Processing appointment: { appointmentId, consultationId, patientId }"
3. "Processed files: X" (where X is number of files)
4. "Prompt built, length: XXX, images: X"
5. "Calling Gemini API with: { promptLength: XXX, imageCount: X, model: 'gemini-2.0-flash-exp' }"
6. "Gemini API response received, length: XXX"
7. "Clinical summary generation completed successfully"

❌ FAILURE POINTS:
- If you see "Webhook received" but not "Processing appointment" → Database data issue
- If you see "Processing appointment" but not "Processed files" → File processing issue
- If you see "Processed files" but not "Prompt built" → Prompt building issue
- If you see "Prompt built" but not "Calling Gemini API" → API call preparation issue
- If you see "Calling Gemini API" but not "Gemini API response received" → API call issue
- If you see "Gemini API error: XXX" → API key or request format issue
`)

// Step 2: Check environment variable
console.log(`
📋 STEP 2: Check Environment Variable
====================================

Go to Supabase Dashboard → Settings → Edge Functions

Check if GEMINI_API_KEY exists and is correct.

If you see "GEMINI_API_KEY environment variable is not set" in logs,
that's the issue!
`)

// Step 3: Test the API key manually
console.log(`
📋 STEP 3: Test API Key Manually
=================================

Run this test to verify your API key works:

node test_gemini_api.js

If this fails, your API key is the issue.
If this succeeds, the issue is in the Edge Function.
`)

// Step 4: Check database data
console.log(`
📋 STEP 4: Check Database Data
==============================

Go to Supabase Dashboard → SQL Editor and run:

-- Check if appointment has proper data
SELECT 
  id,
  consultation_id,
  patient_id,
  ai_processing_status
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;

-- Check if consultation has form data
SELECT 
  c.id,
  c.form_data,
  c.patient_id
FROM consultations c
JOIN appointments a ON c.id = a.consultation_id
ORDER BY a.created_at DESC 
LIMIT 1;

-- Check if patient files exist
SELECT 
  id,
  file_name,
  file_type,
  processed
FROM patient_files 
ORDER BY uploaded_at DESC 
LIMIT 5;

Expected: Should show data for all queries
`)

// Step 5: Check the ai_clinical_data view
console.log(`
📋 STEP 5: Check AI Clinical Data View
======================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
  consultation_id,
  patient_id,
  form_data,
  age,
  family_history
FROM ai_clinical_data 
ORDER BY created_at DESC 
LIMIT 1;

Expected: Should show data if the view is working
If no results, the view might not be created or have data
`)

// Step 6: Test Edge Function manually
console.log(`
📋 STEP 6: Test Edge Function Manually
======================================

Go to Supabase Dashboard → Edge Functions → generate_clinical_summary
Click "Invoke" and use this test payload:

{
  "type": "INSERT",
  "record": {
    "id": "test-appointment-id",
    "consultation_id": "test-consultation-id",
    "patient_id": "test-patient-id",
    "table": "appointments"
  }
}

Check the response and logs for errors.
`)

// Step 7: Check specific error messages
console.log(`
📋 STEP 7: Check Specific Error Messages
========================================

Look for these specific error messages in Edge Function logs:

❌ "Failed to collect clinical data" → Database query issue
❌ "Error fetching clinical data" → Database connection issue
❌ "GEMINI_API_KEY environment variable is not set" → Environment variable issue
❌ "Gemini API error: 400" → Invalid request format
❌ "Gemini API error: 403" → API key permissions issue
❌ "Gemini API error: 429" → Rate limiting
❌ "Invalid response from Gemini API" → API response format issue
❌ "Error calling Gemini API" → Network or API issue
`)

// Step 8: Check the prompt building
console.log(`
📋 STEP 8: Check Prompt Building
================================

The issue might be in the prompt building step. Check if:

1. Clinical data is being collected properly
2. Patient files are being processed
3. The prompt is being built correctly
4. The prompt is not too long or malformed

Look for these log messages:
- "Prompt built, length: XXX, images: X"
- If length is 0, there's no data to process
- If length is very large, the prompt might be too long
`)

// Step 9: Check file processing
console.log(`
📋 STEP 9: Check File Processing
================================

Go to Supabase Dashboard → SQL Editor and run:

SELECT 
  id,
  file_name,
  file_type,
  processed,
  parsed_text IS NOT NULL as has_parsed_text
FROM patient_files 
ORDER BY uploaded_at DESC 
LIMIT 5;

Expected: processed should be true, has_parsed_text should be true for text files
`)

console.log(`
🎯 MOST LIKELY ISSUES (in order of probability):

1. ❌ Environment variable not accessible (40% probability)
   - GEMINI_API_KEY not set correctly in Edge Function
   - Function can't access the environment variable

2. ❌ Database data missing (30% probability)
   - Appointment doesn't have consultation_id
   - Consultation doesn't have form_data
   - Patient files not uploaded properly
   - ai_clinical_data view not working

3. ❌ API call failing (20% probability)
   - Network connectivity issue
   - API key permissions issue
   - Request format issue

4. ❌ Prompt building issue (10% probability)
   - Prompt too long
   - Malformed prompt
   - No data to process
`)

console.log(`
🔧 IMMEDIATE FIXES:

1. CHECK ENVIRONMENT VARIABLE:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Verify GEMINI_API_KEY is set correctly
   - Try deleting and re-adding the environment variable

2. TEST API KEY MANUALLY:
   - Run: node test_gemini_api.js
   - If it fails, get a new API key

3. CHECK DATABASE DATA:
   - Run the SQL queries above
   - Make sure all data exists

4. TEST EDGE FUNCTION MANUALLY:
   - Use the test payload above
   - Check the logs for specific errors

5. RE-DEPLOY THE FUNCTION:
   npx supabase functions deploy generate_clinical_summary
`)

console.log(`
📊 SUCCESS INDICATORS:

Your Gemini API integration is working when:
✅ Edge Function logs show "Calling Gemini API"
✅ Edge Function logs show "Gemini API response received"
✅ Google Console shows API token usage
✅ Clinical summary is created in database
✅ ai_processing_status changes to "completed"

The logs will tell you exactly where the process is failing!
`)

console.log(`
🚀 NEXT STEPS:

1. Check the Edge Function logs for specific error messages
2. Test the API key manually
3. Verify database data exists
4. Test the Edge Function manually
5. Fix the specific issue identified

Share the specific error messages from the logs, and I can help you fix the exact issue!
`) 