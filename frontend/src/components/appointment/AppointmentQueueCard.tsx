import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Activity, RefreshCw, Calendar } from 'lucide-react';
import { appointmentApi } from '../../services/phase1Api';
import type { Appointment } from '../../types';

interface Props {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onReschedule?: (apt: Appointment) => void;
}

export const AppointmentQueueCard: React.FC<Props> = ({ appointment, onCancel, onReschedule }) => {
  const [queueInfo, setQueueInfo] = useState({
    currently_serving: 1,
    people_ahead: Math.max(0, (appointment.queue_number || 1) - 1),
    estimated_wait_minutes: Math.max(0, ((appointment.queue_number || 1) - 1) * 10),
    status: appointment.status || 'Booked'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchQueue = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await appointmentApi.getQueueStatus(appointment.id);
      if (res) {
        setQueueInfo({
          currently_serving: res.currently_serving || 1,
          people_ahead: res.people_ahead ?? 0,
          estimated_wait_minutes: res.estimated_wait_minutes ?? 0,
          status: res.status || appointment.status
        });
      }
    } catch (e) {
      console.warn('Queue refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [appointment.id, appointment.status]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleCancelClick = async () => {
    if (!window.confirm(`Are you sure you want to cancel appointment ${appointment.id}? This will free up your reserved time slot.`)) {
      return;
    }

    setIsCancelling(true);
    try {
      await appointmentApi.cancel(appointment.id);
      if (onCancel) {
        onCancel(appointment.id);
      }
    } catch (e) {
      console.error('Failed to cancel appointment:', e);
    } finally {
      setIsCancelling(false);
    }
  };

  const priorityColor =
    appointment.triage_priority === 'Emergency' ? 'bg-clinical-emergency text-white' :
    appointment.triage_priority === 'Urgent' ? 'bg-clinical-urgent text-white' : 'bg-clinical-routine text-white';

  return (
    <div className="bg-white border border-brand-teal/20 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden text-left">
      
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-teal/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-teal/10 rounded-lg text-brand-teal">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-brand-forest tracking-wider">YOUR LIVE QUEUE STATUS</h4>
            <p className="text-[11px] text-brand-earth font-medium">Refreshes automatically every 10s</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityColor}`}>
            {appointment.triage_priority || 'Routine'} Priority
          </span>
          <button
            type="button"
            onClick={fetchQueue}
            className={`p-1 text-brand-earth hover:text-brand-teal transition ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh queue token position"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Appointment Info Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-brand-cream/40 p-3.5 rounded-xl border border-brand-teal/10 text-xs">
        <div>
          <span className="block text-[10px] text-brand-earth font-semibold uppercase">Doctor / Department</span>
          <span className="font-bold text-brand-forest truncate block">{appointment.department || 'General Medicine'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-brand-earth font-semibold uppercase">Date & Time Slot</span>
          <span className="font-bold text-brand-forest">{appointment.appointment_date} ({appointment.time_slot})</span>
        </div>
        <div>
          <span className="block text-[10px] text-brand-earth font-semibold uppercase">Consultation Type</span>
          <span className="font-bold text-brand-teal">{appointment.appointment_type || 'Teleconsultation'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-brand-earth font-semibold uppercase">Appointment ID</span>
          <span className="font-mono font-bold text-brand-forest">{appointment.id}</span>
        </div>
      </div>

      {/* 4-Stat Queue Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {/* Your Queue Token */}
        <div className="bg-brand-forest/5 border border-brand-forest/15 rounded-xl p-3">
          <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Queue Number</span>
          <span className="text-2xl font-black text-brand-forest">#{appointment.queue_number || 1}</span>
        </div>

        {/* Currently Serving */}
        <div className="bg-clinical-routineLight/50 border border-clinical-routine/20 rounded-xl p-3">
          <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Currently Serving</span>
          <span className="text-2xl font-black text-clinical-routine">#{queueInfo.currently_serving}</span>
        </div>

        {/* People Ahead */}
        <div className="bg-clinical-urgentLight/50 border border-clinical-urgent/20 rounded-xl p-3">
          <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">People Ahead</span>
          <span className="text-2xl font-black text-clinical-urgent">{queueInfo.people_ahead}</span>
        </div>

        {/* Estimated Wait */}
        <div className="bg-brand-teal/10 border border-brand-teal/20 rounded-xl p-3">
          <span className="block text-[10px] uppercase font-bold text-brand-earth tracking-wide">Estimated Wait</span>
          <span className="text-xl font-black text-brand-teal flex items-center justify-center gap-1 mt-0.5">
            <Clock className="w-4 h-4 inline" /> ~{queueInfo.estimated_wait_minutes}m
          </span>
        </div>
      </div>

      {/* Action Strip */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-teal/10">
        <span className="text-brand-earth flex items-center gap-1.5 font-medium">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clinical-routine opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-clinical-routine"></span>
          </span>
          Status: <strong className="text-brand-forest capitalize">{queueInfo.status}</strong>
        </span>

        <div className="flex items-center gap-3">
          {onReschedule && queueInfo.status !== 'Completed' && queueInfo.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              className="text-[11px] text-brand-teal hover:underline font-bold flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" /> Reschedule
            </button>
          )}

          {queueInfo.status !== 'Completed' && queueInfo.status !== 'CANCELLED' && (
            <button
              type="button"
              disabled={isCancelling}
              onClick={handleCancelClick}
              className="text-[11px] text-clinical-emergency hover:underline font-semibold"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Appointment'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
