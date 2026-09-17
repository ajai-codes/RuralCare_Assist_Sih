import React, { useState, useEffect, useCallback } from 'react';
import { useCase } from '../hooks/useCase';
import { useRealtime } from '../hooks/useRealtime';
import PatientCaseCard from '../components/doctor/PatientCaseCard';
import ClinicalSummary from '../components/doctor/ClinicalSummary';
import TriagePanel from '../components/doctor/TriagePanel';
import PrescriptionForm from '../components/doctor/PrescriptionForm';
import Sidebar from '../components/common/Sidebar';
import { Heart, Activity, AlertTriangle, Search, Calendar, UserCheck, UserX, Clock, CalendarDays, FileText, Bell, Printer, Plus } from 'lucide-react';
import { TeleconsultationPanel } from '../components/teleconsultation/TeleconsultationPanel';
import { appointmentApi } from '../services/phase1Api';
import { api } from '../services/api';
import type { Appointment } from '../types';
import { LongitudinalRecordModal } from '../components/patient/LongitudinalRecordModal';
import { FollowUpSlipModal } from '../components/patient/FollowUpSlipModal';

export const DoctorDashboard: React.FC = () => {
  const { cases, activeCaseId, setActiveCaseId, updateTriage, approvePrescription } = useCase();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'appointments' | 'walkin_cases' | 'followups'>('appointments');
  
  // Appointments state
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts] = useState(false);
  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [newRescheduleSlot, setNewRescheduleSlot] = useState('10:30 AM');
  const [actionError, setActionError] = useState<string | null>(null);

  // Longitudinal Care History & Follow-Up modal state
  const [historyPatient, setHistoryPatient] = useState<{ id: string; name: string } | null>(null);
  const [slipModalId, setSlipModalId] = useState<string | null>(null);
  const [doctorFollowups, setDoctorFollowups] = useState<any[]>([]);
  const [isCreateFollowupOpen, setIsCreateFollowupOpen] = useState(false);

  // Follow-up form fields
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [fuDate, setFuDate] = useState(tomorrowStr);
  const [fuTime, setFuTime] = useState('10:00 AM');
  const [fuRisk, setFuRisk] = useState('HIGH');
  const [fuReason, setFuReason] = useState('Post-triage clinical re-assessment and medication evaluation');
  const [fuNotes, setFuNotes] = useState('Bring previous prescription slip and lab reports.');

  const todayStr = new Date().toISOString().split('T')[0];

  // Enable Supabase Realtime case updates
  useRealtime(activeCaseId);

  // Fetch appointments for today
  const loadAppointments = useCallback(async () => {
    setLoadingApts(true);
    try {
      const apts = await appointmentApi.list({
        facility_id: '550e8400-e29b-41d4-a716-446655440000',
        appointment_date: todayStr
      });
      setTodayAppointments(apts || []);
    } catch (e) {
      console.error('Failed to load doctor appointments:', e);
    } finally {
      setLoadingApts(false);
    }
  }, [todayStr]);

  const loadFollowups = useCallback(async () => {
    try {
      const list = await api.getFollowUps();
      setDoctorFollowups(list || []);
    } catch (e) {
      console.error('Failed to load doctor follow-ups:', e);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
    loadFollowups();
    const interval = setInterval(() => {
      loadAppointments();
      loadFollowups();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadAppointments, loadFollowups]);

  // Selected case
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  // Filter cases based on search term
  const filteredCases = cases.filter(
    (c) =>
      c.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter appointments
  const filteredAppointments = todayAppointments.filter(
    (a) =>
      (a.patients?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter follow-ups
  const filteredFollowups = doctorFollowups.filter(
    (f) =>
      (f.patients?.name || f.patient_name || 'Selva').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.reason || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Action handlers
  const handleCheckIn = async (aptId: string) => {
    setActionError(null);
    try {
      await appointmentApi.checkIn(aptId);
      loadAppointments();
    } catch (e: any) {
      setActionError(e.message || 'Check-in failed');
    }
  };

  const handleMarkNoShow = async (aptId: string) => {
    setActionError(null);
    if (!window.confirm('Are you sure you want to mark this patient as No-show?')) return;
    try {
      await appointmentApi.markNoShow(aptId);
      loadAppointments();
    } catch (e: any) {
      setActionError(e.message || 'Failed to mark No-show');
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleApt || !newRescheduleDate || !newRescheduleSlot) return;
    setActionError(null);
    try {
      await appointmentApi.reschedule(rescheduleApt.id, newRescheduleDate, newRescheduleSlot);
      setRescheduleApt(null);
      loadAppointments();
      alert('Appointment rescheduled successfully!');
    } catch (e: any) {
      setActionError(e.message || 'Failed to reschedule appointment');
    }
  };

  const handleCreateFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase) return;
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'doctor' },
        body: JSON.stringify({
          case_id: activeCase.id,
          patient_id: activeCase.patient.patientId || 'PA-2410',
          doctor_name: 'Dr. Anand Sharma',
          follow_up_date: fuDate,
          follow_up_time: fuTime,
          risk_level: fuRisk,
          reason: fuReason,
          notes: fuNotes
        })
      });
      if (!res.ok) throw new Error('Failed to create follow-up');
      alert('High-Risk Follow-Up successfully scheduled and logged to patient record!');
      setIsCreateFollowupOpen(false);
      loadFollowups();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule follow-up');
    }
  };

  const handleTriggerReminder = async (id: string) => {
    try {
      const res = await api.triggerFollowUpReminder(id);
      alert(res.notification || 'Reminder triggered!');
      loadFollowups();
    } catch (e: any) {
      alert(e.message || 'Failed to trigger reminder');
    }
  };

  const handleCompleteFollowup = async (id: string) => {
    if (!window.confirm('Mark this follow-up as COMPLETED upon patient return?')) return;
    try {
      await api.completeFollowUp(id, 'Patient attended follow-up clinic. Clinical re-assessment completed.');
      alert('Follow-Up marked as COMPLETED and logged into Longitudinal Care History.');
      loadFollowups();
    } catch (e: any) {
      alert(e.message || 'Failed to complete follow-up');
    }
  };

  // Stats calculation
  const emergencyCount = cases.filter((c) => c.triagePriority === 'Emergency' && !c.doctorApproved).length +
    todayAppointments.filter((a) => a.triage_priority === 'Emergency' && a.status !== 'Completed' && a.status !== 'CANCELLED').length;
  
  const urgentCount = cases.filter((c) => c.triagePriority === 'Urgent' && !c.doctorApproved).length +
    todayAppointments.filter((a) => a.triage_priority === 'Urgent' && a.status !== 'Completed' && a.status !== 'CANCELLED').length;

  const totalTodayApts = todayAppointments.filter(a => a.status !== 'CANCELLED').length;


  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-screen bg-waves">
      {/* Main Clinical Console */}
      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto w-full">
        
        {/* Top metrics summary grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Emergency Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-emergency/5 rounded-full" />
            <div className="p-2 bg-clinical-emergencyLight border border-clinical-emergency/20 rounded-lg text-clinical-emergency">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Emergency Cases</span>
              <span className="text-xl font-black text-clinical-emergency">{emergencyCount}</span>
            </div>
          </div>

          {/* Urgent Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-urgent/5 rounded-full" />
            <div className="p-2 bg-clinical-urgentLight border border-clinical-urgent/20 rounded-lg text-clinical-urgent">
              <Heart className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Urgent Priority</span>
              <span className="text-xl font-black text-clinical-urgent">{urgentCount}</span>
            </div>
          </div>

          {/* Today's Scheduled Appointments */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-clinical-active/5 rounded-full" />
            <div className="p-2 bg-clinical-activeLight border border-clinical-active/20 rounded-lg text-clinical-active">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Today's Appointments</span>
              <span className="text-xl font-black text-brand-forest">{totalTodayApts}</span>
            </div>
          </div>

          {/* High-Risk Follow-Ups Counter */}
          <div className="bg-white border border-brand-teal/10 rounded-xl p-4 shadow-sm flex items-center gap-3 relative overflow-hidden">
            <span className="absolute -right-2 -bottom-2 h-10 w-10 bg-amber-500/5 rounded-full" />
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Scheduled Follow-Ups</span>
              <span className="text-xl font-black text-amber-700">{doctorFollowups.length}</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs: Appointments vs Walk-in Cases vs High-Risk Follow-Ups */}
        <div className="flex flex-wrap items-center justify-between border-b border-brand-teal/15 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                activeTab === 'appointments'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-white text-brand-forest hover:bg-brand-gray/40 border border-brand-teal/10'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>📅 Appointments ({todayAppointments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('walkin_cases')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                activeTab === 'walkin_cases'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-white text-brand-forest hover:bg-brand-gray/40 border border-brand-teal/10'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>🎙️ Voice Cases ({cases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('followups')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                activeTab === 'followups'
                  ? 'bg-brand-teal text-white shadow-sm'
                  : 'bg-white text-brand-forest hover:bg-brand-gray/40 border border-brand-teal/10'
              }`}
            >
              <Bell className="w-4 h-4 text-amber-300" />
              <span>🔔 Follow-Ups ({doctorFollowups.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateFollowupOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow"
            >
              <Plus className="w-4 h-4" /> Schedule Follow-Up
            </button>
            <button
              onClick={() => { loadAppointments(); loadFollowups(); }}
              className="text-xs text-brand-teal hover:underline font-semibold flex items-center gap-1"
            >
              Refresh Queue
            </button>
          </div>
        </div>

        {actionError && (
          <div className="bg-clinical-emergencyLight text-clinical-emergency border border-clinical-emergency/20 p-3 rounded-xl text-xs font-bold">
            {actionError}
          </div>
        )}

        {/* TAB 1: SCHEDULED APPOINTMENTS & QUEUE MANAGEMENT */}
        {activeTab === 'appointments' ? (
          <div className="bg-white border border-brand-teal/20 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-teal/10 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-brand-forest tracking-wider">
                  TODAY'S CLINICAL APPOINTMENT SCHEDULE & QUEUE
                </h3>
                <p className="text-xs text-brand-earth font-medium">Manage patient check-in, priority queue, no-shows, and video sessions</p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-brand-earth absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter patient or ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-brand-teal/20 rounded-lg outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>
            </div>

            {/* Appointments Table */}
            {loadingApts && todayAppointments.length === 0 ? (
              <div className="text-center py-10 text-brand-earth text-xs font-semibold animate-pulse">
                Loading today's appointment queue...
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-10 text-brand-earth/60 text-xs font-semibold">
                No appointments scheduled for today.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-teal/15 text-brand-forest font-black uppercase text-[10px] tracking-wider bg-brand-cream/40">
                      <th className="p-3">Queue #</th>
                      <th className="p-3">Time Slot</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Doctor Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-teal/10">
                    {filteredAppointments.map((apt) => {
                      const priorityStyle =
                        apt.triage_priority === 'Emergency' ? 'bg-clinical-emergency text-white' :
                        apt.triage_priority === 'Urgent' ? 'bg-clinical-urgent text-white' :
                        'bg-clinical-routine text-white';

                      const statusStyle =
                        apt.status === 'Checked In' ? 'bg-clinical-activeLight text-clinical-active' :
                        apt.status === 'In Consultation' ? 'bg-clinical-routineLight text-clinical-routine font-bold' :
                        apt.status === 'Completed' ? 'bg-gray-100 text-gray-600' :
                        apt.status === 'No-show' || apt.status === 'CANCELLED' ? 'bg-gray-100 text-gray-400 line-through' :
                        'bg-brand-cream/60 text-brand-forest';

                      const patientName = apt.patients?.name || 'Selva';

                      return (
                        <tr key={apt.id} className="hover:bg-brand-gray/20 transition">
                          <td className="p-3 font-mono font-black text-brand-forest text-sm">
                            #{apt.queue_number || 1}
                          </td>
                          <td className="p-3 font-bold text-brand-teal">
                            {apt.time_slot}
                          </td>
                          <td className="p-3 font-bold text-brand-forest">
                            {patientName}
                            <span className="block text-[10px] font-normal text-brand-earth">{apt.id}</span>
                          </td>
                          <td className="p-3 font-medium text-brand-forest">
                            {apt.department || 'General Medicine'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${apt.appointment_type === 'Teleconsultation' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {apt.appointment_type === 'Teleconsultation' ? '📹 Video' : '🏥 In-Person'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${priorityStyle}`}>
                              {apt.triage_priority || 'Routine'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>
                              {apt.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Longitudinal Record Action */}
                              <button
                                type="button"
                                onClick={() => setHistoryPatient({ id: apt.patient_id || 'PA-2410', name: patientName })}
                                className="px-2 py-1 bg-brand-forest text-brand-cream hover:bg-brand-forest/90 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                                title="View Patient Care Record History"
                              >
                                <FileText className="w-3 h-3 text-brand-teal" /> Care History
                              </button>

                              {/* Check In Action */}
                              {apt.status === 'Booked' && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(apt.id)}
                                  className="px-2.5 py-1 bg-clinical-active text-white rounded-lg text-[10px] font-bold hover:bg-clinical-active/90 transition shadow-sm flex items-center gap-1"
                                >
                                  <UserCheck className="w-3 h-3" /> Check In
                                </button>
                              )}

                              {/* Reschedule Action */}
                              {apt.status !== 'Completed' && apt.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRescheduleApt(apt);
                                    setNewRescheduleDate(apt.appointment_date || todayStr);
                                    setNewRescheduleSlot(apt.time_slot || '10:30 AM');
                                  }}
                                  className="px-2 py-1 bg-white border border-brand-teal/30 hover:bg-brand-gray/30 text-brand-forest rounded-lg text-[10px] font-bold transition"
                                >
                                  Reschedule
                                </button>
                              )}

                              {/* Mark No-Show Action */}
                              {(apt.status === 'Booked' || apt.status === 'Checked In') && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkNoShow(apt.id)}
                                  className="px-2 py-1 bg-gray-100 hover:bg-red-50 text-clinical-emergency border border-clinical-emergency/20 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                  title="Mark patient as No-Show"
                                >
                                  <UserX className="w-3 h-3" /> No-Show
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'walkin_cases' ? (
          /* TAB 2: WALK-IN VOICE CASES & CLINICAL CONSOLE */
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
            {/* Left panel: Active patient list */}
            <div className="xl:col-span-1 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-brand-teal/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-forest">
                  Patient Queue ({filteredCases.length})
                </h3>
              </div>

              {/* Search filter */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-brand-earth" />
                </span>
                <input
                  type="text"
                  placeholder="Search patient or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 border border-brand-teal/15 bg-white rounded-lg focus:outline-brand-teal font-semibold text-brand-forest shadow-sm"
                />
              </div>

              {/* Case list items */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredCases.length === 0 ? (
                  <div className="text-center py-8 text-brand-earth/60 text-xs">
                    No enqueued patients.
                  </div>
                ) : (
                  filteredCases.map((kase) => (
                    <PatientCaseCard
                      key={kase.id}
                      kase={kase}
                      isActive={activeCase?.id === kase.id}
                      onSelect={() => setActiveCaseId(kase.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right panel: Case validation console */}
            <div className="xl:col-span-3 space-y-6">
              {activeCase ? (
                <>
                  {/* Doctor Care History & Schedule Follow-up Header Bar */}
                  <div className="bg-brand-cream/80 border border-brand-teal/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-brand-forest uppercase tracking-wide">Evaluating Active Case:</span>
                      <span className="font-bold text-brand-teal">{activeCase.patient.name}</span>
                      <span className="text-brand-earth">({activeCase.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreateFollowupOpen(true)}
                        className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow"
                      >
                        <Bell className="w-3.5 h-3.5" /> Schedule Follow-Up
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryPatient({ id: activeCase.patient.patientId || 'PA-2410', name: activeCase.patient.name })}
                        className="px-3 py-1.5 bg-brand-forest text-brand-cream hover:bg-brand-forest/90 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-teal" /> View Care Record
                      </button>
                    </div>
                  </div>

                  {/* 1. Clinical abstract summary and transcripts */}
                  <ClinicalSummary currentCase={activeCase} />

                  {/* 2. Referral and Triage override details */}
                  <TriagePanel currentCase={activeCase} onUpdateTriage={updateTriage} />

                  {/* 3. Prescription and clinical authorization order */}
                  <PrescriptionForm currentCase={activeCase} onApprove={approvePrescription} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-brand-teal/10 shadow-inner min-h-[300px]">
                  <Activity className="w-12 h-12 text-brand-earth/30 mb-3 animate-pulse" />
                  <h4 className="font-bold text-brand-forest uppercase text-xs tracking-wider">No Active Case Selected</h4>
                  <p className="text-xs text-brand-earth mt-1">Please select an enqueued patient from the left panel.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB 3: HIGH-RISK FOLLOW-UPS MANAGEMENT PANEL */
          <div className="bg-white border border-brand-teal/20 rounded-2xl p-6 shadow-sm space-y-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-teal/10 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-amber-600" /> HIGH-RISK PATIENT FOLLOW-UP TRACKING CONSOLE
                </h3>
                <p className="text-xs text-brand-earth font-medium">
                  Monitor post-triage follow-ups, trigger SMS reminders, print reminder slips, and log re-assessment encounters
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFollowupOpen(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow"
                >
                  <Plus className="w-4 h-4" /> Schedule New Follow-Up
                </button>
              </div>
            </div>

            {filteredFollowups.length === 0 ? (
              <div className="text-center py-12 text-brand-earth/60 text-xs font-semibold">
                No high-risk follow-ups currently scheduled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-teal/15 text-brand-forest font-black uppercase text-[10px] tracking-wider bg-amber-50/60">
                      <th className="p-3">Patient</th>
                      <th className="p-3">Follow-Up Date & Time</th>
                      <th className="p-3">Risk Level</th>
                      <th className="p-3">Clinical Instructions</th>
                      <th className="p-3">Notification Mode</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Doctor Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-teal/10">
                    {filteredFollowups.map((fu) => {
                      const ptName = fu.patients?.name || fu.patient_name || 'Selva';
                      const ptId = fu.patients?.patient_id || fu.patient_id || 'PA-2410';
                      const isPhone = fu.notification_mode === 'SMS_AND_APP';

                      return (
                        <tr key={fu.id} className="hover:bg-amber-50/30 transition">
                          <td className="p-3 font-bold text-brand-forest">
                            {ptName}
                            <span className="block text-[10px] font-normal text-brand-earth">{ptId}</span>
                          </td>
                          <td className="p-3 font-bold text-amber-900">
                            📅 {fu.follow_up_date}
                            <span className="block text-[10px] font-semibold text-slate-500">{fu.follow_up_time || '10:00 AM'}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                              {fu.risk_level || 'HIGH'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 max-w-xs truncate" title={fu.reason}>
                            {fu.reason}
                          </td>
                          <td className="p-3">
                            {isPhone ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                📲 SMS Dispatched
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                🖨️ Printable Slip Mode
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              fu.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {fu.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Trigger Reminder / Dispatch SMS Action */}
                              <button
                                type="button"
                                onClick={() => handleTriggerReminder(fu.id)}
                                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                title="Trigger SMS / Notification Reminder"
                              >
                                📲 Send Reminder
                              </button>

                              {/* View / Print Slip Action */}
                              <button
                                type="button"
                                onClick={() => setSlipModalId(fu.id)}
                                className="px-2 py-1 bg-brand-forest text-brand-cream hover:bg-brand-forest/90 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                                title="Print Official Follow-Up Reminder Slip"
                              >
                                <Printer className="w-3 h-3 text-brand-teal" /> Print Slip
                              </button>

                              {/* Complete & Re-assess Action */}
                              {fu.status !== 'COMPLETED' && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteFollowup(fu.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow flex items-center gap-1"
                                  title="Mark Follow-up as Completed upon patient return"
                                >
                                  <UserCheck className="w-3 h-3" /> Complete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Phase 1: Real Teleconsultation Room */}
        <div className="bg-white border border-brand-teal/20 rounded-2xl p-6 shadow-sm">
          <TeleconsultationPanel role="doctor" doctorId="d0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7" />
        </div>
      </main>

      {/* Doctor Schedule Follow-Up Modal */}
      {isCreateFollowupOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateFollowupSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-brand-teal/20 text-left">
            <div className="flex justify-between items-center border-b border-brand-teal/10 pb-3">
              <h3 className="font-bold text-sm text-brand-forest flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" /> Schedule High-Risk Follow-Up
              </h3>
              <button type="button" onClick={() => setIsCreateFollowupOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-brand-earth">
              Patient: <strong>{activeCase?.patient.name || 'Selva'}</strong> ({activeCase?.id || 'RT-1001'})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-brand-forest block mb-1">Follow-Up Date</label>
                <input
                  type="date"
                  min={todayStr}
                  value={fuDate}
                  onChange={e => setFuDate(e.target.value)}
                  required
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-brand-forest block mb-1">Reporting Time Slot</label>
                <select
                  value={fuTime}
                  onChange={e => setFuTime(e.target.value)}
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
                >
                  {['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-forest block mb-1">Clinical Risk Category</label>
                <select
                  value={fuRisk}
                  onChange={e => setFuRisk(e.target.value)}
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none font-bold text-amber-900 bg-amber-50"
                >
                  <option value="HIGH">🔴 HIGH RISK (Mandatory Re-assessment)</option>
                  <option value="MODERATE">🟡 MODERATE RISK (Follow-up Check)</option>
                  <option value="ROUTINE">🟢 ROUTINE (Standard Checkup)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-forest block mb-1">Clinical Reason for Follow-Up</label>
                <input
                  type="text"
                  value={fuReason}
                  onChange={e => setFuReason(e.target.value)}
                  required
                  placeholder="e.g., Post-triage chest pain re-assessment"
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-brand-forest block mb-1">Doctor's Instructions & Notes</label>
                <textarea
                  value={fuNotes}
                  onChange={e => setFuNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g., Bring previous lab reports and prescription slip."
                  className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateFollowupOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-brand-earth hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 shadow"
              >
                Schedule & Log to Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Doctor Reschedule Modal */}
      {rescheduleApt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-brand-teal/20">
            <h3 className="font-bold text-sm text-brand-forest flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-teal" /> Reschedule Appointment ({rescheduleApt.id})
            </h3>
            <p className="text-xs text-brand-earth">
              Patient: <strong>{rescheduleApt.patients?.name || 'Patient'}</strong>
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-brand-forest block">Select New Date</label>
              <input
                type="date"
                min={todayStr}
                value={newRescheduleDate}
                onChange={e => setNewRescheduleDate(e.target.value)}
                className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
              />

              <label className="font-bold text-brand-forest block pt-2">Select New Time Slot</label>
              <select
                value={newRescheduleSlot}
                onChange={e => setNewRescheduleSlot(e.target.value)}
                className="w-full p-2 border border-brand-teal/20 rounded-xl outline-none"
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
                className="px-3 py-2 rounded-xl text-xs font-bold text-brand-earth hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                className="px-4 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold hover:bg-brand-tealDark"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Longitudinal Record Modal for Doctor */}
      {historyPatient && (
        <LongitudinalRecordModal
          isOpen={!!historyPatient}
          onClose={() => setHistoryPatient(null)}
          patientId={historyPatient.id}
          patientName={historyPatient.name}
          role="doctor"
        />
      )}

      {/* Follow-Up Slip Printable Modal for Doctor */}
      {slipModalId && (
        <FollowUpSlipModal
          isOpen={!!slipModalId}
          onClose={() => setSlipModalId(null)}
          followupId={slipModalId}
          userRole="doctor"
        />
      )}

      {/* Live activity logging */}
      <Sidebar />
    </div>
  );
};

export default DoctorDashboard;


