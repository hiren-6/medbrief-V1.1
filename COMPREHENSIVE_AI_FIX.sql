-- ===================================
-- COMPREHENSIVE AI PROCESSING FIX
-- Fixes all potential issues with AI processing when patients upload documents
-- ===================================

-- STEP 1: VERIFY AND RESTORE ALL TRIGGERS
-- ========================================

-- Drop all existing triggers to start fresh
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;

-- Drop all existing functions
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();

-- STEP 2: CREATE THE MAIN WORKFLOW FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION trigger_complete_medical_workflow()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  process_files_url TEXT;
  service_role_key TEXT;
  linked_files_count INTEGER;
  files_exist BOOLEAN;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Set URLs
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  process_files_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Get service role key
  service_role_key := current_setting('app.settings.service_role_key', true);
  
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
    
    SELECT 
      status,
      content
    INTO 
      response_status,
      response_body
    FROM net.http_post(
      url := process_files_url,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )::text,
      body := json_build_object(
        'appointment_id', NEW.id
      )::text
    );
    
    RAISE NOTICE 'process_patient_files response: status=%, body=%', response_status, response_body;
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'Failed to call process_patient_files: status=%, response=%', response_status, response_body;
    END IF;
    
  ELSE
    -- No files - call clinical summary directly
    RAISE NOTICE 'No files to process, calling clinical summary directly for appointment %', NEW.id;
    
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
      body := json_build_object(
        'type', 'INSERT',
        'record', row_to_json(NEW),
        'table', 'appointments'
      )::text
    );
    
    RAISE NOTICE 'clinical_summary response: status=%, body=%', response_status, response_body;
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'Failed to call clinical summary: status=%, response=%', response_status, response_body;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in complete medical workflow for appointment %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: CREATE BACKUP FUNCTIONS
-- ================================

-- Backup AI clinical summary function
CREATE OR REPLACE FUNCTION trigger_ai_clinical_summary()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Triggering AI processing for appointment: %', NEW.id;
  
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
    body := json_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW),
      'table', 'appointments'
    )::text
  );
  
  RAISE NOTICE 'Edge function response: status=%, body=%', response_status, response_body;
  
  IF response_status IS NULL OR response_status >= 400 THEN
    RAISE WARNING 'Failed to trigger AI processing: status=%, response=%', response_status, response_body;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger AI processing: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Manual processing function
CREATE OR REPLACE FUNCTION mark_appointment_for_processing()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Marked appointment % for AI processing', NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- File linking function
CREATE OR REPLACE FUNCTION trigger_link_files_to_appointment()
RETURNS TRIGGER AS $$
DECLARE
  linked_count INTEGER;
BEGIN
  SELECT link_files_to_appointment(NEW.id) INTO linked_count;
  
  RAISE NOTICE 'Linked % files to appointment %', linked_count, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: CREATE ALL TRIGGERS
-- ============================

-- Main comprehensive workflow trigger (HIGHEST PRIORITY)
CREATE TRIGGER trg_complete_medical_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_medical_workflow();

-- Backup AI summary trigger
CREATE TRIGGER trg_ai_summary 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_ai_clinical_summary();

-- Manual processing trigger
CREATE TRIGGER trg_manual_processing 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION mark_appointment_for_processing();

-- File linking trigger
CREATE TRIGGER trg_link_files_to_appointment 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_link_files_to_appointment();

-- STEP 5: VERIFY TRIGGERS AND FUNCTIONS
-- ======================================

-- Check triggers
SELECT 
    'VERIFYING TRIGGERS:' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'appointments'
ORDER BY trigger_name;

-- Check functions
SELECT 
    'VERIFYING FUNCTIONS:' AS info;

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

-- STEP 6: SET UP WEBHOOK CONFIGURATION
-- =====================================

-- Note: This requires manual setup in Supabase Dashboard
-- Go to Database → Webhooks and create:
-- - Table: appointments
-- - Events: INSERT
-- - URL: https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary
-- - Method: POST

-- STEP 7: TEST THE WORKFLOW
-- ==========================

-- Create a test appointment
INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    appointment_date,
    appointment_time,
    appointment_datetime,
    status,
    ai_processing_status
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    gen_random_uuid(),
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    'scheduled',
    'pending'
);

-- Check the result
SELECT 
    'TESTING WORKFLOW:' AS info;

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;

-- STEP 8: MANUAL TRIGGER TEST
-- ============================

-- Find recent appointments
SELECT 
    'RECENT APPOINTMENTS:' AS info;

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
ORDER BY created_at DESC 
LIMIT 3;

-- STEP 9: CHECK FILE LINKING
-- ===========================

-- Check if files are properly linked
SELECT 
    'FILE LINKING STATUS:' AS info;

SELECT 
    pf.id,
    pf.file_name,
    pf.consultation_id,
    pf.appointment_id,
    pf.processed,
    a.ai_processing_status
FROM patient_files pf
LEFT JOIN appointments a ON pf.appointment_id = a.id
ORDER BY pf.created_at DESC 
LIMIT 5;

-- STEP 10: FINAL VERIFICATION
-- ============================

DO $$
BEGIN
  -- Check triggers
  IF (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'appointments') >= 4 THEN
    RAISE NOTICE '✅ SUCCESS: All triggers created';
  ELSE
    RAISE WARNING '❌ ERROR: Missing triggers. Expected 4, found %', (SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'appointments');
  END IF;
  
  -- Check functions
  IF (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('trigger_ai_clinical_summary', 'trigger_complete_medical_workflow', 'mark_appointment_for_processing', 'trigger_link_files_to_appointment')) = 4 THEN
    RAISE NOTICE '✅ SUCCESS: All functions created';
  ELSE
    RAISE WARNING '❌ ERROR: Missing functions';
  END IF;
  
  -- Check appointments table structure
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'ai_processing_status') THEN
    RAISE NOTICE '✅ SUCCESS: appointments table has ai_processing_status column';
  ELSE
    RAISE WARNING '❌ ERROR: appointments table missing ai_processing_status column';
  END IF;
  
  -- Check patient_files table structure
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_files' AND column_name = 'appointment_id') THEN
    RAISE NOTICE '✅ SUCCESS: patient_files table has appointment_id column';
  ELSE
    RAISE WARNING '❌ ERROR: patient_files table missing appointment_id column';
  END IF;
  
END $$;

-- STEP 11: ADD HELPFUL COMMENTS
-- ==============================

COMMENT ON FUNCTION trigger_complete_medical_workflow() IS 'Complete medical workflow: link files → process files → generate clinical summary';
COMMENT ON FUNCTION trigger_ai_clinical_summary() IS 'Backup AI clinical summary trigger';
COMMENT ON FUNCTION mark_appointment_for_processing() IS 'Manual processing backup trigger';
COMMENT ON FUNCTION trigger_link_files_to_appointment() IS 'File linking trigger for appointment management';

-- STEP 12: MANUAL WEBHOOK SETUP INSTRUCTIONS
-- ===========================================

SELECT 
    'MANUAL SETUP REQUIRED:' AS info;

SELECT 
    'Go to Supabase Dashboard → Database → Webhooks' AS step1,
    'Create new webhook with:' AS step2,
    'Table: appointments' AS step3,
    'Events: INSERT' AS step4,
    'URL: https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary' AS step5,
    'Method: POST' AS step6;

SELECT 
    'Also verify in Supabase Dashboard → Settings → Edge Functions:' AS step7,
    'GEMINI_API_KEY is set correctly' AS step8; 