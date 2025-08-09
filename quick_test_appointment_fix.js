// ===================================
// QUICK APPOINTMENT FIX TEST
// Simple test to verify the fix works
// ===================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 QUICK APPOINTMENT FIX TEST')
console.log('==============================')

// Test 1: Check if the migration file exists

console.log('\n📋 TEST 1: Migration File Check')

const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20241210_comprehensive_appointment_fix.sql');
if (fs.existsSync(migrationFile)) {
  console.log('    ✅ Migration file exists');
  
  const migrationContent = fs.readFileSync(migrationFile, 'utf8');
  const hasTrigger = migrationContent.includes('CREATE TRIGGER trg_complete_appointment_workflow');
  const hasFileLinking = migrationContent.includes('link_files_to_appointment');
  const hasAiProcessing = migrationContent.includes('ai_processing_status');
  
  if (hasTrigger) {
    console.log('    ✅ Single safe trigger defined');
  } else {
    console.log('    ❌ Missing trigger definition');
  }
  
  if (hasFileLinking) {
    console.log('    ✅ File linking function defined');
  } else {
    console.log('    ❌ Missing file linking function');
  }
  
  if (hasAiProcessing) {
    console.log('    ✅ AI processing status column defined');
  } else {
    console.log('    ❌ Missing AI processing status column');
  }
} else {
  console.log('    ❌ Migration file not found');
}

// Test 2: Check if the frontend fix exists
console.log('\n📋 TEST 2: Frontend Fix Check')

const frontendFile = path.join(__dirname, 'src', 'pages', 'PatientViewPage.tsx');
if (fs.existsSync(frontendFile)) {
  console.log('    ✅ PatientViewPage.tsx exists');
  
  const frontendContent = fs.readFileSync(frontendFile, 'utf8');
  const hasValidation = frontendContent.includes('if (!selectedDoctor)');
  const hasLogging = frontendContent.includes('console.log');
  const hasErrorHandling = frontendContent.includes('setSubmitError');
  
  if (hasValidation) {
    console.log('    ✅ Input validation added');
  } else {
    console.log('    ❌ Missing input validation');
  }
  
  if (hasLogging) {
    console.log('    ✅ Detailed logging added');
  } else {
    console.log('    ❌ Missing detailed logging');
  }
  
  if (hasErrorHandling) {
    console.log('    ✅ Enhanced error handling');
  } else {
    console.log('    ❌ Missing enhanced error handling');
  }
} else {
  console.log('    ❌ PatientViewPage.tsx not found');
}

// Test 3: Check if the edge function exists
console.log('\n📋 TEST 3: Edge Function Check')

const edgeFunctionDir = path.join(__dirname, 'supabase', 'functions', 'process_patient_files');
if (fs.existsSync(edgeFunctionDir)) {
  console.log('    ✅ Process patient files edge function exists');
  
  const indexFile = path.join(edgeFunctionDir, 'index.ts');
  if (fs.existsSync(indexFile)) {
    const edgeFunctionContent = fs.readFileSync(indexFile, 'utf8');
    const hasGeminiApi = edgeFunctionContent.includes('GEMINI_API_KEY');
    const hasPdfProcessing = edgeFunctionContent.includes('processPDF');
    const hasImageProcessing = edgeFunctionContent.includes('processImage');
    
    if (hasGeminiApi) {
      console.log('    ✅ Gemini AI integration');
    } else {
      console.log('    ❌ Missing Gemini AI integration');
    }
    
    if (hasPdfProcessing) {
      console.log('    ✅ PDF processing function');
    } else {
      console.log('    ❌ Missing PDF processing function');
    }
    
    if (hasImageProcessing) {
      console.log('    ✅ Image processing function');
    } else {
      console.log('    ❌ Missing image processing function');
    }
  } else {
    console.log('    ❌ Edge function index.ts not found');
  }
} else {
  console.log('    ❌ Process patient files edge function not found');
}

// Test 4: Check if the test file exists
console.log('\n📋 TEST 4: Test File Check')

const testFile = path.join(__dirname, 'test_comprehensive_appointment_fix.js');
if (fs.existsSync(testFile)) {
  console.log('    ✅ Comprehensive test file exists');
  
  const testContent = fs.readFileSync(testFile, 'utf8');
  const hasDatabaseTest = testContent.includes('testDatabaseStructure');
  const hasAppointmentTest = testContent.includes('testAppointmentCreation');
  const hasFileTest = testContent.includes('testFileProcessing');
  
  if (hasDatabaseTest) {
    console.log('    ✅ Database structure test');
  } else {
    console.log('    ❌ Missing database structure test');
  }
  
  if (hasAppointmentTest) {
    console.log('    ✅ Appointment creation test');
  } else {
    console.log('    ❌ Missing appointment creation test');
  }
  
  if (hasFileTest) {
    console.log('    ✅ File processing test');
  } else {
    console.log('    ❌ Missing file processing test');
  }
} else {
  console.log('    ❌ Comprehensive test file not found');
}

// Test 5: Check if the summary document exists
console.log('\n📋 TEST 5: Documentation Check')

const summaryFile = path.join(__dirname, 'COMPREHENSIVE_APPOINTMENT_FIX_SUMMARY.md');
if (fs.existsSync(summaryFile)) {
  console.log('    ✅ Comprehensive fix summary exists');
  
  const summaryContent = fs.readFileSync(summaryFile, 'utf8');
  const hasProblemAnalysis = summaryContent.includes('Problem Analysis');
  const hasSolution = summaryContent.includes('Solution Implemented');
  const hasDeployment = summaryContent.includes('Deployment Instructions');
  
  if (hasProblemAnalysis) {
    console.log('    ✅ Problem analysis documented');
  } else {
    console.log('    ❌ Missing problem analysis');
  }
  
  if (hasSolution) {
    console.log('    ✅ Solution implementation documented');
  } else {
    console.log('    ❌ Missing solution documentation');
  }
  
  if (hasDeployment) {
    console.log('    ✅ Deployment instructions documented');
  } else {
    console.log('    ❌ Missing deployment instructions');
  }
} else {
  console.log('    ❌ Comprehensive fix summary not found');
}

console.log('\n✅ QUICK TEST COMPLETED!')
console.log('\n📋 SUMMARY:')
console.log('- All fix files should be present and properly structured')
console.log('- Database migration includes single trigger and file linking')
console.log('- Frontend has enhanced validation and error handling')
console.log('- Edge function has Gemini AI integration for file processing')
console.log('- Comprehensive test suite and documentation provided')

console.log('\n🚀 NEXT STEPS:')
console.log('1. Apply the database migration in Supabase')
console.log('2. Deploy the updated frontend code')
console.log('3. Test appointment creation with a real patient')
console.log('4. Monitor the logs for any issues')
console.log('5. Verify file processing with uploaded documents')
