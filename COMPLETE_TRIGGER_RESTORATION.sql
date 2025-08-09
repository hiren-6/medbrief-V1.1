-- ===================================
-- COMPLETE TRIGGER RESTORATION SCRIPT
-- Restore all necessary triggers and functions for appointments table
-- ===================================

-- STEP 1: DROP ALL EXISTING TRIGGERS AND FUNCTIONS (CLEAN SLATE)
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;

DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();

-- STEP 2: CREATE ALL NECESSARY FUNCTIONS

-- 2.1 Main AI Clinical Summary Function
CREATE OR REPLACE FUNCTION trigger_ai_clinical_summary()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Set the webhook URL
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  
  -- Get the service role key from environment
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Update the appointment status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  -- Prepare the request body
  request_body := json_build_object(
    'type', 'INSERT',
    'record', row_to_json(NEW),
    'table', 'appointments'
  )::text;
  
  -- Log the trigger attempt
  RAISE NOTICE 'Triggering AI processing for appointment: %', NEW.id;
  
  -- Call the Edge Function via HTTP
  SELECT 
    status,
    content
  INTO 
    response_status,
    response_body
  FROM net.http_post(
    url := webhook_url,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    )::text,
    body := request_body
  );
  
  -- Log the response
  RAISE NOTICE 'Edge function response: status=%, body=%', response_status, response_body;
  
  -- If the HTTP call failed, log it but don't fail the insert
  IF response_status IS NULL OR response_status >= 400 THEN
    RAISE WARNING 'Failed to trigger AI processing: status=%, response=%', response_status, response_body;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the insert
    RAISE WARNING 'Failed to trigger AI processing: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Manual Processing Function
CREATE OR REPLACE FUNCTION mark_appointment_for_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Just update the status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Marked appointment % for AI processing', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.3 File Linking Function
CREATE OR REPLACE FUNCTION trigger_link_files_to_appointment()
RETURNS TRIGGER AS $$
DECLARE
  linked_count INTEGER;
BEGIN
  -- Link files to this appointment
  SELECT link_files_to_appointment(NEW.id) INTO linked_count;
  
  RAISE NOTICE 'Linked % files to appointment %', linked_count, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.4 Complete Medical Workflow Function
CREATE OR REPLACE FUNCTION trigger_complete_medical_workflow()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  process_files_url TEXT;
  service_role_key TEXT;
  linked_files_count INTEGER;
  files_exist BOOLEAN;
BEGIN
  -- Set URLs
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  process_files_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Update appointment status
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Starting complete medical workflow for appointment: %', NEW.id;
  
  -- STEP 1: Link files to appointment
  SELECT link_files_to_appointment(NEW.id) INTO linked_files_count;
  RAISE NOTICE 'Linked % files to appointment %', linked_files_count, NEW.id;
  
  -- STEP 2: Check if files exist for this appointment
  SELECT EXISTS (
    SELECT 1 FROM patient_files 
    WHERE appointment_id = NEW.id 
    AND (processed IS NULL OR processed = false)
  ) INTO files_exist;
  
  RAISE NOTICE 'Files exist for appointment %: %', NEW.id, files_exist;
  
  -- STEP 3: Call appropriate function based on files
  IF files_exist THEN
    -- Files exist - call process_patient_files first
    RAISE NOTICE 'Calling process_patient_files for appointment %', NEW.id;
    
    PERFORM net.http_post(
      url := process_files_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'appointment_id', NEW.id
      )::text
    );
    
    RAISE NOTICE 'Successfully called process_patient_files for appointment %', NEW.id;
  ELSE
    -- No files - call clinical summary directly
    RAISE NOTICE 'No files to process, calling clinical summary directly for appointment %', NEW.id;
    
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
    RAISE WARNING 'Error in complete medical workflow for appointment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: CREATE ALL TRIGGERS

-- 3.1 Main comprehensive workflow trigger (HIGHEST PRIORITY)
CREATE TRIGGER trg_complete_medical_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_medical_workflow();

-- 3.2 Backup AI summary trigger (FALLBACK)
CREATE TRIGGER trg_ai_summary 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_ai_clinical_summary();

-- 3.3 Manual processing trigger (FOR TESTING)
CREATE TRIGGER trg_manual_processing 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION mark_appointment_for_processing();

-- 3.4 File linking trigger (FOR FILE MANAGEMENT)
CREATE TRIGGER trg_link_files_to_appointment 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_link_files_to_appointment();

-- STEP 4: VERIFY ALL TRIGGERS ARE CREATED
SELECT 
    'VERIFYING ALL TRIGGERS CREATED:' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;

-- STEP 5: VERIFY ALL FUNCTIONS ARE CREATED
SELECT 
    'VERIFYING ALL FUNCTIONS CREATED:' AS info;

SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'trigger_ai_clinical_summary',
    'trigger_complete_medical_workflow',
    'mark_appointment_for_processing',
    'trigger_link_files_to_appointment'
)
ORDER BY routine_name;

-- STEP 6: TEST WITH REAL DATA
SELECT 
    'TESTING WITH REAL DATA:' AS info;

-- Create test appointment using existing data
WITH real_data AS (
    SELECT 
        u.id as patient_id,
        c.id as consultation_id
    FROM auth.users u
    CROSS JOIN consultations c
    LIMIT 1
)
INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    appointment_date,
    appointment_time,
    appointment_datetime,
    status,
    ai_processing_status
)
SELECT 
    gen_random_uuid(),
    rd.consultation_id,
    rd.patient_id,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    'scheduled',
    'pending'
FROM real_data rd;

-- STEP 7: CHECK THE RESULT
SELECT 
    'VERIFYING TRIGGER FIRED:' AS info;

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;

-- STEP 8: CHECK TRIGGER STATUS
SELECT 
    'CHECKING TRIGGER STATUS:' AS info;

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
WHERE ai_processing_status = 'triggered'
ORDER BY created_at DESC 
LIMIT 3;

-- STEP 9: ADD HELPFUL COMMENTS
COMMENT ON FUNCTION trigger_complete_medical_workflow() IS 'Complete medical workflow: link files → process files → generate clinical summary';
COMMENT ON FUNCTION trigger_ai_clinical_summary() IS 'Backup AI clinical summary trigger';
COMMENT ON FUNCTION mark_appointment_for_processing() IS 'Manual processing backup trigger';
COMMENT ON FUNCTION trigger_link_files_to_appointment() IS 'File linking trigger for appointment management';

-- STEP 10: FINAL VERIFICATION
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'appointments') = 4 THEN
    RAISE NOTICE '✅ SUCCESS: All 4 triggers restored and working';
  ELSE
    RAISE WARNING '❌ ERROR: Expected 4 triggers, found %', (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'appointments');
  END IF;
  
  IF (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('trigger_ai_clinical_summary', 'trigger_complete_medical_workflow', 'mark_appointment_for_processing', 'trigger_link_files_to_appointment')) = 4 THEN
    RAISE NOTICE '✅ SUCCESS: All 4 functions restored and working';
  ELSE
    RAISE WARNING '❌ ERROR: Expected 4 functions, found %', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('trigger_ai_clinical_summary', 'trigger_complete_medical_workflow', 'mark_appointment_for_processing', 'trigger_link_files_to_appointment'));
  END IF;
END $$; 