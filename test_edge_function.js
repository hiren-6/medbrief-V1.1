// ===================================
// TASK 2: EDGE FUNCTION TEST SCRIPT
// Test the deployed Edge Function
// ===================================

// Replace with your actual Supabase project URL
const SUPABASE_URL = 'https://jtfvuyocnbfpgewqxyki.supabase.co'
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate_clinical_summary`

// Test webhook payload
const testPayload = {
  type: 'INSERT',
  record: {
    id: 'test-appointment-id',
    consultation_id: 'test-consultation-id',
    patient_id: 'test-patient-id',
    doctor_id: 'test-doctor-id',
    table: 'appointments'
  }
}

// Test the Edge Function
async function testEdgeFunction() {
  try {
    console.log('🧪 Testing Edge Function...')
    console.log('URL:', EDGE_FUNCTION_URL)
    console.log('Payload:', JSON.stringify(testPayload, null, 2))

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'your-anon-key'}`
      },
      body: JSON.stringify(testPayload)
    })

    const result = await response.json()
    
    console.log('📊 Response Status:', response.status)
    console.log('📄 Response Body:', JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('✅ Edge Function test successful!')
    } else {
      console.log('❌ Edge Function test failed!')
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error.message)
  }
}

// Database verification queries
const verificationQueries = [
  {
    name: 'Check if trigger exists',
    query: `
      SELECT trigger_name, event_manipulation 
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_ai_summary'
    `
  },
  {
    name: 'Check appointments with AI status',
    query: `
      SELECT ai_processing_status, COUNT(*) 
      FROM appointments 
      GROUP BY ai_processing_status
    `
  },
  {
    name: 'Check clinical summaries table',
    query: `
      SELECT COUNT(*) as summary_count 
      FROM clinical_summaries
    `
  }
]

// Instructions for manual testing
console.log(`
🚀 TASK 2 DEPLOYMENT GUIDE
==========================

1. DEPLOY EDGE FUNCTION:
   - Install Supabase CLI: npm install -g supabase
   - Login: supabase login
   - Link project: supabase link --project-ref YOUR_PROJECT_REF
   - Deploy: supabase functions deploy generate_clinical_summary

2. APPLY DATABASE MIGRATION:
   - Go to Supabase Dashboard → SQL Editor
   - Run the content of: supabase/migrations/20241201_activate_ai_trigger.sql

3. SET ENVIRONMENT VARIABLES:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Add: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

4. TEST THE FUNCTION:
   - Run this script: node test_edge_function.js
   - Or create a test appointment in your app

5. VERIFY DEPLOYMENT:
   - Check Edge Function logs in Supabase Dashboard
   - Verify trigger was created in database
   - Test with real appointment creation

📁 FILES CREATED:
- supabase/functions/generate_clinical_summary/index.ts
- supabase/functions/generate_clinical_summary/deno.json
- supabase/functions/generate_clinical_summary/import_map.json
- supabase/migrations/20241201_activate_ai_trigger.sql
- TASK2_README.md

🔍 NEXT STEPS:
- Deploy the Edge Function
- Test with a real appointment
- Check logs for any errors
- Proceed to Task 3 for Gemini integration
`)

// Export for use in other scripts
module.exports = {
  testEdgeFunction,
  verificationQueries,
  testPayload
}

// Run test if this file is executed directly
if (require.main === module) {
  testEdgeFunction()
} 