-- ===================================
-- SETUP DATABASE WEBHOOK
-- This migration sets up the webhook to trigger the Edge Function
-- ===================================

-- Enable the pg_net extension for webhooks
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the webhook function to call the Edge Function
CREATE OR REPLACE FUNCTION call_ai_edge_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function via HTTP
  PERFORM net.http_post(
    url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
    body := json_build_object(
      'type', 'INSERT',
      'record', row_to_json(NEW),
      'table', 'appointments'
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to call the webhook function
DROP TRIGGER IF EXISTS trg_webhook_ai_summary ON appointments;

CREATE TRIGGER trg_webhook_ai_summary 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION call_ai_edge_function();

-- Alternative: Use Supabase's built-in webhook system
-- This is the recommended approach for Supabase

-- Create a webhook function that logs the event
CREATE OR REPLACE FUNCTION log_appointment_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the insert event
  INSERT INTO _supabase_realtime.subscription_events (
    subscription_id,
    event_type,
    table_name,
    record_id,
    record
  ) VALUES (
    'ai_clinical_summary_webhook',
    'INSERT',
    'appointments',
    NEW.id,
    row_to_json(NEW)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging
DROP TRIGGER IF EXISTS trg_log_appointment_insert ON appointments;

CREATE TRIGGER trg_log_appointment_insert 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION log_appointment_insert();

-- Verify the triggers were created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name IN ('trg_webhook_ai_summary', 'trg_log_appointment_insert', 'trg_ai_summary'); 