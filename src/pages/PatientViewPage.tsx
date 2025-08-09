import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle, AlertCircle, User, Calendar, Phone, Mail, Menu, LogOut, Lock, Clock, Activity, Heart } from 'lucide-react';
import { scrollToTop, useScrollToTop } from '../hooks/useScrollToTop';
import { supabase } from '../supabaseClient';
import AppointmentScheduler from '../components/AppointmentScheduler';
import NotificationDropdown from '../components/NotificationDropdown';

// Helper function to format specialty display
const formatSpecialtyDisplay = (specialty: string): string => {
  if (!specialty) return '';
  
  // Handle special cases
  const specialCases: { [key: string]: string } = {
    'obstetrics_gynecology': 'Obstetrics & Gynecology',
    'family_medicine': 'Family Medicine',
    'general_surgery': 'General Surgery',
    'internal_medicine': 'Internal Medicine',
    'emergency_medicine': 'Emergency Medicine'
  };
  
  if (specialCases[specialty]) {
    return specialCases[specialty];
  }
  
  // For other cases, capitalize first letter and replace underscores with spaces
  // Handle special characters like & properly
  return specialty
    .split('_')
    .map(word => {
      // Handle words that might contain special characters
      if (word.includes('&')) {
        return word.split('&').map(part => 
          part.trim().charAt(0).toUpperCase() + part.trim().slice(1).toLowerCase()
        ).join(' & ');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

interface FormData {
  // Essential Medical Information Only (in order of importance)
  chiefComplaint: string;
  symptomDuration: string;
  severityLevel: number;
  symptoms: string[];
  additionalSymptoms: string;
  allergies: string;
  medications: string;
  chronicConditions: string;
}

const PatientViewPage: React.FC = () => {
  // Scroll to top on page load
  useScrollToTop();
  
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<Array<File & { url?: string }>>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [userName, setUserName] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [patientId, setPatientId] = useState<string>('');
  const [showPopup, setShowPopup] = useState(false);

  // New: Doctor selection state
  const [doctors, setDoctors] = useState<Array<{ id: string; full_name: string; doctor_speciality: string }>>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [loadingDoctors, setLoadingDoctors] = useState<boolean>(true);
  const [doctorError, setDoctorError] = useState<string>('');

  // Appointment scheduling state
  const [appointmentDate, setAppointmentDate] = useState<string>('');
  const [appointmentTime, setAppointmentTime] = useState<string>('');
  const [appointmentDatetime, setAppointmentDatetime] = useState<string>('');

  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      setDoctorError('');
      
      // First, get all doctors
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, doctor_speciality, role');
      
      console.log('Doctor fetch result:', { data, error });
      if (error) {
        setDoctorError('Supabase error: ' + error.message);
        setDoctors([]);
        setLoadingDoctors(false);
        return;
      } else if (!data) {
        setDoctorError('No data returned from Supabase.');
        setDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      const doctorsOnly = data.filter((doc: any) => doc.role === 'doctor');
      if (doctorsOnly.length === 0) {
        setDoctorError('No doctors found in the database.');
        setDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      // Now check which doctors have appointment settings
      const doctorIds = doctorsOnly.map(doc => doc.id);
      console.log('Checking appointment settings for doctors:', doctorIds);
      
      // Try multiple query approaches to debug the issue
      console.log('Attempting query 1: Direct IN query');
      const { data: settingsData1, error: settingsError1 } = await supabase
        .from('appointment_settings')
        .select('doctor_id, start_date, end_date')
        .in('doctor_id', doctorIds);

      console.log('Query 1 result:', { settingsData1, settingsError1 });

      // Try alternative query approach
      console.log('Attempting query 2: Individual queries');
      const settingsPromises = doctorIds.map(async (doctorId) => {
        const { data, error } = await supabase
          .from('appointment_settings')
          .select('doctor_id, start_date, end_date')
          .eq('doctor_id', doctorId)
          .single();
        return { doctorId, data, error };
      });

      const settingsResults = await Promise.all(settingsPromises);
      console.log('Query 2 results:', settingsResults);

      // Use the first query result for now
      const settingsData = settingsData1;
      const settingsError = settingsError1;

      if (settingsError) {
        console.warn('Error fetching appointment settings:', settingsError);
        // Still show all doctors, but they might not have settings
        setDoctors(doctorsOnly);
      } else {
        // For debugging, let's show all doctors first
        console.log('Settings data:', settingsData);
        console.log('All doctors:', doctorsOnly);
        
        // Filter to only show doctors with appointment settings
        const doctorsWithSettings = doctorsOnly.filter(doc => 
          settingsData?.some(setting => setting.doctor_id === doc.id)
        );
        
        console.log('Doctors with settings:', doctorsWithSettings.length);
        console.log('All doctors:', doctorsOnly.length);
        
        // For now, show all doctors to test the booking flow
        console.log('Showing all doctors for testing');
        setDoctors(doctorsOnly);
        setDoctorError('');
        
        // TODO: Re-enable filtering once we identify the issue
        // if (doctorsWithSettings.length === 0) {
        //   setDoctorError('No doctors have set up their appointment schedules yet. Please contact the doctors to configure their working hours.');
        //   setDoctors([]);
        // } else {
        //   setDoctors(doctorsWithSettings);
        // }
      }
      
      setLoadingDoctors(false);
    };
    fetchDoctors();
  }, []);
  
  const [formData, setFormData] = useState<FormData>({
    chiefComplaint: '',
    symptomDuration: '',
    severityLevel: 0,
    symptoms: [],
    additionalSymptoms: '',
    allergies: '',
    medications: '',
    chronicConditions: ''
  });

  // Removed the useEffect that restricts patients to only one appointment

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
      if (!profile || profile.role !== 'patient') {
        navigate('/dashboard/patient');
        return;
      }
      setUserName(profile.full_name || '');
    };
    checkRole();
  }, [navigate]);

  // Fetch patient id on mount
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setPatientId(user.id);
    };
    fetchUserId();
  }, []);

  // Handle click outside logout dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showLogout && !target.closest('.logout-dropdown')) {
        setShowLogout(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLogout]);

  const handleBack = () => {
    navigate('/dashboard/patient');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSymptomToggle = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) e.preventDefault();
    console.log('handleNext called, advancing to step 4');
    scrollToTop('smooth'); // Smooth scroll when moving to next step
    setCurrentStep(4);
  };

  const handleAppointmentSelected = (date: string, time: string, datetime: string) => {
    setAppointmentDate(date);
    setAppointmentTime(time);
    setAppointmentDatetime(datetime);
    setCurrentStep(3); // Move to consultation form
    scrollToTop('smooth'); // Scroll to top when moving to step 3
  };

  // Add this function to handle file uploads
  const uploadFilesToSupabase = async (files: File[], consultationId: string, appointmentId?: string) => {
    const uploadedFiles = [];
    
    for (const file of files) {
      try {
        // Create unique file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${patientId}/${consultationId}/${fileName}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('patient-documents')
          .upload(filePath, file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('patient-documents')
          .getPublicUrl(filePath);
        
        // Insert file record into database with appointment_id (correct approach)
        const { error: dbError } = await supabase
          .from('patient_files')
          .insert({
            consultation_id: consultationId,
            patient_id: patientId,
            doctor_id: selectedDoctor,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            file_category: getFileCategory(file.name),
            appointment_id: appointmentId, // Set appointment_id immediately
            processed: false
          });
        
        if (dbError) {
          console.error('Database error:', dbError);
          continue;
        }
        
        uploadedFiles.push({
          name: file.name,
          path: filePath,
          url: urlData.publicUrl,
          size: file.size
        });
        
      } catch (error) {
        console.error('File upload error:', error);
      }
    }
    
    return uploadedFiles;
  };

  // Helper function to categorize files
  const getFileCategory = (fileName: string): string => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('lab') || lowerName.includes('test') || lowerName.includes('report')) {
      return 'lab_report';
    } else if (lowerName.includes('prescription') || lowerName.includes('medication')) {
      return 'prescription';
    } else if (lowerName.includes('xray') || lowerName.includes('mri') || lowerName.includes('ct') || lowerName.includes('scan')) {
      return 'imaging';
    } else if (lowerName.includes('discharge') || lowerName.includes('summary')) {
      return 'discharge_summary';
    }
    return 'medical_document';
  };

  // Enhanced handleSubmit function with better error handling and validation
  const handleSubmit = async () => {
    setSubmitLoading(true);
    setSubmitError('');
    setSubmitSuccess(false);
    
    try {
      // Validate required fields
      if (!selectedDoctor) {
        setSubmitError('Please select a doctor');
        setSubmitLoading(false);
        return;
      }

      if (!appointmentDate || !appointmentTime || !appointmentDatetime) {
        setSubmitError('Please select an appointment time');
        setSubmitLoading(false);
        return;
      }

      if (!formData.chiefComplaint.trim()) {
        setSubmitError('Please describe your main concern');
        setSubmitLoading(false);
        return;
      }

      console.log('🔄 Starting appointment creation process...');
      console.log('Selected doctor:', selectedDoctor);
      console.log('Appointment datetime:', appointmentDatetime);
      console.log('Files to upload:', uploadedFiles.length);

      // Create a clean medical data object with only essential fields
      const medicalData = {
        chiefComplaint: formData.chiefComplaint,
        symptomDuration: formData.symptomDuration,
        severityLevel: formData.severityLevel,
        symptoms: formData.symptoms,
        additionalSymptoms: formData.additionalSymptoms,
        allergies: formData.allergies,
        medications: formData.medications,
        chronicConditions: formData.chronicConditions
      };

      console.log('📝 Creating consultation...');
      // Insert into consultations table with only medical data
      const { data: consultationData, error: consultationError } = await supabase
        .from('consultations')
        .insert([{
          patient_id: patientId,
          doctor_id: selectedDoctor,
          form_data: medicalData,
        }])
        .select()
        .single();

      if (consultationError) {
        console.error('❌ Consultation creation failed:', consultationError);
        setSubmitError('Failed to submit consultation: ' + consultationError.message);
        setSubmitLoading(false);
        return;
      }

      console.log('✅ Consultation created successfully:', consultationData.id);

      console.log('📅 Creating appointment FIRST...');
      // Create appointment BEFORE uploading files (correct order)
      const { data: appointmentData, error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          patient_id: patientId,
          doctor_id: selectedDoctor,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          appointment_datetime: appointmentDatetime,
          consultation_id: consultationData.id,
          status: 'scheduled',
          ai_processing_status: 'pending'
        }])
        .select()
        .single();

      if (appointmentError) {
        console.error('❌ Appointment creation failed:', appointmentError);
        setSubmitError('Failed to create appointment: ' + appointmentError.message);
        setSubmitLoading(false);
        return;
      }

      console.log('✅ Appointment created successfully:', appointmentData.id);

      // NOW upload files with appointment_id (correct order)
      if (uploadedFiles.length > 0) {
        console.log('📁 Uploading files with appointment_id...');
        try {
          await uploadFilesToSupabase(uploadedFiles, consultationData.id, appointmentData.id);
          console.log('✅ Files uploaded successfully with appointment link');
        } catch (fileError) {
          console.error('⚠️ File upload error (continuing anyway):', fileError);
          // Don't fail the entire process if file upload fails
        }
      }

      if (appointmentError) {
        console.error('❌ Appointment creation failed:', appointmentError);
        setSubmitError('Failed to create appointment: ' + appointmentError.message);
        setSubmitLoading(false);
        return;
      }

      console.log('✅ Appointment created successfully:', appointmentData.id);

      // Verify appointment was created by fetching it
      const { data: verifyAppointment, error: verifyError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentData.id)
        .single();

      if (verifyError || !verifyAppointment) {
        console.error('❌ Appointment verification failed:', verifyError);
        setSubmitError('Appointment created but verification failed. Please check your appointments.');
        setSubmitLoading(false);
        return;
      }

      console.log('✅ Appointment verified successfully');

      // Note: Files are now uploaded with appointment_id directly, so no linking needed
      // AI processing will be triggered automatically by appointment INSERT trigger

      setSubmitSuccess(true);
      setIsSubmitted(true);
      setShowPopup(true);
      
      // Show success message for longer
      setTimeout(() => {
        setShowPopup(false);
        navigate('/dashboard/patient');
      }, 3000);
      
    } catch (err: any) {
      console.error('💥 Unexpected error in handleSubmit:', err);
      setSubmitError('Unexpected error: ' + err.message);
    }
    setSubmitLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const commonSymptoms = [
    'Fever', 'Headache', 'Cough', 'Shortness of breath', 'Chest pain',
    'Abdominal pain', 'Nausea', 'Vomiting', 'Diarrhea', 'Fatigue',
    'Dizziness', 'Joint pain', 'Muscle pain', 'Skin rash', 'Sleep problems'
  ];

  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setNotifications(data);

      // Subscribe to real-time notifications for this user
      const notificationSubscription = supabase
        .channel(`user_notifications_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            if (payload.new) {
              setNotifications((prev: any) => [payload.new, ...prev]);
            }
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(notificationSubscription);
      };
    };
    fetchNotifications();
  }, []);

  const handleNotificationClick = async (notificationId: string) => {
    await supabase.from('notifications').delete().eq('id', notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Submission Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your pre-consultation form and documents have been submitted successfully. 
            Your doctor will review this information before your appointment.
          </p>
          {submitSuccess && <p className="text-green-600">Your information has been saved.</p>}
          {submitError && <p className="text-red-600">{submitError}</p>}
          <button
            onClick={() => navigate('/my-appointments')}
            className="mt-6 bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-teal-600 font-semibold"
          >
            View My Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Popup Message */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Success!</h3>
            <p className="text-gray-600">Your information is submitted to your doctor</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div />
            
            {/* MedBrief Logo - Center */}
            <div className="flex items-center justify-center">
              <div className="w-32 h-12 rounded-xl overflow-hidden">
                <img 
                  src="/Picture3.svg" 
                  alt="MedBrief AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
                      <div className="flex items-center space-x-3 relative logout-dropdown">
            {userName && (
              <span className="text-blue-700 font-semibold">Welcome, {userName}!</span>
            )}
            <User className={`h-6 w-6 text-blue-600 cursor-pointer transition-all duration-200 ${showLogout ? 'text-blue-700 scale-110' : 'hover:text-blue-700 hover:scale-105'}`} onClick={() => setShowLogout(v => !v)} />
            {showLogout && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border rounded-lg shadow-lg z-50 transform transition-all duration-200 ease-in-out opacity-100 scale-100">
                <button
                  onClick={() => navigate('/profile')}
                  className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                >
                  <User className="h-4 w-4 mr-3" /> My Profile
                </button>
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                >
                  <Lock className="h-4 w-4 mr-3" /> My Account
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-gray-50 transition-colors duration-150"
                >
                  <LogOut className="h-4 w-4 mr-3" /> Logout
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                1
              </div>
              <div className={`h-1 w-16 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                2
              </div>
              <div className={`h-1 w-16 ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                3
              </div>
              <div className={`h-1 w-16 ${currentStep >= 4 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                4
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Step {currentStep} of 4
            </div>
          </div>
        </div>
      </div>

      {/* Notification Dropdown (temporary placement) */}
      <NotificationDropdown
        notifications={notifications}
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationClick={handleNotificationClick}
      />

      {/* Main Content */}
      <div className="pt-32 min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back to Dashboard Button - Top Left */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard/patient')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-all duration-300 font-semibold flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {currentStep === 1 ? (
            // Step 1: Select Doctor
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Select Your Doctor</h1>
                <p className="text-gray-600">Choose from the list of available doctors below.</p>
              </div>
              {loadingDoctors ? (
                <div className="text-blue-600">Loading doctors...</div>
              ) : doctorError ? (
                <div className="text-red-600">{doctorError}</div>
              ) : (
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doctor *</label>
                  <select
                    value={selectedDoctor}
                    onChange={e => setSelectedDoctor(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a doctor</option>
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.full_name} ({formatSpecialtyDisplay(doc.doctor_speciality)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => selectedDoctor && setCurrentStep(2)}
                  className={`bg-gradient-to-r from-blue-500 to-teal-500 text-white px-8 py-3 rounded-xl transition-all duration-300 font-semibold flex items-center space-x-2 ${!selectedDoctor ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-teal-600'}`}
                  disabled={!selectedDoctor}
                >
                  <span>Next: Select Appointment Time</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : currentStep === 2 ? (
            // Step 2: Appointment Scheduling
            <AppointmentScheduler
              doctorId={selectedDoctor}
              onAppointmentSelected={handleAppointmentSelected}
              onBack={() => setCurrentStep(1)}
            />
          ) : currentStep === 3 ? (
            // Step 3: Pre-consultation Form
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Pre-Consultation Form</h1>
                <p className="text-gray-600">Please fill out this form to help your doctor prepare for your appointment.</p>
              </div>

              <form className="space-y-8">
                {/* Chief Complaint */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2 text-blue-600" />
                    Chief Complaint
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">What is your main concern today? *</label>
                    <textarea
                      name="chiefComplaint"
                      value={formData.chiefComplaint}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe your main symptoms or concerns..."
                      required
                    />
                  </div>
                </div>

                {/* How Long */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-orange-600" />
                    How Long?
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">How long have you had these symptoms?</label>
                    <select
                      name="symptomDuration"
                      value={formData.symptomDuration}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select duration</option>
                      <option value="less-than-day">Less than a day</option>
                      <option value="1-3-days">1-3 days</option>
                      <option value="1-week">About a week</option>
                      <option value="2-4-weeks">2-4 weeks</option>
                      <option value="1-3-months">1-3 months</option>
                      <option value="more-than-3-months">More than 3 months</option>
                    </select>
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-red-600" />
                    Severity
                  </h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">How severe are your symptoms? (1-5)</label>
                    <select
                      name="severityLevel"
                      value={formData.severityLevel}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>Select severity</option>
                      <option value={1}>1 - Mild</option>
                      <option value={2}>2 - Slight</option>
                      <option value={3}>3 - Moderate</option>
                      <option value={4}>4 - Severe</option>
                      <option value={5}>5 - Very Severe</option>
                    </select>
                  </div>
                </div>

                {/* Current Symptoms */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-green-600" />
                    Current Symptoms
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select your current symptoms:</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {commonSymptoms.map((symptom) => (
                          <label key={symptom} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.symptoms.includes(symptom)}
                              onChange={() => handleSymptomToggle(symptom)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{symptom}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Other symptoms not listed above:</label>
                      <textarea
                        name="additionalSymptoms"
                        value={formData.additionalSymptoms}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe any other symptoms you're experiencing..."
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                    <Heart className="h-5 w-5 mr-2 text-red-600" />
                    Medical Information
                  </h2>
                  <div className="space-y-6">
                    {/* Allergies */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Any allergies?</label>
                      <textarea
                        name="allergies"
                        value={formData.allergies}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="List your allergies and reactions (if any)..."
                      />
                    </div>

                    {/* Medications */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Any medications?</label>
                      <textarea
                        name="medications"
                        value={formData.medications}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="List all current medications, dosages, and frequency (if any)..."
                      />
                    </div>

                    {/* Chronic Conditions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Any chronic medical conditions?</label>
                      <textarea
                        name="chronicConditions"
                        value={formData.chronicConditions}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="List chronic conditions like diabetes, hypertension, etc. (if any)..."
                      />
                    </div>
                  </div>
                </div>

                {/* Next and Back Buttons */}
                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-300 transition-all duration-300 font-semibold flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={formData.chiefComplaint ? handleNext : undefined}
                    className={`bg-gradient-to-r from-blue-500 to-teal-500 text-white px-8 py-3 rounded-xl transition-all duration-300 font-semibold flex items-center space-x-2 ${!formData.chiefComplaint ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-teal-600'}`}
                    disabled={!formData.chiefComplaint}
                  >
                    <span>Next: Upload Documents</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // Step 4: Document Upload
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Upload Medical Documents</h1>
                <p className="text-gray-600">Upload any relevant medical documents to help your doctor prepare for your appointment.</p>
              </div>

              {/* Upload Area */}
              <div className="mb-8">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors duration-200">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Upload Documents</h3>
                  <p className="text-gray-600 mb-4">
                    Drag and drop files here, or click to select files
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-pointer inline-block"
                  >
                    Select Files
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB each)
                  </p>
                </div>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Documents</h3>
                  <div className="space-y-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-800">{file.name}</p>
                            <p className="text-sm text-gray-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {file.name.toLowerCase().endsWith('.pdf') && file.url && (
                            <button
                              onClick={() => { if (file.url) setSelectedPdf(file.url); }}
                              className="text-blue-600 hover:text-blue-800 underline text-sm"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-700 transition-colors duration-200"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedPdf && (
                    <div className="mt-6 border rounded-lg overflow-hidden" style={{height: '600px'}}>
                      <iframe
                        src={selectedPdf + '#toolbar=0&navpanes=0&scrollbar=0'}
                        title="PDF Preview"
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Document Types Suggestion */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-blue-800 mb-3">Helpful Document Types to Upload:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-700">
                  <div>• Lab reports and test results</div>
                  <div>• Previous prescriptions</div>
                  <div>• Imaging reports (X-rays, MRI, CT scans)</div>
                  <div>• Discharge summaries</div>
                  <div>• Specialist consultation notes</div>
                  <div>• Vaccination records</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-300 transition-all duration-300 font-semibold flex items-center space-x-2"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleSubmit}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-300 font-semibold flex items-center space-x-2"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientViewPage;