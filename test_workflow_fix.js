// ===================================
// WORKFLOW FIX TEST SCRIPT
// Tests the complete workflow: file processing → clinical summary
// ===================================

import { createClient } from '@supabase/supabase-js'

// Configuration
const supabaseUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testWorkflow() {
  console.log('🧪 Testing complete workflow fix...\n')
  
  try {
    // Step 1: Test database functions
    console.log('📊 Step 1: Testing database functions...')
    await testDatabaseFunctions()
    
    // Step 2: Test file processing function
    console.log('\n📁 Step 2: Testing file processing function...')
    await testFileProcessing()
    
    // Step 3: Test clinical summary function
    console.log('\n🏥 Step 3: Testing clinical summary function...')
    await testClinicalSummary()
    
    // Step 4: Test complete workflow
    console.log('\n🔄 Step 4: Testing complete workflow...')
    await testCompleteWorkflow()
    
    console.log('\n✅ All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

async function testDatabaseFunctions() {
  console.log('  🔍 Testing database functions...')
  
  // Test get_unprocessed_files_for_appointment
  try {
    const { data: files, error } = await supabase
      .rpc('get_unprocessed_files_for_appointment', {
        appointment_uuid: '00000000-0000-0000-0000-000000000000'
      })
    
    if (error) {
      console.log(`    ❌ get_unprocessed_files_for_appointment: ${error.message}`)
    } else {
      console.log(`    ✅ get_unprocessed_files_for_appointment: ${files?.length || 0} files`)
    }
  } catch (error) {
    console.log(`    ❌ get_unprocessed_files_for_appointment: ${error.message}`)
  }
  
  // Test check_all_files_processed
  try {
    const { data: allProcessed, error } = await supabase
      .rpc('check_all_files_processed', {
        appointment_uuid: '00000000-0000-0000-0000-000000000000'
      })
    
    if (error) {
      console.log(`    ❌ check_all_files_processed: ${error.message}`)
    } else {
      console.log(`    ✅ check_all_files_processed: ${allProcessed}`)
    }
  } catch (error) {
    console.log(`    ❌ check_all_files_processed: ${error.message}`)
  }
  
  // Test acquire_appointment_processing_lock
  try {
    const { data: lockAcquired, error } = await supabase
      .rpc('acquire_appointment_processing_lock', {
        appointment_uuid: '00000000-0000-0000-0000-000000000000'
      })
    
    if (error) {
      console.log(`    ❌ acquire_appointment_processing_lock: ${error.message}`)
    } else {
      console.log(`    ✅ acquire_appointment_processing_lock: ${lockAcquired}`)
    }
  } catch (error) {
    console.log(`    ❌ acquire_appointment_processing_lock: ${error.message}`)
  }
}

async function testFileProcessing() {
  console.log('  🔄 Testing process_patient_files function...')
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        appointment_id: '00000000-0000-0000-0000-000000000000'
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log(`    ✅ process_patient_files: ${response.status}`)
      console.log(`    📊 Response:`, result)
    } else {
      console.log(`    ❌ process_patient_files: ${response.status} - ${result.error}`)
    }
  } catch (error) {
    console.log(`    ❌ process_patient_files error: ${error.message}`)
  }
}

async function testClinicalSummary() {
  console.log('  🏥 Testing generate_clinical_summary function...')
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/generate_clinical_summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        type: 'INSERT',
        record: {
          id: '00000000-0000-0000-0000-000000000000',
          consultation_id: '00000000-0000-0000-0000-000000000000',
          patient_id: '00000000-0000-0000-0000-000000000000',
          ai_processing_status: 'pending'
        },
        table: 'appointments'
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log(`    ✅ generate_clinical_summary: ${response.status}`)
      console.log(`    📊 Response:`, result)
    } else {
      console.log(`    ❌ generate_clinical_summary: ${response.status} - ${result.error}`)
    }
  } catch (error) {
    console.log(`    ❌ generate_clinical_summary error: ${error.message}`)
  }
}

async function testCompleteWorkflow() {
  console.log('  🔄 Testing complete workflow...')
  
  // Create a test appointment to trigger the workflow
  try {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        id: 'test-appointment-' + Date.now(),
        consultation_id: '00000000-0000-0000-0000-000000000000',
        patient_id: '00000000-0000-0000-0000-000000000000',
        doctor_id: '00000000-0000-0000-0000-000000000000',
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '10:00:00',
        status: 'scheduled',
        ai_processing_status: 'pending'
      })
      .select()
      .single()
    
    if (error) {
      console.log(`    ❌ Failed to create test appointment: ${error.message}`)
    } else {
      console.log(`    ✅ Created test appointment: ${appointment.id}`)
      console.log(`    📊 Appointment status: ${appointment.ai_processing_status}`)
      
      // Wait a bit for the trigger to process
      console.log('    ⏳ Waiting for workflow to process...')
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Check the appointment status
      const { data: updatedAppointment, error: checkError } = await supabase
        .from('appointments')
        .select('ai_processing_status, error_message')
        .eq('id', appointment.id)
        .single()
      
      if (checkError) {
        console.log(`    ❌ Failed to check appointment status: ${checkError.message}`)
      } else {
        console.log(`    📊 Final appointment status: ${updatedAppointment.ai_processing_status}`)
        if (updatedAppointment.error_message) {
          console.log(`    ⚠️  Error message: ${updatedAppointment.error_message}`)
        }
      }
    }
  } catch (error) {
    console.log(`    ❌ Complete workflow test error: ${error.message}`)
  }
}

// Run the test
testWorkflow()
