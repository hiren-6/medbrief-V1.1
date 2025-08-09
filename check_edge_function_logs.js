// ===================================
// EDGE FUNCTION LOGS DEBUGGING
// Check what's happening in your Edge Function
// ===================================

console.log(`
🔍 EDGE FUNCTION LOGS DEBUGGING
==============================

Since your Edge Function is invoked but Gemini API tokens aren't being used,
let's check the logs to see where it's failing.
`)

console.log(`
📋 STEP 1: Check Edge Function Logs
===================================

Go to: Supabase Dashboard → Edge Functions → generate_clinical_summary → Logs

Look for these specific log messages:

✅ GOOD SIGNS:
- "Webhook received" - Function started
- "Processing appointment: {appointmentId}" - Function processing
- "AI response received" - Gemini API worked
- "Clinical summary stored" - Database updated

❌ BAD SIGNS:
- "Error fetching clinical data" - Database issue
- "Gemini API error" - API key or network issue
- "Error building prompt" - Data processing issue
- "Error storing summary" - Database write issue
- "No GEMINI_API_KEY found" - Environment variable issue
`)

console.log(`
📋 STEP 2: Test Edge Function Directly
======================================

Go to: Supabase Dashboard → Edge Functions → generate_clinical_summary
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

console.log(`
📋 STEP 3: Check Environment Variables
=====================================

Go to: Supabase Dashboard → Settings → Edge Functions

Verify these exist:
- ✅ GEMINI_API_KEY (should be set)
- ✅ SUPABASE_URL (auto-set)
- ✅ SUPABASE_SERVICE_ROLE_KEY (auto-set)

If GEMINI_API_KEY is missing or incorrect, that's the issue!
`)

console.log(`
📋 STEP 4: Test Gemini API Key Manually
========================================

Create a simple test to verify your API key works:

1. Go to: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent
2. Use a tool like Postman or curl
3. Method: POST
4. Headers: Content-Type: application/json
5. Body:
{
  "contents": [{
    "parts": [{
      "text": "Hello, this is a test"
    }]
  }]
}
6. Add your API key as a query parameter: ?key=YOUR_API_KEY

If this fails, your API key is the issue.
`)

console.log(`
📋 STEP 5: Check Database Data
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
`)

console.log(`
🎯 MOST LIKELY ISSUES:

1. ❌ GEMINI_API_KEY environment variable issue (80% probability)
   - Check if it's set correctly in Supabase Dashboard
   - Verify the API key is valid and active
   - Test the API key manually

2. ❌ Database data missing (15% probability)
   - Appointment doesn't have consultation_id
   - Consultation doesn't have form_data
   - Patient files not uploaded properly

3. ❌ Edge Function code error (5% probability)
   - Check the logs for JavaScript errors
   - Verify the function can access the API key
   - Check if the function is calling the right API endpoint

4. ❌ Network/API issues (rare)
   - Gemini API service down
   - Network connectivity issues
   - Rate limiting
`)

console.log(`
🔧 QUICK FIXES:

1. Re-set the GEMINI_API_KEY:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Delete the existing GEMINI_API_KEY
   - Add it again with the correct value

2. Test the API key manually:
   - Use the test above to verify it works

3. Check the logs:
   - Look for specific error messages
   - The logs will tell you exactly what's failing

4. Re-deploy the function:
   npx supabase functions deploy generate_clinical_summary
`)

console.log(`
📊 HOW TO RUN TEST SCRIPTS:
===========================

1. Open terminal/command prompt
2. Navigate to your project folder
3. Run: node filename.js

Example:
node check_edge_function_logs.js
node debug_ai_feature.js
node quick_test_ai_feature.js

Or run directly:
node check_edge_function_logs.js
`) 