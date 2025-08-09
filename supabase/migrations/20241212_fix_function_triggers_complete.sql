-- ===================================
-- FIX FUNCTION TRIGGERS COMPLETE
-- This migration fixes both the patient file processing and clinical summary triggers
-- ===================================

-- PART 1: Fix process_patient_files function trigger
-- Remove any existing triggers for patient_files
DROP TRIGGER IF EXISTS trg_process_patient_files_insert ON patient_files;
DROP TRIGGER IF EXISTS trg_process_patient_files_update ON patient_files;
DROP FUNCTION IF EXISTS trigger_process_patient_files();

-- Create new trigger function that only fires when appointment_id is populated
CREATE OR REPLACE FUNCTION trigger_process_patient_files_on_link()
RETURNS TRIGGER AS $$
DECLARE
  appointment_exists BOOLEAN;
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
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
    
    -- Set the webhook URL
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
    
    -- Get the service role key from environment
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- If service role key is not set, use the hardcoded one (for development)
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Prepare the request body with appointment_id
    request_body := json_build_object(
      'appointment_id', NEW.appointment_id,
      'request_id', 'trigger_' || NEW.id || '_' || extract(epoch from now())::text
    )::text;
    
    -- Log the trigger attempt
    RAISE NOTICE 'Triggering file processing for appointment: % (file: %)', NEW.appointment_id, NEW.file_name;
    
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
    RAISE NOTICE 'File processing response: status=%, body=%', response_status, response_body;
    
    -- If the HTTP call failed, log it but don't fail the update
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'Failed to trigger file processing: status=%, response=%', response_status, response_body;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the update
    RAISE WARNING 'Failed to trigger file processing: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the UPDATE trigger for patient_files
CREATE TRIGGER trg_process_patient_files_on_link
    AFTER UPDATE ON patient_files 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_process_patient_files_on_link();

-- PART 2: Ensure the appointments UPDATE trigger is properly configured
-- The clinical summary trigger should already be fixed from the previous migration
-- But let's make sure it's properly set up

-- Verify the appointments trigger exists and is working
DO $$ 
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM information_schema.triggers 
        WHERE trigger_name = 'trg_ai_processing_update'
        AND event_object_table = 'appointments'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        RAISE NOTICE 'Creating missing appointments UPDATE trigger for AI processing';
        
        -- Create the trigger if it doesn't exist
        CREATE TRIGGER trg_ai_processing_update
            AFTER UPDATE ON appointments 
            FOR EACH ROW 
            EXECUTE FUNCTION trigger_ai_processing_on_update();
    ELSE
        RAISE NOTICE 'Appointments UPDATE trigger already exists';
    END IF;
END $$;

-- Create a helper function to manually trigger file processing for an appointment
CREATE OR REPLACE FUNCTION manually_trigger_file_processing(appointment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Verify the appointment exists
  IF NOT EXISTS(SELECT 1 FROM appointments WHERE id = appointment_id) THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Set the webhook URL
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Get the service role key from environment
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- If service role key is not set, use the hardcoded one
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
  END IF;
  
  -- Prepare the request body
  request_body := json_build_object(
    'appointment_id', appointment_id,
    'request_id', 'manual_' || appointment_id::text || '_' || extract(epoch from now())::text
  )::text;
  
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
  
  -- Check if successful
  IF response_status IS NOT NULL AND response_status < 400 THEN
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Failed to trigger file processing: status=%, response=%', response_status, response_body;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Verify all triggers were created successfully
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_process_patient_files_on_link', 'trg_ai_processing_update')
ORDER BY event_object_table, trigger_name;

-- Add comments to document the triggers
COMMENT ON TRIGGER trg_process_patient_files_on_link ON patient_files IS 
'Triggers file processing when a patient file is linked to an appointment (appointment_id changes from NULL to a value)';

COMMENT ON FUNCTION trigger_process_patient_files_on_link() IS 
'Function that calls the process_patient_files Edge Function when a file is linked to an appointment';

COMMENT ON FUNCTION manually_trigger_file_processing(UUID) IS 
'Helper function to manually trigger file processing for a specific appointment';
