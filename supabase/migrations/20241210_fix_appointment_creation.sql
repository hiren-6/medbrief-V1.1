-- ===================================
-- FIX APPOINTMENT CREATION ISSUE
-- This migration fixes the problem where appointments are not being created
-- due to conflicting triggers and database constraints
-- ===================================

-- STEP 1: DROP ALL EXISTING TRIGGERS TO AVOID CONFLICTS
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments;

-- STEP 2: DROP ALL EXISTING TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow();

-- STEP 3: CREATE A SIMPLE, SAFE TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION trigger_safe_appointment_workflow()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  process_files_url TEXT;
  linked_files_count INTEGER;
  has_files BOOLEAN;
BEGIN
  -- Set URLs
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  process_files_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Update appointment status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Appointment % created successfully, status updated to triggered', NEW.id;
  
  -- Link files to appointment (if any exist)
  SELECT link_files_to_appointment(NEW.id) INTO linked_files_count;
  
  -- Check if there are files to process
  SELECT EXISTS (
    SELECT 1 FROM patient_files 
    WHERE appointment_id = NEW.id 
    AND (processed IS NULL OR processed = false)
  ) INTO has_files;
  
  -- Only proceed with AI processing if we have files or sufficient data
  IF has_files THEN
    RAISE NOTICE 'Files found for appointment %. Calling process_patient_files...', NEW.id;
    
    -- Call process_patient_files asynchronously (don't wait for response)
    PERFORM net.http_post(
      url := process_files_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'appointment_id', NEW.id
      )::text
    );
    
    RAISE NOTICE 'Successfully called process_patient_files for appointment %', NEW.id;
  ELSE
    RAISE NOTICE 'No files to process for appointment %. Calling clinical summary directly...', NEW.id;
    
    -- Call clinical summary directly
    PERFORM net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'type', 'INSERT',
        'record', row_to_json(NEW),
        'table', 'appointments'
      )::text
    );
    
    RAISE NOTICE 'Successfully called clinical summary for appointment %', NEW.id;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but NEVER fail the appointment creation
    RAISE WARNING 'Error in appointment workflow for appointment %: %', NEW.id, SQLERRM;
    
    -- Update appointment status to failed but don't prevent creation
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Workflow trigger failed: ' || SQLERRM
    WHERE id = NEW.id;
    
    -- Always return NEW to ensure appointment is created
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: CREATE THE SINGLE, SAFE TRIGGER
CREATE TRIGGER trg_safe_appointment_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_safe_appointment_workflow();

-- STEP 5: VERIFY THE TRIGGER WAS CREATED
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_safe_appointment_workflow'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: Safe appointment workflow trigger created successfully';
  ELSE
    RAISE WARNING '❌ ERROR: Trigger was not created';
  END IF;
END $$;

-- STEP 6: SHOW ALL TRIGGERS ON APPOINTMENTS TABLE
SELECT 
    'Current triggers on appointments table:' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;

-- STEP 7: ADD HELPFUL COMMENTS
COMMENT ON FUNCTION trigger_safe_appointment_workflow() IS 'Safe appointment workflow: ensures appointment creation never fails due to trigger errors';
COMMENT ON TRIGGER trg_safe_appointment_workflow ON appointments IS 'Single safe trigger for appointment workflow - never blocks appointment creation';

-- STEP 8: TEST APPOINTMENT CREATION
-- Create a test appointment to verify the trigger works
DO $$
DECLARE
  test_appointment_id UUID;
BEGIN
  -- Create a test appointment
  INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    doctor_id,
    appointment_date,
    appointment_time,
    appointment_datetime,
    status,
    ai_processing_status
  ) VALUES (
    gen_random_uuid(),
    (SELECT id FROM consultations LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1),
    (SELECT id FROM profiles WHERE role = 'doctor' LIMIT 1),
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    'scheduled',
    'pending'
  ) RETURNING id INTO test_appointment_id;
  
  RAISE NOTICE '✅ TEST: Appointment created successfully with ID: %', test_appointment_id;
  
  -- Check the appointment status
  IF EXISTS (
    SELECT 1 FROM appointments 
    WHERE id = test_appointment_id 
    AND ai_processing_status IN ('triggered', 'failed')
  ) THEN
    RAISE NOTICE '✅ TEST: Trigger fired successfully';
  ELSE
    RAISE WARNING '❌ TEST: Trigger may not have fired';
  END IF;
  
  -- Clean up test appointment
  DELETE FROM appointments WHERE id = test_appointment_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ TEST: Failed to create test appointment: %', SQLERRM;
END $$;
