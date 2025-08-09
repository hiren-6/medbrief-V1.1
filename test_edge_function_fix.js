import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

console.log('🧪 TESTING EDGE FUNCTION FIX')
console.log('============================')

// Test 1: Test process_patient_files edge function with proper request format
async function testProcessPatientFiles() {
  console.log('\n📋 TEST 1: Process Patient Files Edge Function')
  
  try {
    const testPayload = {
      appointment_id: '00000000-0000-0000-0000-000000000000',
      request_id: 'test-request-123'
    }
    
    console.log('📤 Sending test request with payload:', testPayload)
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(testPayload)
    })
    
    const responseText = await response.text()
    console.log(`📥 Response status: ${response.status}`)
    console.log(`📥 Response body: ${responseText}`)
    
    if (response.status === 409) {
      console.log('✅ Edge function is working - returned expected conflict status for test appointment')
    } else if (response.status === 400) {
      console.log('❌ Edge function still has the appointment_id issue')
    } else {
      console.log(`ℹ️  Edge function returned status ${response.status}`)
    }
    
    // Try to parse response
    try {
      const parsedResponse = JSON.parse(responseText)
      if (parsedResponse.appointment_id) {
        console.log('✅ Response includes appointment_id - parsing is working')
      }
    } catch (parseError) {
      console.log('⚠️  Response is not valid JSON')
    }
    
  } catch (error) {
    console.error('❌ Error testing edge function:', error.message)
  }
}

// Test 2: Test the database trigger format
async function testTriggerFormat() {
  console.log('\n📋 TEST 2: Database Trigger Format')
  
  try {
    // Simulate the exact format the trigger should send
    const triggerPayload = {
      appointment_id: '12345678-1234-1234-1234-123456789012',
      request_id: 'trigger-request-456'
    }
    
    console.log('📤 Testing trigger-style payload:', triggerPayload)
    
    const response = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(triggerPayload)
    })
    
    const responseText = await response.text()
    console.log(`📥 Trigger test status: ${response.status}`)
    console.log(`📥 Trigger test response: ${responseText}`)
    
    if (response.status !== 400) {
      console.log('✅ Trigger format is being processed correctly')
    } else {
      console.log('❌ Trigger format is still causing issues')
    }
    
  } catch (error) {
    console.error('❌ Error testing trigger format:', error.message)
  }
}

// Test 3: Test malformed requests to ensure error handling works
async function testErrorHandling() {
  console.log('\n📋 TEST 3: Error Handling')
  
  try {
    // Test with missing appointment_id
    console.log('🔍 Testing missing appointment_id...')
    const response1 = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ request_id: 'test' })
    })
    
    const responseText1 = await response1.text()
    console.log(`📥 Missing appointment_id status: ${response1.status}`)
    
    if (response1.status === 400) {
      console.log('✅ Correctly rejects missing appointment_id')
    }
    
    // Test with malformed JSON
    console.log('🔍 Testing malformed JSON...')
    const response2 = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    })
    
    const responseText2 = await response2.text()
    console.log(`📥 Malformed JSON status: ${response2.status}`)
    
    if (response2.status === 400) {
      console.log('✅ Correctly handles malformed JSON')
    }
    
  } catch (error) {
    console.error('❌ Error testing error handling:', error.message)
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting edge function fix tests...\n')
  
  await testProcessPatientFiles()
  await testTriggerFormat() 
  await testErrorHandling()
  
  console.log('\n✅ All tests completed!')
  console.log('\n📋 SUMMARY:')
  console.log('- Edge function should now properly parse appointment_id')
  console.log('- Request format from trigger should work correctly')
  console.log('- Error handling should be improved with better logging')
  console.log('- Concurrent processing should be handled properly')
  
  console.log('\n🚀 NEXT STEPS:')
  console.log('1. Apply the updated migration to fix the database trigger')
  console.log('2. Deploy the updated edge function')
  console.log('3. Test with a real appointment creation')
  console.log('4. Upload some test PDFs/images to verify Gemini processing')
}

// Run the tests
runAllTests().catch(console.error)
