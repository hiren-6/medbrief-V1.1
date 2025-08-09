-- ===================================
-- FIX WEBHOOK TRIGGER FOR NEW APPOINTMENTS
-- This migration ensures the edge function is properly triggered for new appointments
-- ===================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;
DROP TRIGGER IF EXISTS trg_mark_for_processing ON appointments;

-- Create a robust webhook trigger function
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
  
  -- If service role key is not set, try to get it from a different source
  IF service_role_key IS NULL THEN
    -- Try to get from a custom setting or use a default
    service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZnZ1eW9jbmJmcGdld3F4eWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzE5NzI5MCwiZXhwIjoyMDQ4Nzc3MjkwfQ.YOUR_SERVICE_ROLE_KEY';
  END IF;
  
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

-- Create the trigger
CREATE TRIGGER trg_ai_summary 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_ai_clinical_summary();

-- Create a backup trigger that just marks appointments for processing
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

-- Create backup trigger
CREATE TRIGGER trg_mark_for_processing 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION mark_appointment_for_processing();

-- Verify the triggers were created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_ai_summary', 'trg_mark_for_processing'); 