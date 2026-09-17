import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ClinicalCase, Patient, TriageLevel, PrescriptionItem, PharmacyPrepStatus, CaseStatus } from '../types';
import { api } from '../services/api';

interface CaseContextType {
  cases: ClinicalCase[];
  activeCaseId: string | null;
  setActiveCaseId: (id: string | null) => void;
  patientProfile: Patient;
  updatePatientProfile: (profile: Partial<Patient>) => void;
  currentRole: 'patient' | 'doctor' | 'pharmacy' | 'phone_demo';
  setCurrentRole: (role: 'patient' | 'doctor' | 'pharmacy' | 'phone_demo') => void;
  createCase: (transcript: string, language: string, audioBlob?: Blob) => Promise<void>;
  updateTriage: (caseId: string, priority: TriageLevel, department: string) => Promise<void>;
  approvePrescription: (
    caseId: string,
    payload: {
      triagePriority: TriageLevel;
      assignedDepartment: string;
      observations: string;
      doctorName: string;
      prescriptionItems: PrescriptionItem[];
      followUpDate?: string;
    }
  ) => Promise<void>;
  updatePharmacyStatus: (caseId: string, status: PharmacyPrepStatus) => Promise<void>;
  refreshCase: (caseId: string) => Promise<void>;
  analyzeCase: (caseId: string, transcript: string, detectedLang: string) => Promise<void>;
  isProcessingVoice: boolean;
  notifications: string[];
  addNotification: (msg: string) => void;
  clearNotifications: () => void;
  setCases: React.Dispatch<React.SetStateAction<ClinicalCase[]>>;
}

const defaultPatientProfile: Patient = {
  name: 'Selva',
  age: 42,
  gender: 'Male',
  phone: '9443218765',
  patientId: 'PA-2410',
  address: '3/142, West Street, Melur Panchayat, Madurai District',
  emergencyContact: 'Meenakshi (Wife) - 9443218766',
  allergies: 'None reported',
  medicalHistory: 'Mild Hypertension diagnosed 2 years ago',
  currentMedications: 'Amlodipine 5mg once daily',
};

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<Patient>(defaultPatientProfile);
  const [currentRole, setCurrentRole] = useState<'patient' | 'doctor' | 'pharmacy' | 'phone_demo'>('patient');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Load cases from backend for currently authenticated patient or role on mount/profile change
  useEffect(() => {
    const loadCases = async () => {
      try {
        const fetchedCases = await api.getCases(currentRole === 'patient' ? patientProfile.patientId : undefined);
        if (fetchedCases) {
          setCases(fetchedCases);
          if (fetchedCases.length > 0) {
            setActiveCaseId(fetchedCases[0].id);
          } else {
            setActiveCaseId(null);
          }
        }
      } catch (e) {
        console.error('Failed to load cases from backend:', e);
        setCases([]);
        setActiveCaseId(null);
      }
    };
    loadCases();
  }, [patientProfile.patientId, currentRole]);

  const addNotification = (msg: string) => {
    setNotifications((prev) => [msg, ...prev].slice(0, 10));
  };

  const clearNotifications = () => setNotifications([]);

  const updatePatientProfile = (profile: Partial<Patient>) => {
    if (profile.patientId && profile.patientId !== patientProfile.patientId) {
      setCases([]);
      setActiveCaseId(null);
    }
    setPatientProfile((prev) => ({ ...prev, ...profile }));
  };

  // 1. Patient consults via voice
  const createCase = async (transcript: string, language: string, audioBlob?: Blob) => {
    setIsProcessingVoice(true);
    addNotification('AI Pipeline: Transcribing audio and extracting clinical markers...');
    
    try {
      const newCase = await api.createCaseFromVoice(transcript, language, patientProfile, audioBlob);
      setCases((prev) => [newCase, ...prev]);
      setActiveCaseId(newCase.id);
      addNotification(`Case ${newCase.id} created. AI Triage recommendation: ${newCase.aiTriageRecommend}.`);
    } catch (e) {
      console.error('Error creating case', e);
      addNotification('Error: Failed to process voice consultation.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // 2. Doctor triage modification (before prescription approval)
  const updateTriage = async (caseId: string, priority: TriageLevel, department: string) => {
    try {
      await api.updateTriage(caseId, priority, department);
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                triagePriority: priority,
                assignedDepartment: department,
                status: c.status === 'Voice Submitted' || c.status === 'AI Summary' ? 'Doctor Review' : c.status,
              }
            : c
        )
      );
      addNotification(`Case ${caseId} triage details updated by medical officer.`);
    } catch (e) {
      console.error('Failed to update triage details on backend:', e);
      addNotification('Error: Failed to save triage details on server.');
    }
  };

  // 3. Doctor prescribes & approves
  const approvePrescription = async (
    caseId: string,
    payload: {
      triagePriority: TriageLevel;
      assignedDepartment: string;
      observations: string;
      doctorName: string;
      prescriptionItems: PrescriptionItem[];
      followUpDate?: string;
    }
  ) => {
    try {
      const updates = await api.approvePrescription(caseId, payload);
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, ...updates } : c))
      );
      addNotification(`Prescription for ${caseId} approved by Dr. ${payload.doctorName} and sent to Pharmacy.`);
    } catch (e) {
      console.error('Error approving prescription', e);
      addNotification('Error: Failed to approve prescription.');
    }
  };

  // 4. Pharmacy modifies preparation state
  const updatePharmacyStatus = async (caseId: string, status: PharmacyPrepStatus) => {
    try {
      await api.updatePharmacyStatus(caseId, status);
      
      setCases((prev) =>
        prev.map((c) => {
          if (c.id === caseId) {
            const newStatus: CaseStatus = status === 'Dispensed' ? 'Dispensed' : 'Pharmacy';
            
            // If queue is advancing, decrease estimated wait times for other patients
            if (status === 'Dispensed' && c.tokenNumber) {
              addNotification(`Case ${caseId} medicines dispensed.`);
            } else {
              addNotification(`Case ${caseId} pharmacy state updated: ${status}.`);
            }

            return {
              ...c,
              pharmacyStatus: status,
              status: newStatus,
              estimatedWaitingTime: status === 'Ready' ? 0 : status === 'Dispensed' ? undefined : c.estimatedWaitingTime,
            };
          }
          return c;
        })
      );

      // If a case is completed/dispensed, let's decrease the waiting time of other en-route / waiting patients in queue
      if (status === 'Dispensed') {
        setCases((prev) =>
          prev.map((c) => {
            if (c.status === 'Pharmacy' && c.estimatedWaitingTime && c.estimatedWaitingTime > 2) {
              return {
                ...c,
                estimatedWaitingTime: Math.max(2, c.estimatedWaitingTime - 5),
              };
            }
            return c;
          })
        );
      }
    } catch (e) {
      console.error('Failed to update pharmacy status:', e);
      addNotification('Error: Failed to update pharmacy status in database.');
    }
  };

  const refreshCase = async (caseId: string) => {
    try {
      const updatedCase = await api.getCase(caseId);
      setCases((prev) => {
        const exists = prev.some((c) => c.id === caseId);
        if (exists) {
          return prev.map((c) => (c.id === caseId ? updatedCase : c));
        } else {
          return [updatedCase, ...prev];
        }
      });
    } catch (e) {
      console.error(`Failed to refresh case ${caseId}:`, e);
    }
  };

  const analyzeCase = async (caseId: string, transcript: string, detectedLang: string) => {
    setIsProcessingVoice(true);
    console.log(`Analyzing case ${caseId} with detected language: ${detectedLang}`);
    addNotification('AI Pipeline: Running clinical marker extraction and preliminary triage...');
    try {
      const newCase = await api.analyzeCase(caseId, patientProfile, transcript);
      setCases((prev) => [newCase, ...prev]);
      setActiveCaseId(newCase.id);
      addNotification(`Case ${newCase.id} successfully analyzed. Priority recommended: ${newCase.aiTriageRecommend}.`);
    } catch (e) {
      console.error('Error analyzing case', e);
      addNotification('Error: Failed to execute clinical AI extraction.');
      throw e;
    } finally {
      setIsProcessingVoice(false);
    }
  };

  return (
    <CaseContext.Provider
      value={{
        cases,
        activeCaseId,
        setActiveCaseId,
        patientProfile,
        updatePatientProfile,
        currentRole,
        setCurrentRole,
        createCase,
        updateTriage,
        approvePrescription,
        updatePharmacyStatus,
        refreshCase,
        analyzeCase,
        isProcessingVoice,
        notifications,
        addNotification,
        clearNotifications,
        setCases,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
};

export const useCase = () => {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
};
