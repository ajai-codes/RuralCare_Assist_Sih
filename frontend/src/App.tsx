import React from 'react';
import { CaseProvider, useCase } from './hooks/useCase';
import Header from './components/common/Header';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import PhoneDemoDashboard from './pages/PhoneDemoDashboard';
import IvrDemoDashboard from './pages/IvrDemoDashboard';
import { User, Shield, Pill } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole } = useCase();
  const [path, setPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-brand-cream relative">
      {/* 1. Global Header showing connection status */}
      <Header />

      {/* 2. Primary Page view */}
      <div className="flex-1">
        {path === '/demo/ivr' ? (
          <IvrDemoDashboard />
        ) : (
          <>
            {currentRole === 'patient' && <PatientDashboard />}
            {currentRole === 'phone_demo' && <PhoneDemoDashboard />}
            {currentRole === 'doctor' && <DoctorDashboard />}
            {currentRole === 'pharmacy' && <PharmacyDashboard />}
          </>
        )}
      </div>

      {/* 3. Floating Role Switcher for Hackathon Judges */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-brand-forest/95 backdrop-blur border border-brand-teal/30 p-2 rounded-2xl shadow-2xl flex items-center justify-center">
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5 w-full sm:w-auto">
          {/* Patient Role Button */}
          <button
            onClick={() => {
              setCurrentRole('patient');
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              currentRole === 'patient' && path !== '/demo/ivr'
                ? 'bg-brand-teal text-white shadow-md'
                : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-forestLight'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Patient</span>
          </button>

          {/* Doctor Role Button */}
          <button
            onClick={() => {
              setCurrentRole('doctor');
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              currentRole === 'doctor' && path !== '/demo/ivr'
                ? 'bg-clinical-active text-white shadow-md'
                : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-forestLight'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Doctor</span>
          </button>

          {/* Pharmacy Role Button */}
          <button
            onClick={() => {
              setCurrentRole('pharmacy');
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new Event('popstate'));
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              currentRole === 'pharmacy' && path !== '/demo/ivr'
                ? 'bg-clinical-routine text-white shadow-md'
                : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-forestLight'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Pharmacy</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CaseProvider>
      <AppContent />
    </CaseProvider>
  );
};

export default App;
