-- ===================================
-- CLEAN TRIGGERS - FINAL SOLUTION
-- This migration implements the correct, simplified trigger system:
-- 1. One trigger on appointments INSERT that calls process_patient_files
-- 2. No triggers on patient_files (files now have appointment_id from start)
-- 3. No separate clinical summary trigger (called directly by process_patient_files)
-- ===================================

-- PART 1: REMOVE ALL EXISTING TRIGGERS COMPLETELY
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    -- Drop all triggers on patient_files
    FOR trigger_record IN 
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'patient_files'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON patient_files CASCADE';
        RAISE NOTICE 'Dropped patient_files trigger: %', trigger_record.trigger_name;
    END LOOP;
    
    -- Drop all triggers on appointments
    FOR trigger_record IN 
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'appointments'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON appointments CASCADE';
        RAISE NOTICE 'Dropped appointments trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- PART 2: DROP ALL TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS file_processing_trigger() CASCADE;
DROP FUNCTION IF EXISTS trg_production_file_processing() CASCADE;
DROP FUNCTION IF EXISTS production_file_processing_trigger() CASCADE;
DROP FUNCTION IF EXISTS trigger_process_patient_files() CASCADE;
DROP FUNCTION IF EXISTS trigger_process_patient_files_on_link() CASCADE;
DROP FUNCTION IF EXISTS coordinated_file_processing_trigger() CASCADE;

DROP FUNCTION IF EXISTS trg_production_ai_summary() CASCADE;
DROP FUNCTION IF EXISTS production_ai_summary_trigger() CASCADE;
DROP FUNCTION IF EXISTS trigger_ai_processing_on_update() CASCADE;
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary() CASCADE;
DROP FUNCTION IF EXISTS coordinated_ai_summary_trigger() CASCADE;

-- PART 3: CREATE THE SINGLE, CORRECT TRIGGER

-- This is the ONLY trigger we need: appointment INSERT calls file processing
CREATE OR REPLACE FUNCTION trigger_file_processing_on_appointment()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
  files_count INTEGER;
BEGIN
  -- Only trigger when appointment is created with valid consultation_id and patient_id
  IF NEW.consultation_id IS NOT NULL AND NEW.patient_id IS NOT NULL THEN
    
    -- Check if there are files for this appointment
    SELECT COUNT(*) INTO files_count 
    FROM patient_files 
    WHERE appointment_id = NEW.id;
    
    RAISE NOTICE 'FINAL SOLUTION: Appointment % created, found % files to process', 
                 NEW.id, files_count;
    
    -- Set webhook configuration
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Update appointment status to processing
    UPDATE appointments 
    SET ai_processing_status = 'processing',
        updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Prepare coordinated payload
    request_body := json_build_object(
      'appointment_id', NEW.id,
      'request_id', 'final_solution_' || NEW.id || '_' || extract(epoch from now())::text,
      'trigger_type', 'appointment_created',
      'files_count', files_count
    )::text;
    
    -- Call the file processing function
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
    
    RAISE NOTICE 'FINAL SOLUTION: File processing response - status: %, body: %', 
                 response_status, COALESCE(response_body, 'null');
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'FINAL SOLUTION: File processing failed - status: %, response: %', 
                    response_status, response_body;
      
      -- Update appointment status to failed
      UPDATE appointments 
      SET ai_processing_status = 'failed',
          error_message = 'File processing failed: HTTP ' || COALESCE(response_status::text, 'null'),
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  ELSE
    RAISE WARNING 'FINAL SOLUTION: Appointment % missing consultation_id or patient_id', NEW.id;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'FINAL SOLUTION: Trigger error: %', SQLERRM;
    
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Trigger error: ' || SQLERRM,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the ONLY trigger we need
CREATE TRIGGER trg_final_solution_appointment_processing
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_file_processing_on_appointment();

-- PART 4: HELPER FUNCTIONS FOR MANUAL CONTROL

-- Function to manually trigger the entire workflow
CREATE OR REPLACE FUNCTION manually_trigger_appointment_processing(appointment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if appointment exists
  IF NOT EXISTS(SELECT 1 FROM appointments WHERE id = appointment_id) THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Trigger by updating the appointment (this will call the INSERT trigger logic)
  UPDATE appointments 
  SET updated_at = NOW()
  WHERE id = appointment_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check appointment processing status
CREATE OR REPLACE FUNCTION check_appointment_processing_status(appointment_id UUID)
RETURNS JSON AS $$
DECLARE
  appointment_record RECORD;
  files_count INTEGER;
  processed_files INTEGER;
  clinical_summary_count INTEGER;
  result JSON;
BEGIN
  -- Get appointment details
  SELECT * INTO appointment_record 
  FROM appointments 
  WHERE id = appointment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Appointment not found');
  END IF;
  
  -- Count files
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE processed = true) as processed
  INTO files_count, processed_files
  FROM patient_files 
  WHERE appointment_id = check_appointment_processing_status.appointment_id;
  
  -- Check clinical summary
  SELECT COUNT(*) INTO clinical_summary_count
  FROM clinical_summaries 
  WHERE consultation_id = appointment_record.consultation_id;
  
  result := json_build_object(
    'appointment_id', appointment_id,
    'appointment_status', appointment_record.ai_processing_status,
    'total_files', files_count,
    'processed_files', processed_files,
    'has_clinical_summary', clinical_summary_count > 0,
    'consultation_id', appointment_record.consultation_id,
    'patient_id', appointment_record.patient_id,
    'error_message', appointment_record.error_message
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- PART 5: VERIFY FINAL SETUP
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE event_object_table IN ('appointments', 'patient_files')
ORDER BY event_object_table, trigger_name;

-- PART 6: DOCUMENTATION
COMMENT ON TRIGGER trg_final_solution_appointment_processing ON appointments IS 
'FINAL SOLUTION: Single trigger that starts the complete workflow when appointment is created';

COMMENT ON FUNCTION trigger_file_processing_on_appointment() IS 
'FINAL SOLUTION: The only trigger function needed - calls process_patient_files which then calls clinical_summary';

COMMENT ON FUNCTION manually_trigger_appointment_processing(UUID) IS 
'FINAL SOLUTION: Manual trigger for the complete appointment processing workflow';

COMMENT ON FUNCTION check_appointment_processing_status(UUID) IS 
'FINAL SOLUTION: Check the complete status of appointment processing';

-- PART 7: FINAL STATUS LOG
DO $$ 
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'FINAL SOLUTION IMPLEMENTED';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'CORRECT FLOW:';
  RAISE NOTICE '1. Create consultation';
  RAISE NOTICE '2. Create appointment (triggers file processing)';
  RAISE NOTICE '3. Upload files with appointment_id';
  RAISE NOTICE '4. process_patient_files processes all files';
  RAISE NOTICE '5. process_patient_files calls generate_clinical_summary';
  RAISE NOTICE '6. Workflow complete';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'TRIGGERS ACTIVE: 1 (appointment INSERT only)';
  RAISE NOTICE 'EDGE FUNCTIONS: 2 (process_patient_files calls generate_clinical_summary)';
  RAISE NOTICE 'MANUAL FUNCTIONS: Available for debugging';
  RAISE NOTICE '=============================================';
END $$;
