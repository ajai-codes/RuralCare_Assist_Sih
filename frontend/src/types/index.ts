export type TriageLevel = 'Emergency' | 'Urgent' | 'Routine';

export type CaseStatus =
  | 'Voice Submitted'
  | 'AI Summary'
  | 'Doctor Review'
  | 'Prescription'
  | 'Hospital Received'
  | 'Queue'
  | 'Pharmacy'
  | 'Dispensed';

export type PharmacyPrepStatus = 'Received' | 'Preparing' | 'Ready' | 'Dispensed';

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dosage: string; // e.g., "500mg"
  frequency: string; // e.g., "Twice daily (1-0-1)"
  duration: string; // e.g., "5 days"
  route: string; // e.g., "Oral"
  instructions: string; // e.g., "Take after food"
}

export interface Patient {
  name: string;
  age: number;
  gender: string;
  phone: string;
  patientId: string;
  address: string;
  emergencyContact: string;
  allergies: string;
  medicalHistory: string;
  currentMedications: string;
}

export interface ClinicalCase {
  id: string; // e.g., "RT-10245"
  patient: Patient;
  language: string; // e.g., "Tamil-English mixed"
  originalTranscript: string;
  
  // AI Extracted Details
  aiClinicalSummary: string;
  aiSymptoms: string[];
  aiDuration: string;
  aiSeverity: 'High' | 'Medium' | 'Low';
  aiConfidence: number; // percentage (e.g. 92)
  aiTriageRecommend: TriageLevel;
  
  // Doctor Verification / Overrides
  triagePriority: TriageLevel;
  assignedDepartment: string;
  observations: string;
  doctorName: string;
  doctorApproved: boolean;
  prescriptionDate?: string;
  prescriptionItems: PrescriptionItem[];
  followUpDate?: string;
  
  // Operational Details
  status: CaseStatus;
  tokenNumber?: string; // e.g., "A-24"
  estimatedWaitingTime?: number; // in minutes
  arrivalTime?: string; // ISO string or time string
  pharmacyStatus?: PharmacyPrepStatus;
  
  // Phone / IVR consultation fields
  channel?: 'voice_web' | 'phone_demo' | 'ivr_demo';
  callerPhone?: string;
  locationText?: string;
  locationSource?: string;
  languageCode?: 'ta' | 'en';
  expiry_date?: string;
}

// ============================================================
// Phase 1: Appointment & Teleconsultation Types
// ============================================================

export type AppointmentStatus = 'Booked' | 'Checked In' | 'Waiting' | 'In Consultation' | 'Completed' | 'No-show' | 'CANCELLED';

export interface Appointment {
  id: string;
  patient_id: string;
  facility_id: string;
  doctor_id?: string;
  department?: string;
  appointment_date: string;
  time_slot: string;
  appointment_type?: 'In-Person' | 'Teleconsultation';
  status: AppointmentStatus;
  triage_priority?: 'Emergency' | 'Urgent' | 'Routine';
  queue_number?: number;
  estimated_wait_minutes?: number;
  case_id?: string;
  notes?: string;
  checked_in_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  patients?: { name: string; patient_id?: string; phone?: string; age?: number; gender?: string };
  profiles?: { full_name: string; role?: string };
}

export type TeleconsultationStatus = 'REQUESTED' | 'SCHEDULED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'Failed';

export interface Teleconsultation {
  id: string;
  appointment_id?: string;
  case_id?: string;
  patient_id: string;
  doctor_id?: string;
  facility_id?: string;
  room_id?: string;
  status: TeleconsultationStatus;
  consultation_notes?: string;
  duration_seconds?: number;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  patients?: { name: string; patient_id?: string; phone?: string; age?: number; gender?: string };
  profiles?: { full_name: string; role?: string };
}


