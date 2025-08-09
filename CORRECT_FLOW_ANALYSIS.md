# Correct Process Flow Analysis

## Current WRONG Flow:
1. Create Consultation ✅
2. Upload Files → INSERT trigger fires with appointment_id: null ❌
3. Create Appointment ✅
4. Link files to appointment ✅
5. Trigger file processing ✅

## Correct IDEAL Flow:
1. Create Consultation ✅
2. Create Appointment ✅  
3. Upload Files with appointment_id ✅
4. Trigger file processing ✅
5. Generate clinical summary ✅

## Solution:
- Update PatientViewPage.tsx to create appointment BEFORE uploading files
- Remove unnecessary triggers  
- Keep only one trigger: appointment INSERT that calls file processing
- File processing function will call clinical summary when done
- Remove separate clinical summary trigger

## Database Triggers to Keep:
- ONE trigger on appointments INSERT that calls process_patient_files
- Remove all others

## Edge Functions:
- process_patient_files: processes files and calls clinical summary at the end
- generate_clinical_summary: only called by process_patient_files, not by triggers
