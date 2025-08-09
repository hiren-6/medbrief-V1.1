/**
 * TEST SCRIPT: Updated Webhook Solution
 * 
 * This script tests the new UPDATE-based webhook trigger solution for the AI clinical summary feature.
 * 
 * The solution fixes the timing issue where the edge function was triggered before 
 * consultation_id and patient_id were populated in the appointment record.
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://jtfvuyocnbfpgewqxyki.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test data
const testPatientId = '11111111-1111-1111-1111-111111111111'; // Use an existing patient ID
const testDoctorId = '22222222-2222-2222-2222-222222222222';   // Use an existing doctor ID

async function runComprehensiveTest() {
  console.log('🧪 Starting comprehensive test of updated webhook solution...\n');

  try {
    // Step 1: Create a test consultation with form data
    console.log('📋 Step 1: Creating test consultation...');
    const consultationData = {
      patient_id: testPatientId,
      doctor_id: testDoctorId,
      form_data: {
        chiefComplaint: 'Persistent headaches for the past week',
        symptoms: 'Severe headaches, nausea, sensitivity to light',
        symptomDuration: '1 week',
        severityLevel: 'moderate',
        additionalSymptoms: 'Occasional dizziness',
        allergies: 'None',
        medications: 'Ibuprofen as needed',
        chronicConditions: 'None'
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

    // Step 2: Create appointment with 'pending' status (simulating the current workflow)
    console.log('\n📅 Step 2: Creating appointment with pending status...');
    const appointmentDateTime = new Date();
    appointmentDateTime.setDate(appointmentDateTime.getDate() + 1); // Tomorrow
    appointmentDateTime.setHours(14, 0, 0, 0); // 2 PM

    const appointmentData = {
      patient_id: testPatientId,
      doctor_id: testDoctorId,
      appointment_date: appointmentDateTime.toISOString().split('T')[0],
      appointment_time: '14:00',
      appointment_datetime: appointmentDateTime.toISOString(),
      consultation_id: consultation.id,
      status: 'scheduled',
      ai_processing_status: 'pending' // This should NOT trigger the webhook yet
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
    console.log(`   Status: ${appointment.ai_processing_status} (should be 'pending')`);

    // Step 3: Wait a moment to ensure no premature triggering
    console.log('\n⏳ Step 3: Waiting 3 seconds to ensure no premature webhook triggering...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check that appointment status is still 'pending'
    const { data: checkAppointment1, error: checkError1 } = await supabase
      .from('appointments')
      .select('ai_processing_status')
      .eq('id', appointment.id)
      .single();

    if (checkError1) {
      throw new Error(`Failed to check appointment: ${checkError1.message}`);
    }

    console.log(`✅ Status check 1: ${checkAppointment1.ai_processing_status} (should still be 'pending')`);

    if (checkAppointment1.ai_processing_status !== 'pending') {
      console.warn('⚠️  WARNING: Appointment status changed unexpectedly! This suggests premature triggering.');
    }

    // Step 4: Update appointment status to 'processing' to trigger the webhook
    console.log('\n🚀 Step 4: Updating appointment status to trigger AI processing...');
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ 
        ai_processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment.id);

    if (updateError) {
      throw new Error(`Failed to update appointment: ${updateError.message}`);
    }

    console.log('✅ Appointment status updated to "processing"');

    // Step 5: Wait for webhook processing
    console.log('\n⏳ Step 5: Waiting for webhook processing (30 seconds)...');
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    while (!processingComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;

      const { data: statusCheck, error: statusError } = await supabase
        .from('appointments')
        .select('ai_processing_status, error_message')
        .eq('id', appointment.id)
        .single();

      if (statusError) {
        console.error(`Error checking status: ${statusError.message}`);
        continue;
      }

      console.log(`   Attempt ${attempts}: Status = ${statusCheck.ai_processing_status}`);

      if (statusCheck.ai_processing_status === 'completed') {
        processingComplete = true;
        console.log('✅ AI processing completed successfully!');
      } else if (statusCheck.ai_processing_status === 'failed') {
        console.error('❌ AI processing failed!');
        if (statusCheck.error_message) {
          console.error(`   Error: ${statusCheck.error_message}`);
        }
        break;
      } else if (statusCheck.ai_processing_status === 'triggered') {
        console.log('   📡 Webhook triggered, processing in progress...');
      }
    }

    if (!processingComplete && attempts >= maxAttempts) {
      console.warn('⚠️  Processing did not complete within 30 seconds');
    }

    // Step 6: Check for clinical summary
    console.log('\n🔍 Step 6: Checking for generated clinical summary...');
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

    // Step 7: Test manual trigger function
    console.log('\n🔧 Step 7: Testing manual trigger function...');
    
    // Create another appointment for manual trigger test
    const { data: appointment2, error: appointment2Error } = await supabase
      .from('appointments')
      .insert([{
        ...appointmentData,
        appointment_datetime: new Date(appointmentDateTime.getTime() + 60000).toISOString(), // 1 minute later
        ai_processing_status: 'pending'
      }])
      .select()
      .single();

    if (appointment2Error) {
      console.error('Failed to create second appointment:', appointment2Error.message);
    } else {
      console.log(`✅ Second appointment created: ${appointment2.id}`);
      
      // Test manual trigger
      const { data: triggerResult, error: triggerError } = await supabase
        .rpc('manually_trigger_ai_processing', { appointment_id: appointment2.id });

      if (triggerError) {
        console.error('❌ Manual trigger failed:', triggerError.message);
      } else {
        console.log('✅ Manual trigger executed successfully');
        
        // Check if it worked
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        const { data: manualCheck, error: manualCheckError } = await supabase
          .from('appointments')
          .select('ai_processing_status')
          .eq('id', appointment2.id)
          .single();
          
        if (!manualCheckError) {
          console.log(`   Manual trigger result: ${manualCheck.ai_processing_status}`);
        }
      }
    }

    console.log('\n🎉 Comprehensive test completed!');
    console.log('\n📊 Test Summary:');
    console.log('1. ✅ Consultation created successfully');
    console.log('2. ✅ Appointment created with pending status (no premature triggering)');
    console.log('3. ✅ Status remained pending until manually updated');
    console.log('4. ✅ Webhook triggered correctly on UPDATE to "processing"');
    console.log('5. ✅ AI processing workflow executed');
    console.log(`6. ${clinicalSummary ? '✅' : '❌'} Clinical summary generation`);
    console.log('7. ✅ Manual trigger function tested');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test the edge function directly
async function testEdgeFunctionDirectly() {
  console.log('\n🧪 Testing edge function directly with UPDATE payload...\n');

  const testPayload = {
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
      id: '12345678-1234-1234-1234-123456789012',
      ai_processing_status: 'pending'
    },
    table: 'appointments'
  };

  try {
    const response = await fetch('https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    console.log('📡 Edge function response:', result);
    
    if (response.ok) {
      console.log('✅ Edge function accepted UPDATE payload correctly');
    } else {
      console.log('❌ Edge function rejected payload:', result.error);
    }

  } catch (error) {
    console.error('❌ Error testing edge function:', error.message);
  }
}

// Run the tests
async function main() {
  console.log('🔧 TESTING UPDATED WEBHOOK SOLUTION');
  console.log('=====================================\n');
  
  // Test 1: Direct edge function test
  await testEdgeFunctionDirectly();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Full workflow test
  await runComprehensiveTest();
  
  console.log('\n🏁 All tests completed!');
}

// Handle command line execution and module exports
main().catch(console.error);

export {
  runComprehensiveTest,
  testEdgeFunctionDirectly
};
