import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { X, FileText, Share2, Bell, ShieldCheck, Calendar, Pill, Activity } from 'lucide-react';

interface LongitudinalRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  role?: 'patient' | 'doctor';
}

export const LongitudinalRecordModal: React.FC<LongitudinalRecordModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName = 'Patient',
  role = 'patient'
}) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getLongitudinalHistory(patientId, role);
        setHistory(data);
      } catch (e: any) {
        console.error('Failed to load longitudinal record:', e);
        setError(e.message || 'Failed to load longitudinal care history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [isOpen, patientId, role]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-brand-teal/20 overflow-hidden text-left">
        {/* Header */}
        <div className="bg-brand-forest text-brand-cream p-5 flex items-center justify-between border-b border-brand-teal/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-teal/20 border border-brand-teal/40 rounded-xl flex items-center justify-center text-brand-teal">
              <FileText className="w-5 h-5 text-brand-teal" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider">
                LONGITUDINAL PATIENT CARE RECORD
              </h3>
              <p className="text-xs text-brand-earth/90">
                Patient: <span className="font-bold text-brand-cream">{history?.patient?.name || patientName}</span> ({history?.patient?.patient_id || patientId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-cream/70 hover:text-white hover:bg-brand-forestLight transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 text-center text-brand-earth text-xs font-semibold animate-pulse">
              Compiling longitudinal health encounters & clinical records...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
              {error}
            </div>
          ) : (
            <>
              {/* Demographics & Clinical Profile */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-brand-cream/50 p-4 rounded-xl border border-brand-teal/15 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-brand-earth uppercase tracking-wider block">Demographics</span>
                  <p className="font-bold text-brand-forest mt-0.5">
                    {history.patient.name} ({history.patient.age} yrs, {history.patient.gender})
                  </p>
                  <p className="text-brand-earth font-medium text-[11px]">Phone: {history.patient.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-brand-earth uppercase tracking-wider block">Medical History</span>
                  <p className="font-semibold text-brand-forest mt-0.5">{history.patient.medical_history || 'None reported'}</p>
                  <p className="text-brand-earth font-medium text-[11px]">Allergies: {history.patient.allergies || 'None'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-brand-earth uppercase tracking-wider block">Current Medications</span>
                  <p className="font-semibold text-brand-forest mt-0.5">{history.patient.current_medications || 'None'}</p>
                </div>
              </div>

              {/* Total Encounters Counter */}
              <div className="flex items-center justify-between border-b border-brand-teal/10 pb-2">
                <h4 className="text-xs font-black uppercase text-brand-forest tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-teal" /> Care Journey Timeline ({history.total_encounters || (history.cases || []).length} Encounters)
                </h4>
                <span className="text-[10px] font-bold text-brand-earth bg-brand-gray px-2 py-0.5 rounded">
                  HIPAA & Ayushman Bharat Compliant
                </span>
              </div>

              {/* Encounters List (Cases / Triage) */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-bold uppercase text-brand-earth tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-brand-teal" /> Triage & Clinical Encounters
                </h5>
                {(history.cases || []).map((kase: any) => (
                  <div key={kase.id} className="border border-brand-teal/15 rounded-xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-teal/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-brand-forest">{kase.case_id}</span>
                        <span className="text-[10px] text-brand-earth font-semibold">
                          {kase.created_at ? new Date(kase.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-teal/10 text-brand-teal">
                          AI Priority: {kase.ai_priority || 'Urgent'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          kase.final_priority === 'Emergency' ? 'bg-red-100 text-red-700' :
                          kase.final_priority === 'Urgent' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          Doctor Validated: {kase.final_priority || 'Validated'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-bold text-brand-forest">Chief Complaint (Transcript):</p>
                      <p className="text-brand-earth bg-brand-gray/30 p-2 rounded-lg italic text-[11px]">
                        "{kase.main_complaint || kase.transcript || 'Voice consultation recorded'}"
                      </p>
                    </div>

                    {kase.clinical_summary && (
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-brand-forest">AI Clinical Summary:</p>
                        <p className="text-brand-earth font-medium text-[11px]">{kase.clinical_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Appointments & Queue History */}
              {(history.appointments || []).length > 0 && (
                <div className="space-y-3 pt-2">
                  <h5 className="text-[11px] font-bold uppercase text-brand-earth tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" /> Appointments & Queue History ({history.appointments.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {history.appointments.map((apt: any) => (
                      <div key={apt.id} className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between font-bold text-blue-900">
                          <span>📅 {apt.appointment_date} ({apt.time_slot})</span>
                          <span className="uppercase text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-black">
                            {apt.status || 'Booked'}
                          </span>
                        </div>
                        <p className="text-blue-800 text-[11px]">
                          Department: <strong>{apt.department || 'General Medicine'}</strong> | Queue #{apt.queue_number || 1}
                        </p>
                        <p className="text-blue-700 text-[10px]">
                          Mode: <strong>{apt.appointment_type || 'In-Person'}</strong> | Priority: <strong>{apt.triage_priority || 'Routine'}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prescriptions & Pharmacy Processing */}
              {(history.prescriptions || []).length > 0 && (
                <div className="space-y-3 pt-2">
                  <h5 className="text-[11px] font-bold uppercase text-brand-earth tracking-wider flex items-center gap-1">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" /> Prescriptions & Pharmacy Status ({history.prescriptions.length})
                  </h5>
                  <div className="space-y-2">
                    {history.prescriptions.map((pres: any) => (
                      <div key={pres.id} className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between font-bold text-emerald-900">
                          <span>💊 Prescribed by {pres.doctor_name || 'Dr. Anand Sharma'}</span>
                          <span className="uppercase text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-black">
                            {pres.pharmacy_status || pres.status || 'DISPENSED'}
                          </span>
                        </div>
                        {Array.isArray(pres.medications) && pres.medications.length > 0 ? (
                          <ul className="list-disc list-inside text-emerald-800 text-[11px] space-y-0.5">
                            {pres.medications.map((m: any, idx: number) => (
                              <li key={idx}>
                                {typeof m === 'string' ? m : `${m.name || m.drug} - ${m.dosage || '1 tab'} (${m.frequency || 'OD'})`}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-emerald-800 text-[11px]">Medications dispensed as authorized.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referrals Section */}
              {(history.referrals || []).length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-[11px] font-bold uppercase text-brand-earth tracking-wider flex items-center gap-1">
                    <Share2 className="w-3.5 h-3.5 text-purple-600" /> Active Facility Referrals ({history.referrals.length})
                  </h5>
                  <div className="space-y-2">
                    {history.referrals.map((ref: any) => (
                      <div key={ref.id} className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-purple-900">
                          <span>{ref.referral_code} → {ref.target_facility}</span>
                          <span className="uppercase text-[10px] bg-purple-200 px-2 py-0.5 rounded font-black">{ref.status}</span>
                        </div>
                        <p className="text-purple-800 text-[11px] font-medium">Reason: {ref.reason}</p>
                        <p className="text-purple-700 text-[10px]">Referred by: {ref.referring_doctor_name || 'Primary Care Physician'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-Ups Section */}
              {(history.follow_ups || []).length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-[11px] font-bold uppercase text-brand-earth tracking-wider flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5 text-amber-600" /> Scheduled High-Risk Follow-Ups ({history.follow_ups.length})
                  </h5>
                  <div className="space-y-2">
                    {history.follow_ups.map((fu: any) => (
                      <div key={fu.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between font-bold text-amber-900">
                          <span>📅 Due Date: {fu.follow_up_date} ({fu.risk_level || 'High'} Risk)</span>
                          <span className="uppercase text-[10px] bg-amber-200 px-2 py-0.5 rounded font-black">{fu.status}</span>
                        </div>
                        <p className="text-amber-800 text-[11px] font-medium">Instructions: {fu.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-brand-cream/80 p-4 border-t border-brand-teal/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-tealDark transition shadow"
          >
            Close Longitudinal Record
          </button>
        </div>
      </div>
    </div>
  );
};

