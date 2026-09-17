import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { X, Printer, Bell, Calendar, Clock, FileText } from 'lucide-react';


interface FollowUpSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  followupId: string;
  userRole?: string;
}

export const FollowUpSlipModal: React.FC<FollowUpSlipModalProps> = ({
  isOpen,
  onClose,
  followupId,
  userRole = 'patient'
}) => {
  const [loading, setLoading] = useState(true);
  const [slip, setSlip] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !followupId) return;
    const fetchSlip = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getFollowUpSlip(followupId, userRole);
        setSlip(data);
      } catch (e: any) {
        console.error('Failed to load follow-up slip:', e);
        setError(e.message || 'Failed to load follow-up reminder slip');
      } finally {
        setLoading(false);
      }
    };
    fetchSlip();
  }, [isOpen, followupId, userRole]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-brand-teal/20 overflow-hidden text-left print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* Modal Header (Hidden during print) */}
        <div className="bg-brand-forest text-brand-cream p-4 flex items-center justify-between border-b border-brand-teal/20 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-teal/20 border border-brand-teal/40 rounded-lg flex items-center justify-center text-brand-teal">
              <Printer className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs uppercase tracking-wider">
                OFFICIAL FOLLOW-UP REMINDER SLIP
              </h3>
              <p className="text-[11px] text-brand-earth/90">
                RuralCare Assist — High-Risk Clinical Care Continuity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-brand-cream/70 hover:text-white hover:bg-brand-forestLight transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Slip Body */}
        <div className="p-6 space-y-5 bg-white text-slate-900 font-sans print:p-6 print:m-0">
          
          {/* Slip Header Banner */}
          <div className="border-b-2 border-brand-teal pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase text-brand-teal tracking-widest block">
                GOVERNMENT RURAL HEALTHCARE NETWORK
              </span>
              <h2 className="text-lg font-black text-brand-forest">
                🏥 RuralCare Assist Clinical Follow-Up Slip
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Facility: {slip?.facility_name || 'Madurai Medical College & Hospital'}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                {slip?.risk_level || 'HIGH'} RISK FOLLOW-UP
              </span>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Ref ID: {slip?.id ? slip.id.substring(0, 8).toUpperCase() : 'RC-FU-101'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs font-semibold animate-pulse">
              Compiling follow-up reminder slip details...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
              {error}
            </div>
          ) : (
            <>
              {/* Notification Mode Status Banner */}
              <div className="p-3 rounded-xl border text-xs flex items-center justify-between bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-teal" />
                  <span className="font-bold text-slate-800">Reminder Delivery Status:</span>
                </div>
                {slip.notification_mode === 'SMS_AND_APP' ? (
                  <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                    📲 SMS Dispatched to {slip.patient_phone}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] uppercase border border-amber-300">
                    🖨️ Printed Slip Mode (No Registered Phone)
                  </span>
                )}
              </div>

              {/* Patient Profile Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Information</span>
                  <p className="font-black text-slate-900 text-sm mt-0.5">{slip.patient_name}</p>
                  <p className="text-slate-600 font-medium">Patient ID: <strong className="font-mono">{slip.patient_id}</strong></p>
                  <p className="text-slate-600 font-medium">{slip.patient_age_gender}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Attending Physician & Facility</span>
                  <p className="font-bold text-slate-900 mt-0.5">{slip.doctor_name}</p>
                  <p className="text-slate-600 font-medium">{slip.facility_name}</p>
                  <p className="text-slate-500 text-[10px]">Contact: Registered Rural Hospital Desk</p>
                </div>
              </div>

              {/* Follow-up Date & Time Highlights */}
              <div className="bg-brand-teal/10 border-2 border-brand-teal/40 rounded-xl p-4 flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-brand-forest tracking-wider block flex items-center justify-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-brand-teal" /> Follow-Up Date
                  </span>
                  <span className="text-lg font-black text-brand-forest mt-0.5 block">{slip.follow_up_date}</span>
                </div>
                <div className="h-8 w-px bg-brand-teal/30" />
                <div>
                  <span className="text-[10px] font-bold uppercase text-brand-forest tracking-wider block flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand-teal" /> Reporting Time
                  </span>
                  <span className="text-lg font-black text-brand-forest mt-0.5 block">{slip.follow_up_time}</span>
                </div>
              </div>

              {/* Clinical Instructions */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand-teal" /> Doctor's Clinical Instructions & Notes
                </h4>
                <p className="text-xs text-slate-700 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {slip.reason} — {slip.notes || 'Please present this slip at the hospital triage counter upon arrival.'}
                </p>
              </div>

              {/* Compliance & Footnote */}
              <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200">
                <span>Issued via RuralCare Assist — Teleconsultation & Triage System</span>
                <span>Printed: {slip.printed_at}</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Action Footer (Hidden during print) */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !!error}
            className="px-5 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold hover:bg-brand-tealDark transition shadow flex items-center gap-1.5 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print Reminder Slip
          </button>
        </div>
      </div>
    </div>
  );
};
