# 🔗 Webhook Quick Reference

## Here's the Education

**Real World Analogy:** Webhooks are like automatic order routing in a restaurant. When a customer places an order (patient uploads documents), the webhook automatically sends it to the right kitchen station (Edge Function) for processing.

## 🎯 Quick Answer: Do You Need Both Webhooks?

### **Primary Webhook (REQUIRED)**
- **Table:** `appointments`
- **URL:** `generate_clinical_summary`
- **Purpose:** Triggers AI processing when appointments are created
- **Status:** MUST SET UP

### **Secondary Webhook (OPTIONAL)**
- **Table:** `patient_files`
- **URL:** `process_patient_files`
- **Purpose:** Triggers file processing when files are uploaded
- **Status:** NICE TO HAVE

## 🚀 Quick Setup (5 minutes)

### Step 1: Primary Webhook (CRITICAL)
1. Go to **Supabase Dashboard → Database → Webhooks**
2. Click **"Create a new webhook"**
3. Fill in:
   - **Name:** `AI Processing Trigger`
   - **Table:** `appointments`
   - **Events:** `INSERT`
   - **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary`
   - **Method:** `POST`
4. Click **"Save"**

### Step 2: Secondary Webhook (OPTIONAL)
1. Go to **Supabase Dashboard → Database → Webhooks**
2. Click **"Create a new webhook"**
3. Fill in:
   - **Name:** `File Processing Trigger`
   - **Table:** `patient_files`
   - **Events:** `INSERT`
   - **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files`
   - **Method:** `POST`
4. Click **"Save"**

## ✅ Test Your Setup

### Test Primary Webhook:
1. Create a new appointment in your app
2. Check webhook logs in Supabase Dashboard
3. Verify clinical summary is created

### Test Secondary Webhook (if configured):
1. Upload a file in your app
2. Check webhook logs in Supabase Dashboard
3. Verify file processing status

## 🔍 Troubleshooting

### If Primary Webhook Not Working:
```sql
-- Check if webhook exists
SELECT * FROM supabase_functions.hooks WHERE table_name = 'appointments';

-- Manually trigger processing
UPDATE appointments 
SET ai_processing_status = 'triggered' 
WHERE id = 'your-appointment-id';
```

### If Secondary Webhook Not Working:
```sql
-- Check if webhook exists
SELECT * FROM supabase_functions.hooks WHERE table_name = 'patient_files';

-- Check file processing status
SELECT file_name, processed, extracted_text IS NOT NULL as has_text
FROM patient_files 
ORDER BY created_at DESC 
LIMIT 5;
```

## 🎯 Success Indicators

✅ **Primary Webhook Working:**
- Appointment creation triggers AI processing
- Clinical summaries are generated automatically
- Processing status updates correctly

✅ **Secondary Webhook Working (if configured):**
- File uploads trigger immediate processing
- Text extraction happens in real-time
- Files are processed before appointment creation

## 📊 Workflow Summary

### **With Primary Webhook Only:**
1. Patient uploads files → Files stored
2. Patient creates appointment → Primary webhook triggers
3. Edge Function processes files + generates clinical summary
4. Results displayed to patient/doctor

### **With Both Webhooks:**
1. Patient uploads files → Secondary webhook triggers file processing
2. Files processed in real-time → Text extracted
3. Patient creates appointment → Primary webhook triggers clinical summary
4. Clinical summary generated with processed file data
5. Results displayed to patient/doctor

## 🎉 Expected Outcome

After setting up webhooks:
- ✅ AI processing triggers automatically
- ✅ Clinical summaries generated within 30-60 seconds
- ✅ File processing happens seamlessly
- ✅ No manual intervention required

**Remember:** The primary webhook is the critical piece that makes everything work. The secondary webhook is optional but provides real-time file processing. 