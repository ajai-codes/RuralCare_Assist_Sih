import type { ClinicalCase, PrescriptionItem, TriageLevel, PharmacyPrepStatus } from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

export const api = {
  // Fetch cases from database (optionally scoped to a specific patient)
  getCases: async (patientId?: string): Promise<ClinicalCase[]> => {
    const url = patientId ? `${BASE_URL}/cases?patient_id=${encodeURIComponent(patientId)}` : `${BASE_URL}/cases`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch cases: ${res.statusText}`);
    }
    return res.json();
  },

  // Fetch a single case by ID
  getCase: async (caseId: string): Promise<ClinicalCase> => {
    const res = await fetch(`${BASE_URL}/cases/${caseId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch case ${caseId}: ${res.statusText}`);
    }
    return res.json();
  },

  // 1. Upload Audio Blob to Supabase Storage via backend
  uploadAudio: async (caseId: string, audioBlob: Blob): Promise<{ audio_path: string; filename: string }> => {
    const filename = 'recording.webm';
    const formData = new FormData();
    formData.append('case_id', caseId);
    formData.append('file', audioBlob, filename);

    const res = await fetch(`${BASE_URL}/voice/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Failed to upload audio: ${res.statusText}`);
    }
    return res.json();
  },

  // 2. Transcribe Audio using Whisper model
  transcribeAudio: async (
    caseId: string,
    audioPath: string,
    overrideTranscript?: string
  ): Promise<{ transcript: string; detected_language: string }> => {
    const payload: any = {
      case_id: caseId,
      audio_path: audioPath,
    };
    if (overrideTranscript) {
      payload.override_transcript = overrideTranscript;
    }

    const res = await fetch(`${BASE_URL}/voice/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to transcribe audio: ${res.statusText}`);
    }
    return res.json();
  },

  // 3. Register Patient, Create Case, and Run Ollama/Qwen Analysis
  analyzeCase: async (
    caseId: string,
    patientProfile: {
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
    },
    transcript: string,
    channel: string = 'voice_web',
    callerPhone?: string,
    locationText?: string,
    locationSource?: string,
    languageCode?: string
  ): Promise<ClinicalCase> => {
    // 1. Create/update patient profile
    const patientRes = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientProfile.patientId,
        name: patientProfile.name,
        age: patientProfile.age,
        gender: patientProfile.gender,
        phone: patientProfile.phone,
        address: patientProfile.address,
        emergency_contact: patientProfile.emergencyContact,
        allergies: patientProfile.allergies,
        medical_history: patientProfile.medicalHistory,
        current_medications: patientProfile.currentMedications,
      }),
    });
    if (!patientRes.ok) {
      throw new Error('Failed to register patient profile');
    }

    // 2. Create a new case specifying the case_id
    const caseRes = await fetch(`${BASE_URL}/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        case_id: caseId,
        patient_id: patientProfile.patientId,
        main_complaint: transcript,
        status: 'VOICE_SUBMITTED',
        channel,
        caller_phone: callerPhone,
        location_text: locationText,
        location_source: locationSource,
        language_code: languageCode
      }),
    });
    if (!caseRes.ok) {
      throw new Error('Failed to create case');
    }

    // 3. Run AI clinical extraction
    const extractRes = await fetch(`${BASE_URL}/ai/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId }),
    });
    if (!extractRes.ok) {
      throw new Error('Failed to run AI clinical extraction');
    }

    // 4. Run AI triage recommendation
    const triageRes = await fetch(`${BASE_URL}/ai/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_id: caseId }),
    });
    if (!triageRes.ok) {
      throw new Error('Failed to determine AI triage priority');
    }

    // 5. Fetch fully compiled clinical case details
    return api.getCase(caseId);
  },

  // Backward compatibility convenience helper
  createCaseFromVoice: async (
    transcript: string,
    detectedLang: string,
    patientProfile: any,
    audioBlob?: Blob
  ): Promise<ClinicalCase> => {
    console.log('Fallback voice pipeline. Language detected:', detectedLang);
    const caseId = `RT-${Math.floor(10000 + Math.random() * 90000)}`;
    let audioPath = '';
    
    if (audioBlob) {
      const upload = await api.uploadAudio(caseId, audioBlob);
      audioPath = upload.audio_path;
    } else {
      const dummyBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);
      const dummyBlob = new Blob([dummyBytes], { type: 'audio/wav' });
      const upload = await api.uploadAudio(caseId, dummyBlob);
      audioPath = upload.audio_path;
    }

    await api.transcribeAudio(caseId, audioPath, audioBlob ? undefined : transcript);
    return api.analyzeCase(caseId, patientProfile, transcript);
  },

  // Save Doctor Verification and prescription approval
  approvePrescription: async (
    caseId: string,
    payload: {
      triagePriority: TriageLevel;
      assignedDepartment: string;
      observations: string;
      doctorName: string;
      prescriptionItems: PrescriptionItem[];
      followUpDate?: string;
    }
  ): Promise<Partial<ClinicalCase>> => {
    // 1. Submit Doctor Review overrides
    const reviewRes = await fetch(`${BASE_URL}/doctor/cases/${caseId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_name: payload.doctorName,
        doctor_registration_id: 'REG-87421',
        clinical_observations: payload.observations,
        final_priority: payload.triagePriority,
        department: payload.assignedDepartment,
      }),
    });
    if (!reviewRes.ok) {
      throw new Error('Failed to save doctor review details');
    }

    // 2. Create Prescription draft
    const prescriptionRes = await fetch(`${BASE_URL}/doctor/cases/${caseId}/prescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_name: payload.doctorName,
        doctor_registration_id: 'REG-87421',
        clinical_assessment: payload.observations || 'ACS Verified Assessment',
        prescriptionItems: payload.prescriptionItems,
        instructions: payload.observations,
        follow_up_date: payload.followUpDate || '',
      }),
    });
    if (!prescriptionRes.ok) {
      throw new Error('Failed to create prescription draft');
    }
    const newPrescription = await prescriptionRes.json();

    // 3. Approve Prescription via transaction workflow
    const approveRes = await fetch(`${BASE_URL}/doctor/prescriptions/${newPrescription.id}/approve`, {
      method: 'POST',
    });
    if (!approveRes.ok) {
      throw new Error('Failed to approve prescription');
    }

    return approveRes.json();
  },

  // Update Pharmacy Order Status
  updatePharmacyStatus: async (caseId: string, status: PharmacyPrepStatus): Promise<void> => {
    const res = await fetch(`${BASE_URL}/pharmacy/orders/${caseId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: status.toUpperCase(),
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update pharmacy status for ${caseId}: ${res.statusText}`);
    }
  },

  // Update Case Status
  updateCaseStatus: async (caseId: string, status: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/cases/${caseId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update case status for ${caseId}: ${res.statusText}`);
    }
  },

  // Update Triage Details
  updateTriage: async (caseId: string, priority: string, department: string): Promise<void> => {
    const res = await fetch(`${BASE_URL}/doctor/cases/${caseId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_name: "Dr. Ramesh Kumar",
        doctor_registration_id: 'REG-87421',
        clinical_observations: "Triage details updated by medical officer.",
        final_priority: priority,
        department: department,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update triage: ${res.statusText}`);
    }
  },

  // Fetch IVR Configuration from backend
  getIvrConfig: async (): Promise<{ ivr_mode: string; demo_patient_phone: string }> => {
    const res = await fetch(`${BASE_URL}/ivr/config`);
    if (!res.ok) {
      throw new Error(`Failed to fetch IVR config: ${res.statusText}`);
    }
    return res.json();
  },

  // Referrals API
  createReferral: async (payload: {
    case_id: string;
    patient_id?: string;
    referring_doctor_name?: string;
    target_facility: string;
    target_department?: string;
    priority?: string;
    reason: string;
    transport_required?: boolean;
    notes?: string;
  }): Promise<any> => {
    const res = await fetch(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create referral: ${res.statusText}`);
    }
    return res.json();
  },

  getReferrals: async (patientId?: string, caseId?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    if (caseId) params.append('case_id', caseId);
    const res = await fetch(`${BASE_URL}/referrals?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to list referrals: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  },

  // High-Risk Follow-Ups API
  createFollowUp: async (payload: {
    case_id: string;
    patient_id?: string;
    doctor_name?: string;
    follow_up_date: string;
    risk_level?: string;
    reason: string;
    notes?: string;
  }): Promise<any> => {
    const res = await fetch(`${BASE_URL}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to schedule follow-up: ${res.statusText}`);
    }
    return res.json();
  },

  getFollowUps: async (patientId?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId);
    const res = await fetch(`${BASE_URL}/follow-ups?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to list follow-ups: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data || [];
  },

  triggerFollowUpReminder: async (followupId: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/follow-ups/${followupId}/trigger-reminder`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to trigger follow-up reminder: ${res.statusText}`);
    }
    return res.json();
  },

  getFollowUpSlip: async (followupId: string, userRole: string = 'patient'): Promise<any> => {
    const res = await fetch(`${BASE_URL}/follow-ups/${followupId}/slip`, {
      headers: { 'x-user-role': userRole }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch follow-up slip: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },

  completeFollowUp: async (followupId: string, notes?: string): Promise<any> => {
    const res = await fetch(`${BASE_URL}/follow-ups/${followupId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    if (!res.ok) {
      throw new Error(`Failed to complete follow-up: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },


  // Longitudinal History API
  getLongitudinalHistory: async (patientId: string, userRole: string = 'doctor', userId?: string): Promise<any> => {
    const headers: Record<string, string> = {
      'x-user-role': userRole,
    };
    if (userId) {
      headers['x-user-id'] = userId;
    }
    const res = await fetch(`${BASE_URL}/patients/${patientId}/history`, { headers });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Forbidden: You are not authorized to view this patient\'s record.');
      }
      throw new Error(`Failed to fetch longitudinal history: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }
};


