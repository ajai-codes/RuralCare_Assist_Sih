import React from 'react';
import type { ClinicalCase } from '../../types';
import { Clock, Navigation, Users } from 'lucide-react';

interface QueueCardProps {
  currentCase: ClinicalCase;
}

export const QueueCard: React.FC<QueueCardProps> = ({ currentCase }) => {
  const { doctorApproved, tokenNumber, estimatedWaitingTime, assignedDepartment } = currentCase;

  const isEmergencyStatus = currentCase.triagePriority === 'Emergency' || ['EMERGENCY_CONFIRMED', 'DOCTOR_REQUESTED', 'STAFF_ALERTED', 'HIGH_PRIORITY'].includes(currentCase.status);

  if (isEmergencyStatus && (!doctorApproved || !tokenNumber)) {
    return (
      <div className="w-full bg-red-50 rounded-xl border border-red-200 p-6 shadow-sm flex flex-col justify-center items-center text-center min-h-[220px] bg-dot-grid">
        <div className="w-10 h-10 bg-red-100 text-red-500 rounded-full flex items-center justify-center border border-red-200 animate-pulse mb-3">
          🚨
        </div>
        <h4 className="text-xs font-black text-red-600 uppercase tracking-wider">🚨 EMERGENCY CASE</h4>
        <p className="text-[11px] font-semibold text-brand-forest mt-1.5 max-w-[200px] leading-relaxed">
          "Your case has been marked as high priority and sent for immediate healthcare review."
        </p>
      </div>
    );
  }

  if (!doctorApproved || !tokenNumber) {
    return (
      <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm flex flex-col justify-center items-center text-center min-h-[220px] bg-dot-grid">
        <Users className="w-8 h-8 text-brand-earth/30 mb-2" />
        <h4 className="text-xs font-bold text-brand-forest uppercase tracking-wider">Queue Allocation Pending</h4>
        <p className="text-[11px] text-brand-earth mt-1 max-w-[200px] leading-relaxed">
          Queue tokens and department assignments are generated immediately after doctor verification.
        </p>
      </div>
    );
  }

  // Count mock ahead patients (based on estimated wait time)
  const patientsAhead = Math.max(1, Math.floor((estimatedWaitingTime || 15) / 5));

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm relative overflow-hidden flex flex-col justify-between bg-plus-grid">
      {/* Decorative accent */}
      <div className="absolute right-0 bottom-0 text-brand-teal/5 font-mono text-[100px] font-extrabold select-none leading-none translate-y-6 translate-x-3 pointer-events-none">
        {tokenNumber}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-start border-b border-brand-teal/5 pb-3">
          <div>
            <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-widest">Rural Medical Clinic</span>
            <h4 className="text-xs font-bold text-brand-forest uppercase tracking-wide flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-brand-teal" />
              {assignedDepartment}
            </h4>
          </div>
          <span className="text-[10px] bg-clinical-routineLight border border-clinical-routine/25 text-clinical-routine font-bold px-2 py-0.5 rounded">
            Checked In
          </span>
        </div>

        {/* Big Token Number */}
        <div className="py-2 text-center">
          <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-widest">Queue Token</span>
          <h2 className="text-5xl font-mono font-extrabold text-brand-forest tracking-tight mt-1">
            {tokenNumber}
          </h2>
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="mt-4 pt-3 border-t border-brand-teal/5 grid grid-cols-2 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-teal shrink-0" />
          <div>
            <span className="block text-[9px] uppercase font-bold text-brand-earth">Est. Wait</span>
            <span className="font-bold text-brand-forest">
              {estimatedWaitingTime === 0 ? 'Ready' : `${estimatedWaitingTime} mins`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-teal shrink-0" />
          <div>
            <span className="block text-[9px] uppercase font-bold text-brand-earth">Position</span>
            <span className="font-bold text-brand-forest">
              {estimatedWaitingTime === 0 ? 'Current Patient' : `${patientsAhead} ahead`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueCard;
