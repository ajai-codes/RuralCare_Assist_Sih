import React from 'react';
import type { ClinicalCase } from '../../types';
import { CheckCircle2, Smartphone, Users, Pill } from 'lucide-react';

interface MedicineReadyCardProps {
  currentCase: ClinicalCase;
}

export const MedicineReadyCard: React.FC<MedicineReadyCardProps> = ({ currentCase }) => {
  const rawToken = currentCase.tokenNumber || '1042';
  const pickupToken = rawToken.startsWith('RC-') 
    ? rawToken 
    : (rawToken.startsWith('C-') ? 'RC-' + rawToken.slice(2) : 'RC-' + rawToken);

  return (
    <div className="w-full bg-white rounded-xl border border-red-200 p-6 shadow-md relative overflow-hidden bg-dot-grid">
      {/* Red accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500"></div>

      <div className="space-y-5">
        
        {/* Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-brand-teal/5">
          <div className="p-2 bg-red-50 text-red-500 rounded-lg border border-red-100 animate-pulse">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              💊 Medicine Ready
            </h4>
            <span className="text-[9px] text-brand-earth uppercase tracking-widest font-bold block mt-0.5">
              Ready for Pickup
            </span>
          </div>
        </div>

        {/* Big Pickup Token display */}
        <div className="text-center bg-brand-gray/30 py-3.5 rounded-2xl border border-brand-teal/5 relative">
          <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-widest">
            🎫 Pickup Token
          </span>
          <h2 className="text-4xl font-mono font-black text-brand-forest mt-1">
            {pickupToken}
          </h2>
        </div>

        {/* SMS Status Section */}
        <div className="space-y-2">
          <h5 className="text-[10px] uppercase font-bold text-brand-earth tracking-wider flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-brand-teal" />
            📱 SMS Notification
          </h5>
          <div className="bg-brand-teal/[0.02] border border-brand-teal/10 p-3.5 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-[10px] font-bold text-brand-earth">
              <span>Recipient:</span>
              <span className="font-semibold text-brand-forest">{currentCase.patient.phone || '+91 XXXXX XXXXX'}</span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] font-bold text-brand-earth">
              <span>Status:</span>
              <span className="font-bold text-brand-forest flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-brand-forest" />
                ✓ Notification Generated
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-brand-earth">
              <span>SMS_STATUS:</span>
              <span className="bg-brand-teal/10 text-brand-teal text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-brand-teal/20 font-mono">
                SIMULATED
              </span>
            </div>
          </div>
        </div>

        {/* Demo Mode Disclaimer */}
        <div className="bg-brand-gray border border-brand-teal/10 p-3 rounded-xl flex gap-2 items-start text-[10px] text-brand-forest leading-relaxed">
          <span className="bg-brand-teal text-white font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0">
            🟡 DEMO MODE
          </span>
          <span>
            "SMS delivery is simulated for this prototype."
          </span>
        </div>

        {/* SMS Message Preview Bubble */}
        <div className="space-y-1.5">
          <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-widest">
            SMS Message Preview:
          </span>
          <div className="border border-brand-teal/15 rounded-2xl bg-brand-gray/80 p-3.5 shadow-inner relative">
            <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 mb-1.5 text-[8px] text-brand-earth uppercase font-bold tracking-widest font-mono">
              <span>📱 Messages — RURALCARE</span>
              <span>Now</span>
            </div>
            <p className="text-[10px] text-brand-forest leading-relaxed font-semibold italic">
              "RuralCare: Your medicine is ready for pickup. Pickup Token: {pickupToken}. You or an authorized family member, relative, or trusted person can collect the medicine from the designated pharmacy."
            </p>
          </div>
        </div>

        {/* Collection Authorization Info */}
        <div className="bg-brand-teal/[0.02] border border-brand-teal/10 p-3.5 rounded-xl flex gap-2 text-[10px] text-brand-forest leading-relaxed font-medium">
          <Users className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
          <div>
            <strong className="block text-brand-teal uppercase text-[9px] tracking-wider mb-0.5">👤 Who Can Collect?</strong>
            "The patient or an authorized family member, relative, or trusted person can collect the medicine using the pickup token, subject to pharmacy verification."
          </div>
        </div>

      </div>
    </div>
  );
};

export default MedicineReadyCard;
