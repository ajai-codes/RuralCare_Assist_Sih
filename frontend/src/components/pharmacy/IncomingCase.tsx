import React from 'react';
import type { ClinicalCase, PharmacyPrepStatus } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { Navigation, Clock, Pill, CheckCircle2, RefreshCw } from 'lucide-react';

interface IncomingCaseProps {
  kase: ClinicalCase;
  isActive: boolean;
  onSelect: () => void;
  onUpdateStatus: (caseId: string, status: PharmacyPrepStatus) => void;
}

export const IncomingCase: React.FC<IncomingCaseProps> = ({ kase, isActive, onSelect, onUpdateStatus }) => {
  const { id, patient, triagePriority, assignedDepartment, pharmacyStatus = 'Received', tokenNumber, estimatedWaitingTime } = kase;

  const handleNextStep = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting card
    if (pharmacyStatus === 'Received') {
      onUpdateStatus(id, 'Preparing');
    } else if (pharmacyStatus === 'Preparing') {
      onUpdateStatus(id, 'Ready');
    } else if (pharmacyStatus === 'Ready') {
      onUpdateStatus(id, 'Dispensed');
    }
  };

  const getActionBtnText = () => {
    switch (pharmacyStatus) {
      case 'Received': return 'Start Preparing';
      case 'Preparing': return 'Mark Ready';
      case 'Ready': return 'Complete Dispense';
      case 'Dispensed': return 'Dispensed';
    }
  };

  const getActionBtnStyle = () => {
    switch (pharmacyStatus) {
      case 'Received':
        return 'bg-brand-teal hover:bg-brand-tealDark border-brand-tealDark text-white';
      case 'Preparing':
        return 'bg-clinical-urgent border-clinical-urgent hover:bg-amber-600 text-white';
      case 'Ready':
        return 'bg-clinical-routine border-clinical-routine hover:bg-green-700 text-white animate-pulse';
      case 'Dispensed':
        return 'bg-brand-gray border-brand-teal/5 text-brand-earth/50 cursor-not-allowed';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-xl border p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between gap-4 ${
        isActive ? 'border-brand-teal ring-1 ring-brand-teal bg-brand-teal/[0.01]' : 'border-brand-teal/10'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-brand-teal uppercase tracking-wider">{id}</span>
            {tokenNumber && (
              <span className="text-[10px] font-mono font-bold text-brand-forest bg-brand-gray px-1.5 py-0.5 rounded border border-brand-teal/10">
                Token: {tokenNumber}
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-brand-forest mt-1.5">{patient.name}</h4>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge type="triage" value={triagePriority} />
          <StatusBadge type="pharmacy" value={pharmacyStatus} />
        </div>
      </div>

      <div className="space-y-1.5 text-[10px] text-brand-earth/95">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-brand-teal shrink-0" />
            <span>Referral: <span className="font-semibold text-brand-forest">{assignedDepartment}</span></span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-brand-teal shrink-0" />
            <span>Est. Wait: <span className="font-semibold text-brand-forest">{estimatedWaitingTime === undefined ? 'Done' : estimatedWaitingTime === 0 ? 'Ready' : `${estimatedWaitingTime}m`}</span></span>
          </span>
        </div>
        
        {/* Medication count */}
        <p className="text-[10px] text-brand-forest leading-relaxed font-medium flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5 text-brand-teal shrink-0" />
          <span>Order: {kase.prescriptionItems.length} Medication Lines</span>
        </p>
      </div>

      {/* Preparation Action Control */}
      {pharmacyStatus !== 'Dispensed' ? (
        <button
          type="button"
          onClick={handleNextStep}
          className={`w-full py-2 border rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm text-center flex items-center justify-center gap-1.5 ${getActionBtnStyle()}`}
        >
          {pharmacyStatus === 'Received' && <RefreshCw className="w-3.5 h-3.5" />}
          {pharmacyStatus === 'Preparing' && <Pill className="w-3.5 h-3.5" />}
          {pharmacyStatus === 'Ready' && <CheckCircle2 className="w-3.5 h-3.5 fill-white" />}
          {getActionBtnText()}
        </button>
      ) : (
        <div className="w-full text-center py-2 bg-brand-gray/50 border border-brand-teal/5 rounded-lg text-[10px] uppercase font-bold text-brand-earth/80 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-clinical-routine shrink-0" />
          Medication Dispensed
        </div>
      )}
    </div>
  );
};

export default IncomingCase;
