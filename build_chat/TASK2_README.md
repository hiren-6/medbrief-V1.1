# Task 2: Edge Function Scaffold

## Overview
This task creates the Supabase Edge Function that will handle AI clinical summary generation. The function is triggered when a new appointment is created and processes patient data through Gemini AI.

## What We Built

### 1. **Edge Function Structure**
- `supabase/functions/generate_clinical_summary/index.ts` - Main function
- `supabase/functions/generate_clinical_summary/deno.json` - Deno configuration
- `supabase/functions/generate_clinical_summary/import_map.json` - Import mappings

### 2. **Function Workflow**
```
Appointment Created → Trigger → Edge Function → Collect Data → Process Files → Call Gemini → Store Results
```

### 3. **Key Features**
- **TypeScript Support**: Full type safety with interfaces
- **Error Handling**: Comprehensive error catching and logging
- **Status Tracking**: Updates appointment status throughout processing
- **Data Validation**: Validates AI responses before storing
- **Security**: Uses service-role key for database access

### 4. **Database Trigger**
- Activates when appointments are inserted
- Updates `ai_processing_status` to 'triggered'
- Ready for webhook integration

## File Structure
```
supabase/
├── functions/
│   └── generate_clinical_summary/
│       ├── index.ts              # Main Edge Function
│       ├── deno.json             # Deno configuration
│       └── import_map.json       # Import mappings
└── migrations/
    └── 20241201_activate_ai_trigger.sql  # Database trigger
```

## How to Deploy

### Option 1: Supabase CLI (Recommended)
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to your Supabase project
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the Edge Function
supabase functions deploy generate_clinical_summary

# Apply the database migration
supabase db push
```

### Option 2: Supabase Dashboard
1. **Deploy Edge Function:**
   - Go to Supabase Dashboard → Edge Functions
   - Create new function named `generate_clinical_summary`
   - Copy the content of `index.ts` into the function
   - Deploy the function

2. **Apply Database Migration:**
   - Go to SQL Editor
   - Copy and run the content of `20241201_activate_ai_trigger.sql`

## Environment Variables

You'll need to set these environment variables in your Supabase project:

```bash
# In Supabase Dashboard → Settings → Edge Functions
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key  # Will be set in Task 3
```

## Function Components

### 1. **Data Collection**
```typescript
// Collects patient history, symptoms, and file data
const clinicalData = await collectClinicalData(consultationId, patientId)
```

### 2. **File Processing**
```typescript
// Processes PDFs and images (placeholder for Task 3)
const processedFiles = await processPatientFiles(consultationId)
```

### 3. **Prompt Building**
```typescript
// Builds comprehensive prompt for Gemini AI
const prompt = buildPrompt(clinicalData, processedFiles)
```

### 4. **AI Integration** (Placeholder)
```typescript
// Will be implemented in Task 3
const aiResponse = await callGeminiAPI(prompt)
```

### 5. **Response Validation**
```typescript
// Validates and parses AI response
const validatedSummary = validateAndParseResponse(aiResponse)
```

### 6. **Data Storage**
```typescript
// Stores results in clinical_summaries table
await storeClinicalSummary(consultationId, patientId, validatedSummary)
```

## Security Features

### 🔒 **Database Security**
- Uses service-role key (bypasses RLS)
- Only processes authorized appointments
- Validates all inputs and outputs

### 📊 **Error Handling**
- Comprehensive try-catch blocks
- Status tracking for failed operations
- Detailed logging for debugging

### 🔍 **Data Validation**
- TypeScript interfaces for type safety
- JSON schema validation for AI responses
- Input sanitization

## Testing the Function

### 1. **Local Testing**
```bash
# Test the function locally
supabase functions serve generate_clinical_summary

# Send test webhook
curl -X POST http://localhost:54321/functions/v1/generate_clinical_summary \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","record":{"id":"test","consultation_id":"test","patient_id":"test"}}'
```

### 2. **Production Testing**
1. Create a test appointment in your app
2. Check the Edge Function logs in Supabase Dashboard
3. Verify the clinical summary was created

## Monitoring

### 📈 **Logs**
- Check Edge Function logs in Supabase Dashboard
- Monitor for errors and performance issues
- Track processing times

### 🔍 **Database Monitoring**
```sql
-- Check processing status
SELECT ai_processing_status, COUNT(*) 
FROM appointments 
GROUP BY ai_processing_status;

-- Check clinical summaries
SELECT COUNT(*) FROM clinical_summaries;
```

## Placeholders for Task 3

The following components are placeholders and will be implemented in Task 3:

1. **PDF Text Extraction**: Currently just marks files as processed
2. **Gemini API Integration**: Returns mock response
3. **Prompt Templates**: Basic placeholders (you'll provide the actual prompts)
4. **Image Processing**: Will handle image files for Gemini

## Next Steps

After deploying this scaffold:

1. **Test the deployment** by creating a test appointment
2. **Check the logs** to ensure the function is working
3. **Verify database updates** are happening correctly
4. **Proceed to Task 3** for Gemini integration

## Troubleshooting

### Common Issues:

**Function not deploying:**
- Check Supabase CLI is installed and logged in
- Verify project reference is correct
- Check function name matches exactly

**Database errors:**
- Ensure Task 1 migration was applied
- Check service-role key has proper permissions
- Verify table structure matches expectations

**Webhook not triggering:**
- Check trigger was created successfully
- Verify appointment insert is happening
- Check Edge Function logs for errors

### Getting Help:
- Check Supabase Edge Function logs
- Verify environment variables are set
- Test with simple webhook payload first

---

**Ready for Task 3?** Once this scaffold is deployed and tested, we'll implement the actual Gemini AI integration and PDF processing. 