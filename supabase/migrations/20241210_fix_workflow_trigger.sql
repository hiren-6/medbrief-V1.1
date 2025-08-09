-- ===================================
-- FIX WORKFLOW TRIGGER - CRITICAL FIX
-- This migration ensures process_patient_files is called when appointment is created
-- ===================================

-- Drop the old trigger that only calls generate_clinical_summary
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;
DROP TRIGGER IF EXISTS trg_complete_workflow ON appointments;
DROP TRIGGER IF EXISTS trg_manual_processing ON appointments;

-- Create a new comprehensive trigger that handles the complete workflow
CREATE OR REPLACE FUNCTION trigger_complete_workflow()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  process_files_url TEXT;
  service_role_key TEXT;
  linked_files_count INTEGER;
  has_files BOOLEAN;
BEGIN
  -- Get the webhook URLs and service role key
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  process_files_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files';
  
  -- Update the appointment status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RAISE NOTICE 'Starting complete workflow for appointment %', NEW.id;
  
  -- First, link any existing files to this appointment
  SELECT link_files_to_appointment(NEW.id) INTO linked_files_count;
  RAISE NOTICE 'Linked % files to appointment %', linked_files_count, NEW.id;
  
  -- Check if there are any files to process for this appointment
  SELECT EXISTS (
    SELECT 1 FROM patient_files 
    WHERE appointment_id = NEW.id 
    AND (processed IS NULL OR processed = false)
  ) INTO has_files;
  
  IF has_files THEN
    RAISE NOTICE 'Files found for appointment %. Calling process_patient_files...', NEW.id;
    
    -- Call process_patient_files first
    PERFORM net.http_post(
      url := process_files_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'appointment_id', NEW.id
      )::text
    );
    
    RAISE NOTICE 'Successfully called process_patient_files for appointment % with % linked files', NEW.id, linked_files_count;
  ELSE
    RAISE NOTICE 'No files to process for appointment %. Calling clinical summary directly...', NEW.id;
    
    -- No files to process, trigger clinical summary directly
    PERFORM net.http_post(
      url := webhook_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'type', 'INSERT',
        'record', row_to_json(NEW),
        'table', 'appointments'
      )::text
    );
    
    RAISE NOTICE 'Successfully called clinical summary directly for appointment %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the insert
    RAISE WARNING 'Failed to trigger complete workflow for appointment %: %', NEW.id, SQLERRM;
    
    -- Update appointment status to failed
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Workflow trigger failed: ' || SQLERRM
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
CREATE TRIGGER trg_complete_workflow 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_complete_workflow();

-- Also create a backup trigger for manual processing
CREATE OR REPLACE FUNCTION trigger_manual_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Just update the status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create backup trigger
CREATE TRIGGER trg_manual_processing 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_manual_processing();

-- Add helpful comments
COMMENT ON FUNCTION trigger_complete_workflow() IS 'Handles complete workflow: link files → process files → generate clinical summary';
COMMENT ON FUNCTION trigger_manual_processing() IS 'Backup trigger for manual processing workflow'; 