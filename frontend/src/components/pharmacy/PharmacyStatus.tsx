import React from 'react';
import type { PharmacyPrepStatus } from '../../types';
import { CheckCircle } from 'lucide-react';

interface PharmacyStatusProps {
  currentStatus?: PharmacyPrepStatus;
}

const STEPS: { key: PharmacyPrepStatus; label: string; desc: string }[] = [
  { key: 'Received', label: 'Order Received', desc: 'Prescription verified.' },
  { key: 'Preparing', label: 'Dispensing Pack', desc: 'Pharmacist bottling drugs.' },
  { key: 'Ready', label: 'Ready at Counter', desc: 'Awaiting patient collect.' },
  { key: 'Dispensed', label: 'Handover Completed', desc: 'Medicines dispensed.' }
];

export const PharmacyStatus: React.FC<PharmacyStatusProps> = ({ currentStatus = 'Received' }) => {
  const getIndex = (status: PharmacyPrepStatus): number => {
    switch (status) {
      case 'Received': return 0;
      case 'Preparing': return 1;
      case 'Ready': return 2;
      case 'Dispensed': return 3;
      default: return 0;
    }
  };

  const currentIndex = getIndex(currentStatus);

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm space-y-4 bg-plus-grid">
      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-forest">
        Active Preparation Progress
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;

          return (
            <div
              key={step.key}
              className={`p-3 border rounded-xl space-y-1.5 transition-all text-left shadow-sm ${
                isActive
                  ? 'border-brand-teal bg-brand-teal/[0.03] ring-1 ring-brand-teal/20'
                  : isCompleted
                  ? 'border-clinical-routine/30 bg-clinical-routineLight/10'
                  : 'border-brand-teal/10 bg-white/40'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold text-brand-earth tracking-wider">
                  Step {idx + 1}
                </span>
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4 text-clinical-routine fill-white shrink-0" />
                ) : isActive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-teal opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-teal"></span>
                  </span>
                ) : null}
              </div>

              <div className="space-y-0.5">
                <span className={`block text-xs font-bold uppercase tracking-wide leading-none ${
                  isActive ? 'text-brand-teal' : isCompleted ? 'text-brand-forest' : 'text-brand-earth/50'
                }`}>
                  {step.label}
                </span>
                <p className="text-[10px] text-brand-earth leading-tight">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PharmacyStatus;
