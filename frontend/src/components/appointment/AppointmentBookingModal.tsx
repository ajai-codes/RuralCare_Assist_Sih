import React, { useState } from 'react';
import { Calendar, ShieldAlert, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { appointmentApi } from '../../services/phase1Api';
import type { Appointment, TriageLevel } from '../../types';


interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  patientName?: string;
  recommendedFacility?: string;
  triagePriority?: TriageLevel;
  caseId?: string;
  onBookingSuccess?: (apt: Appointment) => void;
}

const TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM'
];

export const AppointmentBookingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  patientId = '',
  patientName = 'Patient',
  recommendedFacility = 'Government Primary Health Centre (PHC)',
  triagePriority = 'Urgent',
  caseId,
  onBookingSuccess
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [selectedFacility, setSelectedFacility] = useState(recommendedFacility);
  const [selectedDepartment, setSelectedDepartment] = useState('General Medicine');
  const [selectedDoctor, setSelectedDoctor] = useState('Dr. Kumar (General Physician)');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:30 AM');
  const [appointmentType, setAppointmentType] = useState<'In-Person' | 'Teleconsultation'>('Teleconsultation');
  
  const [bookedSlots] = useState<string[]>(['10:00 AM']); // Mock booked slot validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedApt, setConfirmedApt] = useState<Appointment | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBooking = async () => {
    setErrorMsg(null);
    if (!selectedDate || selectedDate < todayStr) {
      setErrorMsg('Cannot book appointments for past dates.');
      return;
    }
    if (bookedSlots.includes(selectedTimeSlot)) {
      setErrorMsg(`Time slot ${selectedTimeSlot} is already booked. Please choose another slot.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await appointmentApi.create({
        patient_id: patientId,
        facility_id: '550e8400-e29b-41d4-a716-446655440000',
        doctor_id: 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7',
        department: selectedDepartment,
        appointment_date: selectedDate,
        time_slot: selectedTimeSlot,
        appointment_type: appointmentType,
        triage_priority: triagePriority,
        case_id: caseId,
        notes: `Booked via RuralCare Assist Triage (${triagePriority} Priority)`
      });

      const finalApt: Appointment = res || {
        id: `RC-APT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        patient_id: patientId,
        facility_id: '550e8400-e29b-41d4-a716-446655440000',
        doctor_id: 'd0c70d77-d0c7-d0c7-d0c7-d0c7d0c7d0c7',
        department: selectedDepartment,
        appointment_date: selectedDate,
        time_slot: selectedTimeSlot,
        appointment_type: appointmentType,
        status: 'Booked',
        triage_priority: triagePriority,
        queue_number: 4,
        estimated_wait_minutes: 20,
        case_id: caseId,
        created_at: new Date().toISOString()
      };

      setConfirmedApt(finalApt);
      if (onBookingSuccess) onBookingSuccess(finalApt);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to book appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-brand-teal/20 space-y-0 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-brand-forest p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-teal" />
            <h3 className="font-bold text-base">Book Appointment</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition text-brand-cream/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="bg-clinical-emergencyLight border border-clinical-emergency/20 text-clinical-emergency p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {confirmedApt ? (
            /* Confirmation Card */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-clinical-routineLight text-clinical-routine rounded-full flex items-center justify-center mx-auto border border-clinical-routine/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-black text-brand-forest">Appointment Confirmed ✓</h4>
                <p className="text-xs text-brand-earth mt-0.5">Your slot and queue number have been reserved.</p>
              </div>

              <div className="bg-brand-cream/40 border border-brand-teal/15 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Appointment ID:</span>
                  <span className="font-mono font-bold text-brand-forest">{confirmedApt.id}</span>
                </div>
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Patient:</span>
                  <span className="font-bold text-brand-forest">{patientName}</span>
                </div>
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Facility:</span>
                  <span className="font-bold text-brand-forest">{selectedFacility}</span>
                </div>
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Doctor:</span>
                  <span className="font-bold text-brand-forest">{selectedDoctor}</span>
                </div>
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Date & Time:</span>
                  <span className="font-bold text-brand-teal">{selectedDate} @ {selectedTimeSlot}</span>
                </div>
                <div className="flex justify-between border-b border-brand-teal/10 pb-1.5">
                  <span className="text-brand-earth">Type:</span>
                  <span className="font-bold text-brand-forest">{appointmentType}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-brand-earth">Queue Priority:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    triagePriority === 'Emergency' ? 'bg-clinical-emergencyLight text-clinical-emergency' :
                    triagePriority === 'Urgent' ? 'bg-clinical-urgentLight text-clinical-urgent' : 'bg-clinical-routineLight text-clinical-routine'
                  }`}>
                    #{confirmedApt.queue_number || 4} ({triagePriority})
                  </span>
                </div>
              </div>

              <button onClick={onClose} className="w-full bg-brand-forest text-brand-cream py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-brand-forestLight transition shadow">
                Done & View Live Queue
              </button>
            </div>
          ) : (
            /* Booking Form */
            <div className="space-y-4 text-left text-xs">
              
              {/* Triage Priority Banner */}
              {triagePriority === 'Emergency' ? (
                <div className="bg-clinical-emergencyLight border border-clinical-emergency/30 p-3 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-clinical-emergency">
                      <ShieldAlert className="w-4 h-4 animate-pulse" />
                      <span className="font-bold text-xs uppercase tracking-wider">🚨 Emergency Protocol Active</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-clinical-emergency text-white">
                      EMERGENCY
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-forest font-medium">
                    This case is validated as an <strong>Emergency</strong>. Normal routine queues are bypassed for immediate care or tertiary hospital referral.
                  </p>
                </div>
              ) : (
                <div className="bg-brand-teal/10 border border-brand-teal/20 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-brand-teal" />
                    <span className="font-bold text-brand-forest">Doctor Validated Priority:</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    triagePriority === 'Urgent' ? 'bg-clinical-urgent text-white' : 'bg-clinical-routine text-white'
                  }`}>
                    {triagePriority} Priority
                  </span>
                </div>
              )}

              {/* Consultation Type Selector */}
              <div className="space-y-1">
                <label className="font-bold text-brand-forest">Consultation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAppointmentType('Teleconsultation')}
                    className={`py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      appointmentType === 'Teleconsultation'
                        ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                        : 'bg-white text-brand-forest border-brand-gray hover:bg-brand-gray/30'
                    }`}
                  >
                    📹 Video Teleconsult
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentType('In-Person')}
                    className={`py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      appointmentType === 'In-Person'
                        ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                        : 'bg-white text-brand-forest border-brand-gray hover:bg-brand-gray/30'
                    }`}
                  >
                    🏥 In-Person PHC Visit
                  </button>
                </div>
              </div>

              {/* Facility & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-brand-forest">Facility</label>
                  <input
                    type="text"
                    value={selectedFacility}
                    onChange={e => setSelectedFacility(e.target.value)}
                    className="w-full bg-brand-gray/30 border border-brand-gray/60 rounded-xl px-3 py-2 text-brand-forest outline-none focus:ring-1 focus:ring-brand-teal font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-brand-forest">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={e => setSelectedDepartment(e.target.value)}
                    className="w-full bg-brand-gray/30 border border-brand-gray/60 rounded-xl px-3 py-2 text-brand-forest outline-none focus:ring-1 focus:ring-brand-teal font-medium"
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Emergency">Emergency Care</option>
                  </select>
                </div>
              </div>

              {/* Doctor & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-brand-forest">Doctor</label>
                  <select
                    value={selectedDoctor}
                    onChange={e => setSelectedDoctor(e.target.value)}
                    className="w-full bg-brand-gray/30 border border-brand-gray/60 rounded-xl px-3 py-2 text-brand-forest outline-none focus:ring-1 focus:ring-brand-teal font-medium"
                  >
                    <option value="Dr. Kumar (General Physician)">Dr. Kumar (General Physician)</option>
                    <option value="Dr. Anitha (Cardiologist)">Dr. Anitha (Cardiologist)</option>
                    <option value="On-Duty Medical Officer">On-Duty Medical Officer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-brand-forest">Appointment Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full bg-brand-gray/30 border border-brand-gray/60 rounded-xl px-3 py-2 text-brand-forest outline-none focus:ring-1 focus:ring-brand-teal font-medium"
                  />
                </div>
              </div>

              {/* Time Slots Grid */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-brand-forest flex items-center justify-between">
                  <span>Available Time Slots</span>
                  <span className="text-[10px] text-brand-earth font-normal">Slot duration: 30 mins</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {TIME_SLOTS.map(slot => {
                    const isBooked = bookedSlots.includes(slot);
                    const isSelected = selectedTimeSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold transition border ${
                          isBooked
                            ? 'bg-gray-100 text-gray-400 border-gray-200 line-through cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-teal text-white border-brand-teal shadow-sm'
                            : 'bg-white text-brand-forest border-brand-gray hover:border-brand-teal/40'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBooking}
                  className="w-full bg-brand-teal hover:bg-brand-tealDark text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Confirming Booking...' : 'Confirm & Reserve Slot'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
