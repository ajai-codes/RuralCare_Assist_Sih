import React from 'react';
import { useCase } from '../../hooks/useCase';
import { Bell, Trash2, HeartPulse, Clock, FileText, CheckCircle2 } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { notifications, clearNotifications, currentRole, cases } = useCase();

  const getRoleHeader = () => {
    switch (currentRole) {
      case 'patient':
        return 'Patient Health Log';
      case 'doctor':
        return 'Clinical Alerts';
      case 'pharmacy':
        return 'Pharmacy Operations Stream';
    }
  };

  // Helper to determine icon based on notification content
  const getNotificationIcon = (text: string) => {
    if (text.includes('approved') || text.includes('dispensed') || text.includes('READY')) {
      return <CheckCircle2 className="w-4 h-4 text-clinical-routine shrink-0 mt-0.5" />;
    }
    if (text.includes('Triage') || text.includes('Emergency') || text.includes('Urgent')) {
      return <HeartPulse className="w-4 h-4 text-clinical-emergency shrink-0 mt-0.5" />;
    }
    if (text.includes('AI Pipeline') || text.includes('transcribing')) {
      return <Clock className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />;
    }
    return <FileText className="w-4 h-4 text-brand-earth shrink-0 mt-0.5" />;
  };

  return (
    <aside className="w-full lg:w-80 bg-brand-cream border-t lg:border-t-0 lg:border-l border-brand-teal/10 p-5 flex flex-col h-full bg-plus-grid">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 mb-4 border-b border-brand-teal/10">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand-teal" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-forest">
            {getRoleHeader()}
          </h2>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="text-brand-earth hover:text-clinical-emergency transition-colors p-1"
            title="Clear Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] lg:max-h-none">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="w-8 h-8 text-brand-earth/30 mb-2" />
            <p className="text-xs text-brand-earth">No recent activity.</p>
            <p className="text-[10px] text-brand-earth/60 mt-1">Actions on other dashboards will stream updates here.</p>
          </div>
        ) : (
          notifications.map((note, index) => (
            <div
              key={index}
              className="flex items-start gap-2.5 p-3 rounded-lg border border-brand-teal/5 bg-white/70 shadow-sm text-xs text-brand-forest hover:bg-white transition-colors"
            >
              {getNotificationIcon(note)}
              <div className="space-y-1">
                <p className="leading-relaxed font-medium">{note}</p>
                <p className="text-[9px] text-brand-earth/80 font-mono">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dashboard quick info statistics */}
      <div className="mt-6 pt-4 border-t border-brand-teal/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-earth mb-3">
          Clinic Status Summary
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-brand-forestLight/5 border border-brand-teal/5 rounded-lg">
            <span className="block text-[10px] uppercase font-semibold text-brand-earth">Total Cases</span>
            <span className="text-base font-bold text-brand-forest">{cases.length}</span>
          </div>
          <div className="p-2.5 bg-brand-forestLight/5 border border-brand-teal/5 rounded-lg">
            <span className="block text-[10px] uppercase font-semibold text-brand-earth">Pending Dr.</span>
            <span className="text-base font-bold text-clinical-urgent">
              {cases.filter((c) => !c.doctorApproved).length}
            </span>
          </div>
          <div className="p-2.5 bg-brand-forestLight/5 border border-brand-teal/5 rounded-lg col-span-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-brand-earth">Active Pharmacy Queue</span>
                <span className="text-base font-bold text-clinical-routine">
                  {cases.filter((c) => c.doctorApproved && c.status === 'Pharmacy').length}
                </span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-clinical-emergency rounded-full animate-pulse" />
                <span className="text-[10px] text-brand-earth">
                  {cases.filter((c) => c.triagePriority === 'Emergency' && c.status === 'Pharmacy').length} Critical
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
