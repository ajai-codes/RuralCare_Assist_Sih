import React, { useState, useEffect } from 'react';
import type { ClinicalCase, TriageLevel } from '../../types';
import { Share2, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface TriagePanelProps {
  currentCase: ClinicalCase;
  onUpdateTriage: (caseId: string, priority: TriageLevel, department: string) => Promise<void>;
}

const DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Emergency Medicine',
  'Pediatrics',
  'Orthopedics',
  'Gastroenterology',
];

export const TriagePanel: React.FC<TriagePanelProps> = ({ currentCase, onUpdateTriage }) => {
  const [priority, setPriority] = useState<TriageLevel>(currentCase.triagePriority);
  const [department, setDepartment] = useState<string>(currentCase.assignedDepartment);
  
  // Referral state
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [targetFacility, setTargetFacility] = useState('Madurai Medical College & Hospital (Tertiary)');
  const [referralReason, setReferralReason] = useState('');
  const [isSubmittingRef, setIsSubmittingRef] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);

  // Sync state with active case changes
  useEffect(() => {
    setPriority(currentCase.triagePriority);
    setDepartment(currentCase.assignedDepartment);
    setReferralSuccess(null);
  }, [currentCase]);

  const handleUpdate = () => {
    onUpdateTriage(currentCase.id, priority, department);
  };

  const handleCreateReferral = async () => {
    if (!referralReason) {
      alert('Please state clinical reason for hospital referral.');
      return;
    }
    setIsSubmittingRef(true);
    try {
      const res = await api.createReferral({
        case_id: currentCase.id,
        patient_id: currentCase.patient.patientId,
        referring_doctor_name: currentCase.doctorName || 'Dr. Ramesh Kumar',
        target_facility: targetFacility,
        target_department: department,
        priority: priority,
        reason: referralReason,
        transport_required: priority === 'Emergency',
        notes: 'Emergency transfer initiated via Doctor Dashboard.'
      });
      setReferralSuccess(res.data?.referral_code || 'REF-CREATED');
      setIsReferralOpen(false);
      alert(`Referral ${res.data?.referral_code || ''} successfully created for tertiary transfer!`);
    } catch (e: any) {
      alert(e.message || 'Failed to create referral');
    } finally {
      setIsSubmittingRef(false);
    }
  };

  const getPriorityBtnStyle = (level: TriageLevel) => {
    const isActive = priority === level;
    switch (level) {
      case 'Emergency':
        return isActive
          ? 'bg-clinical-emergency text-brand-cream border-clinical-emergency shadow-md font-bold'
          : 'bg-white border-clinical-emergency/30 text-clinical-emergency hover:bg-clinical-emergencyLight/20';
      case 'Urgent':
        return isActive
          ? 'bg-clinical-urgent text-brand-cream border-clinical-urgent shadow-md font-bold'
          : 'bg-white border-clinical-urgent/30 text-clinical-urgent hover:bg-clinical-urgentLight/20';
      case 'Routine':
        return isActive
          ? 'bg-clinical-routine text-brand-cream border-clinical-routine shadow-md font-bold'
          : 'bg-white border-clinical-routine/30 text-clinical-routine hover:bg-clinical-routineLight/20';
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm space-y-5 bg-plus-grid">
      <div className="flex justify-between items-start border-b border-brand-teal/5 pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest">
            Triage & Referral Configuration
          </h3>
          <p className="text-[11px] text-brand-earth mt-0.5">Define priority level and referral target</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-brand-earth bg-brand-gray border border-brand-teal/10 px-2 py-0.5 rounded">
          <span>AI Suggested: </span>
          <span className="font-bold text-brand-teal uppercase">{currentCase.aiTriageRecommend}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Triage Selector */}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase font-bold text-brand-earth tracking-wider">
            Clinical Triage Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Emergency', 'Urgent', 'Routine'] as TriageLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPriority(level)}
                className={`py-2 px-3 border rounded-lg text-xs uppercase tracking-wide transition-all ${getPriorityBtnStyle(level)}`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Department Selector */}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase font-bold text-brand-earth tracking-wider">
            Assigned Hospital Department
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full text-xs font-semibold p-2.5 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {referralSuccess && (
        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
            <span>Referral Issued: {referralSuccess} → Tertiary Hospital Transfer Active</span>
          </div>
        </div>
      )}

      {/* Action Trigger */}
      <div className="flex flex-wrap justify-between items-center pt-3 border-t border-brand-teal/5 text-xs gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReferralOpen(true)}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-purple-700 transition flex items-center gap-1.5 shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" /> Issue Tertiary Referral
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdate}
            disabled={priority === currentCase.triagePriority && department === currentCase.assignedDepartment}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors border shadow-sm ${
              priority === currentCase.triagePriority && department === currentCase.assignedDepartment
                ? 'bg-brand-gray border-brand-teal/5 text-brand-earth/50 cursor-not-allowed'
                : 'bg-brand-teal hover:bg-brand-tealDark border-brand-tealDark text-white'
            }`}
          >
            Update Triage & Referral
          </button>
        </div>
      </div>

      {/* Referral Creation Modal */}
      {isReferralOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-purple-200 text-left">
            <h3 className="font-bold text-sm text-purple-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-600" /> Issue Hospital Referral ({currentCase.id})
            </h3>
            <p className="text-xs text-brand-earth">
              Escalate patient care to a higher-level tertiary facility or specialized center.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-brand-forest block">Target Facility</label>
                <select
                  value={targetFacility}
                  onChange={e => setTargetFacility(e.target.value)}
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none mt-1"
                >
                  <option value="Madurai Medical College & Hospital (Tertiary)">Madurai Medical College & Hospital (Tertiary)</option>
                  <option value="Apollo Speciality Hospital Madurai">Apollo Speciality Hospital Madurai</option>
                  <option value="Government Rajaji Hospital">Government Rajaji Hospital</option>
                  <option value="Regional Trauma & Cardiac Center">Regional Trauma & Cardiac Center</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-forest block">Clinical Escalation Reason</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Acute Coronary Syndrome requiring emergency PCI / Cath Lab evaluation..."
                  value={referralReason}
                  onChange={e => setReferralReason(e.target.value)}
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsReferralOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-brand-earth hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRef}
                onClick={handleCreateReferral}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 shadow"
              >
                {isSubmittingRef ? 'Issuing...' : 'Confirm & Issue Referral'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriagePanel;

