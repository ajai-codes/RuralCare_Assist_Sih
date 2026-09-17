import React from 'react';
import { useCase } from '../../hooks/useCase';
import { Activity, Shield, Pill, HeartHandshake, User, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentRole, activeCaseId, cases } = useCase();
  
  const activeCase = cases.find((c) => c.id === activeCaseId);

  const getRoleBadge = () => {
    switch (currentRole) {
      case 'patient':
        return {
          label: 'Patient Portal',
          icon: <HeartHandshake className="w-4 h-4 text-brand-teal" />,
          bg: 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal',
        };
      case 'doctor':
        return {
          label: 'Doctor Dashboard',
          icon: <Shield className="w-4 h-4 text-clinical-active" />,
          bg: 'bg-clinical-active/10 border-clinical-active/20 text-clinical-active',
        };
      case 'pharmacy':
        return {
          label: 'Pharmacy & Operations Hub',
          icon: <Pill className="w-4 h-4 text-clinical-routine" />,
          bg: 'bg-clinical-routine/10 border-clinical-routine/20 text-clinical-routine',
        };
      default:
        return {
          label: 'IVR & Phone Gateway',
          icon: <HeartHandshake className="w-4 h-4 text-brand-teal" />,
          bg: 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal',
        };
    }
  };

  const badge = getRoleBadge();

  return (
    <header className="sticky top-0 z-40 bg-brand-forest text-brand-cream border-b border-brand-forestLight/60 px-6 py-4 shadow-md bg-dot-grid">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Branding */}
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-brand-teal/20 p-1.5 rounded-lg border border-brand-teal/40">
              <Activity className="w-6 h-6 text-brand-teal animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-brand-cream flex items-center gap-1.5">
                RURALCARE <span className="text-brand-teal">ASSIST</span>
              </h1>
              <p className="text-xs text-brand-earth/80 font-medium tracking-wide">
                From Local Voice to Doctor-Verified Healthcare
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Context & Connection status */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Active Role Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider ${badge.bg}`}>
            {badge.icon}
            {badge.label}
          </div>

          {/* Connected Server Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-forestLight/40 border border-brand-forestLight/80 rounded-lg text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clinical-routine opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-clinical-routine"></span>
            </span>
            <span className="text-brand-cream/60 font-mono text-[10px]">REALTIME ACTIVE</span>
          </div>

          {/* Context detail */}
          {currentRole === 'patient' && activeCase && (
            <div className="hidden md:flex items-center gap-3 bg-brand-forestLight/30 border border-brand-forestLight/50 px-3 py-1.5 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 text-brand-cream/80">
                <User className="w-3.5 h-3.5 text-brand-earth" />
                <span>Patient ID: <span className="font-semibold">{activeCase.patient.patientId}</span></span>
              </div>
              <span className="w-px h-3 bg-brand-forestLight/80"></span>
              <div className="text-brand-cream/80">
                <span>Case: <span className="font-mono font-semibold text-brand-teal">{activeCase.id}</span></span>
              </div>
            </div>
          )}

          {currentRole === 'doctor' && (
            <div className="hidden md:flex items-center gap-1.5 bg-brand-forestLight/30 border border-brand-forestLight/50 px-3 py-1.5 rounded-lg text-xs text-brand-cream/80">
              <User className="w-3.5 h-3.5 text-brand-teal" />
              <span>Attending: <span className="font-semibold text-brand-cream">Dr. Ramesh Kumar</span></span>
            </div>
          )}

          {currentRole === 'pharmacy' && (
            <div className="hidden md:flex items-center gap-1.5 bg-brand-forestLight/30 border border-brand-forestLight/50 px-3 py-1.5 rounded-lg text-xs text-brand-cream/80">
              <RefreshCw className="w-3.5 h-3.5 text-brand-teal animate-spin-slow" />
              <span>Ops Center: <span className="font-semibold text-brand-cream">Melur Rural Clinic</span></span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
export default Header;
