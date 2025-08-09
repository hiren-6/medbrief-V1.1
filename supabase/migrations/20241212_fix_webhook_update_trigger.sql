-- ===================================
-- FIX WEBHOOK UPDATE TRIGGER
-- This migration creates a proper UPDATE trigger for the Edge Function
-- that only fires when appointments are ready for AI processing
-- ===================================

-- Drop all existing triggers to start fresh
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_log_appointment_insert ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;

-- Drop all existing webhook functions
DROP FUNCTION IF EXISTS call_ai_edge_function();
DROP FUNCTION IF EXISTS trigger_ai_clinical_summary();
DROP FUNCTION IF EXISTS log_appointment_insert();
DROP FUNCTION IF EXISTS simple_trigger_ai();

-- Create the new UPDATE trigger function
CREATE OR REPLACE FUNCTION trigger_ai_processing_on_update()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
  request_body TEXT;
  response_status INTEGER;
  response_body TEXT;
BEGIN
  -- Only trigger when ai_processing_status changes to 'processing'
  -- and we have the required consultation_id and patient_id
  IF NEW.ai_processing_status = 'processing' 
     AND OLD.ai_processing_status != 'processing'
     AND NEW.consultation_id IS NOT NULL 
     AND NEW.patient_id IS NOT NULL THEN
    
    -- Set the webhook URL
    webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
    
    -- Get the service role key from environment
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- If service role key is not set, use the hardcoded one (for development)
    IF service_role_key IS NULL OR service_role_key = '' THEN
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.GyBe_1p2Eo-w5VZKXV4S3-eSMO0wHzfGPSXFyFrKyLU';
    END IF;
    
    -- Update the appointment status to 'triggered' to indicate processing has started
    UPDATE appointments 
    SET ai_processing_status = 'triggered',
        updated_at = NOW()
    WHERE id = NEW.id;
    
    -- Prepare the request body with UPDATE event type
    request_body := json_build_object(
      'type', 'UPDATE',
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'table', 'appointments'
    )::text;
    
    -- Log the trigger attempt
    RAISE NOTICE 'Triggering AI processing for appointment: % (consultation: %, patient: %)', 
                 NEW.id, NEW.consultation_id, NEW.patient_id;
    
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
    
    -- If the HTTP call failed, log it and update status accordingly
    IF response_status IS NULL OR response_status >= 400 THEN
      RAISE WARNING 'Failed to trigger AI processing: status=%, response=%', response_status, response_body;
      
      -- Update status back to 'failed' if the webhook call failed
      UPDATE appointments 
      SET ai_processing_status = 'failed',
          error_message = 'Failed to trigger AI processing: HTTP ' || COALESCE(response_status::text, 'null'),
          updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and update status to failed
    RAISE WARNING 'Failed to trigger AI processing: %', SQLERRM;
    
    UPDATE appointments 
    SET ai_processing_status = 'failed',
        error_message = 'Trigger error: ' || SQLERRM,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the UPDATE trigger
CREATE TRIGGER trg_ai_processing_update
    AFTER UPDATE ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_ai_processing_on_update();

-- Create a helper function to manually trigger AI processing for an appointment
CREATE OR REPLACE FUNCTION manually_trigger_ai_processing(appointment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  appointment_record RECORD;
BEGIN
  -- Get the appointment record
  SELECT * INTO appointment_record 
  FROM appointments 
  WHERE id = appointment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found: %', appointment_id;
  END IF;
  
  -- Check if the appointment has required data
  IF appointment_record.consultation_id IS NULL OR appointment_record.patient_id IS NULL THEN
    RAISE EXCEPTION 'Appointment missing required consultation_id or patient_id';
  END IF;
  
  -- Update the status to 'processing' to trigger the webhook
  UPDATE appointments 
  SET ai_processing_status = 'processing',
      updated_at = NOW()
  WHERE id = appointment_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    trigger_schema
FROM information_schema.triggers 
WHERE trigger_name = 'trg_ai_processing_update';

-- Add a comment to document the trigger
COMMENT ON TRIGGER trg_ai_processing_update ON appointments IS 
'Triggers AI clinical summary generation when appointment status is updated to processing and has required consultation_id and patient_id';

COMMENT ON FUNCTION trigger_ai_processing_on_update() IS 
'Function that calls the generate_clinical_summary Edge Function when an appointment is ready for AI processing';

COMMENT ON FUNCTION manually_trigger_ai_processing(UUID) IS 
'Helper function to manually trigger AI processing for a specific appointment by setting status to processing';
