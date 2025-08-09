-- ===================================
-- TASK 2: ACTIVATE AI TRIGGER
-- This migration activates the trigger to call the Edge Function
-- ===================================

-- Create the trigger to call the Edge Function
DROP TRIGGER IF EXISTS trg_ai_summary ON appointments;

CREATE TRIGGER trg_ai_summary 
    AFTER INSERT ON appointments 
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_ai_clinical_summary();

-- Update the trigger function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_ai_clinical_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the appointment status to triggered
    UPDATE appointments 
    SET ai_processing_status = 'triggered'
    WHERE id = NEW.id;
    
    -- Note: The actual Edge Function call will be handled by Supabase's webhook system
    -- This trigger just marks the appointment as ready for processing
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trg_ai_summary'; 