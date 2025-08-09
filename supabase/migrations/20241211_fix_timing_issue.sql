-- ===================================
-- FIX TIMING ISSUE: APPOINTMENT CREATION BEFORE FILE PROCESSING
-- This migration ensures files are only processed after appointment is created
-- ===================================

-- STEP 1: REMOVE ANY EXISTING WEBHOOKS OR TRIGGERS ON PATIENT_FILES
-- This prevents premature triggering of process_patient_files

-- Drop any triggers that might exist on patient_files table
DROP TRIGGER IF EXISTS trg_process_files_on_insert ON patient_files;
DROP TRIGGER IF EXISTS trg_webhook_files ON patient_files;
DROP TRIGGER IF EXISTS trg_file_processing ON patient_files;

-- Drop any functions that might be triggered by patient_files inserts
DROP FUNCTION IF EXISTS trigger_file_processing() CASCADE;
DROP FUNCTION IF EXISTS process_files_on_insert() CASCADE;
DROP FUNCTION IF EXISTS webhook_file_processing() CASCADE;

-- STEP 2: ENSURE PATIENT_FILES TABLE HAS CORRECT STRUCTURE
-- Make sure appointment_id can be NULL initially
ALTER TABLE patient_files 
ALTER COLUMN appointment_id DROP NOT NULL;

-- Add a constraint to ensure appointment_id is set when processed
ALTER TABLE patient_files 
ADD CONSTRAINT check_appointment_id_when_processed 
CHECK (processed = false OR appointment_id IS NOT NULL);

-- STEP 3: CREATE A FUNCTION TO UPDATE FILES WITH APPOINTMENT_ID
-- This function will be called after appointment creation
CREATE OR REPLACE FUNCTION update_files_with_appointment_id(appointment_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  consultation_uuid UUID;
  updated_count INTEGER := 0;
BEGIN
  -- Get the consultation_id from the appointment
  SELECT consultation_id INTO consultation_uuid
  FROM appointments 
  WHERE id = appointment_uuid;
  
  IF consultation_uuid IS NULL THEN
    RAISE WARNING 'Appointment % not found', appointment_uuid;
    RETURN 0;
  END IF;
  
  -- Update all files for this consultation that don't have an appointment_id yet
  UPDATE patient_files 
  SET appointment_id = appointment_uuid
  WHERE consultation_id = consultation_uuid 
    AND appointment_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Updated % files with appointment_id %', updated_count, appointment_uuid;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: ENHANCE THE EXISTING TRIGGER FUNCTION
-- Modify the trigger to ensure proper timing and file linking
CREATE OR REPLACE FUNCTION trigger_complete_appointment_workflow()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  process_files_url TEXT;
  linked_files_count INTEGER;
  has_files BOOLEAN;
  request_id TEXT;
  http_response_status INTEGER;
BEGIN
  -- Set URLs for edge functions
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  process_files_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Generate a unique request ID for tracking
  request_id := gen_random_uuid()::text;
  
  RAISE NOTICE '🎯 Appointment % created, starting workflow...', NEW.id;
  
  -- Update appointment status to triggered
  UPDATE appointments 
  SET 
    ai_processing_status = 'triggered',
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RAISE NOTICE '✅ Appointment status updated to triggered';
  
  -- Link files to appointment (if any exist)
  SELECT update_files_with_appointment_id(NEW.id) INTO linked_files_count;
  
  RAISE NOTICE '📁 Linked % files to appointment %', linked_files_count, NEW.id;
  
  -- Check if there are files to process
  SELECT EXISTS (
    SELECT 1 FROM patient_files 
    WHERE appointment_id = NEW.id 
    AND (processed IS NULL OR processed = false)
  ) INTO has_files;
  
  -- Only proceed with AI processing if we have files
  IF has_files THEN
    RAISE NOTICE '🔍 Files found for appointment %. Calling process_patient_files...', NEW.id;
    
    -- Call process_patient_files using pg_net extension
    SELECT net.http_post(
      url := process_files_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object(
        'appointment_id', NEW.id,
        'request_id', request_id
      )
    ) INTO http_response_status;
    
    RAISE NOTICE '📤 Called process_patient_files for appointment % with request ID %', NEW.id, request_id;
    
    -- Wait a moment for file processing to start
    PERFORM pg_sleep(1);
    
  ELSE
    RAISE NOTICE '📄 No files to process for appointment %. Calling clinical summary directly...', NEW.id;
  END IF;
  
  -- Always call clinical summary (either after file processing or directly)
  RAISE NOTICE '🧠 Calling clinical summary generation...';
  
  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object(
        'id', NEW.id,
        'ai_processing_status', 'pending'
      ),
      'table', 'appointments',
      'request_id', request_id
    )
  ) INTO http_response_status;
  
  RAISE NOTICE '✅ Successfully called clinical summary for appointment %', NEW.id;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but NEVER fail the appointment creation
    RAISE WARNING '❌ Error in appointment workflow for appointment %: %', NEW.id, SQLERRM;
    
    -- Update appointment status to failed but don't prevent creation
    UPDATE appointments 
    SET 
      ai_processing_status = 'failed',
      error_message = 'Workflow trigger failed: ' || SQLERRM,
      updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Always return NEW to ensure appointment is created
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: ENSURE THE TRIGGER IS PROPERLY SET UP
-- Drop and recreate the trigger to ensure it's correct
DROP TRIGGER IF EXISTS trg_complete_appointment_workflow ON appointments;

CREATE TRIGGER trg_complete_appointment_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_appointment_workflow();

-- STEP 6: GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION update_files_with_appointment_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION trigger_complete_appointment_workflow() TO service_role;

-- STEP 7: CREATE A VIEW FOR MONITORING THE WORKFLOW
CREATE OR REPLACE VIEW appointment_workflow_status AS
SELECT 
  a.id as appointment_id,
  a.patient_id,
  a.doctor_id,
  a.consultation_id,
  a.ai_processing_status,
  a.error_message,
  a.created_at,
  a.updated_at,
  COUNT(pf.id) as total_files,
  COUNT(CASE WHEN pf.processed = true THEN 1 END) as processed_files,
  COUNT(CASE WHEN pf.processed = false OR pf.processed IS NULL THEN 1 END) as unprocessed_files,
  CASE 
    WHEN a.ai_processing_status = 'completed' THEN '✅ Complete'
    WHEN a.ai_processing_status = 'processing' THEN '🔄 Processing'
    WHEN a.ai_processing_status = 'triggered' THEN '🚀 Triggered'
    WHEN a.ai_processing_status = 'failed' THEN '❌ Failed'
    ELSE '⏳ Pending'
  END as status_display
FROM appointments a
LEFT JOIN patient_files pf ON a.id = pf.appointment_id
GROUP BY a.id, a.patient_id, a.doctor_id, a.consultation_id, a.ai_processing_status, a.error_message, a.created_at, a.updated_at
ORDER BY a.created_at DESC;

-- STEP 8: ADD COMMENTS FOR DOCUMENTATION
COMMENT ON FUNCTION update_files_with_appointment_id(UUID) IS 'Links patient files to appointment after appointment creation';
COMMENT ON FUNCTION trigger_complete_appointment_workflow() IS 'Main workflow trigger that ensures proper timing of file processing';
COMMENT ON VIEW appointment_workflow_status IS 'Monitoring view for appointment and file processing status';

-- STEP 9: VERIFICATION QUERIES
-- These can be run to verify the fix is working

-- Check if any files exist without appointment_id (should be 0 after fix)
-- SELECT COUNT(*) as files_without_appointment FROM patient_files WHERE appointment_id IS NULL;

-- Check if any appointments exist without proper status (should be 0 after fix)
-- SELECT COUNT(*) as appointments_without_status FROM appointments WHERE ai_processing_status IS NULL;

-- Check the workflow status
-- SELECT * FROM appointment_workflow_status LIMIT 10;

RAISE NOTICE '✅ TIMING ISSUE FIX COMPLETED';
RAISE NOTICE '📋 SUMMARY:';
RAISE NOTICE '  - Removed any premature triggers on patient_files';
RAISE NOTICE '  - Enhanced appointment trigger to ensure proper timing';
RAISE NOTICE '  - Added file linking function for appointment_id updates';
RAISE NOTICE '  - Created monitoring view for workflow status';
RAISE NOTICE '  - Files will now only be processed AFTER appointment creation';
