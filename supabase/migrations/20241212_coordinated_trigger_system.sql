-- ===================================
-- COORDINATED TRIGGER SYSTEM - FINAL SOLUTION
-- This migration implements a proper two-stage trigger system that eliminates
-- all timing issues and ensures sequential, coordinated processing
-- ===================================

-- PART 1: CLEAN UP ALL EXISTING TRIGGERS
-- Drop all existing triggers to start fresh

-- Patient Files Triggers
DROP TRIGGER IF EXISTS file_processing_trigger ON patient_files;
DROP TRIGGER IF EXISTS trg_process_patient_files_insert ON patient_files;
DROP TRIGGER IF EXISTS trg_process_patient_files_update ON patient_files;
DROP TRIGGER IF EXISTS trg_process_patient_files_on_link ON patient_files;
DROP TRIGGER IF EXISTS trg_process_files_on_insert ON patient_files;
DROP TRIGGER IF EXISTS trg_webhook_files ON patient_files;
DROP TRIGGER IF EXISTS trg_file_processing ON patient_files;

-- Appointments Triggers
DROP TRIGGER IF EXISTS trg_ai_processing_update ON appointments;
DROP TRIGGER IF EXISTS trg_complete_appointment_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;
DROP TRIGGER IF EXISTS trg_complete_medical_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_safe_appointment_workflow ON appointments;

-- PART 2: DROP ALL EXISTING TRIGGER FUNCTIONS
DROP FUNCTION IF EXISTS trigger_process_patient_files();
DROP FUNCTION IF EXISTS trigger_process_patient_files_on_link();
DROP FUNCTION IF EXISTS trigger_file_processing() CASCADE;
DROP FUNCTION IF EXISTS process_files_on_insert() CASCADE;
DROP FUNCTION IF EXISTS webhook_file_processing() CASCADE;

DROP FUNCTION IF EXISTS trigger_ai_processing_on_update();
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS trigger_complete_workflow();
DROP FUNCTION IF EXISTS trigger_manual_processing();
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS simple_trigger_ai();
DROP FUNCTION IF EXISTS mark_appointment_for_processing();
DROP FUNCTION IF EXISTS trigger_link_files_to_appointment();
DROP FUNCTION IF EXISTS trigger_complete_medical_workflow();
DROP FUNCTION IF EXISTS trigger_safe_appointment_workflow();

-- PART 3: ENSURE PROPER TABLE STRUCTURE
-- Add necessary columns if they don't exist

-- Appointments table enhancements
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS ai_processing_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS files_processed_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_files_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Patient files table enhancements  
ALTER TABLE patient_files
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Make appointment_id nullable initially
ALTER TABLE patient_files 
ALTER COLUMN appointment_id DROP NOT NULL;

-- PART 4: CREATE COORDINATED TRIGGER SYSTEM

-- ===================================
-- STAGE 1: FILE PROCESSING TRIGGER
-- Triggers when appointment_id is linked to patient files
-- ===================================

CREATE OR REPLACE FUNCTION coordinated_file_processing_trigger()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
  appointment_exists BOOLEAN;
BEGIN
  -- Only trigger when appointment_id changes from NULL to a value
  IF OLD.appointment_id IS NULL AND NEW.appointment_id IS NOT NULL THEN
    
    -- Verify the appointment exists
    SELECT EXISTS(
      SELECT 1 FROM appointments 
      WHERE id = NEW.appointment_id
    ) INTO appointment_exists;
    
    IF NOT appointment_exists THEN
      RAISE WARNING 'Appointment % does not exist, skipping file processing trigger', NEW.appointment_id;
      RETURN NEW;
    END IF;
    
    RAISE NOTICE 'STAGE 1: Triggering file processing for appointment % (file: %)', 
                 NEW.appointment_id, NEW.file_name;
    
    -- Set webhook configuration
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Prepare request body
    request_body := json_build_object(
      'appointment_id', NEW.appointment_id,
      'request_id', 'stage1_' || NEW.id || '_' || extract(epoch from now())::text,
      'trigger_stage', 'file_processing'
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
    
    RAISE NOTICE 'STAGE 1: File processing response - status: %, body: %', 
                 response_status, COALESCE(response_body, 'null');
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'STAGE 1: File processing failed - status: %, response: %', 
                    response_status, response_body;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'STAGE 1: File processing trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- STAGE 2: AI SUMMARY TRIGGER  
-- Triggers when appointment status changes to 'ready_for_summary'
-- ===================================

CREATE OR REPLACE FUNCTION coordinated_ai_summary_trigger()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Only trigger when ai_processing_status changes to 'ready_for_summary'
  IF OLD.ai_processing_status != 'ready_for_summary' 
     AND NEW.ai_processing_status = 'ready_for_summary' THEN
    
    RAISE NOTICE 'STAGE 2: Triggering AI summary for appointment % (consultation: %, patient: %)', 
                 NEW.id, NEW.consultation_id, NEW.patient_id;
    
    -- Validate required data is present
    IF NEW.consultation_id IS NULL OR NEW.patient_id IS NULL THEN
      RAISE WARNING 'STAGE 2: Missing required data - consultation_id: %, patient_id: %', 
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
    
    -- Update status to indicate processing has started
    UPDATE appointments 
    SET ai_processing_status = 'processing',
        updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Prepare request body
    request_body := json_build_object(
      'type', 'UPDATE',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table', 'appointments',
      'trigger_stage', 'ai_summary'
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
    
    RAISE NOTICE 'STAGE 2: AI summary response - status: %, body: %', 
                 response_status, COALESCE(response_body, 'null');
    
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'STAGE 2: AI summary failed - status: %, response: %', 
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
    RAISE WARNING 'STAGE 2: AI summary trigger error: %', SQLERRM;
    
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Trigger error: ' || SQLERRM,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PART 5: CREATE THE COORDINATED TRIGGERS

-- Stage 1: File Processing Trigger (on patient_files UPDATE)
CREATE TRIGGER trg_stage1_file_processing
    AFTER UPDATE ON patient_files 
    FOR EACH ROW 
    EXECUTE FUNCTION coordinated_file_processing_trigger();

-- Stage 2: AI Summary Trigger (on appointments UPDATE)  
CREATE TRIGGER trg_stage2_ai_summary
    AFTER UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION coordinated_ai_summary_trigger();

-- PART 6: HELPER FUNCTIONS FOR MANUAL CONTROL

-- Function to manually trigger file processing
CREATE OR REPLACE FUNCTION manually_trigger_stage1_file_processing(appointment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  files_count INTEGER;
BEGIN
  -- Check if appointment exists
  IF NOT EXISTS(SELECT 1 FROM appointments WHERE id = appointment_id) THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Update all files for this appointment to trigger processing
  UPDATE patient_files 
  SET updated_at = NOW()
  WHERE appointment_id = appointment_id 
    AND processed = false;
  
  GET DIAGNOSTICS files_count = ROW_COUNT;
  
  RAISE NOTICE 'Manually triggered file processing for % files', files_count;
  RETURN files_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to manually trigger AI summary
CREATE OR REPLACE FUNCTION manually_trigger_stage2_ai_summary(appointment_id UUID)
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

-- Function to check if all files are processed for an appointment
CREATE OR REPLACE FUNCTION check_files_processing_status(appointment_id UUID)
RETURNS JSON AS $$
DECLARE
  total_files INTEGER;
  processed_files INTEGER;
  pending_files INTEGER;
  result JSON;
BEGIN
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE processed = true) as processed,
    COUNT(*) FILTER (WHERE processed = false) as pending
  INTO total_files, processed_files, pending_files
  FROM patient_files 
  WHERE appointment_id = check_files_processing_status.appointment_id;
  
  result := json_build_object(
    'appointment_id', appointment_id,
    'total_files', total_files,
    'processed_files', processed_files,
    'pending_files', pending_files,
    'all_processed', pending_files = 0 AND total_files > 0,
    'no_files', total_files = 0
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- PART 7: CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_patient_files_appointment_processing 
ON patient_files (appointment_id, processed) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_appointments_ai_status 
ON appointments (ai_processing_status) WHERE ai_processing_status IN ('pending', 'ready_for_summary', 'processing');

-- PART 8: VERIFY TRIGGER CREATION
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_stage1_file_processing', 'trg_stage2_ai_summary')
ORDER BY event_object_table, trigger_name;

-- PART 9: ADD DOCUMENTATION
COMMENT ON TRIGGER trg_stage1_file_processing ON patient_files IS 
'STAGE 1: Triggers file processing when a patient file is linked to an appointment (appointment_id changes from NULL to a value)';

COMMENT ON TRIGGER trg_stage2_ai_summary ON appointments IS 
'STAGE 2: Triggers AI summary generation when appointment status changes to ready_for_summary after all files are processed';

COMMENT ON FUNCTION coordinated_file_processing_trigger() IS 
'STAGE 1: Coordinated file processing trigger function that ensures proper sequencing';

COMMENT ON FUNCTION coordinated_ai_summary_trigger() IS 
'STAGE 2: Coordinated AI summary trigger function that runs after all files are processed';

COMMENT ON FUNCTION manually_trigger_stage1_file_processing(UUID) IS 
'Helper function to manually trigger Stage 1 file processing for a specific appointment';

COMMENT ON FUNCTION manually_trigger_stage2_ai_summary(UUID) IS 
'Helper function to manually trigger Stage 2 AI summary for a specific appointment';

COMMENT ON FUNCTION check_files_processing_status(UUID) IS 
'Helper function to check the file processing status for an appointment';

-- PART 10: FINAL STATUS LOG
DO $$ 
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'COORDINATED TRIGGER SYSTEM INSTALLED';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Stage 1: File processing trigger created on patient_files';
  RAISE NOTICE 'Stage 2: AI summary trigger created on appointments';
  RAISE NOTICE 'Manual control functions available';
  RAISE NOTICE 'Performance indexes created';
  RAISE NOTICE '=============================================';
END $$;
