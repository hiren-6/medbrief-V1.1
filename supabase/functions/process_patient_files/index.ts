import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
const GEMINI_FILE_API_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
// Processing configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
;
const MAX_PROCESSING_TIME = 60000 // 60 seconds max per file
;
serve(async (req)=>{
  try {
    console.log('🔄 File processing request received');
    // Parse request body
    const requestBody = await req.text();
    console.log('📥 Request body:', requestBody);
    let parsedBody;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body',
        received_body: requestBody
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    // Handle different payload types
    let appointment_id, request_id;
    
    // Check if this is a coordinated trigger payload (new system)
    if (parsedBody.appointment_id && parsedBody.request_id) {
      appointment_id = parsedBody.appointment_id;
      request_id = parsedBody.request_id;
      console.log(`📋 Coordinated trigger payload - appointment_id: ${appointment_id}, request_id: ${request_id}`);
    }
    // Check if this is a webhook payload (current system)
    else if (parsedBody.type && parsedBody.record && parsedBody.table === 'patient_files') {
      const record = parsedBody.record;
      
      // For INSERT events, we need appointment_id to be populated
      if (parsedBody.type === 'INSERT') {
        if (!record.appointment_id) {
          console.log('⏸️ INSERT event with null appointment_id - ignoring (waiting for appointment link)');
          return new Response(JSON.stringify({
            success: true,
            message: 'File uploaded but not yet linked to appointment - waiting for coordination',
            file_id: record.id,
            consultation_id: record.consultation_id
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        }
        appointment_id = record.appointment_id;
        request_id = `webhook_insert_${record.id}_${Date.now()}`;
        console.log(`📋 Webhook INSERT payload - appointment_id: ${appointment_id}, file: ${record.file_name}`);
      }
      // For UPDATE events, check if appointment_id was just linked
      else if (parsedBody.type === 'UPDATE') {
        const oldRecord = parsedBody.old_record;
        if (!oldRecord.appointment_id && record.appointment_id) {
          appointment_id = record.appointment_id;
          request_id = `webhook_update_${record.id}_${Date.now()}`;
          console.log(`📋 Webhook UPDATE payload - file linked to appointment: ${appointment_id}, file: ${record.file_name}`);
        } else {
          console.log('⏸️ UPDATE event but appointment_id not newly linked - ignoring');
          return new Response(JSON.stringify({
            success: true,
            message: 'Update event but no new appointment link detected',
            file_id: record.id
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        }
      } else {
        console.log(`⏸️ Unsupported webhook event type: ${parsedBody.type}`);
        return new Response(JSON.stringify({
          success: true,
          message: `Unsupported event type: ${parsedBody.type}`,
          event_type: parsedBody.type
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    }
    // Unknown payload format
    else {
      console.error('❌ Unknown payload format');
      console.error('❌ Received body:', parsedBody);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unknown payload format - expected coordinated trigger or webhook payload',
        received_body: parsedBody
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    // Validate appointment_id is present
    if (!appointment_id) {
      console.error('❌ No valid appointment_id found in request');
      console.error('❌ Received body:', parsedBody);
      return new Response(JSON.stringify({
        success: false,
        error: 'appointment_id is required',
        received_body: parsedBody
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    console.log(`📁 Processing files for appointment: ${appointment_id}`);
    // Try to acquire processing lock by updating appointment status
    const { data: appointmentUpdate, error: lockError } = await supabase.from('appointments').update({
      ai_processing_status: 'processing',
      updated_at: new Date().toISOString()
    }).eq('id', appointment_id).eq('ai_processing_status', 'triggered') // Only update if still in triggered state
    .select();
    if (lockError) {
      console.error(`❌ Error acquiring lock for appointment ${appointment_id}:`, lockError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to acquire processing lock',
        appointment_id,
        lock_error: lockError.message
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    if (!appointmentUpdate || appointmentUpdate.length === 0) {
      console.log(`⏳ Appointment ${appointment_id} is already being processed by another instance`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Appointment is already being processed or not in correct state',
        appointment_id,
        concurrent_processing: true
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 409 // Conflict
      });
    }
    console.log(`🔒 Acquired processing lock for appointment: ${appointment_id}`);
    // Get all unprocessed files for this appointment  
    const files = await getUnprocessedFiles(appointment_id);
    if (files.length === 0) {
      console.log('ℹ️  No files to process');
      // Release the processing lock by updating status back to completed
      try {
        await supabase.from('appointments').update({
          ai_processing_status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', appointment_id);
        console.log(`🔓 Released processing lock for appointment: ${appointment_id}`);
      } catch (lockReleaseError) {
        console.warn('Failed to release processing lock (not critical):', lockReleaseError);
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'No files to process',
        appointment_id,
        processed_files: 0
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    console.log(`📋 Found ${files.length} files to process`);
    // Process each file
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (const file of files){
      console.log(`🔄 Processing file: ${file.file_name} (${file.file_type})`);
      const startTime = Date.now();
      let result;
      try {
        if (file.file_type === 'application/pdf') {
          result = await processPDF(file);
        } else if (file.file_type.startsWith('image/')) {
          result = await processImage(file);
        } else {
          result = {
            file_id: file.id,
            file_name: file.file_name,
            file_type: file.file_type,
            file_size: file.file_size,
            extracted_text: '',
            processing_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: 'Unsupported file type'
          };
        }
        // Update the patient_files table with extracted text
        await updatePatientFileText(result);
        if (result.status === 'completed') {
          successCount++;
          console.log(`✅ Successfully processed: ${file.file_name}`);
        } else {
          failureCount++;
          console.log(`❌ Failed to process: ${file.file_name} - ${result.error_message}`);
        }
        results.push(result);
      } catch (error) {
        failureCount++;
        console.error(`💥 Error processing file ${file.file_name}:`, error);
        result = {
          file_id: file.id,
          file_name: file.file_name,
          file_type: file.file_type,
          file_size: file.file_size,
          extracted_text: '',
          processing_time_ms: Date.now() - startTime,
          status: 'failed',
          error_message: error.message
        };
        await updatePatientFileText(result);
        results.push(result);
      }
    }
    // Check if all files for this appointment are now processed
    const allFilesProcessed = await checkAllFilesProcessed(appointment_id);
    if (allFilesProcessed) {
      console.log('🎯 All files processed for appointment. Triggering clinical summary generation...');
      // Add a delay to ensure database updates are committed
      await new Promise((resolve)=>setTimeout(resolve, 2000));
      await triggerClinicalSummaryGeneration(appointment_id);
    }
    console.log(`🎯 File processing completed: ${successCount} successful, ${failureCount} failed`);
    // Release the processing lock by updating status
    try {
      const finalStatus = allFilesProcessed ? 'completed' : 'processing_failed';
      await supabase.from('appointments').update({
        ai_processing_status: finalStatus,
        updated_at: new Date().toISOString()
      }).eq('id', appointment_id);
      console.log(`🔓 Released processing lock for appointment: ${appointment_id} with status: ${finalStatus}`);
    } catch (lockReleaseError) {
      console.warn('Failed to release processing lock (not critical):', lockReleaseError);
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'File processing completed',
      appointment_id,
      total_files: files.length,
      successful_files: successCount,
      failed_files: failureCount,
      all_files_processed: allFilesProcessed,
      clinical_summary_triggered: allFilesProcessed,
      results
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('💥 Error in file processing:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'File processing failed'
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
// Get files that haven't been processed yet for an appointment
async function getUnprocessedFiles(appointment_id) {
  try {
    console.log(`🔍 Fetching unprocessed files for appointment: ${appointment_id}`);
    // Query directly from patient_files table
    const { data: unprocessedFiles, error: filesError } = await supabase.from('patient_files').select(`
        id,
        consultation_id,
        appointment_id,
        file_name,
        file_path,
        file_type,
        file_size,
        extracted_text,
        processed,
        created_at
      `).eq('appointment_id', appointment_id).or('processed.is.null,processed.eq.false').order('created_at', {
      ascending: true
    });
    if (filesError) {
      console.error('Error fetching unprocessed files:', filesError);
      return [];
    }
    console.log(`📋 Found ${unprocessedFiles?.length || 0} unprocessed files`);
    return unprocessedFiles || [];
  } catch (error) {
    console.error('Error in getUnprocessedFiles:', error);
    return [];
  }
}
// Update patient_files table with extracted text
async function updatePatientFileText(result) {
  try {
    console.log(`📝 Updating file processing status for: ${result.file_name}`);
    // Update directly using Supabase client
    const { error } = await supabase.from('patient_files').update({
      parsed_text: result.extracted_text,
      processed: result.status === 'completed',
      updated_at: new Date().toISOString()
    }).eq('id', result.file_id);
    if (error) {
      console.error('Error updating patient file text:', error);
    } else {
      console.log(`✅ Updated extracted text for file: ${result.file_name}`);
    }
  } catch (error) {
    console.error('Error in updatePatientFileText:', error);
  }
}
// Check if all files for an appointment are processed
async function checkAllFilesProcessed(appointment_id) {
  try {
    console.log(`🔍 Checking if all files processed for appointment: ${appointment_id}`);
    // Count total files and processed files
    const { data: totalFilesResult, error: totalError } = await supabase.from('patient_files').select('id', {
      count: 'exact'
    }).eq('appointment_id', appointment_id);
    if (totalError) {
      console.error('Error counting total files:', totalError);
      return false;
    }
    const totalFiles = totalFilesResult?.length || 0;
    const { data: processedFilesResult, error: processedError } = await supabase.from('patient_files').select('id', {
      count: 'exact'
    }).eq('appointment_id', appointment_id).eq('processed', true);
    if (processedError) {
      console.error('Error counting processed files:', processedError);
      return false;
    }
    const processedFiles = processedFilesResult?.length || 0;
    const allProcessed = totalFiles === 0 || totalFiles === processedFiles;
    console.log(`📊 Files status: ${processedFiles}/${totalFiles} processed, all done: ${allProcessed}`);
    return allProcessed;
  } catch (error) {
    console.error('Error in checkAllFilesProcessed:', error);
    return false;
  }
}
// STAGE 2: Call clinical summary generation directly (simplified approach)
async function triggerClinicalSummaryGeneration(appointment_id) {
  try {
    console.log(`🚀 STAGE 2: Calling clinical summary generation directly for appointment: ${appointment_id}`);
    
    const clinicalSummaryUrl = `${supabaseUrl}/functions/v1/generate_clinical_summary`;
    
    // Get appointment details first
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .single();

    if (appointmentError || !appointment) {
      throw new Error(`Failed to fetch appointment: ${appointmentError?.message}`);
    }

    // Prepare payload for clinical summary function
    const payload = {
      type: "DIRECT_CALL",
      record: {
        ...appointment,
        ai_processing_status: "processing"
      },
      table: "appointments",
      source: "process_patient_files"
    };

    console.log('📤 Calling clinical summary function directly...');
    
    const response = await fetch(clinicalSummaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const responseText = await response.text();
      console.log('✅ Clinical summary generation completed successfully:', responseText);
      
      // Update appointment status to completed
      await supabase
        .from('appointments')
        .update({ 
          ai_processing_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment_id);
        
    } else {
      const errorText = await response.text();
      console.error('❌ Clinical summary generation failed:', response.status, errorText);
      
      // Update appointment status to failed
      await supabase
        .from('appointments')
        .update({ 
          ai_processing_status: 'failed',
          error_message: `Clinical summary failed: HTTP ${response.status}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment_id);
    }
    
  } catch (error) {
    console.error('Error in triggerClinicalSummaryGeneration:', error);
    
    // Update appointment status to failed
    try {
      await supabase
        .from('appointments')
        .update({ 
          ai_processing_status: 'failed',
          error_message: `Clinical summary error: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment_id);
    } catch (statusError) {
      console.error('Failed to update appointment status to failed:', statusError);
    }
  }
}
// Process PDF files
async function processPDF(file) {
  const startTime = Date.now();
  try {
    console.log(`📄 Processing PDF: ${file.file_name}`);
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    // Get signed URL for the file
    console.log(`🔗 Getting signed URL for: ${file.file_path}`);
    const { data: { signedUrl }, error: urlError } = await supabase.storage.from('patient-documents').createSignedUrl(file.file_path, 300) // 5 minutes
    ;
    if (urlError || !signedUrl) {
      throw new Error(`Failed to get signed URL: ${urlError?.message}`);
    }
    console.log(`⬇️  Downloading file from signed URL`);
    // Download the file
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    const fileBuffer = await response.arrayBuffer();
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(fileBuffer.byteLength / 1024 / 1024)}MB exceeds 10MB limit`);
    }
    console.log(`📤 Uploading to Gemini API using resumable upload protocol`);
    // Step 1: Start resumable upload session
    const startUploadResponse = await fetch(`${GEMINI_FILE_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': fileBuffer.byteLength.toString(),
        'X-Goog-Upload-Header-Content-Type': file.file_type,
        'Content-Length': '0'
      },
      body: JSON.stringify({
        file: {
          displayName: file.file_name
        }
      })
    });
    // Get the resumable upload URL from response headers
    const uploadUrl = startUploadResponse.headers.get('X-Goog-Upload-URL');
    if (!startUploadResponse.ok || !uploadUrl) {
      const errorText = await startUploadResponse.text();
      throw new Error(`Gemini upload start failed: ${startUploadResponse.status} - ${errorText}`);
    }
    console.log(`📤 Resumable upload URL obtained, uploading file content...`);
    // Step 2: Upload the actual file content to the resumable upload URL
    const finalUploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.file_type,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Length': fileBuffer.byteLength.toString()
      },
      body: fileBuffer
    });
    if (!finalUploadResponse.ok) {
      const errorText = await finalUploadResponse.text();
      throw new Error(`Gemini file upload failed: ${finalUploadResponse.status} - ${errorText}`);
    }
    const uploadResult = await finalUploadResponse.json();
    const fileUri = uploadResult.file.uri;
    const fileName = uploadResult.file.name;
    console.log(`⏳ Waiting for Gemini to process file`);
    // Wait for processing
    let fileState = 'PROCESSING';
    let waitTime = 0;
    while(fileState === 'PROCESSING' && waitTime < MAX_PROCESSING_TIME){
      await new Promise((resolve)=>setTimeout(resolve, 2000));
      waitTime += 2000;
      const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`);
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        fileState = statusResult.state;
      }
    }
    if (fileState !== 'ACTIVE') {
      throw new Error(`File processing failed. State: ${fileState}`);
    }
    console.log(`🔍 Extracting medically relevant text`);
    // Extract medically relevant text only with enhanced prompt
    const extractResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                fileData: {
                  mimeType: file.file_type,
                  fileUri: fileUri
                }
              },
              {
                text: `Extract all medically relevant text content from this PDF document. Focus on:

PATIENT INFORMATION:
- Patient name, age, gender, date of birth
- Contact information and demographics
- Medical record numbers or identifiers

MEDICAL HISTORY:
- Past medical history and conditions
- Previous surgeries or procedures
- Family medical history
- Social history (smoking, alcohol, drugs)

CURRENT PRESENTATION:
- Chief complaint and presenting symptoms
- History of present illness
- Review of systems
- Duration and severity of symptoms

CLINICAL FINDINGS:
- Physical examination findings
- Vital signs (blood pressure, heart rate, temperature, etc.)
- Laboratory test results and values
- Imaging study results
- Diagnostic test interpretations

MEDICAL MANAGEMENT:
- Current medications and dosages
- Allergies and adverse reactions
- Treatment plans and recommendations
- Follow-up instructions
- Specialist referrals

ASSESSMENTS AND DIAGNOSES:
- Primary and secondary diagnoses
- ICD codes if present
- Clinical assessments
- Differential diagnoses

Return ONLY the extracted text content as written in the document. Preserve all medical terminology, values, and clinical details exactly. Do not add interpretation, analysis, or additional context. If specific sections are not present in the document, omit them from the output.`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 0.8,
          maxOutputTokens: 8192
        }
      })
    });
    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`Text extraction failed: ${extractResponse.status} - ${errorText}`);
    }
    const extractResult = await extractResponse.json();
    if (!extractResult.candidates || !extractResult.candidates[0] || !extractResult.candidates[0].content) {
      throw new Error('Invalid response from Gemini');
    }
    const extractedText = extractResult.candidates[0].content.parts[0].text.trim();
    console.log(`🧹 Cleaning up uploaded file`);
    // Clean up uploaded file
    try {
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`, {
        method: 'DELETE'
      });
    } catch (deleteError) {
      console.warn('Failed to delete uploaded file (not critical):', deleteError);
    }
    console.log(`✅ PDF processing completed successfully`);
    return {
      file_id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      file_size: file.file_size,
      extracted_text: extractedText,
      processing_time_ms: Date.now() - startTime,
      status: 'completed'
    };
  } catch (error) {
    console.error(`❌ PDF processing failed: ${error.message}`);
    return {
      file_id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      file_size: file.file_size,
      extracted_text: '',
      processing_time_ms: Date.now() - startTime,
      status: 'failed',
      error_message: error.message
    };
  }
}
// Process image files
async function processImage(file) {
  const startTime = Date.now();
  try {
    console.log(`🖼️  Processing image: ${file.file_name}`);
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }
    // Get signed URL for the image
    console.log(`🔗 Getting signed URL for: ${file.file_path}`);
    const { data: { signedUrl }, error: urlError } = await supabase.storage.from('patient-documents').createSignedUrl(file.file_path, 300);
    if (urlError || !signedUrl) {
      throw new Error(`Failed to get signed URL: ${urlError?.message}`);
    }
    console.log(`⬇️  Downloading image from signed URL`);
    // Download and convert to base64
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    const imageBuffer = await response.arrayBuffer();
    if (imageBuffer.byteLength > MAX_FILE_SIZE) {
      throw new Error(`Image too large: ${Math.round(imageBuffer.byteLength / 1024 / 1024)}MB exceeds 10MB limit`);
    }
    
    // Convert to Base64 using reduce to avoid stack overflow for large images
    console.log(`🔢 Converting image to Base64`);
    const binaryString = new Uint8Array(imageBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    );
    const base64Image = btoa(binaryString);
    console.log(`🔍 Analyzing image with Gemini`);
    // Analyze image with Gemini
    const analysisResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.file_type,
                  data: base64Image
                }
              },
              {
                text: `Analyze this medical image and extract all visible medically relevant information. Focus on:

ANATOMICAL STRUCTURES:
- Organs, bones, tissues, or body parts visible
- Anatomical landmarks and orientation
- Size, shape, and positioning of structures

PATHOLOGICAL FINDINGS:
- Any visible abnormalities, lesions, or variations
- Areas of concern or unusual appearance
- Comparative findings (left vs right, normal vs abnormal)

MEDICAL DEVICES AND EQUIPMENT:
- Surgical implants, prosthetics, or hardware
- Monitoring devices, catheters, or tubes
- Medical instruments visible in the image

TEXT AND LABELS:
- Patient identifiers or demographic information
- Date and time stamps
- Technical parameters or settings
- Measurement scales or rulers
- Radiologist annotations or markings

MEASUREMENTS AND VALUES:
- Quantitative measurements shown
- Scale indicators or reference markers
- Technical imaging parameters

IMAGE QUALITY AND TECHNIQUE:
- Image type (X-ray, MRI, CT, ultrasound, photograph, etc.)
- View or projection angle
- Contrast or enhancement used
- Image quality assessment

Provide a comprehensive, factual description of all visible elements. Include any text, numbers, or measurements exactly as they appear. Do not provide medical interpretations, diagnoses, or treatment recommendations - only describe what is objectively visible in the image.`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 0.8,
          maxOutputTokens: 4096
        }
      })
    });
    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      throw new Error(`Image analysis failed: ${analysisResponse.status} - ${errorText}`);
    }
    const analysisResult = await analysisResponse.json();
    if (!analysisResult.candidates || !analysisResult.candidates[0] || !analysisResult.candidates[0].content) {
      throw new Error('Invalid response from Gemini');
    }
    const imageDescription = analysisResult.candidates[0].content.parts[0].text.trim();
    console.log(`✅ Image processing completed successfully`);
    return {
      file_id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      file_size: file.file_size,
      extracted_text: imageDescription,
      processing_time_ms: Date.now() - startTime,
      status: 'completed'
    };
  } catch (error) {
    console.error(`❌ Image processing failed: ${error.message}`);
    return {
      file_id: file.id,
      file_name: file.file_name,
      file_type: file.file_type,
      file_size: file.file_size,
      extracted_text: '',
      processing_time_ms: Date.now() - startTime,
      status: 'failed',
      error_message: error.message
    };
  }
}
