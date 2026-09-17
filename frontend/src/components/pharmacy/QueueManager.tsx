import React from 'react';
import type { ClinicalCase } from '../../types';
import { Users, ArrowRight } from 'lucide-react';

interface QueueManagerProps {
  cases: ClinicalCase[];
  activeCaseId: string | null;
}

export const QueueManager: React.FC<QueueManagerProps> = ({ cases, activeCaseId }) => {
  // Only get cases that are approved by doctor and en en-route or in pharmacy prep
  const queueCases = cases
    .filter((c) => c.doctorApproved && c.tokenNumber && c.status === 'Pharmacy')
    .sort((a, b) => {
      // Sort: Ready first, then Preparing, then Received
      const weight = { Ready: 0, Preparing: 1, Received: 2, Dispensed: 3 };
      const aW = weight[a.pharmacyStatus || 'Received'];
      const bW = weight[b.pharmacyStatus || 'Received'];
      return aW - bW;
    });

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm space-y-4 bg-plus-grid">
      <div className="flex justify-between items-start border-b border-brand-teal/5 pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest flex items-center gap-1.5">
            <Users className="w-4 h-4 text-brand-teal" />
            Visual Operations Queue Track
          </h3>
          <p className="text-[11px] text-brand-earth mt-0.5">Real-time token sequence and counter traffic</p>
        </div>
        <div className="text-[10px] bg-brand-forestLight/5 border border-brand-teal/10 px-2 py-0.5 rounded font-mono font-bold text-brand-forest">
          Queue Load: {queueCases.length} Patients
        </div>
      </div>

      {queueCases.length === 0 ? (
        <div className="text-center py-8 bg-brand-gray/30 border border-dashed border-brand-teal/10 rounded-xl text-xs text-brand-earth">
          No patients currently enqueued in the active pharmacy pipeline.
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-3 overflow-x-auto py-2 scrollbar-thin">
          {queueCases.map((kase, idx) => {
            const isCurrent = idx === 0; // First item in sorted list is the counter target
            const isSelected = activeCaseId === kase.id;

            return (
              <React.Fragment key={kase.id}>
                {/* Visual token block */}
                <div
                  className={`flex-shrink-0 w-full md:w-44 border rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm ${
                    isCurrent
                      ? 'border-brand-teal bg-brand-teal/[0.03] ring-1 ring-brand-teal/30'
                      : isSelected
                      ? 'border-brand-teal bg-brand-teal/5'
                      : 'border-brand-teal/10 bg-white hover:border-brand-teal/35'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-2xl font-mono font-black text-brand-forest tracking-tight block">
                      {kase.tokenNumber}
                    </span>
                    <span
                      className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide border ${
                        kase.pharmacyStatus === 'Ready'
                          ? 'bg-clinical-routineLight border-clinical-routine/25 text-clinical-routine animate-pulse'
                          : kase.pharmacyStatus === 'Preparing'
                          ? 'bg-clinical-urgentLight border-clinical-urgent/25 text-clinical-urgent'
                          : 'bg-brand-gray border-brand-earth/20 text-brand-forest/65'
                      }`}
                    >
                      {kase.pharmacyStatus}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[11px] font-bold text-brand-forest truncate">
                      {kase.patient.name}
                    </span>
                    <div className="flex justify-between items-center text-[9px] text-brand-earth uppercase tracking-wide">
                      <span className="font-semibold">{kase.assignedDepartment}</span>
                      <span>
                        {kase.pharmacyStatus === 'Ready' ? 'Counter' : `${kase.estimatedWaitingTime}m`}
                      </span>
                    </div>
                  </div>

                  {/* Indicator tag */}
                  {isCurrent && (
                    <div className="text-[8px] bg-brand-teal text-white font-extrabold uppercase py-0.5 rounded text-center tracking-widest shadow-sm">
                      ★ Active Counter
                    </div>
                  )}
                </div>

                {/* Arrow spacer between steps in desktop */}
                {idx < queueCases.length - 1 && (
                  <ArrowRight className="hidden md:block w-4 h-4 text-brand-teal/30 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QueueManager;
