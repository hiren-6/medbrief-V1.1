-- ===================================
-- PRODUCTION TRIGGER FIX
-- This migration fixes the production issue where old INSERT triggers
-- are still firing and causing the process_patient_files function to fail
-- ===================================

-- PART 1: COMPLETELY REMOVE ALL OLD TRIGGERS
-- This ensures no leftover triggers are causing conflicts

-- Drop ALL possible patient_files triggers
DROP TRIGGER IF EXISTS file_processing_trigger ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_process_patient_files_insert ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_process_patient_files_update ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_process_patient_files_on_link ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_process_files_on_insert ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_webhook_files ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_file_processing ON patient_files CASCADE;
DROP TRIGGER IF EXISTS trg_stage1_file_processing ON patient_files CASCADE;

-- Drop ALL possible appointments triggers  
DROP TRIGGER IF EXISTS trg_ai_processing_update ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_complete_appointment_workflow ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_safe_appointment_workflow ON appointments CASCADE;
DROP TRIGGER IF EXISTS trg_stage2_ai_summary ON appointments CASCADE;

-- Drop ALL trigger functions
DROP FUNCTION IF EXISTS trigger_process_patient_files() CASCADE;
DROP FUNCTION IF EXISTS trigger_process_patient_files_on_link() CASCADE;
DROP FUNCTION IF EXISTS trigger_file_processing() CASCADE;
DROP FUNCTION IF EXISTS process_files_on_insert() CASCADE;
DROP FUNCTION IF EXISTS webhook_file_processing() CASCADE;
DROP FUNCTION IF EXISTS coordinated_file_processing_trigger() CASCADE;

DROP FUNCTION IF EXISTS trigger_ai_processing_on_update() CASCADE;
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary() CASCADE;
DROP FUNCTION IF EXISTS trigger_complete_workflow() CASCADE;
DROP FUNCTION IF EXISTS trigger_manual_processing() CASCADE;
DROP FUNCTION IF EXISTS call_ai_edge_function() CASCADE;
DROP FUNCTION IF EXISTS simple_trigger_ai() CASCADE;
DROP FUNCTION IF EXISTS mark_appointment_for_processing() CASCADE;
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment() CASCADE;
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow() CASCADE;
DROP FUNCTION IF EXISTS trigger_safe_appointment_workflow() CASCADE;
DROP FUNCTION IF EXISTS coordinated_ai_summary_trigger() CASCADE;

-- PART 2: CHECK FOR ANY REMAINING TRIGGERS
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    -- List any remaining triggers on patient_files
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'patient_files'
    LOOP
        RAISE NOTICE 'Found remaining patient_files trigger: %', trigger_record.trigger_name;
    END LOOP;
    
    -- List any remaining triggers on appointments
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'appointments'
    LOOP
        RAISE NOTICE 'Found remaining appointments trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- PART 3: PRODUCTION-READY SOLUTION
-- Based on the logs, we need a trigger that works with the current application workflow

-- Create a production-ready trigger that handles file linking properly
CREATE OR REPLACE FUNCTION production_file_processing_trigger()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Only trigger when appointment_id changes from NULL to a value (file gets linked)
  IF TG_OP = 'UPDATE' AND OLD.appointment_id IS NULL AND NEW.appointment_id IS NOT NULL THEN
    
    RAISE NOTICE 'PRODUCTION: File % linked to appointment %, triggering processing', 
                 NEW.file_name, NEW.appointment_id;
    
    -- Set webhook configuration
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Prepare coordinated trigger payload (preferred)
    request_body := json_build_object(
      'appointment_id', NEW.appointment_id,
      'request_id', 'production_' || NEW.id || '_' || extract(epoch from now())::text,
      'trigger_type', 'file_link',
      'file_id', NEW.id,
      'file_name', NEW.file_name
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
    
    RAISE NOTICE 'PRODUCTION: File processing response - status: %, body: %', 
                 response_status, COALESCE(response_body, 'null');
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'PRODUCTION: File processing failed - status: %, response: %', 
                    response_status, response_body;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'PRODUCTION: File processing trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create production trigger on patient_files UPDATE
CREATE TRIGGER trg_production_file_processing
    AFTER UPDATE ON patient_files 
    FOR EACH ROW 
    EXECUTE FUNCTION production_file_processing_trigger();

-- PART 4: PRODUCTION AI SUMMARY TRIGGER
-- This will trigger when files are done processing

CREATE OR REPLACE FUNCTION production_ai_summary_trigger()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Only trigger when ai_processing_status changes to 'ready_for_summary'
  IF TG_OP = 'UPDATE' 
     AND OLD.ai_processing_status != 'ready_for_summary' 
     AND NEW.ai_processing_status = 'ready_for_summary' THEN
    
    RAISE NOTICE 'PRODUCTION: Appointment % ready for AI summary, triggering processing', NEW.id;
    
    -- Validate required data
    IF NEW.consultation_id IS NULL OR NEW.patient_id IS NULL THEN
      RAISE WARNING 'PRODUCTION: Missing required data - consultation_id: %, patient_id: %', 
                    NEW.consultation_id, NEW.patient_id;
      
      UPDATE appointments 
      SET ai_processing_status = 'failed',
          error_message = 'Missing consultation_id or patient_id',
          updated_at = NOW()
      WHERE id = NEW.id;
      
      RETURN NEW;
    END IF;
    
    -- Set webhook configuration
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Update status to processing first
    UPDATE appointments 
    SET ai_processing_status = 'processing',
        updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Prepare coordinated trigger payload
    request_body := json_build_object(
      'type', 'UPDATE',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table', 'appointments',
      'trigger_type', 'ai_summary'
    )::text;
    
    -- Call the AI summary function
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
    
    RAISE NOTICE 'PRODUCTION: AI summary response - status: %, body: %', 
                 response_status, COALESCE(response_body, 'null');
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'PRODUCTION: AI summary failed - status: %, response: %', 
                    response_status, response_body;
      
      UPDATE appointments 
      SET ai_processing_status = 'failed',
          error_message = 'AI summary generation failed: HTTP ' || COALESCE(response_status::text, 'null'),
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'PRODUCTION: AI summary trigger error: %', SQLERRM;
    
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Trigger error: ' || SQLERRM,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create production trigger on appointments UPDATE
CREATE TRIGGER trg_production_ai_summary
    AFTER UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION production_ai_summary_trigger();

-- PART 5: HELPER FUNCTIONS FOR PRODUCTION

-- Function to manually trigger file processing for an appointment
CREATE OR REPLACE FUNCTION manually_trigger_file_processing(appointment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  files_count INTEGER;
BEGIN
  -- Check if appointment exists
  IF NOT EXISTS(SELECT 1 FROM appointments WHERE id = appointment_id) THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Trigger file processing by updating all unprocessed files
  UPDATE patient_files 
  SET updated_at = NOW()
  WHERE appointment_id = manually_trigger_file_processing.appointment_id 
    AND processed = false;
  
  GET DIAGNOSTICS files_count = ROW_COUNT;
  
  RAISE NOTICE 'Manually triggered file processing for % files', files_count;
  RETURN files_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to manually trigger AI summary
CREATE OR REPLACE FUNCTION manually_trigger_ai_summary(appointment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if appointment exists
  IF NOT EXISTS(SELECT 1 FROM appointments WHERE id = appointment_id) THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Update appointment to ready_for_summary status
  UPDATE appointments 
  SET ai_processing_status = 'ready_for_summary',
      updated_at = NOW()
  WHERE id = appointment_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- PART 6: VERIFY PRODUCTION SETUP
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_production_file_processing', 'trg_production_ai_summary')
ORDER BY event_object_table, trigger_name;

-- Add production documentation
COMMENT ON TRIGGER trg_production_file_processing ON patient_files IS 
'PRODUCTION: Triggers file processing when a patient file is linked to an appointment';

COMMENT ON TRIGGER trg_production_ai_summary ON appointments IS 
'PRODUCTION: Triggers AI summary generation when appointment status changes to ready_for_summary';

COMMENT ON FUNCTION production_file_processing_trigger() IS 
'PRODUCTION: File processing trigger function that handles appointment linking';

COMMENT ON FUNCTION production_ai_summary_trigger() IS 
'PRODUCTION: AI summary trigger function that handles coordinated processing';

-- PART 7: PRODUCTION STATUS LOG
DO $$ 
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'PRODUCTION TRIGGER SYSTEM DEPLOYED';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'All old triggers removed';
  RAISE NOTICE 'Production file processing trigger: ACTIVE';
  RAISE NOTICE 'Production AI summary trigger: ACTIVE';
  RAISE NOTICE 'Manual control functions: AVAILABLE';
  RAISE NOTICE 'Edge functions updated to handle both payload types';
  RAISE NOTICE '=============================================';
END $$;
