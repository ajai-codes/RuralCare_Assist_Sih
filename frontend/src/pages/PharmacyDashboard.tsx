import React from 'react';
import { useCase } from '../hooks/useCase';
import { useRealtime } from '../hooks/useRealtime';
import IncomingCase from '../components/pharmacy/IncomingCase';
import QueueManager from '../components/pharmacy/QueueManager';
import PrescriptionView from '../components/pharmacy/PrescriptionView';
import PharmacyStatus from '../components/pharmacy/PharmacyStatus';
import Sidebar from '../components/common/Sidebar';
import { Pill, Activity, AlertTriangle, UserCheck, Layers } from 'lucide-react';

export const PharmacyDashboard: React.FC = () => {
  const { cases, activeCaseId, setActiveCaseId, updatePharmacyStatus } = useCase();

  // Enable Realtime pharmacy case updates
  useRealtime(activeCaseId);

  // Find the selected active case
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases.find((c) => c.doctorApproved);

  // Doctor approved cases en route to pharmacy or completed
  const pharmacyCases = cases.filter((c) => c.doctorApproved);

  // Stats
  const emergencyCount = pharmacyCases.filter((c) => c.triagePriority === 'Emergency' && c.status === 'Pharmacy').length;
  const urgentCount = pharmacyCases.filter((c) => c.triagePriority === 'Urgent' && c.status === 'Pharmacy').length;
  const totalIncoming = pharmacyCases.filter((c) => c.status === 'Pharmacy').length;
  const readyCount = pharmacyCases.filter((c) => c.pharmacyStatus === 'Ready').length;
  const dispensedCount = cases.filter((c) => c.status === 'Dispensed').length;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-screen bg-waves">
      {/* Main Pharmacy Dashboard Container */}
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto w-full">
        {/* Pharmacy Top Operational Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Emergency Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-emergency/5 rounded-full" />
            <div className="p-2 bg-clinical-emergencyLight border border-clinical-emergency/20 rounded-lg text-clinical-emergency shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-wide">Emergency En Route</span>
              <span className="text-xl font-black text-clinical-emergency">{emergencyCount}</span>
            </div>
          </div>

          {/* Urgent Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-urgent/5 rounded-full" />
            <div className="p-2 bg-clinical-urgentLight border border-clinical-urgent/20 rounded-lg text-clinical-urgent shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-wide">Urgent Incoming</span>
              <span className="text-xl font-black text-clinical-urgent">{urgentCount}</span>
            </div>
          </div>

          {/* Prescriptions En Route */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-active/5 rounded-full" />
            <div className="p-2 bg-clinical-activeLight border border-clinical-active/20 rounded-lg text-clinical-active shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-wide">Active In Queue</span>
              <span className="text-xl font-black text-brand-forest">{totalIncoming}</span>
            </div>
          </div>

          {/* Medicines Ready Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-routine/5 rounded-full" />
            <div className="p-2 bg-clinical-routineLight border border-clinical-routine/20 rounded-lg text-clinical-routine shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-wide">Medicines Ready</span>
              <span className="text-xl font-black text-clinical-routine">{readyCount}</span>
            </div>
          </div>

          {/* Dispensed Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-brand-forestLight/5 rounded-full" />
            <div className="p-2 bg-brand-forestLight/10 border border-brand-forestLight/20 rounded-lg text-brand-forestLight shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-brand-earth tracking-wide">Dispensed Today</span>
              <span className="text-xl font-black text-brand-forest">{dispensedCount}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Split */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Left panel: Enroute Patients Queue */}
          <div className="xl:col-span-1 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-forest pb-2 border-b border-brand-teal/5">
              Prescriptions Inbound ({pharmacyCases.length})
            </h3>
            
            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {pharmacyCases.length === 0 ? (
                <div className="text-center py-8 text-brand-earth/60 text-xs">
                  No approved prescriptions en route.
                </div>
              ) : (
                pharmacyCases.map((kase) => (
                  <IncomingCase
                    key={kase.id}
                    kase={kase}
                    isActive={activeCase?.id === kase.id}
                    onSelect={() => setActiveCaseId(kase.id)}
                    onUpdateStatus={updatePharmacyStatus}
                  />
                ))
              )}
            </div>
          </div>

          {/* Middle/Right: Operations workflow */}
          <div className="xl:col-span-3 space-y-6">
            {/* 1. Visual Queue manager tracking horizontal token sequence */}
            <QueueManager cases={cases} activeCaseId={activeCase?.id || null} />

            {activeCase ? (
              <>
                {/* 2. Pharmacy prep status bar */}
                <PharmacyStatus currentStatus={activeCase.pharmacyStatus} />

                {/* 3. Read only prescription sheet */}
                <PrescriptionView currentCase={activeCase} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-brand-teal/10 shadow-inner min-h-[300px]">
                <Pill className="w-12 h-12 text-brand-earth/30 mb-3 animate-pulse" />
                <h4 className="font-bold text-brand-forest uppercase text-xs tracking-wider">No Patient Selected</h4>
                <p className="text-xs text-brand-earth mt-1">Please select an inbound patient from the left queue to view prescription sheets.</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Operations log sidebar */}
      <Sidebar />
    </div>
  );
};

export default PharmacyDashboard;
