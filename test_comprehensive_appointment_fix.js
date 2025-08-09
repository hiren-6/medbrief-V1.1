// ===================================
// COMPREHENSIVE APPOINTMENT FIX TEST
// Tests the complete appointment creation workflow and file processing
// ===================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🧪 COMPREHENSIVE APPOINTMENT FIX TEST')
console.log('=====================================')

// Test 1: Check database structure
async function testDatabaseStructure() {
  console.log('\n📋 TEST 1: Database Structure')
  
  try {
    // Check appointments table
    const { data: appointmentColumns, error: appointmentError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'appointments')
      .eq('table_schema', 'public')
    
    if (appointmentError) {
      console.log(`    ❌ Failed to check appointments table: ${appointmentError.message}`)
    } else {
      console.log(`    ✅ Appointments table has ${appointmentColumns?.length || 0} columns`)
      
      const requiredColumns = ['id', 'patient_id', 'doctor_id', 'consultation_id', 'appointment_date', 'appointment_time', 'status', 'ai_processing_status']
      const columnNames = appointmentColumns?.map(c => c.column_name) || []
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col))
      if (missingColumns.length > 0) {
        console.log(`    ⚠️  Missing columns: ${missingColumns.join(', ')}`)
      } else {
        console.log(`    ✅ All required columns present`)
      }
    }

    // Check patient_files table
    const { data: fileColumns, error: fileError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'patient_files')
      .eq('table_schema', 'public')
    
    if (fileError) {
      console.log(`    ❌ Failed to check patient_files table: ${fileError.message}`)
    } else {
      console.log(`    ✅ Patient_files table has ${fileColumns?.length || 0} columns`)
      
      const requiredFileColumns = ['id', 'consultation_id', 'appointment_id', 'file_name', 'file_path', 'processed', 'parsed_text']
      const fileColumnNames = fileColumns?.map(c => c.column_name) || []
      
      const missingFileColumns = requiredFileColumns.filter(col => !fileColumnNames.includes(col))
      if (missingFileColumns.length > 0) {
        console.log(`    ⚠️  Missing columns: ${missingFileColumns.join(', ')}`)
      } else {
        console.log(`    ✅ All required file columns present`)
      }
    }

    // Check triggers
    const { data: triggers, error: triggerError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_manipulation')
      .eq('event_object_table', 'appointments')
      .eq('event_object_schema', 'public')
    
    if (triggerError) {
      console.log(`    ❌ Failed to check triggers: ${triggerError.message}`)
    } else {
      console.log(`    📊 Found ${triggers?.length || 0} triggers on appointments table`)
      triggers?.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.event_manipulation})`)
      })
      
      if (triggers?.length === 1) {
        console.log(`    ✅ Single trigger found - no conflicts`)
      } else if (triggers?.length > 1) {
        console.log(`    ⚠️  Multiple triggers found - potential conflicts`)
      } else {
        console.log(`    ❌ No triggers found - appointment workflow won't work`)
      }
    }
  } catch (error) {
    console.log(`    ❌ Database structure test error: ${error.message}`)
  }
}

// Test 2: Test appointment creation workflow
async function testAppointmentCreation() {
  console.log('\n📅 TEST 2: Appointment Creation Workflow')
  
  try {
    // Get test data
    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1)
    
    if (userError || !users?.length) {
      console.log(`    ❌ Failed to get test user: ${userError?.message}`)
      return
    }
    
    const testPatientId = users[0].id
    
    const { data: doctors, error: doctorError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'doctor')
      .limit(1)
    
    if (doctorError || !doctors?.length) {
      console.log(`    ❌ Failed to get test doctor: ${doctorError?.message}`)
      return
    }
    
    const testDoctorId = doctors[0].id
    
    console.log(`    👤 Using test patient: ${testPatientId}`)
    console.log(`    👨‍⚕️ Using test doctor: ${testDoctorId}`)
    
    // Create test consultation
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .insert([{
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        form_data: {
          chiefComplaint: 'Test chest pain',
          symptomDuration: '2 days',
          severityLevel: 3,
          symptoms: ['Chest pain', 'Shortness of breath'],
          additionalSymptoms: 'None',
          allergies: 'None',
          medications: 'None',
          chronicConditions: 'None'
        }
      }])
      .select()
      .single()
    
    if (consultationError) {
      console.log(`    ❌ Failed to create test consultation: ${consultationError.message}`)
      return
    }
    
    console.log(`    ✅ Test consultation created: ${consultation.id}`)
    
    // Create test appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([{
        consultation_id: consultation.id,
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '10:00:00',
        appointment_datetime: new Date().toISOString(),
        status: 'scheduled',
        ai_processing_status: 'pending'
      }])
      .select()
      .single()
    
    if (appointmentError) {
      console.log(`    ❌ Failed to create test appointment: ${appointmentError.message}`)
      return
    }
    
    console.log(`    ✅ Test appointment created: ${appointment.id}`)
    
    // Wait a moment for trigger to process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check appointment status
    const { data: updatedAppointment, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment.id)
      .single()
    
    if (checkError) {
      console.log(`    ❌ Failed to check appointment status: ${checkError.message}`)
    } else {
      console.log(`    📊 Appointment status: ${updatedAppointment.ai_processing_status}`)
      
      if (updatedAppointment.ai_processing_status === 'triggered') {
        console.log(`    ✅ Trigger fired successfully`)
      } else if (updatedAppointment.ai_processing_status === 'failed') {
        console.log(`    ⚠️  Trigger failed: ${updatedAppointment.error_message}`)
      } else {
        console.log(`    ❌ Trigger may not have fired`)
      }
    }
    
    // Clean up test data
    await supabase.from('appointments').delete().eq('id', appointment.id)
    await supabase.from('consultations').delete().eq('id', consultation.id)
    
    console.log(`    🧹 Test data cleaned up`)
    
  } catch (error) {
    console.log(`    ❌ Appointment creation test error: ${error.message}`)
  }
}

// Test 3: Test file processing integration
async function testFileProcessing() {
  console.log('\n📁 TEST 3: File Processing Integration')
  
  try {
    // Get test data
    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1)
    
    if (userError || !users?.length) {
      console.log(`    ❌ Failed to get test user: ${userError?.message}`)
      return
    }
    
    const testPatientId = users[0].id
    
    const { data: doctors, error: doctorError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    
    if (doctorError || !doctors?.length) {
      console.log(`    ❌ Failed to get test doctor: ${doctorError?.message}`)
      return
    }
    
    const testDoctorId = doctors[0].id
    
    // Create test consultation
    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .insert([{
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        form_data: {
          chiefComplaint: 'Test file processing',
          symptomDuration: '1 day',
          severityLevel: 2,
          symptoms: ['Test symptom'],
          additionalSymptoms: 'None',
          allergies: 'None',
          medications: 'None',
          chronicConditions: 'None'
        }
      }])
      .select()
      .single()
    
    if (consultationError) {
      console.log(`    ❌ Failed to create test consultation: ${consultationError.message}`)
      return
    }
    
    console.log(`    ✅ Test consultation created: ${consultation.id}`)
    
    // Create test file record
    const { data: file, error: fileError } = await supabase
      .from('patient_files')
      .insert([{
        consultation_id: consultation.id,
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        file_name: 'test-document.pdf',
        file_path: 'test/consultation/test-document.pdf',
        file_size: 1024,
        file_type: 'application/pdf',
        file_category: 'medical_document',
        processed: false
      }])
      .select()
      .single()
    
    if (fileError) {
      console.log(`    ❌ Failed to create test file: ${fileError.message}`)
      return
    }
    
    console.log(`    ✅ Test file created: ${file.id}`)
    
    // Create test appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([{
        consultation_id: consultation.id,
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '11:00:00',
        appointment_datetime: new Date().toISOString(),
        status: 'scheduled',
        ai_processing_status: 'pending'
      }])
      .select()
      .single()
    
    if (appointmentError) {
      console.log(`    ❌ Failed to create test appointment: ${appointmentError.message}`)
      return
    }
    
    console.log(`    ✅ Test appointment created: ${appointment.id}`)
    
    // Wait for file linking
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check if file was linked to appointment
    const { data: linkedFile, error: linkError } = await supabase
      .from('patient_files')
      .select('*')
      .eq('id', file.id)
      .single()
    
    if (linkError) {
      console.log(`    ❌ Failed to check file linking: ${linkError.message}`)
    } else {
      if (linkedFile.appointment_id === appointment.id) {
        console.log(`    ✅ File successfully linked to appointment`)
      } else {
        console.log(`    ❌ File not linked to appointment`)
      }
    }
    
    // Test file processing function
    const { data: unprocessedFiles, error: filesError } = await supabase
      .rpc('get_unprocessed_files_for_appointment', {
        appointment_uuid: appointment.id
      })
    
    if (filesError) {
      console.log(`    ❌ Failed to get unprocessed files: ${filesError.message}`)
    } else {
      console.log(`    📊 Found ${unprocessedFiles?.length || 0} unprocessed files`)
      
      if (unprocessedFiles?.length > 0) {
        console.log(`    ✅ File processing function working correctly`)
      } else {
        console.log(`    ⚠️  No unprocessed files found`)
      }
    }
    
    // Clean up test data
    await supabase.from('appointments').delete().eq('id', appointment.id)
    await supabase.from('patient_files').delete().eq('id', file.id)
    await supabase.from('consultations').delete().eq('id', consultation.id)
    
    console.log(`    🧹 Test data cleaned up`)
    
  } catch (error) {
    console.log(`    ❌ File processing test error: ${error.message}`)
  }
}

// Test 4: Test edge function integration
async function testEdgeFunctionIntegration() {
  console.log('\n🔗 TEST 4: Edge Function Integration')
  
  try {
    // Test process_patient_files edge function
    const processFilesResponse = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        appointment_id: '00000000-0000-0000-0000-000000000000' // Test with dummy ID
      })
    })
    
    if (processFilesResponse.ok) {
      const responseData = await processFilesResponse.json()
      console.log(`    ✅ Process files edge function responding: ${responseData.message || 'OK'}`)
    } else {
      const errorText = await processFilesResponse.text()
      console.log(`    ⚠️  Process files edge function error: ${processFilesResponse.status} - ${errorText}`)
    }
    
    // Test generate_clinical_summary edge function
    const clinicalSummaryResponse = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        type: 'INSERT',
        record: {
          id: '00000000-0000-0000-0000-000000000000',
          ai_processing_status: 'pending'
        },
        table: 'appointments'
      })
    })
    
    if (clinicalSummaryResponse.ok) {
      const responseData = await clinicalSummaryResponse.json()
      console.log(`    ✅ Clinical summary edge function responding: ${responseData.message || 'OK'}`)
    } else {
      const errorText = await clinicalSummaryResponse.text()
      console.log(`    ⚠️  Clinical summary edge function error: ${clinicalSummaryResponse.status} - ${errorText}`)
    }
    
  } catch (error) {
    console.log(`    ❌ Edge function test error: ${error.message}`)
  }
}

// Test 5: Check recent appointments for issues
async function checkRecentAppointments() {
  console.log('\n📊 TEST 5: Recent Appointments Analysis')
  
  try {
    const { data: recentAppointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        consultation_id,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        status,
        ai_processing_status,
        error_message,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.log(`    ❌ Failed to fetch recent appointments: ${error.message}`)
      return
    }
    
    console.log(`    📊 Found ${recentAppointments?.length || 0} recent appointments`)
    
    if (recentAppointments?.length > 0) {
      const statusCounts = {}
      const errorCount = recentAppointments.filter(apt => apt.error_message).length
      
      recentAppointments.forEach(apt => {
        const status = apt.ai_processing_status || 'unknown'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      
      console.log(`    📈 Status distribution:`)
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      - ${status}: ${count}`)
      })
      
      if (errorCount > 0) {
        console.log(`    ⚠️  ${errorCount} appointments have errors`)
      } else {
        console.log(`    ✅ No appointment errors found`)
      }
    } else {
      console.log(`    ℹ️  No recent appointments found`)
    }
    
  } catch (error) {
    console.log(`    ❌ Recent appointments check error: ${error.message}`)
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive appointment fix tests...\n')
  
  await testDatabaseStructure()
  await testAppointmentCreation()
  await testFileProcessing()
  await testEdgeFunctionIntegration()
  await checkRecentAppointments()
  
  console.log('\n✅ All tests completed!')
  console.log('\n📋 SUMMARY:')
  console.log('- Database structure should have all required columns')
  console.log('- Appointment creation should work without conflicts')
  console.log('- File processing should be properly integrated')
  console.log('- Edge functions should be responding')
  console.log('- Recent appointments should show healthy status')
}

// Run the tests
runAllTests().catch(console.error)
