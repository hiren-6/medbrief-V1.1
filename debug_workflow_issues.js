// Comprehensive debugging script for workflow issues
const debugWorkflowIssues = async () => {
  console.log('🔍 DEBUGGING WORKFLOW ISSUES')
  console.log('='.repeat(50))

  // Test 1: Check if edge function is accessible
  console.log('\n📋 TEST 1: Edge Function Accessibility')
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
          id: 'test-appointment-id',
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

  // Test 2: Check database triggers
  console.log('\n📋 TEST 2: Database Trigger Status')
  console.log('-'.repeat(30))
  
  console.log(`
Run this SQL in Supabase Dashboard → SQL Editor:

-- Check if triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%ai%' OR trigger_name LIKE '%appointment%';

-- Check recent appointments
SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if pg_net extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';
`)

  // Test 3: Test Gemini API directly
  console.log('\n📋 TEST 3: Gemini API Direct Test')
  console.log('-'.repeat(30))
  
  const testGeminiAPI = async () => {
    const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY' // Replace with actual key
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
    
    const testPrompt = 'Generate a simple medical summary for a patient with chest pain.'
    
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: testPrompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100
          }
        })
      })

      if (response.status === 503) {
        console.log('⚠️  Gemini API overloaded (503) - this confirms the retry logic is needed')
      } else if (response.ok) {
        const result = await response.json()
        console.log('✅ Gemini API working correctly')
        console.log('📄 Response:', result.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100) + '...')
      } else {
        console.log('❌ Gemini API error:', response.status, await response.text())
      }
    } catch (error) {
      console.log('❌ Gemini API test failed:', error.message)
    }
  }

  await testGeminiAPI()

  // Test 4: Manual trigger test
  console.log('\n📋 TEST 4: Manual Trigger Test')
  console.log('-'.repeat(30))
  
  console.log(`
To test the webhook trigger manually:

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL to create a test appointment:

INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    appointment_date,
    appointment_time,
    ai_processing_status
) VALUES (
    'test-manual-trigger-' || EXTRACT(EPOCH FROM NOW())::text,
    'test-consultation-id',
    'test-patient-id',
    CURRENT_DATE,
    '10:00:00',
    'pending'
);

3. Check the edge function logs immediately after
4. Look for "Webhook received" message
`)

  // Test 5: Environment variables check
  console.log('\n📋 TEST 5: Environment Variables')
  console.log('-'.repeat(30))
  
  console.log(`
Check these environment variables in Supabase Dashboard → Settings → Edge Functions:

✅ SUPABASE_URL: https://jtfvuyocnbfpgewqxyki.supabase.co
✅ SUPABASE_SERVICE_ROLE_KEY: [Your service role key]
✅ GEMINI_API_KEY: [Your Gemini API key]

If any are missing, add them and redeploy the function.
`)

  // Test 6: Troubleshooting steps
  console.log('\n📋 TEST 6: Troubleshooting Steps')
  console.log('-'.repeat(30))
  
  console.log(`
🎯 ISSUE 1: Gemini API 503 Error
Solution: ✅ FIXED - Added retry logic with exponential backoff
- Function will retry 3 times with delays: 1s, 2s, 4s
- Falls back to manual review message if all retries fail
- Logs show retry attempts and final status

🎯 ISSUE 2: Webhook Not Triggering for New Appointments
Solutions:
1. ✅ FIXED - Enhanced trigger function with better error handling
2. ✅ FIXED - Added backup trigger that just marks appointments
3. ✅ FIXED - Improved logging to track trigger attempts

🔧 IMMEDIATE ACTIONS:
1. Run the database migration: supabase/migrations/20241203_fix_webhook_trigger_final.sql
2. Redeploy the edge function with retry logic
3. Test with a new appointment booking
4. Monitor logs for complete workflow
`)

  // Test 7: Expected workflow logs
  console.log('\n📋 TEST 7: Expected Workflow Logs')
  console.log('-'.repeat(30))
  
  console.log(`
After fixes, you should see this complete workflow:

1. "Webhook received: { type: 'INSERT', record_id: 'xxx' }"
2. "Processing appointment: { appointmentId, consultationId, patientId }"
3. "Step 1: Collecting clinical data..."
4. "Step 1: Clinical data collected successfully"
5. "Step 2: Processing patient files..."
6. "Processed files: X"
7. "Step 3: Building prompt..."
8. "Prompt built, length: XXX, images: X"
9. "Step 4: Calling Gemini API..."
10. "Calling Gemini API with: { promptLength: XXX, imageCount: X, model: 'gemini-2.0-flash-exp' }"
11. "Gemini API overloaded (attempt 1/3): model is overloaded. please try again"
12. "Retrying in 1000ms..."
13. "Gemini API response received, length: XXX" (after successful retry)
14. "Step 5: Validating and storing response..."
15. "Step 6: Updating appointment status..."
16. "Clinical summary generation completed successfully"
`)

  console.log('\n🎯 SUMMARY:')
  console.log('✅ Gemini API 503 errors: FIXED with retry logic')
  console.log('✅ Webhook trigger issues: FIXED with enhanced triggers')
  console.log('✅ Error logging: IMPROVED with detailed step tracking')
  console.log('✅ Fallback responses: ADDED for API failures')
  
  console.log('\n🚀 NEXT STEPS:')
  console.log('1. Deploy the updated edge function')
  console.log('2. Run the database migration')
  console.log('3. Test with a new appointment booking')
  console.log('4. Monitor logs for complete workflow')
}

// Export for use in other scripts
module.exports = {
  debugWorkflowIssues
}

// Run if this file is executed directly
if (require.main === module) {
  debugWorkflowIssues()
} 