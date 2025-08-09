// ===================================
// APPOINTMENT CREATION TEST SCRIPT
// Tests the complete appointment creation workflow
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

async function testAppointmentCreation() {
  console.log('🧪 Testing appointment creation workflow...\n')
  
  try {
    // Step 1: Test database structure
    console.log('📊 Step 1: Testing database structure...')
    await testDatabaseStructure()
    
    // Step 2: Test consultation creation
    console.log('\n📝 Step 2: Testing consultation creation...')
    const consultationId = await testConsultationCreation()
    
    // Step 3: Test appointment creation
    console.log('\n📅 Step 3: Testing appointment creation...')
    const appointmentId = await testAppointmentCreation(consultationId)
    
    // Step 4: Test trigger functionality
    console.log('\n🔧 Step 4: Testing trigger functionality...')
    await testTriggerFunctionality(appointmentId)
    
    // Step 5: Clean up test data
    console.log('\n🧹 Step 5: Cleaning up test data...')
    await cleanupTestData(consultationId, appointmentId)
    
    console.log('\n✅ All tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

async function testDatabaseStructure() {
  console.log('  🔍 Testing database structure...')
  
  // Test appointments table structure
  try {
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'appointments')
      .eq('table_schema', 'public')
    
    if (error) {
      console.log(`    ❌ Failed to check appointments table: ${error.message}`)
    } else {
      console.log(`    ✅ Appointments table has ${columns?.length || 0} columns`)
      
      // Check for required columns
      const requiredColumns = ['id', 'patient_id', 'doctor_id', 'consultation_id', 'appointment_date', 'appointment_time', 'status', 'ai_processing_status']
      const columnNames = columns?.map(c => c.column_name) || []
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col))
      if (missingColumns.length > 0) {
        console.log(`    ⚠️  Missing columns: ${missingColumns.join(', ')}`)
      } else {
        console.log(`    ✅ All required columns present`)
      }
    }
  } catch (error) {
    console.log(`    ❌ Database structure test error: ${error.message}`)
  }
  
  // Test triggers
  try {
    const { data: triggers, error } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_manipulation')
      .eq('event_object_table', 'appointments')
      .eq('event_object_schema', 'public')
    
    if (error) {
      console.log(`    ❌ Failed to check triggers: ${error.message}`)
    } else {
      console.log(`    📊 Found ${triggers?.length || 0} triggers on appointments table`)
      triggers?.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.event_manipulation})`)
      })
    }
  } catch (error) {
    console.log(`    ❌ Trigger check error: ${error.message}`)
  }
}

async function testConsultationCreation() {
  console.log('  📝 Testing consultation creation...')
  
  try {
    // Get a test patient and doctor
    const { data: patients, error: patientError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1)
    
    const { data: doctors, error: doctorError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'doctor')
      .limit(1)
    
    if (patientError || doctorError) {
      throw new Error(`Failed to get test data: ${patientError?.message || doctorError?.message}`)
    }
    
    if (!patients?.length || !doctors?.length) {
      throw new Error('No test patients or doctors found')
    }
    
    const testMedicalData = {
      chiefComplaint: 'Test chief complaint',
      symptomDuration: '2 days',
      severityLevel: 3,
      symptoms: ['Fever', 'Headache'],
      additionalSymptoms: 'None',
      allergies: 'None',
      medications: 'None',
      chronicConditions: 'None'
    }
    
    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert([{
        patient_id: patients[0].id,
        doctor_id: doctors[0].id,
        form_data: testMedicalData,
      }])
      .select()
      .single()
    
    if (error) {
      console.log(`    ❌ Consultation creation failed: ${error.message}`)
      throw error
    } else {
      console.log(`    ✅ Consultation created successfully: ${consultation.id}`)
      return consultation.id
    }
  } catch (error) {
    console.log(`    ❌ Consultation creation test error: ${error.message}`)
    throw error
  }
}

async function testAppointmentCreation(consultationId) {
  console.log('  📅 Testing appointment creation...')
  
  try {
    // Get test data
    const { data: patients, error: patientError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1)
    
    const { data: doctors, error: doctorError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'doctor')
      .limit(1)
    
    if (patientError || doctorError) {
      throw new Error(`Failed to get test data: ${patientError?.message || doctorError?.message}`)
    }
    
    const appointmentData = {
      patient_id: patients[0].id,
      doctor_id: doctors[0].id,
      consultation_id: consultationId,
      appointment_date: new Date().toISOString().split('T')[0],
      appointment_time: '10:00:00',
      appointment_datetime: new Date().toISOString(),
      status: 'scheduled',
      ai_processing_status: 'pending'
    }
    
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select()
      .single()
    
    if (error) {
      console.log(`    ❌ Appointment creation failed: ${error.message}`)
      throw error
    } else {
      console.log(`    ✅ Appointment created successfully: ${appointment.id}`)
      console.log(`    📊 Appointment status: ${appointment.ai_processing_status}`)
      return appointment.id
    }
  } catch (error) {
    console.log(`    ❌ Appointment creation test error: ${error.message}`)
    throw error
  }
}

async function testTriggerFunctionality(appointmentId) {
  console.log('  🔧 Testing trigger functionality...')
  
  try {
    // Wait a bit for the trigger to process
    console.log('    ⏳ Waiting for trigger to process...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check the appointment status
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select('ai_processing_status, error_message')
      .eq('id', appointmentId)
      .single()
    
    if (error) {
      console.log(`    ❌ Failed to check appointment status: ${error.message}`)
    } else {
      console.log(`    📊 Final appointment status: ${appointment.ai_processing_status}`)
      if (appointment.error_message) {
        console.log(`    ⚠️  Error message: ${appointment.error_message}`)
      }
      
      if (appointment.ai_processing_status === 'triggered') {
        console.log(`    ✅ Trigger fired successfully`)
      } else if (appointment.ai_processing_status === 'failed') {
        console.log(`    ⚠️  Trigger failed but appointment was created`)
      } else {
        console.log(`    ❓ Unexpected status: ${appointment.ai_processing_status}`)
      }
    }
  } catch (error) {
    console.log(`    ❌ Trigger functionality test error: ${error.message}`)
  }
}

async function cleanupTestData(consultationId, appointmentId) {
  console.log('  🧹 Cleaning up test data...')
  
  try {
    // Delete appointment first (due to foreign key constraints)
    if (appointmentId) {
      const { error: appointmentError } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
      
      if (appointmentError) {
        console.log(`    ⚠️  Failed to delete test appointment: ${appointmentError.message}`)
      } else {
        console.log(`    ✅ Test appointment deleted`)
      }
    }
    
    // Delete consultation
    if (consultationId) {
      const { error: consultationError } = await supabase
        .from('consultations')
        .delete()
        .eq('id', consultationId)
      
      if (consultationError) {
        console.log(`    ⚠️  Failed to delete test consultation: ${consultationError.message}`)
      } else {
        console.log(`    ✅ Test consultation deleted`)
      }
    }
  } catch (error) {
    console.log(`    ❌ Cleanup error: ${error.message}`)
  }
}

// Run the test
testAppointmentCreation()
