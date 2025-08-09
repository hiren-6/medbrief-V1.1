// ===================================
// COMPREHENSIVE AI FEATURE DEBUGGING
// Step-by-step debugging for AI clinical summary
// ===================================

// Replace with your actual values
const SUPABASE_URL = 'YOUR_SUPABASE_URL' // Get from Supabase Dashboard
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY' // Get from Supabase Dashboard
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate_clinical_summary`

console.log(`
🔍 AI FEATURE DEBUGGING GUIDE
=============================

This script will help you identify where the AI feature is failing.
Follow each step and check the results.
`)

// Step 1: Check if database trigger exists
async function checkDatabaseTrigger() {
  console.log('\n📋 STEP 1: Checking Database Trigger')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'trg_ai_summary';
  `)
  
  console.log('Expected result: Should show trigger "trg_ai_summary"')
  console.log('If no results: The trigger is missing - run the migration')
}

// Step 2: Check if appointments table has AI status column
async function checkAppointmentsTable() {
  console.log('\n📋 STEP 2: Checking Appointments Table')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'ai_processing_status';
  `)
  
  console.log('Expected result: Should show ai_processing_status column')
  console.log('If no results: The column is missing - run the migration')
}

// Step 3: Check if clinical_summaries table exists
async function checkClinicalSummariesTable() {
  console.log('\n📋 STEP 3: Checking Clinical Summaries Table')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'clinical_summaries';
  `)
  
  console.log('Expected result: Should show clinical_summaries table')
  console.log('If no results: The table is missing - run the migration')
}

// Step 4: Check recent appointments
async function checkRecentAppointments() {
  console.log('\n📋 STEP 4: Checking Recent Appointments')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
SELECT 
  id,
  consultation_id,
  patient_id,
  ai_processing_status,
  created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;
  `)
  
  console.log('Expected result: Should show your recent appointments')
  console.log('Check if ai_processing_status is "triggered" or "pending"')
}

// Step 5: Check if Edge Function is deployed
async function checkEdgeFunction() {
  console.log('\n📋 STEP 5: Checking Edge Function Deployment')
  console.log('Go to Supabase Dashboard → Edge Functions')
  console.log('Look for: generate_clinical_summary function')
  console.log('Status should be: Deployed')
  
  console.log('\nTest the function directly:')
  console.log(`URL: ${EDGE_FUNCTION_URL}`)
  console.log('Method: POST')
  console.log('Headers: Content-Type: application/json')
  console.log('Body: {"type":"INSERT","record":{"id":"test","consultation_id":"test","patient_id":"test","table":"appointments"}}')
}

// Step 6: Check environment variables
async function checkEnvironmentVariables() {
  console.log('\n📋 STEP 6: Checking Environment Variables')
  console.log('Go to Supabase Dashboard → Settings → Edge Functions')
  console.log('Check if these variables exist:')
  console.log('- GEMINI_API_KEY (should be set)')
  console.log('- SUPABASE_URL (auto-set)')
  console.log('- SUPABASE_SERVICE_ROLE_KEY (auto-set)')
}

// Step 7: Check Edge Function logs
async function checkEdgeFunctionLogs() {
  console.log('\n📋 STEP 7: Checking Edge Function Logs')
  console.log('Go to Supabase Dashboard → Edge Functions → generate_clinical_summary')
  console.log('Click on the function and check the "Logs" tab')
  console.log('Look for:')
  console.log('- Function invocation logs')
  console.log('- Error messages')
  console.log('- API call logs')
}

// Step 8: Test the complete flow
async function testCompleteFlow() {
  console.log('\n📋 STEP 8: Testing Complete Flow')
  console.log('1. Create a new appointment with files')
  console.log('2. Check if trigger fires (ai_processing_status should change to "triggered")')
  console.log('3. Check Edge Function logs for processing')
  console.log('4. Check if clinical_summary is created')
  console.log('5. Check if ai_processing_status changes to "completed"')
}

// Step 9: Manual trigger test
async function manualTriggerTest() {
  console.log('\n📋 STEP 9: Manual Trigger Test')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
-- Find your appointment ID
SELECT id, consultation_id, patient_id 
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;

-- Manually trigger the function (replace with your appointment ID)
UPDATE appointments 
SET ai_processing_status = 'triggered' 
WHERE id = 'YOUR_APPOINTMENT_ID';
  `)
}

// Step 10: Check file processing
async function checkFileProcessing() {
  console.log('\n📋 STEP 10: Checking File Processing')
  console.log('Go to Supabase Dashboard → SQL Editor and run:')
  console.log(`
SELECT 
  id,
  file_name,
  file_type,
  processed,
  parsed_text IS NOT NULL as has_parsed_text
FROM patient_files 
ORDER BY uploaded_at DESC 
LIMIT 5;
  `)
  
  console.log('Expected: processed should be true, has_parsed_text should be true for text files')
}

// Run all checks
async function runAllChecks() {
  console.log('🚀 Starting comprehensive debugging...')
  
  await checkDatabaseTrigger()
  await checkAppointmentsTable()
  await checkClinicalSummariesTable()
  await checkRecentAppointments()
  await checkEdgeFunction()
  await checkEnvironmentVariables()
  await checkEdgeFunctionLogs()
  await testCompleteFlow()
  await manualTriggerTest()
  await checkFileProcessing()
  
  console.log('\n✅ Debugging checks complete!')
  console.log('\n📝 Next Steps:')
  console.log('1. Run each SQL query in Supabase Dashboard')
  console.log('2. Check the results against expected outcomes')
  console.log('3. Fix any missing components')
  console.log('4. Test the complete flow again')
}

// Common issues and solutions
console.log('\n🔧 COMMON ISSUES & SOLUTIONS:')
console.log(`
❌ Issue: No trigger found
✅ Solution: Run database migration

❌ Issue: Edge Function not deployed
✅ Solution: Run: npx supabase functions deploy generate_clinical_summary

❌ Issue: Missing environment variables
✅ Solution: Set GEMINI_API_KEY in Supabase Dashboard

❌ Issue: Function logs show errors
✅ Solution: Check API key and network connectivity

❌ Issue: Files not processed
✅ Solution: Check file upload and parsing logic

❌ Issue: No clinical summaries created
✅ Solution: Check AI API response and validation
`)

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllChecks,
    checkDatabaseTrigger,
    checkAppointmentsTable,
    checkClinicalSummariesTable,
    checkRecentAppointments,
    checkEdgeFunction,
    checkEnvironmentVariables,
    checkEdgeFunctionLogs,
    testCompleteFlow,
    manualTriggerTest,
    checkFileProcessing
  }
}

// Run if called directly
if (typeof window === 'undefined') {
  runAllChecks()
} 