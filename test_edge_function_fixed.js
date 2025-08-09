// Test script for the fixed edge function
const testEdgeFunction = async () => {
  const edgeFunctionUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary'
  
  // Test payload that matches the expected format
  const testPayload = {
    type: 'INSERT',
    record: {
      id: 'test-appointment-id',
      consultation_id: 'test-consultation-id',
      patient_id: 'test-patient-id',
      table: 'appointments'
    }
  }

  console.log('🧪 Testing Edge Function with payload:', JSON.stringify(testPayload, null, 2))

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY' // Replace with actual key
      },
      body: JSON.stringify(testPayload)
    })

    const responseText = await response.text()
    console.log('📊 Response Status:', response.status)
    console.log('📄 Response Headers:', Object.fromEntries(response.headers.entries()))
    console.log('📝 Response Body:', responseText)

    if (response.ok) {
      console.log('✅ Edge Function executed successfully!')
    } else {
      console.log('❌ Edge Function failed with status:', response.status)
    }

  } catch (error) {
    console.error('💥 Error testing edge function:', error)
  }
}

// Test with different scenarios
const testScenarios = [
  {
    name: 'Valid Appointment Insert',
    payload: {
      type: 'INSERT',
      record: {
        id: 'test-appointment-id',
        consultation_id: 'test-consultation-id',
        patient_id: 'test-patient-id',
        table: 'appointments'
      }
    }
  },
  {
    name: 'Invalid Type (UPDATE)',
    payload: {
      type: 'UPDATE',
      record: {
        id: 'test-appointment-id',
        consultation_id: 'test-consultation-id',
        patient_id: 'test-patient-id',
        table: 'appointments'
      }
    }
  },
  {
    name: 'Invalid Table',
    payload: {
      type: 'INSERT',
      record: {
        id: 'test-record-id',
        table: 'other_table'
      }
    }
  }
]

const runAllTests = async () => {
  console.log('🚀 Starting Edge Function Tests...\n')
  
  for (const scenario of testScenarios) {
    console.log(`\n📋 Testing: ${scenario.name}`)
    console.log('='.repeat(50))
    
    try {
      const response = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY' // Replace with actual key
        },
        body: JSON.stringify(scenario.payload)
      })

      const responseText = await response.text()
      console.log('Status:', response.status)
      console.log('Response:', responseText)
      
    } catch (error) {
      console.error('Error:', error.message)
    }
  }
}

// Export for use in other scripts
module.exports = {
  testEdgeFunction,
  runAllTests,
  testScenarios
}

// Run if this file is executed directly
if (require.main === module) {
  testEdgeFunction()
} 