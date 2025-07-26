import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Phone, Mail, Calendar, Clock, FileText, AlertTriangle, CheckCircle, Check, LogOut, Menu, Search, Filter, Download, ChevronDown, ChevronUp, Heart, Activity, Scale, Ruler, Wine, Dumbbell, Lock, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AppointmentStatusService } from '../services/AppointmentStatusService';
import { AppointmentCacheService } from '../services/AppointmentCacheService';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// 1. Import ProfileImage at the top
import ProfileImage from '../components/ProfileImage';
// 1. Import VITE_SUPABASE_URL at the top
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  appointmentDate: string;
  appointmentTime: string;
  chiefComplaint: string;
  phone: string;
  email: string;
  status: 'scheduled' | 'in-progress' | 'checked' | 'cancelled';
}

interface PatientDetail {
  // Personal Information
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  profile_image_url?: string;
  
  // Medical History
  family_history: string;
  smoking_status: string;
  tobacco_use: string;
  allergies: string;
  alcohol_consumption: string;
  exercise_frequency: string;
  weight: number;
  height: number;
  bmi: number;
}

interface ComplaintData {
  chiefComplaint: string;
  symptomDuration: string;
  severityLevel: number;
  symptoms: string[];
  additionalSymptoms: string;
  allergies: string;
  medications: string;
  chronicConditions: string;
}

interface PatientDocument {
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

// 2. Add a helper to get the public URL for a file
const getPublicFileUrl = (filePath: string) => {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  return `${supabaseUrl}/storage/v1/object/public/patient-documents/${filePath}`;
};

const DoctorViewPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'patient-detail' | 'complaint' | 'tab3' | 'tab4'>('patient-detail');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [complaintData, setComplaintData] = useState<ComplaintData | null>(null);
  const [patientDocuments, setPatientDocuments] = useState<PatientDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PatientDocument | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    scheduled: true,
    checked: false, // Collapsed by default
    cancelled: true
  });
  const [showLogout, setShowLogout] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Fetch appointments and patients
  const fetchAppointments = async () => {
    await fetchAppointmentsForDate(selectedDate);
  };

  // Fetch appointments for a specific date
  const fetchAppointmentsForDate = async (date: Date) => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Create date range for the selected date (start and end of day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Debug: Log the date range and user ID
      console.log('Fetching appointments for date:', date.toISOString());
      console.log('Date range:', { startOfDay: startOfDay.toISOString(), endOfDay: endOfDay.toISOString() });
      console.log('Doctor ID:', user.id);

      // Fetch appointments for this doctor on the specific date
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*, consultations!appointments_consultation_id_fkey(*)')
        .eq('doctor_id', user.id)
        .gte('appointment_datetime', startOfDay.toISOString())
        .lte('appointment_datetime', endOfDay.toISOString())
        .order('appointment_datetime', { ascending: true });

      if (appointmentsError) {
        console.error('Error fetching appointments:', appointmentsError);
        return;
      }

      console.log('Appointments found:', appointmentsData?.length || 0);
      console.log('Appointments data:', appointmentsData);

      const appointments = appointmentsData || [];

      // Fetch patient profiles
      if (appointments.length > 0) {
        const patientIds = [...new Set(appointments.map((apt: any) => apt.patient_id))];
        const { data: patientProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, phone, email, date_of_birth, gender, profile_image_url')
          .in('id', patientIds);

        if (profilesError) {
          console.error('Error fetching patient profiles:', profilesError);
        } else {
          const profilesMap = Object.fromEntries((patientProfiles || []).map((profile: any) => [profile.id, profile]));
          
          // Transform appointments to patients
          const transformedPatients: Patient[] = appointments.map((apt: any) => {
            const patientProfile = profilesMap[apt.patient_id] || {};
            const appointmentDate = new Date(apt.appointment_datetime);
            
            // Calculate age
            let age = 0;
            if (patientProfile?.date_of_birth) {
              const birthDate = new Date(patientProfile.date_of_birth);
              age = new Date().getFullYear() - birthDate.getFullYear();
              const monthDiff = new Date().getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && new Date().getDate() < birthDate.getDate())) {
                age--;
              }
            }

            // Extract consultation data robustly
            let chiefComplaint = '';
            let consultation = apt.consultations;
            // Debug: log the consultation structure
            console.log('Consultation for appointment', apt.id, consultation);
            if (Array.isArray(consultation) && consultation.length > 0) {
              const formData = consultation[0]?.form_data || {};
              chiefComplaint = formData.cheifcomplaint || formData.chiefComplaint || '';
            } else if (consultation && typeof consultation === 'object') {
              const formData = consultation.form_data || {};
              chiefComplaint = formData.cheifcomplaint || formData.chiefComplaint || '';
            }
            if (!chiefComplaint && apt.notes) chiefComplaint = apt.notes;

            return {
              id: apt.id,
              name: patientProfile?.full_name || `${patientProfile?.first_name || ''} ${patientProfile?.last_name || ''}`.trim() || 'Unknown Patient',
              age: age,
              gender: patientProfile?.gender || '',
              appointmentDate: appointmentDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }),
              appointmentTime: appointmentDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              }),
              chiefComplaint: chiefComplaint,
              phone: patientProfile?.phone || '',
              email: patientProfile?.email || '',
              status: apt.status || 'scheduled'
            };
          });

          setPatients(transformedPatients);
        }
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch patient details when a patient is selected
  const fetchPatientDetails = async (appointmentId: string) => {
    try {
      // Get the appointment to find patient_id and consultation_id
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('*, consultations!appointments_consultation_id_fkey(*)')
        .eq('id', appointmentId)
        .single();

      if (appointmentError || !appointment) {
        console.error('Error fetching appointment:', appointmentError);
        return;
      }

      console.log('Appointment data:', appointment);

      // Fetch patient profile (Patient Detail tab)
      const { data: patientProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', appointment.patient_id)
        .single();

      if (profileError) {
        console.error('Error fetching patient profile:', profileError);
      } else {
        setPatientDetail(patientProfile);
      }

      // Extract complaint data from consultation (Complaint tab)
      const consultation = appointment.consultations;
      const formData = consultation?.form_data || {};
      
      const complaint: ComplaintData = {
        chiefComplaint: formData.cheifcomplaint || formData.chiefComplaint || '',
        symptomDuration: formData.symptomDuration || '',
        severityLevel: formData.severityLevel || 0,
        symptoms: formData.symptoms || [],
        additionalSymptoms: formData.additionalSymptoms || '',
        allergies: formData.allergies || '',
        medications: formData.medications || '',
        chronicConditions: formData.chronicConditions || ''
      };

      setComplaintData(complaint);

      // Fetch patient documents
      console.log('Fetching documents for consultation_id:', appointment.consultation_id);
      let documents = null;
      let documentsError = null;

      // Try to fetch by consultation_id first
      if (appointment.consultation_id) {
        const { data, error } = await supabase
          .from('patient_files')
          .select('*')
          .eq('consultation_id', appointment.consultation_id)
          .order('uploaded_at', { ascending: false });
        
        documents = data;
        documentsError = error;
        console.log('Documents query by consultation_id result:', { documents, documentsError });
      }

      // If no documents found by consultation_id, try by patient_id
      if (!documents || documents.length === 0) {
        console.log('No documents found by consultation_id, trying patient_id:', appointment.patient_id);
        const { data, error } = await supabase
          .from('patient_files')
          .select('*')
          .eq('patient_id', appointment.patient_id)
          .order('uploaded_at', { ascending: false });
        
        documents = data;
        documentsError = error;
        console.log('Documents query by patient_id result:', { documents, documentsError });
      }
      
      if (documentsError) {
        console.error('Error fetching patient documents:', documentsError);
      } else {
        console.log('Setting patient documents:', documents);
        setPatientDocuments(documents || []);
        
        // Auto-expand first category and select first document if available
        if (documents && documents.length > 0) {
          const grouped = groupDocumentsByCategory(documents);
          const firstCategory = Object.keys(grouped)[0];
          if (firstCategory) {
            setExpandedCategories({ [firstCategory]: true });
          }
          setSelectedDocument(documents[0]);
        } else {
          setSelectedDocument(null);
          setExpandedCategories({});
        }
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
    }
  };

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
      if (!profile || profile.role !== 'doctor') {
        navigate('/dashboard');
        return;
      }
      setUserName(profile.full_name || '');
      await fetchAppointmentsForDate(selectedDate);
    };
    checkRole();
    testDatabaseConnection();
  }, [navigate]);

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

  useEffect(() => {
    setPdfLoadError(false);
  }, [selectedDocument]);

  const handlePatientClick = async (patientId: string) => {
    setSelectedPatient(patientId);
    setActiveTab('patient-detail'); // Always default to patient detail tab
    await fetchPatientDetails(patientId);
  };

  const handleBack = () => {
    setSelectedPatient(null);
    setPatientDetail(null);
    setComplaintData(null);
    setPatientDocuments([]);
    setSelectedDocument(null);
    setExpandedCategories({});
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleCheckPatient = async (appointmentId: string) => {
    try {
      // Optimistic UI update
      setPatients(prevPatients =>
        prevPatients.map(patient =>
          patient.id === appointmentId
            ? { ...patient, status: 'checked' as const }
            : patient
        )
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use enhanced service to update status directly with appointment ID
      await AppointmentStatusService.updateStatus({
        appointmentId: appointmentId,
        newStatus: 'checked',
        notes: 'Appointment completed by doctor'
      });

      // Invalidate cache for this doctor
      AppointmentCacheService.invalidateDoctorCache(user.id, selectedDate);

      alert('Appointment marked as checked!');
      console.log('Appointment marked as checked!');
    } catch (error) {
      console.error('Error marking appointment as checked:', error);
      alert('Failed to update appointment: ' + (error as Error).message);
      
      // Revert optimistic update
      await fetchAppointmentsForDate(selectedDate);
    }
  };

  const handleCancelPatient = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      // Optimistic UI update
      setPatients(prevPatients =>
        prevPatients.map(patient =>
          patient.id === appointmentId
            ? { ...patient, status: 'cancelled' as const }
            : patient
        )
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use enhanced service to update status directly with appointment ID
      await AppointmentStatusService.updateStatus({
        appointmentId: appointmentId,
        newStatus: 'cancelled',
        reason: 'Cancelled by doctor'
      });

      // Invalidate cache for this doctor
      AppointmentCacheService.invalidateDoctorCache(user.id, selectedDate);

      alert('Appointment cancelled successfully!');
      console.log('Appointment cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment: ' + (error as Error).message);
      
      // Revert optimistic update
      await fetchAppointmentsForDate(selectedDate);
    }
  };

  const toggleSection = (section: 'scheduled' | 'checked' | 'cancelled') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handlePreviousDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const handleToday = () => {
    setSelectedDate(() => {
      const today = new Date();
      return today;
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab_report':
      case 'laboratory':
        return '🧪';
      case 'imaging':
      case 'xray':
      case 'mri':
      case 'ct':
        return '📷';
      case 'prescription':
      case 'medication':
        return '💊';
      case 'medical_record':
      case 'history':
        return '📋';
      case 'insurance':
      case 'billing':
        return '💳';
      default:
        return '📄';
    }
  };

  const getDocumentCategoryName = (category: string) => {
    switch (category.toLowerCase()) {
      case 'lab_report':
      case 'laboratory':
        return 'Lab Reports';
      case 'imaging':
      case 'xray':
      case 'mri':
      case 'ct':
        return 'Imaging';
      case 'prescription':
      case 'medication':
        return 'Prescriptions';
      case 'medical_record':
      case 'history':
        return 'Medical Records';
      case 'insurance':
      case 'billing':
        return 'Insurance & Billing';
      case 'discharge_summary':
        return 'Discharge Summaries';
      case 'medical_document':
        return 'Other Documents';
      default:
        return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const groupDocumentsByCategory = (documents: PatientDocument[]) => {
    const grouped: Record<string, PatientDocument[]> = {};
    
    documents.forEach(doc => {
      const category = doc.file_category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(doc);
    });
    
    return grouped;
  };

  // Test function to check all documents in database
  const testDatabaseConnection = async () => {
    console.log('Testing database connection...');
    const { data: allDocuments, error } = await supabase
      .from('patient_files')
      .select('*')
      .limit(10);
    
    console.log('All documents in database:', allDocuments);
    console.log('Error:', error);
  };

  // Filter patients for search
  const filteredPatients = patients.filter((patient) => {
    const query = searchQuery.toLowerCase();
    return (
      patient.name.toLowerCase().includes(query) ||
      patient.phone.toLowerCase().includes(query) ||
      patient.chiefComplaint.toLowerCase().includes(query)
    );
  });

  // Helper function to sort document categories
  const sortDocumentCategories = (categories: string[]): string[] => {
    const priority = ['prescription', 'lab_report'];
    return categories.sort((a: string, b: string) => {
      const aIndex = priority.indexOf(a.toLowerCase());
      const bIndex = priority.indexOf(b.toLowerCase());
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  // Use useEffect to fetch appointments when selectedDate changes
  useEffect(() => {
    fetchAppointmentsForDate(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  if (selectedPatient) {
    const patient = patients.find(p => p.id === selectedPatient);
    if (!patient) return null;

    const handleDownloadPDF = () => {
      const doc = new jsPDF();

      // Patient Card
      doc.setFontSize(18);
      doc.text('Patient Summary', 14, 16);
      doc.setFontSize(12);
      doc.text(`Name: ${patient.name || ''}`, 14, 28);
      doc.text(`Age: ${patient.age || ''}`, 14, 36);
      doc.text(`Gender: ${patient.gender || ''}`, 60, 36);
      doc.text(`Phone: ${patient.phone || ''}`, 14, 44);
      doc.text(`Appointment Date: ${patient.appointmentDate || ''}`, 14, 52);
      doc.text(`Appointment Time: ${patient.appointmentTime || ''}`, 80, 52);

      let y = 62;

      // Patient Detail Tab
      if (patientDetail) {
        doc.setFontSize(14);
        doc.text('Personal Information', 14, y);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [['Phone', 'Email', 'Date of Birth', 'Gender']],
          body: [[
            patientDetail.phone || '',
            patientDetail.email || '',
            patientDetail.date_of_birth ? new Date(patientDetail.date_of_birth).toLocaleDateString() : '',
            patientDetail.gender || ''
          ]],
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
          styles: { fontSize: 10 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
        doc.setFontSize(12);
        if (patientDetail.family_history) {
          doc.text('Family History:', 14, y);
          doc.setFont('helvetica', 'normal');
          doc.text(patientDetail.family_history, 50, y);
          y += 8;
        }
        if (patientDetail.allergies) {
          doc.text('Allergies:', 14, y);
          doc.text(patientDetail.allergies, 50, y);
          y += 8;
        }
        if (patientDetail.smoking_status) {
          doc.text('Smoking Status:', 14, y);
          doc.text(patientDetail.smoking_status, 50, y);
          y += 8;
        }
        if (patientDetail.alcohol_consumption) {
          doc.text('Alcohol Consumption:', 14, y);
          const splitAlcohol = doc.splitTextToSize(patientDetail.alcohol_consumption, 140);
          doc.text(splitAlcohol, 50, y);
          y += 6 + splitAlcohol.length * 6;
        }
        if (patientDetail.exercise_frequency) {
          doc.text('Exercise Frequency:', 14, y);
          const splitExercise = doc.splitTextToSize(patientDetail.exercise_frequency, 140);
          doc.text(splitExercise, 50, y);
          y += 6 + splitExercise.length * 6;
        }
        if (patientDetail.weight) {
          doc.text('Weight:', 14, y);
          doc.text(String(patientDetail.weight), 50, y);
          y += 8;
        }
        if (patientDetail.height) {
          doc.text('Height:', 14, y);
          doc.text(String(patientDetail.height), 50, y);
          y += 8;
        }
        if (patientDetail.bmi) {
          doc.text('BMI:', 14, y);
          doc.text(String(patientDetail.bmi), 50, y);
          y += 8;
        }
      }

      // Complaint Tab
      if (complaintData) {
        y += 8;
        doc.setFontSize(14);
        doc.text('Complaint', 14, y);
        y += 8;
        doc.setFontSize(12);
        if (complaintData.chiefComplaint) {
          doc.text('Chief Complaint:', 14, y);
          doc.text(complaintData.chiefComplaint, 50, y);
          y += 8;
        }
        if (complaintData.symptomDuration) {
          doc.text('Symptom Duration:', 14, y);
          doc.text(complaintData.symptomDuration, 50, y);
          y += 8;
        }
        if (complaintData.severityLevel) {
          doc.text('Severity Level:', 14, y);
          doc.text(String(complaintData.severityLevel), 50, y);
          y += 8;
        }
        if (complaintData.symptoms && complaintData.symptoms.length > 0) {
          doc.text('Other Symptoms:', 14, y);
          doc.text(complaintData.symptoms.join(', '), 50, y);
          y += 8;
        }
        if (complaintData.additionalSymptoms) {
          doc.text('Additional Symptoms:', 14, y);
          doc.text(complaintData.additionalSymptoms, 50, y);
          y += 8;
        }
        if (complaintData.allergies) {
          doc.text('Allergies:', 14, y);
          doc.text(complaintData.allergies, 50, y);
          y += 8;
        }
        if (complaintData.medications) {
          doc.text('Medications:', 14, y);
          doc.text(complaintData.medications, 50, y);
          y += 8;
        }
        if (complaintData.chronicConditions) {
          doc.text('Chronic Conditions:', 14, y);
          doc.text(complaintData.chronicConditions, 50, y);
          y += 8;
        }
      }

      // AI Summary Tab (Placeholder)
      y += 12;
      doc.setFontSize(14);
      doc.text('AI Summary', 14, y);
      y += 8;
      doc.setFontSize(12);
      doc.text('No AI summary available.', 14, y);

      doc.save(`${patient.name || 'patient'}_summary.pdf`);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Patient List</span>
              </button>
              
              {/* Center: Logo */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <div className="w-32 h-12 rounded-xl overflow-hidden">
                  <img 
                    src="/Picture3.svg" 
                    alt="MedBrief AI Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              
              {/* Right: User icon and dropdown */}
              <div className="flex items-center space-x-3 relative logout-dropdown">
                  <User className={`h-6 w-6 text-blue-600 cursor-pointer transition-all duration-200 ${showLogout ? 'text-blue-700 scale-110' : 'hover:text-blue-700 hover:scale-105'}`} onClick={() => setShowLogout(v => !v)} />
                  {showLogout && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-lg z-50 transform transition-all duration-200 ease-in-out opacity-100 scale-100">
                      <button
                        onClick={() => navigate('/profile')}
                        className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                      >
                        <User className="h-4 w-4 mr-3" /> My Profile
                      </button>
                      <button
                        onClick={() => navigate('/appointment-settings')}
                        className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                      >
                        <Calendar className="h-4 w-4 mr-3" /> Appointment Settings
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

        {/* Patient Details Card with Tabs inside */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-4">
          <div className="rounded-2xl p-8 shadow-sm mt-4 flex flex-col bg-white" style={{ minHeight: '220px', marginBottom: '2px' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-4">
                  {/* 3. In the detailed patient view (selectedPatient block), show the patient's image next to their name */}
                  <ProfileImage imageUrl={patientDetail?.profile_image_url} size="lg" className="border-2 border-blue-200" alt={patient.name} />
                  <h2 className="text-2xl font-bold text-gray-800">{patient.name}</h2>
                </div>
                <div className="flex flex-wrap items-center space-x-4 text-base mt-2 ml-16">
                  <span className="text-gray-600">{patient.age} years, {patient.gender}</span>
                  <span className="text-gray-400">|</span>
                  <span className="flex items-center space-x-1 text-gray-700"><Phone className="h-5 w-5 text-gray-500" /><span>{patient.phone}</span></span>
                  <span className="text-gray-400">|</span>
                  <span className="flex items-center space-x-1 text-gray-700"><Calendar className="h-5 w-5 text-gray-500" /><span>{patient.appointmentDate}</span></span>
                  <span className="text-gray-400">|</span>
                  <span className="flex items-center space-x-1 text-gray-700"><Clock className="h-5 w-5 text-gray-500" /><span>{patient.appointmentTime}</span></span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {patient.status === 'checked' ? (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-green-100 text-green-800 border border-green-200">
                    <CheckCircle className="h-5 w-5 mr-1" />
                    Checked
                  </div>
                ) : patient.status === 'cancelled' ? (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-red-100 text-red-800 border border-red-200">
                    <X className="h-5 w-5 mr-1" />
                    Cancelled
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCancelPatient(patient.id)}
                      className="inline-flex items-center px-4 py-2 rounded-full text-base font-medium bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors duration-200"
                    >
                      <X className="h-5 w-5 mr-1" />
                      Cancel
                    </button>
                    <button
                      onClick={() => handleCheckPatient(patient.id)}
                      className="inline-flex items-center px-4 py-2 rounded-full text-base font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors duration-200"
                    >
                      <Check className="h-5 w-5 mr-1" />
                      Mark as Checked
                    </button>
                  </div>
                )}
                <button
                  onClick={handleDownloadPDF}
                  title="Download PDF"
                  className="ml-2 rounded-full p-3 bg-gradient-to-br from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white shadow-md transition-all duration-200 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4m-8 8h8" /></svg>
                </button>
              </div>
            </div>

            {/* Horizontal Tabs inside the card */}
            <div className="flex space-x-8 border-b border-blue-200 mt-8 bg-transparent">
              <button
                onClick={() => setActiveTab('patient-detail')}
                className={`flex items-center px-6 py-3 text-base font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
                  activeTab === 'patient-detail'
                    ? 'border-blue-600 text-blue-700 bg-blue-50 rounded-t-lg shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-t-lg'
                }`}
              >
                <User className="inline h-5 w-5 mr-2" />
                Patient Detail
              </button>
              <button
                onClick={() => setActiveTab('complaint')}
                className={`flex items-center px-6 py-3 text-base font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
                  activeTab === 'complaint'
                    ? 'border-blue-600 text-blue-700 bg-blue-50 rounded-t-lg shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-t-lg'
                }`}
              >
                <AlertTriangle className="inline h-5 w-5 mr-2" />
                Complaint
              </button>
              <button
                onClick={() => setActiveTab('tab3')}
                className={`flex items-center px-6 py-3 text-base font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
                  activeTab === 'tab3'
                    ? 'border-blue-600 text-blue-700 bg-blue-50 rounded-t-lg shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-t-lg'
                }`}
              >
                <FileText className="inline h-5 w-5 mr-2" />
                Documents
              </button>
              <button
                onClick={() => setActiveTab('tab4')}
                className={`flex items-center px-6 py-3 text-base font-medium border-b-2 transition-colors duration-200 focus:outline-none ${
                  activeTab === 'tab4'
                    ? 'border-blue-600 text-blue-700 bg-blue-50 rounded-t-lg shadow-sm'
                    : 'border-transparent text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-t-lg'
                }`}
              >
                <Activity className="inline h-5 w-5 mr-2" />
                AI Summary
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Tab Panels */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          <div className="p-8">
            {/* Tab Content */}
            {activeTab === 'patient-detail' && patientDetail && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <User className="h-5 w-5 mr-3 text-blue-600" />
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="text-gray-700 font-medium">{patientDetail.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-gray-700 font-medium">{patientDetail.email || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Date of Birth</p>
                        <p className="text-gray-700 font-medium">
                          {patientDetail.date_of_birth 
                            ? new Date(patientDetail.date_of_birth).toLocaleDateString()
                            : 'Not provided'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <User className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Gender</p>
                        <p className="text-gray-700 font-medium">{patientDetail.gender || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <Heart className="h-5 w-5 mr-3 text-red-600" />
                    Medical History
                  </h3>
                  <div className="space-y-4">
                    {patientDetail.family_history && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">Family History</h4>
                        <p className="text-gray-600">{patientDetail.family_history}</p>
                      </div>
                    )}
                    {patientDetail.allergies && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-700 mb-2">Allergies</h4>
                        <p className="text-gray-600">{patientDetail.allergies}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <Activity className="h-5 w-5 mr-3 text-green-600" />
                    Lifestyle Factors
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patientDetail.smoking_status && (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Activity className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Smoking Status</p>
                          <p className="text-gray-700 font-medium">{patientDetail.smoking_status}</p>
                        </div>
                      </div>
                    )}
                    {patientDetail.alcohol_consumption && (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Wine className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Alcohol Consumption</p>
                          <p className="text-gray-700 font-medium">{patientDetail.alcohol_consumption}</p>
                        </div>
                      </div>
                    )}
                    {patientDetail.exercise_frequency && (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Dumbbell className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="text-sm text-gray-500">Exercise Frequency</p>
                          <p className="text-gray-700 font-medium">{patientDetail.exercise_frequency}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(patientDetail.weight || patientDetail.height || patientDetail.bmi) && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                      <Scale className="h-5 w-5 mr-3 text-purple-600" />
                      Physical Measurements
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {patientDetail.weight && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <Scale className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Weight</p>
                            <p className="text-gray-700 font-medium">{patientDetail.weight} kg</p>
                          </div>
                        </div>
                      )}
                      {patientDetail.height && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <Ruler className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Height</p>
                            <p className="text-gray-700 font-medium">{patientDetail.height} cm</p>
                          </div>
                        </div>
                      )}
                      {patientDetail.bmi && (
                        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <Activity className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">BMI</p>
                            <p className="text-gray-700 font-medium">{patientDetail.bmi}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>
              )}

            {activeTab === 'complaint' && complaintData && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-3 text-red-600" />
                    Chief Complaint
                  </h3>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-gray-700 text-lg">{complaintData.chiefComplaint || 'No chief complaint provided'}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <Activity className="h-5 w-5 mr-3 text-orange-600" />
                    Symptom Details
                  </h3>
                  <div className="space-y-6">
                    {complaintData.symptomDuration && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-gray-700 mb-2">Duration</h4>
                        <p className="text-gray-600">{complaintData.symptomDuration}</p>
                      </div>
                    )}
                    {complaintData.severityLevel > 0 && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-gray-700 mb-2">Severity Level</h4>
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`w-4 h-4 rounded-full ${
                                  level <= complaintData.severityLevel
                                    ? 'bg-red-500'
                                    : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600 font-medium">Level {complaintData.severityLevel}/5</span>
                        </div>
                      </div>
                    )}
                    {complaintData.symptoms && complaintData.symptoms.length > 0 && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-gray-700 mb-3">Other Symptoms</h4>
                        <div className="flex flex-wrap gap-2">
                          {complaintData.symptoms.map((symptom, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium"
                            >
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {complaintData.additionalSymptoms && (
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <h4 className="font-medium text-gray-700 mb-2">Additional Symptoms</h4>
                        <p className="text-gray-600">{complaintData.additionalSymptoms}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                    <FileText className="h-5 w-5 mr-3 text-green-600" />
                    Medical Information
                  </h3>
                  <div className="space-y-4">
                    {complaintData.allergies && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-gray-700 mb-2">Allergies</h4>
                        <p className="text-gray-600">{complaintData.allergies}</p>
                      </div>
                    )}
                    {complaintData.medications && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-gray-700 mb-2">Current Medications</h4>
                        <p className="text-gray-600">{complaintData.medications}</p>
                      </div>
                    )}
                    {complaintData.chronicConditions && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-gray-700 mb-2">Chronic Conditions</h4>
                        <p className="text-gray-600">{complaintData.chronicConditions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tab3' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                    <FileText className="h-5 w-5 mr-3 text-blue-600" />
                    Documents ({patientDocuments.length})
                  </h3>
                </div>
                {patientDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <h4 className="text-lg font-semibold text-gray-600 mb-2">No Documents Uploaded</h4>
                    <p className="text-gray-500">Patient has not uploaded any medical documents yet.</p>
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
                      <p>Debug Info:</p>
                      <p>Active Tab: {activeTab}</p>
                      <p>Documents Count: {patientDocuments.length}</p>
                      <p>Selected Document: {selectedDocument ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[600px]">
                    {/* Left Panel - Document List */}
                    <div className="w-1/3 border-r border-gray-200 pr-4">
                      <div className="flex justify-end mb-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              const grouped = groupDocumentsByCategory(patientDocuments);
                              const allExpanded = Object.keys(grouped).reduce((acc, category) => {
                                acc[category] = true;
                                return acc;
                              }, {} as Record<string, boolean>);
                              setExpandedCategories(allExpanded);
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors duration-200"
                          >
                            Expand All
                          </button>
                          <button
                            onClick={() => setExpandedCategories({})}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors duration-200"
                          >
                            Collapse All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[550px] overflow-y-auto">
                        {sortDocumentCategories(Object.keys(groupDocumentsByCategory(patientDocuments))).map((category: string) => {
                          const documents = groupDocumentsByCategory(patientDocuments)[category];
                          return (
                            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => setExpandedCategories(prev => ({
                                  ...prev,
                                  [category]: !prev[category]
                                }))}
                                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between text-left"
                              >
                                <div className="flex items-center space-x-3">
                                  <span className="text-lg">{getDocumentCategoryIcon(category)}</span>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">
                                      {getDocumentCategoryName(category)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {documents.length} document{documents.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                </div>
                                {expandedCategories[category] ? (
                                  <ChevronUp className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                )}
                              </button>
                              
                              {expandedCategories[category] && (
                                <div className="border-t border-gray-200 bg-white">
                                  {documents.map((doc) => (
                                    <div
                                      key={doc.id}
                                      onClick={() => setSelectedDocument(doc)}
                                      className={`p-3 cursor-pointer transition-all duration-200 border-b border-gray-100 last:border-b-0 ${
                                        selectedDocument?.id === doc.id
                                          ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                          : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <div className="flex items-center space-x-3">
                                        <div className="flex-shrink-0">
                                          <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-sm">
                                            {doc.file_type.startsWith('image/') ? '🖼️' : 
                                             doc.file_type === 'application/pdf' ? '📄' : '📎'}
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">
                                            {doc.file_name}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatFileSize(doc.file_size)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Panel - Document Viewer */}
                    <div className="flex-1 pl-4">
                      {selectedDocument ? (
                        <div className="h-full">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-700">
                              {selectedDocument.file_name}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500">
                                {new Date(selectedDocument.uploaded_at).toLocaleString()}
                              </span>
                                                                   <div className="flex items-center space-x-2">
                                 <button
                                   onClick={() => window.open(selectedDocument.file_path, '_blank')}
                                   className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
                                 >
                                   Open in New Tab
                                 </button>
                                 <button
                                   onClick={() => {
                                     const link = document.createElement('a');
                                     link.href = selectedDocument.file_path;
                                     link.download = selectedDocument.file_name;
                                     document.body.appendChild(link);
                                     link.click();
                                     document.body.removeChild(link);
                                   }}
                                   className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200"
                                 >
                                   Download
                                 </button>
                               </div>
                            </div>
                          </div>
                          
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 h-[500px]">
                            {selectedDocument.file_type.startsWith('image/') ? (
                              <div className="h-full flex items-center justify-center bg-white">
                                <img
                                  src={getPublicFileUrl(selectedDocument.file_path)}
                                  alt={selectedDocument.file_name}
                                  className="max-w-full max-h-full object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'flex items-center justify-center h-full text-gray-500';
                                    errorDiv.innerHTML = `
                                      <div class="text-center">
                                        <svg class="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                                        </svg>
                                        <p class="text-sm">Failed to load image</p>
                                      </div>
                                    `;
                                    target.parentNode?.appendChild(errorDiv);
                                  }}
                                />
                              </div>
                            ) : selectedDocument.file_type === 'application/pdf' ? (
                              pdfLoadError ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                  <div className="text-center">
                                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                    <p className="text-sm">File is corrupted or can't be opened.</p>
                                    <p className="text-xs mt-1">Try downloading or opening in a new tab.</p>
                                  </div>
                                </div>
                              ) : (
                                <iframe
                                  src={`${getPublicFileUrl(selectedDocument.file_path)}#toolbar=0&navpanes=0&scrollbar=0`}
                                  className="w-full h-full border-0"
                                  title={selectedDocument.file_name}
                                  onError={() => setPdfLoadError(true)}
                                />
                              )
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-500">
                                <div className="text-center">
                                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                  <p className="text-sm">Preview not available</p>
                                  <p className="text-xs mt-1">Click "Open in New Tab" to view</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Select a document to view</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tab4' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <Activity className="h-5 w-5 mr-3 text-purple-600" />
                  AI Summary
                </h3>
                <div className="text-center py-12">
                  <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h4 className="text-lg font-semibold text-gray-600 mb-2">No Notes Yet</h4>
                  <p className="text-gray-500">Add your clinical notes and observations here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Patient List View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between relative">
            {/* Left: Empty for spacing */}
            <div className="w-32 h-12" />
            {/* Center: Logo */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <div className="w-32 h-12 rounded-xl overflow-hidden">
                <img 
                  src="/Picture3.svg" 
                  alt="MedBrief AI Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            {/* Right: User icon and dropdown */}
            <div className="flex items-center space-x-3 relative logout-dropdown">
              <User className={`h-6 w-6 text-blue-600 cursor-pointer transition-all duration-200 ${showLogout ? 'text-blue-700 scale-110' : 'hover:text-blue-700 hover:scale-105'}`} onClick={() => setShowLogout(v => !v)} />
              {showLogout && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-lg z-50 transform transition-all duration-200 ease-in-out opacity-100 scale-100">
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                  >
                    <User className="h-4 w-4 mr-3" /> My Profile
                  </button>
                  <button
                    onClick={() => navigate('/appointment-settings')}
                    className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors duration-150"
                  >
                    <Calendar className="h-4 w-4 mr-3" /> Appointment Settings
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

      {/* Main Content */}
      <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-1 mt-4">
          <h1 className="text-3xl font-extrabold text-left">
            <span className="text-black">Welcome Dr. </span>
            <span className="bg-gradient-to-r from-blue-500 to-teal-500 bg-clip-text text-transparent animate-shimmer">
              {userName}!
            </span>
          </h1>
        </div>

        {/* Go Today Button */}
        <div className="mb-3 flex justify-end">
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
          >
            Go Today
          </button>
        </div>

        {/* Search and Date Selection */}
        <div className="mb-8 flex gap-4">
          {/* Search Bar - 70% width */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients by name, phone, or complaint..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          {/* Date Selection - 30% width */}
          <div className="w-1/3 relative">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousDay}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-center font-medium"
              >
                {formatDate(selectedDate)}
              </button>
              
              <button
                onClick={handleNextDay}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
              >
                <ArrowRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            {/* Calendar Dropdown */}
            {showCalendar && (
              <div className="absolute left-0 right-0 z-50 mt-2">
                <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-4 max-w-xs mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Select Date</h3>
                    <button
                      onClick={() => setShowCalendar(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setShowCalendar(false);
                        fetchAppointmentsForDate(date);
                      }
                    }}
                    inline
                    calendarStartDay={1}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Popup */}
        {/* The calendar popup is now positioned absolutely below the date selection button */}

        {/* Patient List Section - Only this part shows loading spinner */}
        {loading ? (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-blue-600">Loading patients...</div>
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-gray-500 mb-4">
              <User className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Patients Found</h3>
              <p className="text-gray-500">No appointments have been scheduled yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scheduled Patients Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleSection('scheduled')}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-between hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5" />
                  <span className="text-lg font-semibold">Scheduled Patients</span>
                  <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                    {filteredPatients.filter(p => p.status === 'scheduled' || p.status === 'in-progress').length}
                  </span>
                </div>
                {expandedSections.scheduled ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {expandedSections.scheduled && (
                <div className="p-6 space-y-4">
                  {filteredPatients.filter(p => p.status === 'scheduled' || p.status === 'in-progress').length > 0 ? (
                    filteredPatients.filter(p => p.status === 'scheduled' || p.status === 'in-progress').map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-all duration-300 border-l-4 border-blue-500 cursor-pointer"
                        onClick={() => handlePatientClick(patient.id)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-3">
                              <h3 className="text-lg font-bold text-gray-800">{patient.name}</h3>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelPatient(patient.id);
                                  }}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors duration-200"
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCheckPatient(patient.id);
                                  }}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors duration-200"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Mark as Checked
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>{patient.age} years, {patient.gender}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>{patient.appointmentDate}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>{patient.appointmentTime}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4" />
                                <span>{patient.phone}</span>
                              </div>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg">
                              <span className="text-gray-800 font-medium text-sm">Chief Complaint: </span>
                              <span className="text-blue-700 font-semibold text-base">{patient.chiefComplaint || 'Not provided'}</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 lg:mt-0 lg:ml-6">
                            <button 
                              onClick={() => handlePatientClick(patient.id)}
                              className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-6 py-2 rounded-lg hover:from-blue-600 hover:to-teal-600 transition-all duration-300 font-semibold"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Scheduled Patients</h3>
                      <p className="text-gray-500">No appointments are scheduled or in progress for this date.</p>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Checked Patients Section */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleSection('checked')}
                className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white flex items-center justify-between hover:from-green-600 hover:to-green-700 transition-all duration-200"
              >
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-lg font-semibold">Checked Patients</span>
                  <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                    {filteredPatients.filter(p => p.status === 'checked').length}
                  </span>
                </div>
                {expandedSections.checked ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
              
              {expandedSections.checked && (
                <div className="p-6 space-y-4">
                  {filteredPatients.filter(p => p.status === 'checked').length > 0 ? (
                    filteredPatients.filter(p => p.status === 'checked').map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-all duration-300 border-l-4 border-green-500 cursor-pointer"
                        onClick={() => handlePatientClick(patient.id)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-3">
                              <h3 className="text-lg font-bold text-gray-800">{patient.name}</h3>
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Checked
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>{patient.age} years, {patient.gender}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>{patient.appointmentDate}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>{patient.appointmentTime}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4" />
                                <span>{patient.phone}</span>
                              </div>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg">
                              <span className="text-gray-800 font-medium text-sm">Chief Complaint: </span>
                              <span className="text-blue-700 font-semibold text-base">{patient.chiefComplaint || 'Not provided'}</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 lg:mt-0 lg:ml-6">
                            <button 
                              onClick={() => handlePatientClick(patient.id)}
                              className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-300 font-semibold"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Checked Patients</h3>
                      <p className="text-gray-500">No patients have been marked as checked yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cancelled Patients Section - Only show if there are cancelled patients */}
            {filteredPatients.filter(p => p.status === 'cancelled').length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('cancelled')}
                  className="w-full px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white flex items-center justify-between hover:from-red-600 hover:to-red-700 transition-all duration-200"
                >
                  <div className="flex items-center space-x-3">
                    <X className="h-5 w-5" />
                    <span className="text-lg font-semibold">Cancelled Patients</span>
                    <span className="bg-red-200 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                      {filteredPatients.filter(p => p.status === 'cancelled').length}
                    </span>
                  </div>
                  {expandedSections.cancelled ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              
              {expandedSections.cancelled && (
                <div className="p-6 space-y-4">
                  {filteredPatients.filter(p => p.status === 'cancelled').length > 0 ? (
                    filteredPatients.filter(p => p.status === 'cancelled').map((patient) => (
                      <div
                        key={patient.id}
                        className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-all duration-300 border-l-4 border-red-500 cursor-pointer"
                        onClick={() => handlePatientClick(patient.id)}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-3">
                              <h3 className="text-lg font-bold text-gray-800">{patient.name}</h3>
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                                <X className="h-4 w-4 mr-1" />
                                Cancelled
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>{patient.age} years, {patient.gender}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>{patient.appointmentDate}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>{patient.appointmentTime}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4" />
                                <span>{patient.phone}</span>
                              </div>
                            </div>
                            
                            <div className="bg-white p-3 rounded-lg">
                              <span className="text-gray-800 font-medium text-sm">Chief Complaint: </span>
                              <span className="text-blue-700 font-semibold text-base">{patient.chiefComplaint || 'Not provided'}</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 lg:mt-0 lg:ml-6">
                            <button 
                              onClick={() => handlePatientClick(patient.id)}
                              className="bg-gradient-to-r from-red-500 to-teal-500 text-white px-6 py-2 rounded-lg hover:from-red-600 hover:to-teal-600 transition-all duration-300 font-semibold"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <X className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Cancelled Patients</h3>
                      <p className="text-gray-500">No appointments have been cancelled yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorViewPage; 