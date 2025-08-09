-- ===================================
-- ADD APPOINTMENT LINKING TO PATIENT_FILES
-- This migration enables automatic appointment_id linking and concurrent processing
-- ===================================

-- 1. ADD APPOINTMENT_ID COLUMN TO PATIENT_FILES
ALTER TABLE patient_files 
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE;

-- Add index for efficient appointment-based queries
CREATE INDEX IF NOT EXISTS idx_patient_files_appointment_id 
ON patient_files (appointment_id);

-- Add index for concurrent processing (consultation + processed status)
CREATE INDEX IF NOT EXISTS idx_patient_files_consultation_processed 
ON patient_files (consultation_id, processed) WHERE processed = false;

-- 2. CREATE FUNCTION TO AUTO-LINK FILES TO APPOINTMENTS
CREATE OR REPLACE FUNCTION link_files_to_appointment(appointment_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  consultation_uuid UUID;
  linked_count INTEGER := 0;
BEGIN
  -- Get the consultation_id from the appointment
  SELECT consultation_id INTO consultation_uuid
  FROM appointments 
  WHERE id = appointment_uuid;
  
  IF consultation_uuid IS NULL THEN
    RAISE WARNING 'Appointment % not found', appointment_uuid;
    RETURN 0;
  END IF;
  
  -- Update all files for this consultation that don't have an appointment_id yet
  UPDATE patient_files 
  SET appointment_id = appointment_uuid
  WHERE consultation_id = consultation_uuid 
    AND appointment_id IS NULL;
  
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  
  RAISE NOTICE 'Linked % files to appointment %', linked_count, appointment_uuid;
  
  RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

-- 3. CREATE TRIGGER TO AUTO-LINK FILES WHEN APPOINTMENT IS CREATED
CREATE OR REPLACE FUNCTION trigger_link_files_to_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-link any existing files for this consultation
  PERFORM link_files_to_appointment(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS trg_link_files_to_appointment ON appointments;
CREATE TRIGGER trg_link_files_to_appointment 
  AFTER INSERT ON appointments 
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_link_files_to_appointment();

-- 4. CREATE FUNCTION TO GET UNPROCESSED FILES FOR APPOINTMENT
CREATE OR REPLACE FUNCTION get_unprocessed_files_for_appointment(appointment_uuid UUID)
RETURNS TABLE (
  id UUID,
  consultation_id UUID,
  appointment_id UUID,
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  extracted_text TEXT,
  processed BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pf.id,
    pf.consultation_id,
    pf.appointment_id,
    pf.file_name,
    pf.file_path,
    pf.file_type,
    pf.file_size,
    pf.extracted_text,
    pf.processed,
    pf.created_at
  FROM patient_files pf
  WHERE pf.appointment_id = appointment_uuid
    AND (pf.processed IS NULL OR pf.processed = false)
  ORDER BY pf.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. CREATE FUNCTION TO CHECK IF ALL FILES PROCESSED
CREATE OR REPLACE FUNCTION check_all_files_processed(appointment_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_files INTEGER;
  processed_files INTEGER;
BEGIN
  -- Count total files for this appointment
  SELECT COUNT(*) INTO total_files
  FROM patient_files 
  WHERE appointment_id = appointment_uuid;
  
  -- Count processed files for this appointment
  SELECT COUNT(*) INTO processed_files
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = true;
  
  -- Return true if all files are processed (or no files exist)
  RETURN total_files = 0 OR total_files = processed_files;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE FUNCTION TO UPDATE FILE PROCESSING STATUS
CREATE OR REPLACE FUNCTION update_file_processing_status(
  file_uuid UUID,
  extracted_text_content TEXT,
  processing_success BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
BEGIN
  UPDATE patient_files 
  SET 
    extracted_text = CASE 
      WHEN processing_success THEN extracted_text_content 
      ELSE extracted_text 
    END,
    processed = processing_success
  WHERE id = file_uuid;
  
  IF NOT FOUND THEN
    RAISE WARNING 'File % not found for processing update', file_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE FUNCTION TO GET APPOINTMENT PROCESSING STATUS
CREATE OR REPLACE FUNCTION get_appointment_processing_status(appointment_uuid UUID)
RETURNS TABLE (
  total_files INTEGER,
  processed_files INTEGER,
  failed_files INTEGER,
  all_processed BOOLEAN,
  processing_status TEXT
) AS $$
DECLARE
  total_count INTEGER;
  processed_count INTEGER;
  failed_count INTEGER;
  all_done BOOLEAN;
BEGIN
  -- Count files
  SELECT COUNT(*) INTO total_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid;
  
  -- Count processed files
  SELECT COUNT(*) INTO processed_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = true;
  
  -- Count failed files (processed = false but has been attempted)
  SELECT COUNT(*) INTO failed_count
  FROM patient_files 
  WHERE appointment_id = appointment_uuid 
    AND processed = false 
    AND extracted_text IS NOT NULL;
  
  -- Check if all files are processed
  all_done := total_count = 0 OR total_count = processed_count;
  
  -- Determine status
  RETURN QUERY SELECT 
    total_count,
    processed_count,
    failed_count,
    all_done,
    CASE 
      WHEN total_count = 0 THEN 'no_files'
      WHEN all_done THEN 'completed'
      WHEN failed_count > 0 THEN 'partial_failed'
      ELSE 'processing'
    END;
END;
$$ LANGUAGE plpgsql;

-- 8. GRANT PERMISSIONS FOR SERVICE ROLE
GRANT EXECUTE ON FUNCTION link_files_to_appointment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_unprocessed_files_for_appointment(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_all_files_processed(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION update_file_processing_status(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION get_appointment_processing_status(UUID) TO service_role;

-- 9. CREATE VIEW FOR CONCURRENT PROCESSING MONITORING
CREATE OR REPLACE VIEW appointment_file_processing_status AS
SELECT 
  a.id as appointment_id,
  a.consultation_id,
  a.patient_id,
  a.appointment_date,
  a.appointment_time,
  a.status as appointment_status,
  COALESCE(pfs.total_files, 0) as total_files,
  COALESCE(pfs.processed_files, 0) as processed_files,
  COALESCE(pfs.failed_files, 0) as failed_files,
  COALESCE(pfs.all_processed, true) as all_processed,
  COALESCE(pfs.processing_status, 'no_files') as processing_status,
  a.created_at as appointment_created,
  a.updated_at as appointment_updated
FROM appointments a
LEFT JOIN LATERAL get_appointment_processing_status(a.id) pfs ON true
ORDER BY a.created_at DESC;

-- 10. ADD HELPFUL COMMENTS
COMMENT ON COLUMN patient_files.appointment_id IS 'Links file to specific appointment for processing workflow';
COMMENT ON FUNCTION link_files_to_appointment(UUID) IS 'Automatically links consultation files to appointment when created';
COMMENT ON FUNCTION get_unprocessed_files_for_appointment(UUID) IS 'Returns unprocessed files for appointment-based processing';
COMMENT ON FUNCTION check_all_files_processed(UUID) IS 'Checks if all files for appointment have been processed';
COMMENT ON FUNCTION update_file_processing_status(UUID, TEXT, BOOLEAN) IS 'Updates file processing status and extracted text';
COMMENT ON FUNCTION get_appointment_processing_status(UUID) IS 'Returns comprehensive processing status for appointment';

-- 11. CREATE CONCURRENT PROCESSING SAFEGUARDS
-- Add advisory lock function to prevent race conditions
CREATE OR REPLACE FUNCTION acquire_appointment_processing_lock(appointment_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to bigint for advisory lock
  lock_key := ('x' || lpad(replace(appointment_uuid::text, '-', ''), 16, '0'))::bit(64)::bigint;
  
  -- Try to acquire advisory lock
  RETURN pg_try_advisory_lock(lock_key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_appointment_processing_lock(appointment_uuid UUID)
RETURNS VOID AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Convert UUID to bigint for advisory lock
  lock_key := ('x' || lpad(replace(appointment_uuid::text, '-', ''), 16, '0'))::bit(64)::bigint;
  
  -- Release advisory lock
  PERFORM pg_advisory_unlock(lock_key);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION acquire_appointment_processing_lock(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION release_appointment_processing_lock(UUID) TO service_role; 