import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Testing Migration Fix...\n');

// Check if migration file exists
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20241210_comprehensive_appointment_fix.sql');
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  process.exit(1);
}

console.log('✅ Migration file exists');

// Read and analyze the migration file
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

// Check for the explicit DROP statements we added
const dropStatements = [
  'DROP FUNCTION IF EXISTS update_file_processing_status(UUID, TEXT, BOOLEAN) CASCADE;',
  'DROP FUNCTION IF EXISTS update_file_processing_status(UUID, TEXT) CASCADE;',
  'DROP FUNCTION IF EXISTS update_file_processing_status(UUID) CASCADE;',
  'DROP FUNCTION IF EXISTS link_files_to_appointment(UUID) CASCADE;',
  'DROP FUNCTION IF EXISTS get_unprocessed_files_for_appointment(UUID) CASCADE;',
  'DROP FUNCTION IF EXISTS check_all_files_processed(UUID) CASCADE;',
  'DROP FUNCTION IF EXISTS get_appointment_processing_status(UUID) CASCADE;',
  'DROP FUNCTION IF EXISTS trigger_complete_appointment_workflow() CASCADE;',
  'DROP VIEW IF EXISTS appointment_file_processing_status CASCADE;'
];

console.log('\n🔍 Checking for explicit DROP statements...');
let allDropsFound = true;

dropStatements.forEach((dropStmt, index) => {
  if (migrationContent.includes(dropStmt)) {
    console.log(`✅ Found: ${dropStmt}`);
  } else {
    console.log(`❌ Missing: ${dropStmt}`);
    allDropsFound = false;
  }
});

if (allDropsFound) {
  console.log('\n✅ All explicit DROP statements found!');
  console.log('✅ Migration should now apply successfully without parameter default conflicts.');
} else {
  console.log('\n❌ Some DROP statements are missing. Migration may still fail.');
}

// Check for the main functions
const functions = [
  'update_file_processing_status',
  'link_files_to_appointment', 
  'get_unprocessed_files_for_appointment',
  'check_all_files_processed',
  'get_appointment_processing_status',
  'trigger_complete_appointment_workflow'
];

console.log('\n🔍 Checking for function definitions...');
functions.forEach(func => {
  if (migrationContent.includes(`CREATE OR REPLACE FUNCTION ${func}`)) {
    console.log(`✅ Found function: ${func}`);
  } else {
    console.log(`❌ Missing function: ${func}`);
  }
});

console.log('\n📋 Summary:');
console.log('- The migration file has been updated with explicit DROP statements');
console.log('- This should resolve the "cannot remove parameter defaults" error');
console.log('- You can now try applying the migration again');
console.log('\n🚀 Next steps:');
console.log('1. Run: supabase db reset (if in development)');
console.log('2. Or apply the migration manually in your database');
console.log('3. Test the appointment creation flow');
