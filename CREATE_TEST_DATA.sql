-- ===================================
-- CREATE TEST DATA FOR TRIGGER TESTING
-- ===================================

-- STEP 1: Create a test user (if needed)
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    gen_random_uuid(),
    'test-patient@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- STEP 2: Create a test doctor (if needed)
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    gen_random_uuid(),
    'test-doctor@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    false,
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- STEP 3: Create test profiles
INSERT INTO profiles (
    id,
    email,
    full_name,
    avatar_url,
    date_of_birth,
    gender,
    phone_number,
    address,
    emergency_contact,
    medical_history,
    allergies,
    current_medications,
    family_history,
    smoking_status,
    tobacco_use,
    alcohol_consumption,
    exercise_frequency,
    bmi,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.email,
    'Test Patient',
    NULL,
    '1990-01-01',
    'Not specified',
    '+1234567890',
    '123 Test St, Test City',
    'Emergency Contact',
    'No significant medical history',
    'None',
    'None',
    'No family history',
    'Never smoked',
    'No',
    'Occasional',
    '2-3 times per week',
    22.5,
    NOW(),
    NOW()
FROM auth.users u
WHERE u.email = 'test-patient@example.com'
ON CONFLICT (id) DO NOTHING;

-- STEP 4: Create test consultation
INSERT INTO consultations (
    id,
    patient_id,
    doctor_id,
    consultation_type,
    status,
    form_data,
    voice_data,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    u.id,
    d.id,
    'online',
    'completed',
    '{"chiefComplaint": "Test chest pain", "symptoms": "Mild chest discomfort", "severityLevel": "moderate", "symptomDuration": "2 days", "additionalSymptoms": "None", "allergies": "None", "medications": "None", "chronicConditions": "None"}'::jsonb,
    NULL,
    NOW(),
    NOW()
FROM auth.users u
CROSS JOIN auth.users d
WHERE u.email = 'test-patient@example.com'
AND d.email = 'test-doctor@example.com'
LIMIT 1;

-- STEP 5: Create test appointment
INSERT INTO appointments (
    id,
    consultation_id,
    patient_id,
    appointment_date,
    appointment_time,
    appointment_datetime,
    status,
    ai_processing_status
)
SELECT 
    gen_random_uuid(),
    c.id,
    c.patient_id,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    'scheduled',
    'pending'
FROM consultations c
JOIN auth.users u ON c.patient_id = u.id
WHERE u.email = 'test-patient@example.com'
ORDER BY c.created_at DESC
LIMIT 1;

-- STEP 6: Verify test data created
SELECT 
    'VERIFYING TEST DATA CREATED:' AS info;

SELECT 
    'Users:' as table_name,
    COUNT(*) as count
FROM auth.users 
WHERE email LIKE 'test-%@example.com'
UNION ALL
SELECT 
    'Profiles:' as table_name,
    COUNT(*) as count
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email LIKE 'test-%@example.com'
UNION ALL
SELECT 
    'Consultations:' as table_name,
    COUNT(*) as count
FROM consultations c
JOIN auth.users u ON c.patient_id = u.id
WHERE u.email LIKE 'test-%@example.com'
UNION ALL
SELECT 
    'Appointments:' as table_name,
    COUNT(*) as count
FROM appointments a
JOIN consultations c ON a.consultation_id = c.id
JOIN auth.users u ON c.patient_id = u.id
WHERE u.email LIKE 'test-%@example.com';

-- STEP 7: Check trigger status
SELECT 
    'CHECKING TRIGGER STATUS:' AS info;

SELECT 
    id,
    consultation_id,
    patient_id,
    ai_processing_status,
    created_at
FROM appointments 
WHERE ai_processing_status = 'triggered'
ORDER BY created_at DESC 
LIMIT 3; 