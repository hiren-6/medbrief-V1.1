-- ===================================
-- CLEAN TRIGGERS - FINAL SOLUTION
-- Remove all conflicting triggers and create a single, correct trigger
-- ===================================

-- STEP 1: DROP ALL EXISTING TRIGGERS TO AVOID CONFLICTS
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;

-- STEP 2: DROP ALL EXISTING TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();

-- STEP 3: CREATE THE SINGLE, CORRECT TRIGGER FUNCTION
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

-- STEP 4: CREATE THE SINGLE TRIGGER
CREATE TRIGGER trg_complete_medical_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_medical_workflow();

-- STEP 5: VERIFY THE TRIGGER WAS CREATED
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trg_complete_medical_workflow'
  ) THEN
    RAISE NOTICE '✅ SUCCESS: Complete medical workflow trigger created successfully';
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
COMMENT ON FUNCTION trigger_complete_medical_workflow() IS 'Complete medical workflow: link files → process files → generate clinical summary';
COMMENT ON TRIGGER trg_complete_medical_workflow ON appointments IS 'Single trigger for complete medical AI workflow'; 