import React, { useState, useEffect, useCallback } from 'react';
import { useCase } from '../hooks/useCase';
import { useRealtime } from '../hooks/useRealtime';
import VoiceRecorder from '../components/patient/VoiceRecorder';
import PatientRegistration from '../components/patient/PatientRegistration';
import CaseStatusJourney from '../components/patient/CaseStatus';
import QueueCard from '../components/patient/QueueCard';
import MedicineReadyCard from '../components/patient/MedicineReadyCard';
import Sidebar from '../components/common/Sidebar';
import { Mic, Phone, ChevronRight, ArrowLeft, Video, Calendar, Clock, FileText, ShieldAlert, Bell, Printer } from 'lucide-react';

import { AppointmentBookingModal } from '../components/appointment/AppointmentBookingModal';
import { AppointmentQueueCard } from '../components/appointment/AppointmentQueueCard';
import { TeleconsultationPanel } from '../components/teleconsultation/TeleconsultationPanel';
import { LongitudinalRecordModal } from '../components/patient/LongitudinalRecordModal';
import { FollowUpSlipModal } from '../components/patient/FollowUpSlipModal';
import { appointmentApi } from '../services/phase1Api';
import { api } from '../services/api';
import type { Appointment } from '../types';

export const PatientDashboard: React.FC = () => {
  const { activeCaseId, cases, patientProfile } = useCase();
  const [consultationMode, setConsultationMode] = useState<'select' | 'voice' | 'teleconsultation'>('select');
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [slipModalId, setSlipModalId] = useState<string | null>(null);
  const [followups, setFollowups] = useState<any[]>([]);

  // Reschedule state
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('10:30 AM');
  const [isRescheduling, setIsRescheduling] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  
  // Connect mock realtime handler for the active case
  useRealtime(activeCaseId);

  const currentCase = cases.find((c) => c.id === activeCaseId) || (cases.length > 0 ? cases[0] : null);

  // Fetch active appointment for currently authenticated patient
  useEffect(() => {
    const fetchPatientAppointment = async () => {
      if (!patientProfile?.patientId) return;
      try {
        const apts = await appointmentApi.list({ patient_id: patientProfile.patientId });
        if (apts && apts.length > 0) {
          const active = apts.find(a => a.status === 'Booked' || a.status === 'In-Queue' || a.status === 'Scheduled') || apts[0];
          setActiveAppointment(active);
        } else {
          setActiveAppointment(null);
        }
      } catch (e) {
        console.error('Failed to load patient appointment:', e);
        setActiveAppointment(null);
      }
    };
    fetchPatientAppointment();
  }, [patientProfile?.patientId]);

  const loadFollowups = useCallback(async () => {
    try {
      const pid = patientProfile?.patientId;
      if (!pid) {
        setFollowups([]);
        return;
      }
      const list = await api.getFollowUps(pid);
      setFollowups(list || []);
    } catch (e) {
      console.error('Failed to load patient follow-ups:', e);
      setFollowups([]);
    }
  }, [patientProfile?.patientId]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  const handleRescheduleSubmit = async () => {
    if (!rescheduleApt || !rescheduleDate || !rescheduleSlot) return;
    setIsRescheduling(true);
    try {
      const updated = await appointmentApi.reschedule(rescheduleApt.id, rescheduleDate, rescheduleSlot);
      if (updated) {
        setActiveAppointment(updated);
      } else {
        setActiveAppointment(prev => prev ? { ...prev, appointment_date: rescheduleDate, time_slot: rescheduleSlot } : null);
      }
      setRescheduleApt(null);
      alert('Appointment rescheduled successfully!');
    } catch (e: any) {
      alert(e.message || 'Failed to reschedule appointment');
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-screen bg-waves">
      {/* Longitudinal Health Record Modal */}
      <LongitudinalRecordModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        patientId={patientProfile?.patientId || ''}
        patientName={patientProfile?.name}
      />

      {/* Follow-Up Slip Printable Modal */}
      {slipModalId && (
        <FollowUpSlipModal
          isOpen={!!slipModalId}
          onClose={() => setSlipModalId(null)}
          followupId={slipModalId}
          userRole="patient"
        />
      )}

      {/* Appointment Booking Modal */}
      <AppointmentBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        triagePriority={currentCase?.triagePriority || 'Urgent'}
        caseId={currentCase?.id}
        onBookingSuccess={(apt) => {
          setActiveAppointment(apt);
        }}
      />

      {/* Main Panel */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Welcome Block */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-brand-forest text-brand-cream p-6 rounded-2xl shadow-sm border border-brand-forestLight bg-dot-grid relative overflow-hidden text-left">
          <div className="absolute right-0 bottom-0 text-brand-teal/10 font-bold text-7xl uppercase leading-none pointer-events-none select-none translate-y-2 translate-x-2">
            CARE
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Hello, {currentCase?.patient.name || 'Patient'}
            </h2>
            <p className="text-xs text-brand-earth/95 mt-1 max-w-md">
              Welcome to your digital care companion. Access priority triage, appointments, and live video teleconsultations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-forestLight border border-brand-teal/30 text-brand-cream rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-forest transition shadow"
            >
              <FileText className="w-4 h-4 text-brand-teal" /> Care History
            </button>
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-tealDark transition shadow"
            >
              <Calendar className="w-4 h-4" /> Book Appointment
            </button>
          </div>
        </div>

        {/* Priority Emergency Protocol Alert (If Clinician Validated Emergency) */}
        {currentCase?.triagePriority === 'Emergency' && (
          <div className="bg-clinical-emergencyLight border-2 border-clinical-emergency/40 p-5 rounded-2xl shadow-md text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-clinical-emergency text-white rounded-xl shadow shrink-0 animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-clinical-emergency text-white mb-1">
                  🚨 Priority Emergency Escalation Active
                </span>
                <h3 className="text-sm font-extrabold text-clinical-emergency">
                  Immediate Emergency Care / Hospital Referral Triggered
                </h3>
                <p className="text-xs text-brand-forest font-semibold mt-0.5">
                  Your clinical case has been validated by medical officers as <strong>EMERGENCY</strong>. Normal routine video and appointment queues are bypassed for immediate care.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConsultationMode('teleconsultation')}
                className="px-4 py-2 bg-clinical-emergency text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition shadow flex items-center gap-1.5"
              >
                <Video className="w-4 h-4" /> Direct Emergency Call
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Live Appointment Queue Tracker */}
        {activeAppointment && activeAppointment.status !== 'CANCELLED' && (
          <AppointmentQueueCard
            appointment={activeAppointment}
            onCancel={() => setActiveAppointment(null)}
            onReschedule={(apt) => {
              setRescheduleApt(apt);
              setRescheduleDate(apt.appointment_date || todayStr);
              setRescheduleSlot(apt.time_slot || '10:30 AM');
            }}
          />
        )}

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left / Middle: Interaction Area (Colspan 2) */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Consultation Access choice section */}
            {consultationMode === 'select' ? (
              <div className="bg-white border border-brand-teal/15 p-6 rounded-2xl shadow-sm space-y-5 bg-plus-grid text-left">
                <div className="flex items-center justify-between border-b border-brand-teal/5 pb-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-brand-forest tracking-wider">
                      Start Consultation
                    </h3>
                    <p className="text-xs text-brand-earth mt-1 font-bold">
                      Choose how you want to access Rural Triage & Specialist Care
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookingOpen(true)}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-brand-teal/10 text-brand-teal rounded-lg text-xs font-bold hover:bg-brand-teal/20 transition"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Book Slot
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Voice Consultation */}
                  <div className="border border-brand-teal/10 hover:border-brand-teal/30 p-5 rounded-xl space-y-4 flex flex-col justify-between transition bg-brand-gray/20">
                    <div className="space-y-2">
                      <div className="w-10 h-10 bg-brand-teal/10 text-brand-teal rounded-lg flex items-center justify-center border border-brand-teal/20">
                        <Mic className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-black text-brand-forest uppercase tracking-wide">
                        🎙️ Voice Consultation
                      </h4>
                      <p className="text-[11px] text-brand-earth leading-relaxed font-semibold">
                        Speak directly using your device microphone for AI triage and summary.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConsultationMode('voice')}
                      className="bg-brand-teal text-white w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-teal/95 transition flex items-center justify-center gap-1 shadow"
                    >
                      <span>Start Voice Consult</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 2: Video Teleconsultation */}
                  <div className="border border-brand-teal/10 hover:border-brand-teal/30 p-5 rounded-xl space-y-4 flex flex-col justify-between transition bg-brand-gray/20 relative">
                    <span className="absolute right-3 top-3 bg-brand-teal text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-brand-teal/25 shadow-sm">
                      Phase 1 Live
                    </span>
                    <div className="space-y-2">
                      <div className="w-10 h-10 bg-brand-teal/10 text-brand-teal rounded-lg flex items-center justify-center border border-brand-teal/20">
                        <Video className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs font-black text-brand-forest uppercase tracking-wide">
                        📹 Video Teleconsult
                      </h4>
                      <p className="text-[11px] text-brand-earth leading-relaxed font-semibold">
                        Connect live via WebRTC video call with an on-duty specialist or doctor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConsultationMode('teleconsultation')}
                      className="bg-brand-teal text-white w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-teal/95 transition flex items-center justify-center gap-1 shadow"
                    >
                      <span>Join Teleconsult</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 3: IVR Demo */}
                  <div className="border border-brand-teal/10 hover:border-brand-teal/30 p-5 rounded-xl space-y-4 flex flex-col justify-between transition bg-brand-gray/20 relative">
                    <span className="absolute right-3 top-3 bg-brand-teal text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-brand-teal/25 shadow-sm">
                      Prototype
                    </span>
                    <div className="space-y-2">
                      <div className="w-10 h-10 bg-brand-forest/10 text-brand-forest rounded-lg flex items-center justify-center border border-brand-forest/20">
                        <Phone className="w-5 h-5 text-brand-teal" />
                      </div>
                      <h4 className="text-xs font-black text-brand-forest uppercase tracking-wide">
                        📞 IVR Phone Demo
                      </h4>
                      <p className="text-[11px] text-brand-earth leading-relaxed font-semibold">
                        Access Rural Triage via simulated IVR phone system for basic phones.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          window.history.pushState({}, '', '/demo/ivr');
                          window.dispatchEvent(new Event('popstate'));
                        }}
                        className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1 shadow-md"
                      >
                        <span>Start IVR Demo</span>
                        <ChevronRight className="w-3.5 h-3.5 text-brand-teal" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : consultationMode === 'voice' ? (
              <div className="space-y-4 text-left">
                <button
                  type="button"
                  onClick={() => setConsultationMode('select')}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-teal font-black uppercase tracking-wider hover:text-brand-teal/80 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>↩ Back to selection</span>
                </button>
                <VoiceRecorder />
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <button
                  type="button"
                  onClick={() => setConsultationMode('select')}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-teal font-black uppercase tracking-wider hover:text-brand-teal/80 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>↩ Back to selection</span>
                </button>
                <div className="bg-white border border-brand-teal/20 rounded-2xl p-6 shadow-sm">
                  <TeleconsultationPanel role="patient" patientId={patientProfile?.patientId} />
                </div>
              </div>
            )}

            {/* 2. Demographic and Medical Profile */}
            <PatientRegistration />
          </div>

          {/* Right Column: Status & Directives */}
          <div className="space-y-6">
            {/* Scheduled High-Risk Follow-Ups Card */}
            {followups.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-2xl shadow-sm text-left space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-600 animate-bounce" /> High-Risk Follow-Up Reminders ({followups.length})
                  </h4>
                  <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                    Clinical Care Continuity
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {followups.map((fu: any) => (
                    <div key={fu.id} className="p-3 bg-white border border-amber-200 rounded-xl space-y-1.5 shadow-sm text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-950">
                        <span>📅 Due: {fu.follow_up_date} ({fu.follow_up_time || '10:00 AM'})</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-black ${
                          fu.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fu.status || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] font-medium">Instructions: {fu.reason}</p>
                      
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-500">
                          {fu.notification_mode === 'SMS_AND_APP' ? '📲 SMS Reminder Dispatched' : '🖨️ Printable Slip Mode'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSlipModalId(fu.id)}
                          className="px-2.5 py-1 bg-brand-forest text-brand-cream hover:bg-brand-forest/90 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <Printer className="w-3 h-3 text-brand-teal" /> View Reminder Slip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Operational Queue and wait card */}
            {currentCase ? (
              <QueueCard currentCase={currentCase} />
            ) : (
              <div className="bg-white border border-brand-teal/15 p-6 rounded-2xl shadow-sm text-center space-y-2">
                <FileText className="w-8 h-8 text-brand-teal/40 mx-auto" />
                <h4 className="text-sm font-bold text-brand-forest">No Active Triage Record</h4>
                <p className="text-xs text-brand-earth">You currently have no active triage cases. Speak into the microphone or book an appointment to initiate digital triage.</p>
              </div>
            )}

            {/* Medicine Ready Card (when READY_FOR_PICKUP) */}
            {currentCase && currentCase.pharmacyStatus === 'Ready' && (
              <MedicineReadyCard currentCase={currentCase} />
            )}

          </div>
        </div>

        {/* Journey tracker - full-width bottom strip */}
        {currentCase ? (
          <CaseStatusJourney currentCase={currentCase} />
        ) : (
          <div className="bg-white/80 border border-brand-teal/10 p-4 rounded-xl text-center text-xs text-brand-earth font-medium">
            No current case journey active.
          </div>
        )}
      </main>

      {/* Patient Reschedule Modal */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-brand-teal/20 text-left">
            <h3 className="font-bold text-sm text-brand-forest flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-teal" /> Reschedule Appointment ({rescheduleApt.id})
            </h3>
            <p className="text-xs text-brand-earth">
              Choose a new available date and time slot. Your previous slot will be freed.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-brand-forest block">Select New Date</label>
              <input
                type="date"
                min={todayStr}
                value={rescheduleDate}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full p-2.5 border border-brand-teal/20 rounded-xl outline-none"
              />

              <label className="font-bold text-brand-forest block pt-2">Select New Time Slot</label>
              <select
                value={rescheduleSlot}
                onChange={e => setRescheduleSlot(e.target.value)}
                className="w-full p-2.5 border border-brand-teal/20 rounded-xl outline-none"
              >
                {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setRescheduleApt(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-brand-earth hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRescheduling}
                onClick={handleRescheduleSubmit}
                className="px-4 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold hover:bg-brand-tealDark shadow"
              >
                {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operations logs Sidebar */}
      <Sidebar />
    </div>
  );
};

export default PatientDashboard;
