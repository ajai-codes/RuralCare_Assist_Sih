import type { CaseStatus } from '../types';

export const formatStatus = (status: CaseStatus): string => {
  switch (status) {
    case 'Voice Submitted':
      return 'Voice Registered';
    case 'AI Summary':
      return 'Clinical Summary Extracted';
    case 'Doctor Review':
      return 'Under Clinical Review';
    case 'Prescription':
      return 'Prescribed';
    case 'Hospital Received':
      return 'Registered at Hospital';
    case 'Queue':
      return 'In Queue';
    case 'Pharmacy':
      return 'Pharmacy Preparing';
    case 'Dispensed':
      return 'Dispensed & Completed';
    default:
      return status;
  }
};
