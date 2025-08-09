-- ===================================
-- COMPREHENSIVE APPOINTMENT CREATION FIX
-- This migration fixes all appointment creation issues and ensures proper file processing
-- ===================================

-- STEP 1: CLEAN UP ALL EXISTING TRIGGERS TO AVOID CONFLICTS
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_safe_appointment_workflow ON appointments;

-- STEP 2: DROP ALL EXISTING TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow();
DROP FUNCTION IF EXISTS trigger_safe_appointment_workflow();

-- STEP 3: ENSURE APPOINTMENTS TABLE HAS REQUIRED COLUMNS
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS ai_processing_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- STEP 4: ENSURE PATIENT_FILES TABLE HAS REQUIRED COLUMNS
ALTER TABLE patient_files
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS parsed_text TEXT,
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

-- STEP 5: CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_appointments_ai_status ON appointments (ai_processing_status);
CREATE INDEX IF NOT EXISTS idx_patient_files_appointment_id ON patient_files (appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_consultation_processed ON patient_files (consultation_id, processed) WHERE processed = false;

-- STEP 6: CREATE FUNCTION TO LINK FILES TO APPOINTMENTS
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects
DROP FUNCTION IF EXISTS link_files_to_appointment(UUID) CASCADE;

CREATE OR REPLACE FUNCTION link_files_to_appointment(appointment_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  consultation_uuid UUID;
  linked_count INTEGER := 0;
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
  
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  
  RAISE NOTICE 'Linked % files to appointment %', linked_count, appointment_uuid;
  
  RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: CREATE FUNCTION TO GET UNPROCESSED FILES FOR APPOINTMENT
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects
DROP FUNCTION IF EXISTS get_unprocessed_files_for_appointment(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_unprocessed_files_for_appointment(appointment_uuid UUID)
RETURNS TABLE (
  id UUID,
  consultation_id UUID,
  appointment_id UUID,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  extracted_text TEXT,
  processed BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pf.id,
    pf.consultation_id,
    pf.appointment_id,
    pf.file_name,
    pf.file_path,
    pf.file_type,
    pf.file_size,
    pf.extracted_text,
    pf.processed,
    pf.created_at
  FROM patient_files pf
  WHERE pf.appointment_id = appointment_uuid
    AND (pf.processed IS NULL OR pf.processed = false)
  ORDER BY pf.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- STEP 8: CREATE FUNCTION TO CHECK IF ALL FILES PROCESSED
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects
DROP FUNCTION IF EXISTS check_all_files_processed(UUID) CASCADE;

CREATE OR REPLACE FUNCTION check_all_files_processed(appointment_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_files INTEGER;
  processed_files INTEGER;
BEGIN
  -- Count total files for this appointment
  SELECT COUNT(*) INTO total_files
  FROM patient_files 
  WHERE appointment_id = appointment_uuid;
  
  -- Count processed files for this appointment
  SELECT COUNT(*) INTO processed_files
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = true;
  
  -- Return true if all files are processed (or no files exist)
  RETURN total_files = 0 OR total_files = processed_files;
END;
$$ LANGUAGE plpgsql;

-- STEP 9: CREATE FUNCTION TO UPDATE FILE PROCESSING STATUS
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects
DROP FUNCTION IF EXISTS update_file_processing_status(UUID, TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS update_file_processing_status(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_file_processing_status(UUID) CASCADE;

CREATE OR REPLACE FUNCTION update_file_processing_status(
  file_uuid UUID,
  extracted_text_content TEXT,
  processing_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE patient_files 
  SET 
    parsed_text = extracted_text_content,
    processed = processing_success,
    updated_at = NOW()
  WHERE id = file_uuid;
END;
$$ LANGUAGE plpgsql;

-- STEP 10: CREATE FUNCTION TO GET APPOINTMENT PROCESSING STATUS
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects like views
DROP FUNCTION IF EXISTS get_appointment_processing_status(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_appointment_processing_status(appointment_uuid UUID)
RETURNS TABLE (
  total_files INTEGER,
  processed_files INTEGER,
  failed_files INTEGER,
  all_processed BOOLEAN,
  processing_status TEXT
) AS $$
DECLARE
  total_count INTEGER;
  processed_count INTEGER;
  failed_count INTEGER;
  all_done BOOLEAN;
BEGIN
  -- Count total files
  SELECT COUNT(*) INTO total_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid;
  
  -- Count processed files
  SELECT COUNT(*) INTO processed_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = true;
  
  -- Count failed files
  SELECT COUNT(*) INTO failed_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = false 
    AND updated_at IS NOT NULL;
  
  -- Check if all files are processed
  all_done := total_count = 0 OR total_count = processed_count;
  
  -- Determine processing status
  IF total_count = 0 THEN
    processing_status := 'no_files';
  ELSIF all_done THEN
    processing_status := 'completed';
  ELSIF processed_count > 0 OR failed_count > 0 THEN
    processing_status := 'in_progress';
  ELSE
    processing_status := 'pending';
  END IF;
  
  RETURN QUERY SELECT 
    total_count,
    processed_count,
    failed_count,
    all_done,
    processing_status;
END;
$$ LANGUAGE plpgsql;

-- STEP 11: CREATE THE MAIN APPOINTMENT WORKFLOW FUNCTION
-- First drop the function if it exists to avoid parameter default conflicts
-- Use CASCADE to also drop dependent objects like triggers
DROP FUNCTION IF EXISTS trigger_complete_appointment_workflow() CASCADE;

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
  
  -- Update appointment status to triggered
  UPDATE appointments 
  SET 
    ai_processing_status = 'triggered',
    updated_at = NOW()
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
    
    -- Call process_patient_files using pg_net extension
    SELECT net.http_post(
      url := process_files_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := format('{"appointment_id": "%s", "request_id": "%s"}', NEW.id, request_id)::jsonb
    ) INTO http_response_status;
    
    RAISE NOTICE 'Called process_patient_files for appointment % with request ID %', NEW.id, request_id;
  ELSE
    RAISE NOTICE 'No files to process for appointment %. Calling clinical summary directly...', NEW.id;
    
    -- Call clinical summary directly using pg_net extension
    SELECT net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := format('{"type": "INSERT", "record": {"id": "%s", "ai_processing_status": "pending"}, "table": "appointments", "request_id": "%s"}', NEW.id, request_id)::jsonb
    ) INTO http_response_status;
    
    RAISE NOTICE 'Successfully called clinical summary for appointment %', NEW.id;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but NEVER fail the appointment creation
    RAISE WARNING 'Error in appointment workflow for appointment %: %', NEW.id, SQLERRM;
    
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

-- STEP 12: CREATE THE SINGLE, SAFE TRIGGER
CREATE TRIGGER trg_complete_appointment_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_appointment_workflow();

-- STEP 13: GRANT PERMISSIONS TO SERVICE ROLE
GRANT EXECUTE ON FUNCTION link_files_to_appointment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_unprocessed_files_for_appointment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_all_files_processed(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_file_processing_status(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION get_appointment_processing_status(UUID) TO service_role;

-- STEP 14: CREATE VIEW FOR MONITORING
-- First drop the view if it exists to ensure clean recreation
DROP VIEW IF EXISTS appointment_file_processing_status CASCADE;

CREATE OR REPLACE VIEW appointment_file_processing_status AS
SELECT 
  a.id as appointment_id,
  a.consultation_id,
  a.patient_id,
  a.appointment_date,
  a.appointment_time,
  a.status as appointment_status,
  COALESCE(pfs.total_files, 0) as total_files,
  COALESCE(pfs.processed_files, 0) as processed_files,
  COALESCE(pfs.failed_files, 0) as failed_files,
  COALESCE(pfs.all_processed, true) as all_processed,
  COALESCE(pfs.processing_status, 'no_files') as processing_status,
  a.created_at as appointment_created,
  a.updated_at as appointment_updated
FROM appointments a
LEFT JOIN LATERAL get_appointment_processing_status(a.id) pfs ON true
ORDER BY a.created_at DESC;

-- STEP 15: VERIFY THE TRIGGER WAS CREATED
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_complete_appointment_workflow'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: Complete appointment workflow trigger created successfully';
  ELSE
    RAISE WARNING '❌ ERROR: Trigger was not created';
  END IF;
END $$;

-- STEP 16: SHOW ALL TRIGGERS ON APPOINTMENTS TABLE
SELECT 
    'Current triggers on appointments table:' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;

-- STEP 17: TEST APPOINTMENT CREATION
DO $$
DECLARE
  test_appointment_id UUID;
  test_consultation_id UUID;
  test_patient_id UUID;
  test_doctor_id UUID;
BEGIN
  -- Get test data
  SELECT id INTO test_patient_id FROM auth.users LIMIT 1;
  SELECT id INTO test_doctor_id FROM profiles WHERE role = 'doctor' LIMIT 1;
  
  -- Create test consultation
  INSERT INTO consultations (
    id,
    patient_id,
    doctor_id,
    form_data
  ) VALUES (
    gen_random_uuid(),
    test_patient_id,
    test_doctor_id,
    '{"chiefComplaint": "Test complaint"}'::jsonb
  ) RETURNING id INTO test_consultation_id;
  
  -- Create test appointment
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
    test_consultation_id,
    test_patient_id,
    test_doctor_id,
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
  
  -- Clean up test data
  DELETE FROM appointments WHERE id = test_appointment_id;
  DELETE FROM consultations WHERE id = test_consultation_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ TEST: Failed to create test appointment: %', SQLERRM;
END $$;

-- STEP 18: ADD HELPFUL COMMENTS
COMMENT ON FUNCTION trigger_complete_appointment_workflow() IS 'Complete appointment workflow: ensures appointment creation and proper file processing with AI';
COMMENT ON TRIGGER trg_complete_appointment_workflow ON appointments IS 'Single safe trigger for complete appointment workflow - never blocks appointment creation';
COMMENT ON FUNCTION link_files_to_appointment(UUID) IS 'Automatically links consultation files to appointment when created';
COMMENT ON FUNCTION get_unprocessed_files_for_appointment(UUID) IS 'Returns unprocessed files for appointment-based processing';
COMMENT ON FUNCTION check_all_files_processed(UUID) IS 'Checks if all files for appointment have been processed';
COMMENT ON FUNCTION update_file_processing_status(UUID, TEXT, BOOLEAN) IS 'Updates file processing status and extracted text';
COMMENT ON FUNCTION get_appointment_processing_status(UUID) IS 'Returns comprehensive processing status for appointment';
