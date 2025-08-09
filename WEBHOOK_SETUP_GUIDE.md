# 🔗 Webhook Setup Guide for AI Processing

## Here's the Education

**Real World Analogy:** Think of webhooks like a restaurant's order routing system. When a customer places an order (patient uploads documents), the webhook is like the waiter who automatically routes the order to the right kitchen station (Edge Function). Without webhooks, orders never reach the kitchen!

## 🔄 AI Processing Workflow

Your AI processing system has a **two-stage workflow**:

1. **Stage 1:** File Processing (`process_patient_files`)
   - Extracts text from uploaded documents (PDFs, images)
   - Uses Gemini API to analyze document content
   - Updates `patient_files` table with extracted text

2. **Stage 2:** Clinical Summary Generation (`generate_clinical_summary`)
   - Analyzes patient data + extracted text
   - Generates comprehensive clinical summary
   - Stores results in `clinical_summaries` table

## 🎯 Webhook Requirements

### **Primary Webhook (REQUIRED)**
- **Purpose:** Triggers the entire AI workflow when appointments are created
- **Table:** `appointments`
- **Events:** `INSERT`
- **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary`
- **Method:** `POST`

### **Secondary Webhook (OPTIONAL)**
- **Purpose:** Triggers file processing when files are uploaded
- **Table:** `patient_files`
- **Events:** `INSERT`
- **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files`
- **Method:** `POST`

## 🔧 Step-by-Step Webhook Setup

### Step 1: Set Up Primary Webhook (CRITICAL)

1. **Go to Supabase Dashboard → Database → Webhooks**
2. **Click "Create a new webhook"**
3. **Configure the webhook:**
   - **Name:** `AI Processing Trigger`
   - **Table:** `appointments`
   - **Events:** `INSERT`
   - **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary`
   - **HTTP Method:** `POST`
   - **Headers:** Leave default
4. **Click "Save"**

### Step 2: Set Up Secondary Webhook (OPTIONAL)

**Note:** This is optional because the primary webhook already handles the complete workflow. However, if you want immediate file processing when files are uploaded, you can add this:

1. **Go to Supabase Dashboard → Database → Webhooks**
2. **Click "Create a new webhook"**
3. **Configure the webhook:**
   - **Name:** `File Processing Trigger`
   - **Table:** `patient_files`
   - **Events:** `INSERT`
   - **URL:** `https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files`
   - **HTTP Method:** `POST`
   - **Headers:** Leave default
4. **Click "Save"**

## 🔄 How the Workflow Works

### **Scenario 1: Patient Uploads Documents + Creates Appointment**

1. **Patient uploads files** → Files stored in `patient_files` table
2. **Patient creates appointment** → Appointment stored in `appointments` table
3. **Primary webhook triggers** → Calls `generate_clinical_summary`
4. **Edge Function checks for files** → Links files to appointment
5. **If files exist** → Calls `process_patient_files` internally
6. **Files processed** → Text extracted from documents
7. **Clinical summary generated** → AI analyzes patient data + extracted text
8. **Results stored** → Clinical summary saved to database

### **Scenario 2: Patient Creates Appointment First, Then Uploads Files**

1. **Patient creates appointment** → Primary webhook triggers
2. **No files yet** → Clinical summary generated from patient data only
3. **Patient uploads files later** → Secondary webhook triggers (if configured)
4. **Files processed** → New clinical summary generated with file data

### **Scenario 3: Files Uploaded First, Then Appointment Created**

1. **Patient uploads files** → Files stored (no processing yet)
2. **Patient creates appointment** → Primary webhook triggers
3. **Files linked to appointment** → Complete processing workflow runs
4. **Clinical summary generated** → Includes both patient data and file data

## 🎯 Which Webhook Do You Need?

### **Minimum Setup (RECOMMENDED):**
- ✅ **Primary webhook only** (appointments → generate_clinical_summary)
- ✅ Handles all scenarios automatically
- ✅ Simpler to manage
- ✅ Less potential for conflicts

### **Advanced Setup (OPTIONAL):**
- ✅ **Primary webhook** (appointments → generate_clinical_summary)
- ✅ **Secondary webhook** (patient_files → process_patient_files)
- ✅ Immediate file processing when files are uploaded
- ✅ More complex but provides real-time processing

## 📊 Webhook Configuration Details

### **Primary Webhook (generate_clinical_summary)**
```json
{
  "name": "AI Processing Trigger",
  "table": "appointments",
  "events": ["INSERT"],
  "url": "https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

### **Secondary Webhook (process_patient_files)**
```json
{
  "name": "File Processing Trigger", 
  "table": "patient_files",
  "events": ["INSERT"],
  "url": "https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

## 🔍 Testing Your Webhooks

### **Test Primary Webhook:**
1. **Create a new appointment** in your app
2. **Check webhook logs** in Supabase Dashboard → Database → Webhooks
3. **Check Edge Function logs** in Supabase Dashboard → Edge Functions → generate_clinical_summary → Logs
4. **Verify clinical summary** is created in database

### **Test Secondary Webhook (if configured):**
1. **Upload a file** in your app
2. **Check webhook logs** in Supabase Dashboard → Database → Webhooks
3. **Check Edge Function logs** in Supabase Dashboard → Edge Functions → process_patient_files → Logs
4. **Verify file processing** status in database

## 🕵️ Troubleshooting Webhooks

### **If Primary Webhook Not Working:**
```sql
-- Check if webhook exists
SELECT * FROM supabase_functions.hooks WHERE table_name = 'appointments';

-- Check recent appointments
SELECT id, ai_processing_status, created_at 
FROM appointments 
ORDER BY created_at DESC 
LIMIT 5;

-- Manually trigger processing
UPDATE appointments 
SET ai_processing_status = 'triggered' 
WHERE id = 'your-appointment-id';
```

### **If Secondary Webhook Not Working:**
```sql
-- Check if webhook exists
SELECT * FROM supabase_functions.hooks WHERE table_name = 'patient_files';

-- Check recent files
SELECT id, file_name, processed, created_at 
FROM patient_files 
ORDER BY created_at DESC 
LIMIT 5;

-- Check file processing status
SELECT 
    pf.file_name,
    pf.processed,
    pf.extracted_text IS NOT NULL as has_text,
    a.ai_processing_status
FROM patient_files pf
LEFT JOIN appointments a ON pf.appointment_id = a.id
ORDER BY pf.created_at DESC 
LIMIT 5;
```

## 🎯 Production Best Practices

### **1. Webhook Security**
- ✅ Use HTTPS URLs only
- ✅ Verify webhook signatures (if needed)
- ✅ Monitor webhook failures
- ✅ Set up retry logic for failed webhooks

### **2. Error Handling**
- ✅ Webhook failures don't break appointment creation
- ✅ Failed processing is logged for debugging
- ✅ Manual retry mechanisms available
- ✅ Status tracking in database

### **3. Monitoring**
- ✅ Monitor webhook success rates
- ✅ Track processing times
- ✅ Alert on repeated failures
- ✅ Log all webhook events

## 🚀 Quick Setup Commands

### **Check Current Webhooks:**
```sql
-- List all webhooks
SELECT 
    name,
    table_name,
    events,
    url,
    method
FROM supabase_functions.hooks
ORDER BY table_name, name;
```

### **Test Webhook Connectivity:**
```sql
-- Test generate_clinical_summary
SELECT net.http_post(
    url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/generate_clinical_summary',
    headers := '{"Content-Type": "application/json"}',
    body := '{"test": "connection"}'
);

-- Test process_patient_files
SELECT net.http_post(
    url := 'https://jtfvuyocnbfpgewqxyki.supabase.co/functions/v1/process_patient_files',
    headers := '{"Content-Type": "application/json"}',
    body := '{"appointment_id": "test-id"}'
);
```

## 🎉 Expected Results

After setting up the webhooks:

✅ **Primary Webhook Working:**
- Appointment creation triggers AI processing
- Clinical summaries are generated automatically
- Processing status updates correctly

✅ **Secondary Webhook Working (if configured):**
- File uploads trigger immediate processing
- Text extraction happens in real-time
- Files are processed before appointment creation

✅ **Complete Workflow:**
- Patient uploads documents → Files processed
- Patient creates appointment → AI analysis runs
- Clinical summary generated → Results displayed
- All within 30-60 seconds

**Remember:** The primary webhook (appointments → generate_clinical_summary) is the critical piece that makes everything work. The secondary webhook is optional but provides real-time file processing. 