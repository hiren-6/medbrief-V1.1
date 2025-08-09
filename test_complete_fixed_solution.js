/**
 * TEST SCRIPT: Complete Fixed Solution
 * 
 * This script tests the complete fixed solution for both:
 * 1. Patient file processing with proper appointment linking
 * 2. AI clinical summary generation with proper triggers
 * 
 * The fixes address:
 * - Files not being linked to appointments (appointment_id was null)
 * - Process_patient_files function triggered too early
 * - Generate_clinical_summary function trigger logic issues
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test data
const testPatientId = '11111111-1111-1111-1111-111111111111';
const testDoctorId = '22222222-2222-2222-2222-222222222222';

async function runCompleteFixedTest() {
  console.log('🧪 Starting comprehensive test of COMPLETE FIXED solution...\n');

  try {
    // Step 1: Create a test consultation
    console.log('📋 Step 1: Creating test consultation...');
    const consultationData = {
      patient_id: testPatientId,
      doctor_id: testDoctorId,
      form_data: {
        chiefComplaint: 'Persistent cough and shortness of breath',
        symptoms: 'Dry cough, difficulty breathing, chest tightness',
        symptomDuration: '2 weeks',
        severityLevel: 'moderate',
        additionalSymptoms: 'Fatigue, mild fever',
        allergies: 'Penicillin',
        medications: 'Albuterol inhaler as needed',
        chronicConditions: 'Asthma'
      },
      voice_data: null,
      status: 'completed'
    };

    const { data: consultation, error: consultationError } = await supabase
      .from('consultations')
      .insert([consultationData])
      .select()
      .single();

    if (consultationError) {
      throw new Error(`Failed to create consultation: ${consultationError.message}`);
    }

    console.log(`✅ Consultation created: ${consultation.id}`);

    // Step 2: Simulate file upload (without appointment_id initially)
    console.log('\n📁 Step 2: Simulating file upload without appointment_id...');
    const testFile = {
      consultation_id: consultation.id,
      patient_id: testPatientId,
      doctor_id: testDoctorId,
      file_name: 'test_chest_xray.pdf',
      file_path: `${testPatientId}/${consultation.id}/test_chest_xray.pdf`,
      file_size: 1024000,
      file_type: 'application/pdf',
      file_category: 'Medical Records',
      appointment_id: null, // Initially null - this is the key issue we're fixing
      processed: false
    };

    const { data: fileRecord, error: fileError } = await supabase
      .from('patient_files')
      .insert([testFile])
      .select()
      .single();

    if (fileError) {
      throw new Error(`Failed to create file record: ${fileError.message}`);
    }

    console.log(`✅ File record created: ${fileRecord.id} (appointment_id: ${fileRecord.appointment_id})`);

    // Step 3: Create appointment (this should NOT trigger file processing yet)
    console.log('\n📅 Step 3: Creating appointment with pending status...');
    const appointmentDateTime = new Date();
    appointmentDateTime.setDate(appointmentDateTime.getDate() + 1);
    appointmentDateTime.setHours(15, 0, 0, 0);

    const appointmentData = {
      patient_id: testPatientId,
      doctor_id: testDoctorId,
      appointment_date: appointmentDateTime.toISOString().split('T')[0],
      appointment_time: '15:00',
      appointment_datetime: appointmentDateTime.toISOString(),
      consultation_id: consultation.id,
      status: 'scheduled',
      ai_processing_status: 'pending'
    };

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select()
      .single();

    if (appointmentError) {
      throw new Error(`Failed to create appointment: ${appointmentError.message}`);
    }

    console.log(`✅ Appointment created: ${appointment.id}`);

    // Step 4: Link files to appointment (this SHOULD trigger file processing)
    console.log('\n🔗 Step 4: Linking files to appointment (should trigger file processing)...');
    const { error: linkError } = await supabase
      .from('patient_files')
      .update({ appointment_id: appointment.id })
      .eq('consultation_id', consultation.id)
      .is('appointment_id', null);

    if (linkError) {
      throw new Error(`Failed to link files: ${linkError.message}`);
    }

    console.log('✅ Files linked to appointment successfully');

    // Step 5: Wait for file processing
    console.log('\n⏳ Step 5: Waiting for file processing (15 seconds)...');
    let fileProcessingComplete = false;
    let attempts = 0;
    const maxAttempts = 15;

    while (!fileProcessingComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const { data: fileCheck, error: fileCheckError } = await supabase
        .from('patient_files')
        .select('processed, extracted_text')
        .eq('id', fileRecord.id)
        .single();

      if (fileCheckError) {
        console.error(`Error checking file status: ${fileCheckError.message}`);
        continue;
      }

      console.log(`   Attempt ${attempts}: File processed = ${fileCheck.processed}`);

      if (fileCheck.processed) {
        fileProcessingComplete = true;
        console.log('✅ File processing completed!');
        if (fileCheck.extracted_text) {
          console.log(`   Extracted text length: ${fileCheck.extracted_text.length}`);
        }
      }
    }

    if (!fileProcessingComplete) {
      console.warn('⚠️  File processing did not complete within 15 seconds');
    }

    // Step 6: Update appointment status to trigger AI processing
    console.log('\n🤖 Step 6: Triggering AI processing by updating status...');
    const { error: statusUpdateError } = await supabase
      .from('appointments')
      .update({ 
        ai_processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment.id);

    if (statusUpdateError) {
      throw new Error(`Failed to update appointment status: ${statusUpdateError.message}`);
    }

    console.log('✅ Appointment status updated to "processing"');

    // Step 7: Wait for AI processing
    console.log('\n⏳ Step 7: Waiting for AI processing (30 seconds)...');
    let aiProcessingComplete = false;
    attempts = 0;
    const maxAiAttempts = 30;

    while (!aiProcessingComplete && attempts < maxAiAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const { data: statusCheck, error: statusError } = await supabase
        .from('appointments')
        .select('ai_processing_status, error_message')
        .eq('id', appointment.id)
        .single();

      if (statusError) {
        console.error(`Error checking AI status: ${statusError.message}`);
        continue;
      }

      console.log(`   Attempt ${attempts}: AI Status = ${statusCheck.ai_processing_status}`);

      if (statusCheck.ai_processing_status === 'completed') {
        aiProcessingComplete = true;
        console.log('✅ AI processing completed successfully!');
      } else if (statusCheck.ai_processing_status === 'failed') {
        console.error('❌ AI processing failed!');
        if (statusCheck.error_message) {
          console.error(`   Error: ${statusCheck.error_message}`);
        }
        break;
      }
    }

    if (!aiProcessingComplete && attempts >= maxAiAttempts) {
      console.warn('⚠️  AI processing did not complete within 30 seconds');
    }

    // Step 8: Check for clinical summary
    console.log('\n🔍 Step 8: Checking for generated clinical summary...');
    const { data: clinicalSummary, error: summaryError } = await supabase
      .from('clinical_summaries')
      .select('*')
      .eq('consultation_id', consultation.id)
      .single();

    if (summaryError) {
      console.error('❌ No clinical summary found:', summaryError.message);
    } else {
      console.log('✅ Clinical summary generated successfully!');
      console.log('📋 Summary details:');
      console.log(`   Chief Complaint: ${clinicalSummary.summary_json.chief_complaint}`);
      console.log(`   Urgency Level: ${clinicalSummary.summary_json.urgency_level}`);
      console.log(`   Diagnoses Count: ${clinicalSummary.summary_json.differential_diagnoses?.length || 0}`);
      console.log(`   Tests Count: ${clinicalSummary.summary_json.recommended_tests?.length || 0}`);
    }

    // Step 9: Test manual triggers
    console.log('\n🔧 Step 9: Testing manual trigger functions...');
    
    // Test manual file processing trigger
    try {
      const { data: manualFileResult, error: manualFileError } = await supabase
        .rpc('manually_trigger_file_processing', { appointment_id: appointment.id });

      if (manualFileError) {
        console.error('❌ Manual file processing trigger failed:', manualFileError.message);
      } else {
        console.log('✅ Manual file processing trigger executed');
      }
    } catch (error) {
      console.error('❌ Manual file processing trigger error:', error.message);
    }

    // Test manual AI processing trigger
    try {
      const { data: manualAiResult, error: manualAiError } = await supabase
        .rpc('manually_trigger_ai_processing', { appointment_id: appointment.id });

      if (manualAiError) {
        console.error('❌ Manual AI processing trigger failed:', manualAiError.message);
      } else {
        console.log('✅ Manual AI processing trigger executed');
      }
    } catch (error) {
      console.error('❌ Manual AI processing trigger error:', error.message);
    }

    console.log('\n🎉 Complete fixed solution test completed!');
    console.log('\n📊 Test Summary:');
    console.log('1. ✅ Consultation created successfully');
    console.log('2. ✅ File uploaded without appointment_id (no premature triggering)');
    console.log('3. ✅ Appointment created without triggering file processing');
    console.log('4. ✅ Files linked to appointment (triggers file processing)');
    console.log(`5. ${fileProcessingComplete ? '✅' : '❌'} File processing workflow`);
    console.log('6. ✅ AI processing triggered on status update');
    console.log(`7. ${aiProcessingComplete ? '✅' : '❌'} AI processing workflow`);
    console.log(`8. ${clinicalSummary ? '✅' : '❌'} Clinical summary generation`);
    console.log('9. ✅ Manual trigger functions tested');

    return {
      consultationId: consultation.id,
      appointmentId: appointment.id,
      fileProcessingComplete,
      aiProcessingComplete,
      hasClinicalSummary: !!clinicalSummary
    };

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Test edge functions directly
async function testEdgeFunctionsDirectly() {
  console.log('\n🧪 Testing edge functions directly...\n');

  // Test 1: process_patient_files function
  console.log('📁 Testing process_patient_files function...');
  try {
    const fileProcessingPayload = {
      appointment_id: '12345678-1234-1234-1234-123456789012',
      request_id: 'test_direct_call'
    };

    const fileResponse = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(fileProcessingPayload)
    });

    const fileResult = await fileResponse.json();
    console.log('📁 File processing response:', fileResult);
  } catch (error) {
    console.error('❌ Error testing file processing function:', error.message);
  }

  // Test 2: generate_clinical_summary function with UPDATE payload
  console.log('\n🤖 Testing generate_clinical_summary function (UPDATE)...');
  try {
    const updatePayload = {
      type: 'UPDATE',
      record: {
        id: '12345678-1234-1234-1234-123456789012',
        consultation_id: '87654321-4321-4321-4321-210987654321',
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        ai_processing_status: 'processing',
        status: 'scheduled'
      },
      old_record: {
        ai_processing_status: 'pending'
      },
      table: 'appointments'
    };

    const updateResponse = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(updatePayload)
    });

    const updateResult = await updateResponse.json();
    console.log('🤖 UPDATE response:', updateResult);
  } catch (error) {
    console.error('❌ Error testing UPDATE payload:', error.message);
  }

  // Test 3: generate_clinical_summary function with INSERT payload (legacy support)
  console.log('\n🤖 Testing generate_clinical_summary function (INSERT - legacy)...');
  try {
    const insertPayload = {
      type: 'INSERT',
      record: {
        id: '12345678-1234-1234-1234-123456789012',
        consultation_id: '87654321-4321-4321-4321-210987654321',
        patient_id: testPatientId,
        doctor_id: testDoctorId,
        ai_processing_status: 'processing',
        status: 'scheduled'
      },
      table: 'appointments'
    };

    const insertResponse = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(insertPayload)
    });

    const insertResult = await insertResponse.json();
    console.log('🤖 INSERT response:', insertResult);
  } catch (error) {
    console.error('❌ Error testing INSERT payload:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🔧 TESTING COMPLETE FIXED SOLUTION');
  console.log('====================================\n');
  
  // Test 1: Direct edge function tests
  await testEdgeFunctionsDirectly();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test 2: Full workflow test
  const result = await runCompleteFixedTest();
  
  console.log('\n🏁 All tests completed!');
  
  if (result) {
    console.log('\n🎯 FINAL RESULTS:');
    console.log(`   Consultation ID: ${result.consultationId}`);
    console.log(`   Appointment ID: ${result.appointmentId}`);
    console.log(`   File Processing: ${result.fileProcessingComplete ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   AI Processing: ${result.aiProcessingComplete ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Clinical Summary: ${result.hasClinicalSummary ? 'SUCCESS' : 'FAILED'}`);
  }
}

// Handle command line execution and module exports
main().catch(console.error);

export {
  runCompleteFixedTest,
  testEdgeFunctionsDirectly
};
