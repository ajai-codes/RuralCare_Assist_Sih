import React from 'react';
import type { TriageLevel, CaseStatus, PharmacyPrepStatus } from '../../types';

interface StatusBadgeProps {
  type: 'triage' | 'status' | 'pharmacy';
  value: TriageLevel | CaseStatus | PharmacyPrepStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value }) => {
  const getTriageStyles = (lvl: TriageLevel) => {
    switch (lvl) {
      case 'Emergency':
        return 'bg-clinical-emergencyLight border-clinical-emergency/20 text-clinical-emergency';
      case 'Urgent':
        return 'bg-clinical-urgentLight border-clinical-urgent/20 text-clinical-urgent';
      case 'Routine':
        return 'bg-clinical-routineLight border-clinical-routine/20 text-clinical-routine';
    }
  };

  const getStatusStyles = (status: CaseStatus) => {
    switch (status) {
      case 'Voice Submitted':
        return 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal';
      case 'AI Summary':
        return 'bg-clinical-activeLight border-clinical-active/20 text-clinical-active';
      case 'Doctor Review':
        return 'bg-clinical-urgentLight border-clinical-urgent/20 text-clinical-urgent';
      case 'Prescription':
        return 'bg-clinical-routineLight border-clinical-routine/20 text-clinical-routine';
      case 'Hospital Received':
        return 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal';
      case 'Queue':
        return 'bg-clinical-urgentLight border-clinical-urgent/20 text-clinical-urgent';
      case 'Pharmacy':
        return 'bg-clinical-activeLight border-clinical-active/20 text-clinical-active';
      case 'Dispensed':
        return 'bg-clinical-routineLight border-clinical-routine/20 text-clinical-routine';
    }
  };

  const getPharmacyStyles = (status: PharmacyPrepStatus) => {
    switch (status) {
      case 'Received':
        return 'bg-brand-gray border-brand-earth/20 text-brand-forest/75';
      case 'Preparing':
        return 'bg-clinical-urgentLight border-clinical-urgent/20 text-clinical-urgent animate-pulse';
      case 'Ready':
        return 'bg-clinical-routineLight border-clinical-routine/20 text-clinical-routine';
      case 'Dispensed':
        return 'bg-brand-forestLight/10 border-brand-forestLight/20 text-brand-forestLight';
    }
  };

  let styles = '';
  let label: string = value;

  if (type === 'triage') {
    styles = getTriageStyles(value as TriageLevel);
  } else if (type === 'status') {
    styles = getStatusStyles(value as CaseStatus);
    if (value === 'Voice Submitted') label = 'Voice Registered';
    if (value === 'AI Summary') label = 'AI Analyzed';
    if (value === 'Doctor Review') label = 'Under Review';
  } else if (type === 'pharmacy') {
    styles = getPharmacyStyles(value as PharmacyPrepStatus);
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${styles}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
