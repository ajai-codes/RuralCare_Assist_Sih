import React from 'react';
import type { ClinicalCase } from '../../types';
import { CheckCircle2, Calendar, User, FileText, AlertTriangle } from 'lucide-react';

interface PrescriptionCardProps {
  currentCase: ClinicalCase;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({ currentCase }) => {
  const { doctorApproved, doctorName, prescriptionDate, prescriptionItems, followUpDate, observations } = currentCase;

  if (!doctorApproved) {
    return (
      <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm flex flex-col justify-center items-center text-center h-full min-h-[220px] bg-dot-grid">
        <FileText className="w-8 h-8 text-brand-earth/30 mb-2" />
        <h4 className="text-xs font-bold text-brand-forest uppercase tracking-wider">Prescription Awaiting Verification</h4>
        <p className="text-[11px] text-brand-earth mt-1 max-w-[220px] leading-relaxed">
          AI clinical extractions are currently under inspection. Prescriptions are dispatched only after doctor verification.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm relative overflow-hidden bg-plus-grid">
      {/* Approved Watermark Background */}
      <div className="absolute right-3 top-3 text-[10px] font-extrabold uppercase bg-clinical-routineLight border border-clinical-routine/30 text-clinical-routine px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 fill-white" />
        <span>Doctor Approved</span>
      </div>

      <div className="space-y-4">
        {/* Header Details */}
        <div className="border-b border-brand-teal/5 pb-3">
          <span className="text-[9px] uppercase font-bold text-brand-earth tracking-widest">Medical Order Sheet</span>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1.5 mt-1 text-xs">
            <div className="flex items-center gap-1 text-brand-forest font-semibold">
              <User className="w-3.5 h-3.5 text-brand-teal shrink-0" />
              <span>{doctorName}</span>
            </div>
            <div className="flex items-center gap-1 text-brand-earth">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Date: {prescriptionDate || new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Prescription Items */}
        <div className="space-y-3">
          <h5 className="text-[10px] uppercase font-bold text-brand-earth tracking-wider">Prescribed Medications</h5>
          {prescriptionItems.length === 0 ? (
            <p className="text-xs text-brand-earth italic">No specific medications prescribed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-teal/10 text-[10px] text-brand-earth uppercase tracking-wider">
                    <th className="pb-1.5 font-bold">Medicine</th>
                    <th className="pb-1.5 font-bold">Dosage</th>
                    <th className="pb-1.5 font-bold">Frequency</th>
                    <th className="pb-1.5 font-bold">Duration</th>
                    <th className="pb-1.5 font-bold hidden sm:table-cell">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-teal/5">
                  {prescriptionItems.map((item) => (
                    <tr key={item.id} className="text-brand-forest hover:bg-brand-gray/30 transition-colors">
                      <td className="py-2.5 font-bold">{item.medicine}</td>
                      <td className="py-2.5 font-medium">{item.dosage}</td>
                      <td className="py-2.5">{item.frequency}</td>
                      <td className="py-2.5">{item.duration}</td>
                      <td className="py-2.5 hidden sm:table-cell text-brand-earth">{item.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Doctor Observations */}
        {observations && (
          <div className="bg-brand-gray/50 border border-brand-teal/5 p-3 rounded-lg text-xs space-y-1">
            <span className="block text-[9px] uppercase font-bold text-brand-earth">Clinical Observations</span>
            <p className="text-brand-forest italic leading-relaxed">"{observations}"</p>
          </div>
        )}

        {/* Follow Up */}
        {followUpDate && (
          <div className="flex items-center gap-1.5 text-xs text-brand-teal border border-brand-teal/15 bg-brand-teal/5 px-3 py-2 rounded-lg justify-between">
            <span className="font-bold uppercase tracking-wider text-[9px] text-brand-earth">Recommended Follow Up:</span>
            <span className="font-bold text-brand-forest">{followUpDate}</span>
          </div>
        )}

        {/* Safety Disclaimer */}
        <div className="border-t border-brand-teal/5 pt-3 flex gap-2 text-[10px] text-brand-earth/80">
          <AlertTriangle className="w-3.5 h-3.5 text-brand-earth shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Please consult your local community health worker immediately if you experience adverse effects or if symptoms worsen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionCard;
