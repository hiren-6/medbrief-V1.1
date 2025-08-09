import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types for our clinical data
interface PatientHistory {
  age: number;
  family_history: string | null;
  smoking_status: string;
  tobacco_use: string;
  allergies: string[];
  alcohol_consumption: string;
  exercise_frequency: string;
  bmi: number | null;
}

interface SymptomData {
  symptoms: string;
  allergies: string | null;
  medications: string | null;
  severity_level: string;
  chief_complaint: string;
  symptom_duration: string;
  chronic_conditions: string | null;
  additional_symptoms: string | null;
}

interface PatientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  parsed_text: string | null;
  processed: boolean;
}

interface ClinicalSummary {
  chief_complaint: string;
  history_of_present_illness: string;
  differential_diagnoses: string[];
  recommended_tests: string[];
  urgency_level: "routine" | "urgent" | "emergency";
}

interface AIClinicalData {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  form_data: SymptomData;
  voice_data: any | null;
  age: number;
  family_history: string | null;
  smoking_status: string;
  tobacco_use: string;
  allergies: string[];
  alcohol_consumption: string;
  exercise_frequency: string;
  bmi: number | null;
  appointment_id: string;
  appointment_date: string;
  appointment_time: string;
  ai_processing_status: string;
}

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'

// Enhanced prompt templates for medical AI
const SYSTEM_PROMPT = `You are a clinical-grade medical summarizer with expertise in analyzing patient data and creating comprehensive clinical summaries. You must provide accurate, structured medical assessments based on the provided patient information, symptoms, and uploaded documents. Always maintain medical confidentiality and provide evidence-based recommendations.`

const DEVELOPER_PROMPT = `Analyze the provided patient data including medical history, current symptoms, and uploaded documents to create a structured clinical summary. Focus on identifying key clinical findings, potential differential diagnoses, and appropriate diagnostic recommendations.`

const FEW_SHOT_PROMPT = `Here are examples of high-quality clinical summaries:

Example 1: 
Patient presents with chest pain radiating to left arm, history of hypertension and smoking. 
Differential diagnoses: Acute coronary syndrome, stable angina, musculoskeletal pain.
Recommended tests: ECG, cardiac enzymes, chest X-ray, stress test if indicated.

Example 2: 
Patient with diabetes reports foot numbness and tingling, poor glycemic control.
Differential diagnoses: Diabetic neuropathy, peripheral vascular disease, vitamin B12 deficiency.
Recommended tests: Diabetic foot exam, A1C, nerve conduction studies, vascular assessment.

Example 3:
Patient reports persistent cough for 3 weeks, no fever, history of asthma.
Differential diagnoses: Post-viral cough, asthma exacerbation, GERD, post-nasal drip.
Recommended tests: Spirometry, chest X-ray, allergy testing if indicated.`

const AUTO_REPAIR_PROMPT = `IMPORTANT: You must return ONLY valid JSON matching the exact schema provided. If your response is not in the correct JSON format, fix it immediately. The response must be parseable JSON with the exact field names specified.`

serve(async (req) => {
  // Store the request payload at the beginning to avoid double parsing
  let requestPayload: any = null
  let appointmentId: string | null = null
  let consultationId: string | null = null
  let patientId: string | null = null

  try {
    // Parse the webhook payload
    requestPayload = await req.json()
    const { type, record, old_record } = requestPayload
    
    console.log('Webhook received:', { 
      type, 
      record_id: record?.id,
      table_in_record: record?.table,
      table_top_level: requestPayload.table,
      full_payload: requestPayload
    })
    
    // Handle both INSERT and UPDATE events but with different logic
    // For backwards compatibility and testing purposes
    const tableType = record?.table || requestPayload.table
    
    // Validate basic requirements
    if (!record || tableType !== 'appointments') {
      console.log('Ignored event - invalid record or table:', { type, tableType, hasRecord: !!record })
      return new Response(JSON.stringify({ 
        message: 'Ignored - invalid record or not appointments table',
        debug: { type, tableType, hasRecord: !!record }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Handle different call types
    console.log('Processing clinical summary request:', { 
      type, 
      status: record.ai_processing_status,
      source: requestPayload.source 
    });

    // Handle DIRECT_CALL from process_patient_files (primary method)
    if (type === 'DIRECT_CALL') {
      console.log('✅ Processing direct call from process_patient_files for appointment:', record.id);
      // Direct calls are always processed - they come after file processing is complete
    }
    // Handle UPDATE events (coordinated approach)
    else if (type === 'UPDATE') {
      // Only process when ai_processing_status is 'processing' (set by Stage 2 trigger)
      if (record.ai_processing_status !== 'processing') {
        console.log('Ignored UPDATE - not processing status:', { 
          appointmentId: record.id, 
          status: record.ai_processing_status,
          expectedStatus: 'processing'
        })
        return new Response(JSON.stringify({ 
          message: 'Ignored - appointment not in processing status',
          debug: { 
            appointmentId: record.id, 
            currentStatus: record.ai_processing_status,
            expectedStatus: 'processing'
          }
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      }
      
      console.log('✅ Processing UPDATE trigger for appointment:', record.id);
    }
    // Handle INSERT events (legacy/testing support)
    else if (type === 'INSERT') {
      console.log('Processing legacy INSERT event for appointment:', record.id)
      // For INSERT events, we need to check if the record has all required data
      // and the status is appropriate for processing
      if (record.ai_processing_status !== 'processing' && record.ai_processing_status !== 'pending') {
        console.log('Ignored INSERT - inappropriate status:', { 
          appointmentId: record.id, 
          status: record.ai_processing_status 
        })
        return new Response(JSON.stringify({ 
          message: 'Ignored - appointment status not suitable for processing',
          debug: { appointmentId: record.id, status: record.ai_processing_status }
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        })
      }
    }
    // Reject other event types
    else {
      console.log('Ignored event - unsupported type:', { type, tableType })
      return new Response(JSON.stringify({ 
        message: 'Ignored - unsupported event type',
        debug: { type, tableType }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Validate that required fields are present
    if (!record.consultation_id || !record.patient_id) {
      console.error('Missing required fields:', { 
        appointmentId: record.id,
        consultationId: record.consultation_id,
        patientId: record.patient_id
      })
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing consultation_id or patient_id',
        debug: { appointmentId: record.id }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      })
    }

    appointmentId = record.id
    consultationId = record.consultation_id
    patientId = record.patient_id

    console.log('Processing appointment:', { appointmentId, consultationId, patientId })

    // Step 1: Collect all clinical data
    console.log('Step 1: Collecting clinical data...')
    const clinicalData = await collectClinicalData(consultationId, patientId)
    if (!clinicalData) {
      console.error('Failed to collect clinical data - no data found for consultation:', consultationId)
      throw new Error('Failed to collect clinical data')
    }
    console.log('Step 1: Clinical data collected successfully')

    // Step 2: Get extracted text from patient files
    console.log('Step 2: Retrieving extracted text from patient files...')
    const extractedFilesData = await getExtractedFilesData(consultationId!)
    console.log('Extracted files data retrieved:', extractedFilesData.length, 'files')

    // Step 3: Get additional patient data from profiles table
    console.log('Step 3: Retrieving additional patient data...')
    const additionalPatientData = await getAdditionalPatientData(patientId!)
    console.log('Additional patient data retrieved')

    // Step 3.5: Validate that we have sufficient data to generate a meaningful summary
    console.log('Step 3.5: Validating data sufficiency...')
    const hasFiles = extractedFilesData && extractedFilesData.length > 0
    const hasPatientInput = clinicalData.form_data && Object.keys(clinicalData.form_data).length > 0
    const hasVoiceData = clinicalData.voice_data && Object.keys(clinicalData.voice_data).length > 0
    
    console.log(`📊 Data validation: Files=${hasFiles}, PatientInput=${hasPatientInput}, VoiceData=${hasVoiceData}`)
    
    if (!hasFiles && !hasPatientInput && !hasVoiceData) {
      console.warn('⚠️  Insufficient data for clinical summary generation')
      await updateAppointmentStatus(appointmentId!, 'failed', 'Insufficient data for clinical summary generation')
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Insufficient data for clinical summary generation',
        details: {
          hasFiles,
          hasPatientInput,
          hasVoiceData
        }
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Step 4: Build the prompt for Gemini
    console.log('Step 4: Building prompt with chief complaint priority...')
    const prompt = await buildClinicalPrompt(clinicalData, extractedFilesData, additionalPatientData)
    console.log('Prompt built, length:', prompt.length)

    // Step 5: Call Gemini API
    console.log('Step 5: Calling Gemini API...')
    const aiResponse = await callGeminiAPI(prompt)
    console.log('AI response received')

    // Step 6: Validate and store the response
    console.log('Step 6: Validating and storing response...')
    const validatedSummary = validateAndParseResponse(aiResponse)
    await storeClinicalSummary(consultationId!, patientId!, validatedSummary)

    // Step 7: Update appointment status
    console.log('Step 7: Updating appointment status...')
    await updateAppointmentStatus(appointmentId!, 'completed')

    console.log('Clinical summary generation completed successfully')

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Clinical summary generated successfully',
      consultation_id: consultationId
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error in clinical summary generation:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      appointmentId,
      consultationId,
      patientId
    })
    
    // Update appointment status to failed using stored values
    if (appointmentId) {
      try {
        await updateAppointmentStatus(appointmentId, 'failed', error.message)
        console.log('Appointment status updated to failed')
      } catch (updateError) {
        console.error('Failed to update appointment status:', updateError)
      }
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: {
        appointmentId,
        consultationId,
        patientId
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

// Helper function to collect clinical data
async function collectClinicalData(consultationId: string, patientId: string): Promise<AIClinicalData | null> {
  try {
    console.log('Collecting clinical data for consultation:', consultationId, 'patient:', patientId)
    
    // First try the view (for production workflow)
    let { data, error } = await supabase
      .from('ai_clinical_data')
      .select('*')
      .eq('consultation_id', consultationId)
      .single()

    if (error) {
      console.log('View query failed, trying direct table queries:', error.message)
      
      // Fallback: Query tables directly (for testing scenarios)
      const { data: consultationData, error: consultationError } = await supabase
        .from('consultations')
        .select('*, form_data, voice_data')
        .eq('id', consultationId)
        .single()

      if (consultationError) {
        console.error('Error fetching consultation data:', consultationError)
        return null
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', patientId)
        .single()

      if (profileError) {
        console.error('Error fetching profile data:', profileError)
        return null
      }

      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('consultation_id', consultationId)
        .single()

      if (appointmentError) {
        console.error('Error fetching appointment data:', appointmentError)
        return null
      }

      // Construct the data manually
      data = {
        consultation_id: consultationId,
        patient_id: patientId,
        doctor_id: consultationData.doctor_id,
        form_data: consultationData.form_data,
        voice_data: consultationData.voice_data,
        age: profileData.date_of_birth ? 
          new Date().getFullYear() - new Date(profileData.date_of_birth).getFullYear() : 0,
        family_history: profileData.family_history,
        smoking_status: profileData.smoking_status,
        tobacco_use: profileData.tobacco_use,
        allergies: profileData.allergies,
        alcohol_consumption: profileData.alcohol_consumption,
        exercise_frequency: profileData.exercise_frequency,
        bmi: profileData.bmi,
        appointment_id: appointmentData.id,
        appointment_date: appointmentData.appointment_date,
        appointment_time: appointmentData.appointment_time,
        ai_processing_status: appointmentData.ai_processing_status
      }
    }

    if (!data) {
      console.error('No clinical data found for consultation:', consultationId)
      return null
    }

    console.log('Clinical data collected successfully:', {
      consultation_id: data.consultation_id,
      patient_id: data.patient_id,
      has_form_data: !!data.form_data,
      appointment_id: data.appointment_id
    })

    return data as AIClinicalData
  } catch (error) {
    console.error('Error in collectClinicalData:', error)
    return null
  }
}

// Helper function to get extracted text from patient files
async function getExtractedFilesData(consultationId: string): Promise<any[]> {
  try {
    console.log(`🔍 Retrieving extracted files data for consultation: ${consultationId}`)
    
    // First, wait a bit to ensure file processing has completed
    console.log(`⏳ Waiting for file processing to complete...`)
    await new Promise(resolve => setTimeout(resolve, 3000)) // 3 second wait
    
    const { data: files, error } = await supabase
      .from('patient_files')
      .select('id, file_name, file_type, file_size, extracted_text, processed')
      .eq('consultation_id', consultationId)
      .eq('processed', true)
      .not('extracted_text', 'is', null)

    if (error) {
      console.error('Error fetching extracted files data:', error)
      return []
    }

    console.log(`📋 Found ${files?.length || 0} processed files with extracted text`)
    
    // Log details of each file for debugging
    if (files && files.length > 0) {
      files.forEach((file, index) => {
        console.log(`📄 File ${index + 1}: ${file.file_name} (${file.file_type}) - Text length: ${file.extracted_text?.length || 0}`)
      })
    } else {
      console.log(`⚠️  No processed files found with extracted text for consultation: ${consultationId}`)
    }

    return files || []
  } catch (error) {
    console.error('Error in getExtractedFilesData:', error)
    return []
  }
}

// Helper function to get additional patient data from profiles table
async function getAdditionalPatientData(patientId: string): Promise<any | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('gender, date_of_birth, family_history, smoking_status, tobacco_use, allergies, alcohol_consumption, exercise_frequency, bmi')
      .eq('id', patientId)
      .single()

    if (error) {
      console.error('Error fetching additional patient data:', error)
      return null
    }

    // Calculate age from date_of_birth
    let age = 0
    if (profile?.date_of_birth) {
      const birthDate = new Date(profile.date_of_birth)
      const today = new Date()
      age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
    }

    return {
      ...profile,
      age
    }
  } catch (error) {
    console.error('Error in getAdditionalPatientData:', error)
    return null
  }
}

// Helper function to build clinical prompt with chief complaint priority
async function buildClinicalPrompt(clinicalData: AIClinicalData, extractedFilesData: any[], additionalPatientData: any): Promise<string> {
  // Combine data from multiple sources - prioritize profiles table for demographics
  const patientHistory = {
    age: additionalPatientData?.age || clinicalData.age,
    gender: additionalPatientData?.gender || 'Not specified',
    family_history: additionalPatientData?.family_history || clinicalData.family_history,
    smoking_status: additionalPatientData?.smoking_status || clinicalData.smoking_status,
    tobacco_use: additionalPatientData?.tobacco_use || clinicalData.tobacco_use,
    allergies: additionalPatientData?.allergies || clinicalData.allergies,
    alcohol_consumption: additionalPatientData?.alcohol_consumption || clinicalData.alcohol_consumption,
    exercise_frequency: additionalPatientData?.exercise_frequency || clinicalData.exercise_frequency,
    bmi: additionalPatientData?.bmi || clinicalData.bmi
  }

  // Get symptom data from form_data or voice_data 
  const symptomData = clinicalData.form_data || {}
  const voiceData = clinicalData.voice_data || null

  // Fix chief complaint field name mismatch
  const chiefComplaint = symptomData.chiefComplaint || symptomData.chief_complaint || 'Not specified'

  // Build document context from extracted files
  let documentContext = ''
  if (extractedFilesData && extractedFilesData.length > 0) {
    documentContext = '\n\nUPLOADED MEDICAL DOCUMENTS:\n'
    
    extractedFilesData.forEach((file: any, index: number) => {
      documentContext += `\n--- Document ${index + 1}: ${file.file_name} (${file.file_type}) ---\n`
      
      if (file.extracted_text && file.extracted_text.trim()) {
        documentContext += `EXTRACTED CONTENT:\n${file.extracted_text}\n\n`
      } else {
        documentContext += `[No text could be extracted from this file]\n\n`
      }
    })
    
    documentContext += `\nTotal Processed Documents: ${extractedFilesData.length}\n`
  } else {
    documentContext = '\n\nUPLOADED MEDICAL DOCUMENTS:\nNo documents uploaded or processed for this consultation.\n'
  }

  const prompt = `
${SYSTEM_PROMPT}

${DEVELOPER_PROMPT}

${FEW_SHOT_PROMPT}

🚨 CRITICAL: CHIEF COMPLAINT PRIORITY 🚨
The patient has explicitly stated their PRIMARY CHIEF COMPLAINT as: "${chiefComplaint}"

This is the MAIN REASON for their visit. You MUST use this exact chief complaint as provided by the patient. 
DO NOT modify, rephrase, or derive a different chief complaint from other symptoms or documents.
This chief complaint takes ABSOLUTE PRIORITY over any other information.

PATIENT INFORMATION:
Age: ${patientHistory.age} years
Gender: ${patientHistory.gender}
Family History: ${patientHistory.family_history || 'Not specified'}
Smoking Status: ${patientHistory.smoking_status || 'Not specified'}
Tobacco Use: ${patientHistory.tobacco_use || 'Not specified'}
Allergies: ${Array.isArray(patientHistory.allergies) ? patientHistory.allergies.join(', ') : (patientHistory.allergies || 'Not specified')}
Alcohol Consumption: ${patientHistory.alcohol_consumption || 'Not specified'}
Exercise Frequency: ${patientHistory.exercise_frequency || 'Not specified'}
BMI: ${patientHistory.bmi || 'Not specified'}

CURRENT SYMPTOMS AND PATIENT INPUT:
Chief Complaint (PATIENT'S PRIMARY CONCERN): ${chiefComplaint}
Symptom Duration: ${symptomData.symptomDuration || symptomData.symptom_duration || 'Not specified'}
Severity Level: ${symptomData.severityLevel || symptomData.severity_level || 'Not specified'}
Detailed Symptoms: ${symptomData.symptoms || 'Not specified'}
Additional Symptoms: ${symptomData.additionalSymptoms || symptomData.additional_symptoms || 'None'}
Current Allergies: ${symptomData.allergies || 'None'}
Current Medications: ${symptomData.medications || 'None'}
Chronic Conditions: ${symptomData.chronicConditions || symptomData.chronic_conditions || 'None'}

${voiceData ? `VOICE CONSULTATION DATA:\n${JSON.stringify(voiceData, null, 2)}\n` : ''}
${documentContext}

${AUTO_REPAIR_PROMPT}

IMPORTANT INSTRUCTIONS:
1. Use the EXACT chief complaint as stated by the patient: "${symptomData.chief_complaint || 'Not specified'}"
2. Build your analysis around this chief complaint as the primary focus
3. Use uploaded document information to SUPPORT and ENHANCE the analysis, not to override the patient's stated concern
4. If documents suggest different issues, mention them as additional findings while keeping the patient's chief complaint as primary
5. If voice consultation data is provided, integrate it with the form data for a complete picture

Return ONLY valid JSON matching this exact schema:
{
  "chief_complaint": "${chiefComplaint}",
  "history_of_present_illness": "string", 
  "differential_diagnoses": ["string"],
  "recommended_tests": ["string"],
  "urgency_level": "routine" | "urgent" | "emergency"
}
`

  return prompt
}

// Helper function to call Gemini API (updated for new workflow)
async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const maxRetries = 3
  const baseDelay = 1000 // 1 second base delay

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Prepare the request payload
      const requestBody = {
        contents: [{
          parts: [
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent medical responses
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }

      console.log('Calling Gemini API for clinical summary generation')

      // Make the API call
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      // Handle 503 errors with retry logic
      if (response.status === 503) {
        const errorText = await response.text()
        console.warn(`Gemini API overloaded (attempt ${attempt}/${maxRetries}): ${errorText}`)
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        } else {
          console.error('Gemini API overloaded after all retries, using fallback response')
          throw new Error('Gemini API overloaded after all retries')
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error:', response.status, errorText)
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
        throw new Error('Invalid response from Gemini API')
      }

      const aiResponse = result.candidates[0].content.parts[0].text
      console.log('Gemini API response received, length:', aiResponse.length)

      return aiResponse

    } catch (error) {
      console.error(`Error calling Gemini API (attempt ${attempt}/${maxRetries}):`, error)
      
      if (attempt === maxRetries) {
        console.error('All retry attempts failed, using fallback response')
        // Return a fallback response if all retries fail
        return JSON.stringify({
          chief_complaint: "Unable to generate due to API overload - please try again later",
          history_of_present_illness: "AI service temporarily unavailable. Please review patient data manually.",
          differential_diagnoses: ["Requires manual medical review"],
          recommended_tests: ["Standard evaluation recommended"],
          urgency_level: "routine"
        })
      }
      
      // Wait before retrying (exponential backoff)
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but just in case
  throw new Error('Unexpected error in Gemini API call')
}



// Helper function to validate and parse AI response
function validateAndParseResponse(aiResponse: string): ClinicalSummary {
  try {
    // Clean the response - sometimes AI adds extra text
    let cleanedResponse = aiResponse.trim()
    
    // Try to extract JSON if it's wrapped in markdown or other text
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0]
    }
    
    const parsed = JSON.parse(cleanedResponse)
    
    // Enhanced validation
    if (!parsed.chief_complaint || typeof parsed.chief_complaint !== 'string') {
      throw new Error('Missing or invalid chief_complaint')
    }
    
    if (!parsed.history_of_present_illness || typeof parsed.history_of_present_illness !== 'string') {
      throw new Error('Missing or invalid history_of_present_illness')
    }

    // Validate arrays
    if (!Array.isArray(parsed.differential_diagnoses)) {
      parsed.differential_diagnoses = []
    }
    
    if (!Array.isArray(parsed.recommended_tests)) {
      parsed.recommended_tests = []
    }

    // Validate urgency level
    const validUrgencyLevels = ['routine', 'urgent', 'emergency']
    if (!validUrgencyLevels.includes(parsed.urgency_level)) {
      parsed.urgency_level = 'routine'
    }

    // Sanitize strings
    const sanitizedSummary: ClinicalSummary = {
      chief_complaint: parsed.chief_complaint.substring(0, 1000), // Limit length
      history_of_present_illness: parsed.history_of_present_illness.substring(0, 2000),
      differential_diagnoses: parsed.differential_diagnoses
        .filter((d: any) => typeof d === 'string' && d.length > 0)
        .map((d: string) => d.substring(0, 200))
        .slice(0, 10), // Limit to 10 diagnoses
      recommended_tests: parsed.recommended_tests
        .filter((t: any) => typeof t === 'string' && t.length > 0)
        .map((t: string) => t.substring(0, 200))
        .slice(0, 10), // Limit to 10 tests
      urgency_level: parsed.urgency_level
    }

    console.log('Validated clinical summary:', {
      chief_complaint_length: sanitizedSummary.chief_complaint.length,
      diagnoses_count: sanitizedSummary.differential_diagnoses.length,
      tests_count: sanitizedSummary.recommended_tests.length,
      urgency_level: sanitizedSummary.urgency_level
    })

    return sanitizedSummary

  } catch (error) {
    console.error('Error parsing AI response:', error)
    console.error('Raw response:', aiResponse)
    
    // Return a safe fallback
    return {
      chief_complaint: "Unable to parse AI response - manual review required",
      history_of_present_illness: "Patient data available but AI analysis failed. Please review consultation details manually.",
      differential_diagnoses: ["Requires manual medical review"],
      recommended_tests: ["Standard evaluation recommended"],
      urgency_level: "routine"
    }
  }
}

// Helper function to store clinical summary
async function storeClinicalSummary(consultationId: string, patientId: string, summary: ClinicalSummary) {
  try {
    const { error } = await supabase
      .from('clinical_summaries')
      .insert({
        consultation_id: consultationId,
        patient_id: patientId,
        summary_json: summary,
        processing_status: 'completed'
      })

    if (error) {
      console.error('Error storing clinical summary:', error)
      throw error
    }

    console.log('Clinical summary stored successfully')
  } catch (error) {
    console.error('Error in storeClinicalSummary:', error)
    throw error
  }
}

// Helper function to update appointment status
async function updateAppointmentStatus(appointmentId: string, status: string, errorMessage?: string) {
  try {
    const updateData: any = { ai_processing_status: status }
    
    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId)

    if (error) {
      console.error('Error updating appointment status:', error)
    }
  } catch (error) {
    console.error('Error in updateAppointmentStatus:', error)
  }
} 