-- ===================================
-- FIX WEBHOOK TRIGGER
-- This migration sets up the proper webhook trigger for the Edge Function
-- ===================================

-- Drop the old trigger that only updates status
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;

-- Create a new trigger that calls the Edge Function directly
CREATE OR REPLACE FUNCTION trigger_ai_clinical_summary()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get the webhook URL and service role key
  webhook_url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary';
  
  -- Update the appointment status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  -- Call the Edge Function via HTTP
  PERFORM net.http_post(
    url := webhook_url,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
    body := json_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW),
      'table', 'appointments'
    )::text
  );
  
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

-- Alternative approach: Use a simpler trigger that just marks for processing
-- The Edge Function can be called manually or via a cron job

CREATE OR REPLACE FUNCTION simple_trigger_ai()
RETURNS TRIGGER AS $$
BEGIN
  -- Just update the status to triggered
  UPDATE appointments 
  SET ai_processing_status = 'triggered'
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a backup trigger
DROP TRIGGER IF EXISTS trg_simple_ai ON appointments;

CREATE TRIGGER trg_simple_ai 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION simple_trigger_ai();

-- Verify the triggers were created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_ai_summary', 'trg_simple_ai'); 