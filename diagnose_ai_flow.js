const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function diagnoseAIFlow() {
  console.log('🔍 DIAGNOSING AI PROCESSING FLOW...\n')

  try {
    // 1. Check database triggers
    console.log('📋 STEP 1: Checking Database Triggers...')
    const { data: triggers, error: triggersError } = await supabase
      .from('information_schema.triggers')
      .select('trigger_name, event_manipulation, action_statement')
      .eq('event_object_table', 'appointments')

    if (triggersError) {
      console.error('❌ Error checking triggers:', triggersError)
    } else {
      console.log('✅ Found triggers:', triggers?.length || 0)
      triggers?.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`)
      })
    }

    // 2. Check database functions
    console.log('\n📋 STEP 2: Checking Database Functions...')
    const { data: functions, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .in('routine_name', [
        'trigger_ai_clinical_summary',
        'trigger_complete_medical_workflow',
        'mark_appointment_for_processing',
        'trigger_link_files_to_appointment',
        'link_files_to_appointment',
        'get_unprocessed_files_for_appointment',
        'check_all_files_processed',
        'update_file_processing_status'
      ])

    if (functionsError) {
      console.error('❌ Error checking functions:', functionsError)
    } else {
      console.log('✅ Found functions:', functions?.length || 0)
      functions?.forEach(func => {
        console.log(`  - ${func.routine_name} (${func.routine_type})`)
      })
    }

    // 3. Check appointments table structure
    console.log('\n📋 STEP 3: Checking Appointments Table...')
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, consultation_id, patient_id, ai_processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (appointmentsError) {
      console.error('❌ Error checking appointments:', appointmentsError)
    } else {
      console.log('✅ Recent appointments:', appointments?.length || 0)
      appointments?.forEach(apt => {
        console.log(`  - ${apt.id.substring(0, 8)}... (${apt.ai_processing_status})`)
      })
    }

    // 4. Check patient_files table
    console.log('\n📋 STEP 4: Checking Patient Files...')
    const { data: files, error: filesError } = await supabase
      .from('patient_files')
      .select('id, consultation_id, appointment_id, file_name, processed, extracted_text')
      .order('created_at', { ascending: false })
      .limit(5)

    if (filesError) {
      console.error('❌ Error checking patient files:', filesError)
    } else {
      console.log('✅ Recent patient files:', files?.length || 0)
      files?.forEach(file => {
        console.log(`  - ${file.file_name} (processed: ${file.processed}, has appointment: ${!!file.appointment_id})`)
      })
    }

    // 5. Check clinical_summaries table
    console.log('\n📋 STEP 5: Checking Clinical Summaries...')
    const { data: summaries, error: summariesError } = await supabase
      .from('clinical_summaries')
      .select('id, consultation_id, patient_id, processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (summariesError) {
      console.error('❌ Error checking clinical summaries:', summariesError)
    } else {
      console.log('✅ Recent clinical summaries:', summaries?.length || 0)
      summaries?.forEach(summary => {
        console.log(`  - ${summary.id.substring(0, 8)}... (${summary.processing_status})`)
      })
    }

    // 6. Test edge function connectivity
    console.log('\n📋 STEP 6: Testing Edge Function Connectivity...')
    
    // Test generate_clinical_summary
    try {
      const clinicalResponse = await fetch(`${supabaseUrl}/functions/v1/generate_clinical_summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          type: 'TEST',
          record: { id: 'test-id' },
          table: 'appointments'
        })
      })
      
      console.log(`✅ generate_clinical_summary: ${clinicalResponse.status}`)
    } catch (error) {
      console.error('❌ generate_clinical_summary error:', error.message)
    }

    // Test process_patient_files
    try {
      const filesResponse = await fetch(`${supabaseUrl}/functions/v1/process_patient_files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          appointment_id: 'test-appointment-id'
        })
      })
      
      console.log(`✅ process_patient_files: ${filesResponse.status}`)
    } catch (error) {
      console.error('❌ process_patient_files error:', error.message)
    }

    // 7. Check environment variables
    console.log('\n📋 STEP 7: Checking Environment Variables...')
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY'
    ]

    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar]
      if (value) {
        console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`)
      } else {
        console.log(`❌ ${envVar}: NOT SET`)
      }
    })

    // 8. Test database functions directly
    console.log('\n📋 STEP 8: Testing Database Functions...')
    
    // Test link_files_to_appointment
    try {
      const { data: linkResult, error: linkError } = await supabase
        .rpc('link_files_to_appointment', { appointment_uuid: '00000000-0000-0000-0000-000000000000' })
      
      if (linkError) {
        console.log(`❌ link_files_to_appointment: ${linkError.message}`)
      } else {
        console.log(`✅ link_files_to_appointment: ${linkResult} files linked`)
      }
    } catch (error) {
      console.log(`❌ link_files_to_appointment: ${error.message}`)
    }

    // Test get_unprocessed_files_for_appointment
    try {
      const { data: filesResult, error: filesFuncError } = await supabase
        .rpc('get_unprocessed_files_for_appointment', { appointment_uuid: '00000000-0000-0000-0000-000000000000' })
      
      if (filesFuncError) {
        console.log(`❌ get_unprocessed_files_for_appointment: ${filesFuncError.message}`)
      } else {
        console.log(`✅ get_unprocessed_files_for_appointment: ${filesResult?.length || 0} files`)
      }
    } catch (error) {
      console.log(`❌ get_unprocessed_files_for_appointment: ${error.message}`)
    }

    // 9. Check for recent errors in logs
    console.log('\n📋 STEP 9: Checking Recent Processing Status...')
    const { data: recentAppointments, error: recentError } = await supabase
      .from('appointments')
      .select('id, ai_processing_status, error_message, created_at')
      .in('ai_processing_status', ['failed', 'triggered'])
      .order('created_at', { ascending: false })
      .limit(3)

    if (recentError) {
      console.error('❌ Error checking recent appointments:', recentError)
    } else {
      console.log('✅ Recent processing status:')
      recentAppointments?.forEach(apt => {
        console.log(`  - ${apt.id.substring(0, 8)}...: ${apt.ai_processing_status}${apt.error_message ? ` (${apt.error_message})` : ''}`)
      })
    }

    console.log('\n🎯 DIAGNOSIS COMPLETE!')
    console.log('\n📝 SUMMARY:')
    console.log('- Database triggers:', triggers?.length || 0, 'found')
    console.log('- Database functions:', functions?.length || 0, 'found')
    console.log('- Recent appointments:', appointments?.length || 0, 'found')
    console.log('- Patient files:', files?.length || 0, 'found')
    console.log('- Clinical summaries:', summaries?.length || 0, 'found')

  } catch (error) {
    console.error('💥 CRITICAL ERROR IN DIAGNOSIS:', error)
  }
}

// Run the diagnosis
diagnoseAIFlow() 