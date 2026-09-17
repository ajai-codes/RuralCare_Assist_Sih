import React from 'react';
import type { ClinicalCase } from '../../types';
import { CheckCircle2, ShieldCheck, Pill, ShieldAlert } from 'lucide-react';

interface PrescriptionViewProps {
  currentCase: ClinicalCase;
}

export const PrescriptionView: React.FC<PrescriptionViewProps> = ({ currentCase }) => {
  const { doctorApproved, doctorName, prescriptionDate, prescriptionItems, observations, tokenNumber } = currentCase;

  if (!doctorApproved) {
    return (
      <div className="w-full bg-white rounded-xl border border-brand-teal/10 p-6 text-center py-12 flex flex-col items-center justify-center bg-dot-grid min-h-[300px]">
        <ShieldAlert className="w-10 h-10 text-brand-earth/30 mb-2" />
        <h4 className="text-xs font-bold text-brand-forest uppercase tracking-wider">Docket Unauthorized</h4>
        <p className="text-xs text-brand-earth mt-1 max-w-[240px] leading-relaxed">
          Attending clinician must sign and approve the prescription details before operations can prepare medications.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm space-y-5 bg-plus-grid relative">
      {/* Verified banner */}
      <div className="absolute right-4 top-4 text-[10px] font-extrabold uppercase bg-clinical-routineLight border border-clinical-routine/30 text-clinical-routine px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 fill-white animate-pulse" />
        <span>✓ Doctor Approved</span>
      </div>

      <div className="border-b border-brand-teal/5 pb-3">
        <span className="text-[9px] uppercase font-bold text-brand-earth tracking-widest block">Clinic Operations Docket</span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest mt-1">
          Prescription Verification Sheet
        </h3>
      </div>

      {/* Metadata Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-brand-gray/30 p-3 rounded-lg border border-brand-teal/5 text-xs text-brand-forest font-semibold">
        <div>
          <span className="block text-[9px] uppercase font-bold text-brand-earth mb-0.5">Attending Doctor</span>
          <span>{doctorName}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-brand-earth mb-0.5">Authorization Date</span>
          <span>{prescriptionDate || new Date().toLocaleDateString()}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-brand-earth mb-0.5">Allocated Token</span>
          <span className="font-mono text-brand-teal font-bold">{tokenNumber}</span>
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-brand-earth mb-0.5">Security Status</span>
          <span className="text-clinical-routine uppercase text-[9px] font-bold">Encrypted Keys Match</span>
        </div>
      </div>

      {/* Read-Only Table */}
      <div className="space-y-3">
        <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wider">Authorized Meds List</span>
        <div className="border border-brand-teal/10 rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-brand-gray text-[9px] text-brand-earth uppercase tracking-wider border-b border-brand-teal/10">
                <th className="p-3">Medication</th>
                <th className="p-3">Dosage</th>
                <th className="p-3">Frequency</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Route</th>
                <th className="p-3">Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-teal/5">
              {prescriptionItems.map((item) => (
                <tr key={item.id} className="text-brand-forest">
                  <td className="p-3 font-bold flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                    {item.medicine}
                  </td>
                  <td className="p-3 font-semibold text-brand-teal">{item.dosage}</td>
                  <td className="p-3">{item.frequency}</td>
                  <td className="p-3">{item.duration}</td>
                  <td className="p-3">{item.route}</td>
                  <td className="p-3 text-brand-earth">{item.instructions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doctor diagnosis observations */}
      {observations && (
        <div className="bg-brand-cream border border-brand-teal/10 p-3 rounded-lg text-xs space-y-1">
          <span className="block text-[9px] uppercase font-bold text-brand-earth">Attending Diagnosis/Observations</span>
          <p className="text-brand-forest italic">"{observations}"</p>
        </div>
      )}

      {/* Read Only Warn Notice */}
      <div className="bg-brand-gray/60 border border-brand-teal/5 p-3.5 rounded-xl flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
        <div className="text-[10px] text-brand-earth leading-relaxed">
          <span className="font-bold text-brand-forest uppercase tracking-wide block mb-0.5">
            Immutable Security Protocol
          </span>
          The pharmacy hub operates strictly as a dispensing counter. Modifications to dosages, schedules, or medicines are clinically locked and require doctor-issued override keys.
        </div>
      </div>
    </div>
  );
};

export default PrescriptionView;
