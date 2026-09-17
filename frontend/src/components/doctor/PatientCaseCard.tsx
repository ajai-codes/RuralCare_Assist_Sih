import React from 'react';
import type { ClinicalCase } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { Clock, MessageSquareCode } from 'lucide-react';

interface PatientCaseCardProps {
  kase: ClinicalCase;
  isActive: boolean;
  onSelect: () => void;
}

export const PatientCaseCard: React.FC<PatientCaseCardProps> = ({ kase, isActive, onSelect }) => {
  const { id, patient, language, originalTranscript, triagePriority, arrivalTime, status, doctorApproved } = kase;

  // Determine triage borders
  const getBorderColor = () => {
    if (isActive) return 'border-brand-teal ring-1 ring-brand-teal';
    if (triagePriority === 'Emergency') return 'border-l-4 border-l-clinical-emergency border-brand-teal/10 hover:border-brand-teal/30';
    if (triagePriority === 'Urgent') return 'border-l-4 border-l-clinical-urgent border-brand-teal/10 hover:border-brand-teal/30';
    return 'border-l-4 border-l-clinical-routine border-brand-teal/10 hover:border-brand-teal/30';
  };

  // Truncate transcript text for card preview
  const truncateText = (text: string, maxLen = 70) => {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  };

  return (
    <div
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-xl border p-4 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between gap-3 ${getBorderColor()} ${
        isActive ? 'shadow-md bg-brand-teal/[0.02]' : 'bg-white'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] font-mono font-bold text-brand-teal uppercase tracking-wider">{id}</span>
          <h4 className="text-xs font-bold text-brand-forest mt-0.5">{patient.name}</h4>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge type="triage" value={triagePriority} />
          {(kase.channel === 'phone_demo' || kase.channel === 'ivr_demo') && (
            <span className="text-[8px] bg-brand-teal/10 text-brand-teal font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-brand-teal/30 flex items-center gap-0.5">
              📞 {kase.channel === 'ivr_demo' ? 'IVR Demo' : 'Phone Demo'}
            </span>
          )}
          {doctorApproved && (
            <span className="text-[8px] bg-clinical-routineLight text-clinical-routine font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-clinical-routine/25">
              Verified
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {/* Transcript preview */}
        <p className="text-[11px] text-brand-forest/90 italic leading-snug flex items-start gap-1">
          <MessageSquareCode className="w-3.5 h-3.5 text-brand-earth/80 shrink-0 mt-0.5" />
          <span>"{truncateText(originalTranscript)}"</span>
        </p>

        {/* Demographics details */}
        <div className="text-[10px] text-brand-earth flex flex-wrap gap-x-2 gap-y-1 items-center">
          <span>{patient.age} Yrs</span>
          <span className="w-1 h-1 bg-brand-teal/20 rounded-full" />
          <span>{patient.gender}</span>
          <span className="w-1 h-1 bg-brand-teal/20 rounded-full" />
          <span className="bg-brand-teal/5 text-brand-teal px-1 rounded font-semibold uppercase text-[8px] tracking-wide border border-brand-teal/10">
            {language}
          </span>
          {kase.languageCode && (
            <>
              <span className="w-1 h-1 bg-brand-teal/20 rounded-full" />
              <span className="bg-brand-teal/5 text-brand-teal px-1 rounded font-semibold uppercase text-[8px] tracking-wide border border-brand-teal/10">
                IVR: {kase.languageCode === 'ta' ? '🇮🇳 Tamil' : '🇬🇧 English'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Card footer details */}
      <div className="flex justify-between items-center text-[10px] text-brand-earth/95 border-t border-brand-teal/5 pt-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-brand-teal shrink-0" />
          <span>Arrived: {arrivalTime}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${doctorApproved ? 'bg-clinical-routine' : 'bg-clinical-urgent'}`} />
          <span className="font-semibold uppercase tracking-wider text-[8px]">{status}</span>
        </div>
      </div>
    </div>
  );
};

export default PatientCaseCard;
