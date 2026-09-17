import React from 'react';
import type { ClinicalCase, CaseStatus } from '../../types';
import { CheckCircle2, Circle, Activity, AlertCircle } from 'lucide-react';

interface CaseStatusProps {
  currentCase: ClinicalCase;
}

interface Step {
  key: CaseStatus;
  label: string;
  desc: string;
}

const STEPS: Step[] = [
  { key: 'Voice Submitted', label: 'Voice Submitted', desc: 'Audio consultation uploaded.' },
  { key: 'AI Summary', label: 'AI Summary', desc: 'Transcribed & symptoms extracted.' },
  { key: 'Doctor Review', label: 'Doctor Review', desc: 'Awaiting doctor assessment.' },
  { key: 'Prescription', label: 'Prescription Issued', desc: 'Doctor approved medications.' },
  { key: 'Hospital Received', label: 'Hospital Received', desc: 'Record sent to rural health post.' },
  { key: 'Queue', label: 'In Queue', desc: 'Checked in at the department.' },
  { key: 'Pharmacy', label: 'Pharmacy Prep', desc: 'Pharmacist dispensing drugs.' },
  { key: 'Dispensed', label: 'Dispensed', desc: 'Collected medicines.' }
];

export const CaseStatusJourney: React.FC<CaseStatusProps> = ({ currentCase }) => {
  const { status, doctorApproved } = currentCase;

  // Helper to determine step status index
  const getStatusIndex = (s: CaseStatus): number => {
    switch (s) {
      case 'Voice Submitted': return 0;
      case 'AI Summary': return 1;
      case 'Doctor Review': return 2;
      case 'Prescription': return 3;
      case 'Hospital Received': return 4;
      case 'Queue': return 5;
      case 'Pharmacy': return 6;
      case 'Dispensed': return 7;
      default: return 0;
    }
  };

  const currentIndex = getStatusIndex(status);

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm bg-dot-grid">
      <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest mb-6 border-b border-brand-teal/5 pb-3">
        Clinical Journey Map
      </h3>

      {/* Mobile view: vertical list */}
      <div className="md:hidden space-y-4">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex || (step.key === 'Prescription' && doctorApproved);
          const isActive = idx === currentIndex && !(step.key === 'Prescription' && doctorApproved);
          
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-clinical-routine shrink-0" />
                ) : isActive ? (
                  <Activity className="w-5 h-5 text-brand-teal shrink-0 animate-pulse" />
                ) : (
                  <Circle className="w-5 h-5 text-brand-earth/30 shrink-0" />
                )}
                {idx < STEPS.length - 1 && (
                  <div className={`w-0.5 h-10 my-1 ${idx < currentIndex ? 'bg-clinical-routine' : 'bg-brand-teal/10'}`} />
                )}
              </div>
              <div className="space-y-0.5 pb-2">
                <span className={`text-xs font-bold ${isActive ? 'text-brand-teal' : isCompleted ? 'text-brand-forest' : 'text-brand-earth/60'}`}>
                  {step.label}
                </span>
                <p className="text-[10px] text-brand-earth leading-relaxed">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop view: horizontal line */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between relative">
          {/* Horizontal lines */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-brand-teal/10 z-0" />
          <div 
            className="absolute left-6 top-4 h-0.5 bg-clinical-routine transition-all duration-500 z-0" 
            style={{ width: `${(currentIndex / (STEPS.length - 1)) * 90}%` }}
          />

          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex || (step.key === 'Prescription' && doctorApproved);
            const isActive = idx === currentIndex && !(step.key === 'Prescription' && doctorApproved);

            return (
              <div key={step.key} className="flex flex-col items-center z-10 w-24 text-center">
                <div className={`p-1 rounded-full bg-white border-2 transition-colors ${
                  isCompleted 
                    ? 'border-clinical-routine text-clinical-routine' 
                    : isActive 
                    ? 'border-brand-teal text-brand-teal animate-pulse' 
                    : 'border-brand-teal/15 text-brand-earth/30'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 fill-white" />
                  ) : isActive ? (
                    <Activity className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5 fill-white" />
                  )}
                </div>
                <div className="mt-2.5">
                  <span className={`block text-[10px] font-bold tracking-tight leading-none ${
                    isActive ? 'text-brand-teal font-extrabold' : isCompleted ? 'text-brand-forest' : 'text-brand-earth/50'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-[8px] text-brand-earth/80 mt-1 block leading-tight px-1">{step.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current stage banner summary */}
      <div className="mt-6 p-4 rounded-xl border border-brand-teal/10 bg-brand-teal/5 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-brand-forest block">
            Current Status: {STEPS[currentIndex].label}
          </span>
          <p className="text-brand-earth mt-1 leading-relaxed">
            {status === 'Voice Submitted' && 'Your clinical report has been initialized. The AI is compiling your speech history for doctor inspection.'}
            {status === 'AI Summary' && 'AI has summarized your symptoms and determined triage recommended priority. Awaiting clinical validation by the attending doctor.'}
            {status === 'Doctor Review' && 'Attending clinician is currently reviewing your case details and preparing appropriate medicine orders.'}
            {status === 'Pharmacy' && currentCase.pharmacyStatus === 'Received' && 'Your prescription is received by the medical clinic pharmacy and is awaiting dispenser preparation.'}
            {status === 'Pharmacy' && currentCase.pharmacyStatus === 'Preparing' && 'The pharmacist is active and currently bottling and packing your prescribed drugs.'}
            {status === 'Pharmacy' && currentCase.pharmacyStatus === 'Ready' && 'Your medicines are fully prepared! Please proceed to the Clinic Pharmacy counter immediately and show Token ' + currentCase.tokenNumber + '.'}
            {status === 'Dispensed' && 'Medicines have been successfully handed over to you. Please read dosage details carefully and complete follow-up.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CaseStatusJourney;
