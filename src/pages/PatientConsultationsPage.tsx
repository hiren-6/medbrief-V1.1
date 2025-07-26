import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, ChevronDown, ChevronUp, Plus, Lock, FileText, Download, Calendar, Phone, Mail, AlertCircle, Pill, Activity, Brain, Heart, Clock, Bell } from 'lucide-react';
import { useScrollToTop } from '../hooks/useScrollToTop';
import ProfileImage from '../components/ProfileImage';
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

interface Consultation {
  id: string;
  doctor_id: string;
  form_data: any;
  created_at: string;
  doctor?: { full_name: string; doctor_speciality: string; profile_image_url?: string };
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_datetime: string;
  status: string;
  consultation_id: string;
}

interface PatientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_category: string;
  uploaded_at: string;
  processed_by_ai: boolean;
  ai_summary?: string;
}

const PatientConsultationsPage: React.FC = () => {
  // Scroll to top on page load
  useScrollToTop();
  
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [appointments, setAppointments] = useState<Record<string, Appointment>>({});
  const [patientFiles, setPatientFiles] = useState<Record<string, PatientFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState<string>('');
  const [userName, setUserName] = useState('');
  const [showLogout, setShowLogout] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  // Close dropdown on outside click
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

  useEffect(() => {
    const fetchConsultations = async () => {
      setLoading(true);
      setError('');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not logged in.');
        setLoading(false);
        return;
      }
      setPatientId(user.id);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setUserName(profile?.full_name || '');
      
      // Fetch consultations
      const { data, error } = await supabase
        .from('consultations')
        .select('id, doctor_id, form_data, created_at')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        setError('Failed to fetch consultations: ' + error.message);
        setLoading(false);
        return;
      }
      
      // Fetch doctor info
      const doctorIds = Array.from(new Set((data || []).map((c: any) => c.doctor_id)));
      let doctorsMap: Record<string, { full_name: string; doctor_speciality: string; profile_image_url?: string }> = {};
      if (doctorIds.length > 0) {
        const { data: doctors } = await supabase
          .from('profiles')
          .select('id, full_name, doctor_speciality, profile_image_url')
          .in('id', doctorIds);
        if (doctors) {
          doctorsMap = Object.fromEntries(doctors.map((d: any) => [d.id, { full_name: d.full_name, doctor_speciality: d.doctor_speciality, profile_image_url: d.profile_image_url }]));
        }
      }
      
      const consultationsWithDoctor = (data || []).map((c: any) => ({
        ...c,
        doctor: doctorsMap[c.doctor_id] || { full_name: 'Unknown', doctor_speciality: '' },
      }));
      // Fetch appointments for each consultation
      const appointmentsMap: Record<string, Appointment> = {};
      for (const consultation of consultationsWithDoctor) {
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select('*')
          .eq('consultation_id', consultation.id)
          .single();
        if (appointmentData) {
          appointmentsMap[consultation.id] = appointmentData;
        }
      }
      setAppointments(appointmentsMap);
      
      // Sort consultations by appointment datetime (earliest first)
      const consultationsWithAppointments = consultationsWithDoctor.filter(consultation => 
        appointmentsMap[consultation.id]
      );
      
      consultationsWithAppointments.sort((a, b) => {
        const appointmentA = appointmentsMap[a.id];
        const appointmentB = appointmentsMap[b.id];
        
        if (!appointmentA || !appointmentB) return 0;
        
        const dateA = new Date(appointmentA.appointment_datetime);
        const dateB = new Date(appointmentB.appointment_datetime);
        
        return dateA.getTime() - dateB.getTime(); // Ascending order (earliest first)
      });
      
      setConsultations(consultationsWithAppointments);
      
      // Fetch files for each consultation
      const filesMap: Record<string, PatientFile[]> = {};
      for (const consultation of consultationsWithDoctor) {
        const { data: files } = await supabase
          .from('patient_files')
          .select('*')
          .eq('consultation_id', consultation.id)
          .order('uploaded_at', { ascending: false });
        filesMap[consultation.id] = files || [];
      }
      setPatientFiles(filesMap);
      
      setLoading(false);
      if ((data || []).length === 0) {
        navigate('/pre-consult');
      }
    };
    fetchConsultations();
  }, [navigate]);

  useEffect(() => {
    let subscription: any;
    const setupRealtimeNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Initial fetch: only unread notifications
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });
      if (!error && data) setNotifications(data);
      // Subscribe to real-time notifications
      subscription = supabase
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
            if (payload.new && payload.new.read === false) {
              setNotifications((prev: any[]) => [payload.new, ...prev]);
            }
          }
        )
        .subscribe();
    };
    setupRealtimeNotifications();
    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const downloadFile = async (file: PatientFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('patient-documents')
        .download(file.file_path);
      
      if (error) {
        console.error('Download error:', error);
        return;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // Helper function to get filled form data (essential medical data only)
  const getFilledFormData = (formData: any) => {
    const filled: Record<string, any> = {};
    
    // Essential Medical Information Only (in order of importance)
    if (formData.chiefComplaint) filled.chiefComplaint = formData.chiefComplaint;
    if (formData.symptomDuration) filled.symptomDuration = formData.symptomDuration;
    if (formData.severityLevel && formData.severityLevel > 0) filled.severityLevel = formData.severityLevel;
    if (formData.symptoms && formData.symptoms.length > 0) filled.symptoms = formData.symptoms;
    if (formData.additionalSymptoms) filled.additionalSymptoms = formData.additionalSymptoms;
    if (formData.allergies) filled.allergies = formData.allergies;
    if (formData.medications) filled.medications = formData.medications;
    if (formData.chronicConditions) filled.chronicConditions = formData.chronicConditions;
    
    return filled;
  };

  // Helper function to format field names (essential medical data only)
  const formatFieldName = (key: string): string => {
    const fieldMappings: Record<string, string> = {
      chiefComplaint: 'Chief Complaint',
      symptomDuration: 'How Long?',
      severityLevel: 'Severity',
      symptoms: 'Current Symptoms',
      additionalSymptoms: 'Other Symptoms',
      allergies: 'Allergies',
      medications: 'Medications',
      chronicConditions: 'Chronic Conditions'
    };
    
    return fieldMappings[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  // Helper function to format field values
  const formatFieldValue = (key: string, value: any): string => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (key === 'severityLevel') {
      return `${value}/5`;
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return value?.toString() || '';
  };

  // Helper function to get icon for field category (essential medical data only)
  const getFieldIcon = (key: string) => {
    const iconMappings: Record<string, any> = {
      chiefComplaint: AlertCircle,
      symptomDuration: Clock,
      severityLevel: Activity,
      symptoms: Activity,
      additionalSymptoms: Brain,
      allergies: AlertCircle,
      medications: Pill,
      chronicConditions: Heart
    };
    
    return iconMappings[key] || AlertCircle;
  };

  // Helper function to get file category icon
  const getFileCategoryIcon = (category: string) => {
    const iconMappings: Record<string, any> = {
      lab_report: Activity,
      prescription: Pill,
      imaging: Brain,
      discharge_summary: FileText,
      medical_document: FileText
    };
    
    return iconMappings[category] || FileText;
  };

  // Helper function to format appointment date and time
  const formatAppointmentDateTime = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.appointment_datetime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dateDisplay = '';
    if (appointmentDate.toDateString() === today.toDateString()) {
      dateDisplay = 'Today';
    } else if (appointmentDate.toDateString() === tomorrow.toDateString()) {
      dateDisplay = 'Tomorrow';
    } else {
      dateDisplay = appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    const timeDisplay = appointmentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return { dateDisplay, timeDisplay };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 py-8">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {/* Empty div for spacing */}
          </div>
          
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

      <div className="pt-20 max-w-4xl mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">
              <span className="text-black">Welcome, </span>
              <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent animate-shimmer">
                {userName}!
              </span>
            </h1>
            <h2 className="text-base text-gray-500 font-semibold mt-1">My Appointments</h2>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notification Bell Button */}
            <div className="relative">
              <button
                className="group relative bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-full p-3 transition-all duration-300 shadow-lg hover:shadow-xl"
                onClick={() => setShowNotifications(v => !v)}
                title="Notifications"
                style={{ height: '48px', width: '48px', minWidth: '48px', minHeight: '48px' }}
              >
                <Bell className="h-6 w-6" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold z-10">
                    {notifications.length}
                  </span>
                )}
              </button>
              <NotificationDropdown
                notifications={notifications}
                show={showNotifications}
                onClose={() => setShowNotifications(false)}
                onNotificationClick={async (id) => {
                  await supabase.from('notifications').update({ read: true }).eq('id', id);
                  setNotifications(prev => prev.filter(n => n.id !== id));
                }}
              />
            </div>
            {/* Book Appointment Button */}
            <button
              className="group bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl"
              style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', padding: 0 }}
              onClick={() => navigate('/pre-consult')}
              title="Book Appointment"
            >
              <Plus className="h-6 w-6" />
              <span className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 px-3 py-1 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-50">
                Book Appointment
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">{error}</div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">No appointments found.</div>
            <button
              onClick={() => navigate('/pre-consult')}
              className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300"
            >
              Book Your First Appointment
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {consultations.map((consultation, idx) => {
              const filledData = getFilledFormData(consultation.form_data || {});
              const files = patientFiles[consultation.id] || [];
              const appointment = appointments[consultation.id];
              const { dateDisplay, timeDisplay } = appointment ? formatAppointmentDateTime(appointment) : { dateDisplay: '', timeDisplay: '' };
              
              return (
                <div key={consultation.id} className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between p-6 focus:outline-none hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                    aria-expanded={openIndex === idx}
                  >
                    <div className="flex items-center space-x-4">
                      <ProfileImage imageUrl={consultation.doctor?.profile_image_url} size="lg" className="border-2 border-blue-200" alt={`Dr. ${consultation.doctor?.full_name}`} />
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-gray-800">
                          Dr. {consultation.doctor?.full_name}
                        </h3>
                        <p className="text-blue-600 font-medium">
                          {formatSpecialtyDisplay(consultation.doctor?.doctor_speciality || '')}
                        </p>
                        {appointment && (
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="flex items-center space-x-1 text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm font-medium">{dateDisplay} at {timeDisplay}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                              appointment.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' :
                              appointment.status === 'checked' ? 'bg-green-100 text-green-700' :
                              appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {files.length > 0 && (
                        <div className="flex items-center space-x-1 text-blue-600">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <span className="text-blue-600">
                        {openIndex === idx ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
                      </span>
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {openIndex === idx && (
                    <div className="border-t border-gray-100 p-6 space-y-6">
                      {/* Booking Information */}
                      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                          Booking Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-semibold text-gray-700">Booked on:</span>
                            <span className="ml-2 text-gray-600">
                              {new Date(consultation.created_at).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {appointment && (
                            <div>
                              <span className="font-semibold text-gray-700">Appointment:</span>
                              <span className="ml-2 text-gray-600">
                                {new Date(appointment.appointment_datetime).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })} at {new Date(appointment.appointment_datetime).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Filled Form Data */}
                      {Object.keys(filledData).length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <AlertCircle className="h-5 w-5 mr-2 text-blue-600" />
                            Pre-Consultation Information
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(filledData).map(([key, value]) => {
                              const Icon = getFieldIcon(key);
                              return (
                                <div key={key} className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl p-4 border border-blue-100">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <Icon className="h-5 w-5 text-blue-600" />
                                    <span className="font-semibold text-gray-800 text-sm">
                                      {formatFieldName(key)}
                                    </span>
                                  </div>
                                  <p className="text-gray-700 text-sm">
                                    {formatFieldValue(key, value)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Uploaded Files */}
                      {files.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-blue-600" />
                            Uploaded Documents
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {files.map((file) => {
                              const FileIcon = getFileCategoryIcon(file.file_category);
                              return (
                                <div key={file.id} className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-xl p-4 border border-teal-100">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                      <FileIcon className="h-5 w-5 text-teal-600" />
                                      <div>
                                        <p className="font-semibold text-gray-800 text-sm">
                                          {file.file_name}
                                        </p>
                                        <p className="text-xs text-gray-500 capitalize">
                                          {file.file_category.replace('_', ' ')}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => downloadFile(file)}
                                      className="text-teal-600 hover:text-teal-700 transition-colors duration-200"
                                      title="Download file"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                    <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                                  </div>
                                  {file.processed_by_ai && file.ai_summary && (
                                    <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                                      <p className="text-xs text-blue-800">
                                        <strong>AI Summary:</strong> {file.ai_summary}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* No Data Message */}
                      {Object.keys(filledData).length === 0 && files.length === 0 && (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No information or files available for this appointment.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientConsultationsPage; 