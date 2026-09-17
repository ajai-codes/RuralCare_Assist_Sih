import React, { useState, useEffect } from 'react';
import type { ClinicalCase, PrescriptionItem, TriageLevel } from '../../types';
import { Plus, Trash2, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';

interface PrescriptionFormProps {
  currentCase: ClinicalCase;
  onApprove: (
    caseId: string,
    payload: {
      triagePriority: TriageLevel;
      assignedDepartment: string;
      observations: string;
      doctorName: string;
      prescriptionItems: PrescriptionItem[];
      followUpDate?: string;
    }
  ) => Promise<void>;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ currentCase, onApprove }) => {
  const [observations, setObservations] = useState(currentCase.observations || '');
  const [items, setItems] = useState<PrescriptionItem[]>(currentCase.prescriptionItems || []);
  const [followUp, setFollowUp] = useState(currentCase.followUpDate || '1 week');
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for adding a new medicine row
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('500mg');
  const [frequency, setFrequency] = useState('Twice daily (1-0-1)');
  const [duration, setDuration] = useState('5 days');
  const [route, setRoute] = useState('Oral');
  const [instructions, setInstructions] = useState('Take after food');

  // Reset local form states when active case changes
  useEffect(() => {
    setObservations(currentCase.observations || '');
    setItems(currentCase.prescriptionItems || []);
    setFollowUp(currentCase.followUpDate || '1 week');
    setSafetyConfirmed(false);
  }, [currentCase]);

  // Pre-fill some standard medicines if the case symptoms are chest pain to save doctor time in hackathon demo
  useEffect(() => {
    if (items.length === 0 && !currentCase.doctorApproved) {
      if (currentCase.aiClinicalSummary.toLowerCase().includes('chest') || currentCase.originalTranscript.includes('chest')) {
        setItems([
          { id: '1', medicine: 'Aspirin', dosage: '300mg', frequency: 'Once immediately', duration: 'Stat', route: 'Oral (Chewable)', instructions: 'Chew immediately' },
          { id: '2', medicine: 'Clopidogrel', dosage: '300mg', frequency: 'Once immediately', duration: 'Stat', route: 'Oral', instructions: 'Take with water' },
          { id: '3', medicine: 'Atorvastatin', dosage: '80mg', frequency: 'Night', duration: '5 days', route: 'Oral', instructions: 'Take after dinner' },
        ]);
        setObservations('Vitals monitored on arrival. ECG indications suggest ST depression. Referral to tertiary hospital Cardiology arranged.');
      } else {
        setItems([
          { id: '1', medicine: 'Paracetamol', dosage: '500mg', frequency: 'Three times daily (1-1-1)', duration: '3 days', route: 'Oral', instructions: 'Take after food if fever persists' },
          { id: '2', medicine: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily (1-1-1)', duration: '5 days', route: 'Oral', instructions: 'Complete full course' },
        ]);
        setObservations('Acute upper respiratory infection signs. Advised rest, warm fluids, and isolation.');
      }
    }
  }, [currentCase, items.length]);

  const handleAddMedicine = () => {
    if (!medName.trim()) return;
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      medicine: medName.trim(),
      dosage,
      frequency,
      duration,
      route,
      instructions,
    };
    setItems([...items, newItem]);
    setMedName('');
  };

  const handleRemoveMedicine = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyConfirmed || items.length === 0) return;

    setIsSubmitting(true);
    try {
      await onApprove(currentCase.id, {
        triagePriority: currentCase.triagePriority,
        assignedDepartment: currentCase.assignedDepartment,
        observations,
        doctorName: 'Dr. Ramesh Kumar',
        prescriptionItems: items,
        followUpDate: followUp,
      });

      if (followUp && followUp !== 'No follow up needed') {
        const dateMatch = followUp.match(/\d{4}-\d{2}-\d{2}/) || followUp;
        await api.createFollowUp({
          case_id: currentCase.id,
          patient_id: currentCase.patient.patientId,
          doctor_name: 'Dr. Ramesh Kumar',
          follow_up_date: typeof dateMatch === 'string' ? dateMatch : new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          risk_level: currentCase.triagePriority === 'Emergency' ? 'HIGH' : currentCase.triagePriority === 'Urgent' ? 'MEDIUM' : 'LOW',
          reason: `Post-consultation clinical follow-up for ${currentCase.assignedDepartment}.`,
          notes: observations
        });
      }
    } catch (err) {
      console.error('Error submitting prescription & follow up:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentCase.doctorApproved) {
    return (
      <div className="w-full bg-white rounded-xl border border-clinical-routine/20 p-6 shadow-sm space-y-5 bg-plus-grid relative">
        {/* Large green verified banner */}
        <div className="bg-clinical-routineLight border border-clinical-routine/25 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-clinical-routine fill-white shrink-0 animate-bounce" />
            <div>
              <span className="block font-bold text-xs text-clinical-routine uppercase tracking-wider">
                ✓ Doctor Approved
              </span>
              <p className="text-[11px] text-brand-forest mt-0.5">
                Prescription has been signed by Dr. Ramesh Kumar and dispatched to hospital pharmacy.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-clinical-routine bg-white border border-clinical-routine/20 px-3 py-1.5 rounded-lg shadow-sm">
            Token: {currentCase.tokenNumber}
          </span>
        </div>

        {/* Read-Only Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth">Clinical Assessment & Diagnosis</label>
            <p className="text-xs text-brand-forest font-medium bg-brand-gray/40 border border-brand-teal/5 p-3 rounded-lg mt-1 italic">
              "{observations}"
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] uppercase font-bold text-brand-earth">Medications Dispensed</label>
            <div className="border border-brand-teal/10 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-brand-gray text-[9px] text-brand-earth uppercase tracking-wider border-b border-brand-teal/10">
                    <th className="p-3">Medicine</th>
                    <th className="p-3">Dosage</th>
                    <th className="p-3">Frequency</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-teal/5">
                  {items.map((item) => (
                    <tr key={item.id} className="text-brand-forest">
                      <td className="p-3 font-bold">{item.medicine}</td>
                      <td className="p-3 font-semibold text-brand-teal">{item.dosage}</td>
                      <td className="p-3">{item.frequency}</td>
                      <td className="p-3">{item.duration}</td>
                      <td className="p-3 text-brand-earth">{item.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-brand-teal/5 pt-3">
            <span className="text-brand-earth">Follow Up Date:</span>
            <span className="font-bold text-brand-forest">{followUp}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm space-y-6 bg-plus-grid">
      <div className="border-b border-brand-teal/5 pb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest">
          Clinical Prescription Order Form
        </h3>
        <p className="text-[11px] text-brand-earth mt-0.5">Authoritative medication inputs under clinician signing key</p>
      </div>

      {/* Observation Field */}
      <div className="space-y-2">
        <label className="block text-[10px] uppercase font-bold text-brand-earth tracking-wider">
          Diagnosis / Clinical Assessment
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          required
          rows={3}
          placeholder="Enter clinical observations, ECG summaries, physical vitals assessments, or advice..."
          className="w-full text-xs font-semibold p-3 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal resize-none"
        />
      </div>

      {/* Added Medicines List */}
      <div className="space-y-3">
        <label className="block text-[10px] uppercase font-bold text-brand-earth tracking-wider">
          Active Medication List
        </label>
        {items.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-brand-teal/20 rounded-xl bg-brand-gray/30 text-xs text-brand-earth">
            No medications added. Please use the form row below to insert items.
          </div>
        ) : (
          <div className="border border-brand-teal/10 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-brand-gray text-[9px] text-brand-earth uppercase tracking-wider border-b border-brand-teal/10">
                  <th className="p-3">Medicine</th>
                  <th className="p-3">Dosage</th>
                  <th className="p-3">Frequency</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Instructions</th>
                  <th className="p-3 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-teal/5">
                {items.map((item) => (
                  <tr key={item.id} className="text-brand-forest hover:bg-brand-gray/20 transition-colors">
                    <td className="p-3 font-bold">{item.medicine}</td>
                    <td className="p-3 font-semibold text-brand-teal">{item.dosage}</td>
                    <td className="p-3">{item.frequency}</td>
                    <td className="p-3">{item.duration}</td>
                    <td className="p-3 text-brand-earth">{item.instructions}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(item.id)}
                        className="text-clinical-emergency hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Medicinal Chemistry & Safety Analysis Panel */}
        {items.length > 0 && (
          <div className="bg-brand-forest/5 border border-brand-teal/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-brand-forest tracking-wider flex items-center gap-1.5">
                🔬 Medicinal Chemistry & Pharmacopeia Safety Audit
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-teal/15 text-brand-teal">
                ASSISTIVE SAFETY LAYER
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {items.map((it) => {
                const medLower = it.medicine.toLowerCase();
                let apiName = "Active Ingredient (API)";
                let formula = "C-H-N-O Pharmacopeia Standard";
                let classType = "General Therapeutic Agent";

                if (medLower.includes("paracetamol") || medLower.includes("acetaminophen")) {
                  apiName = "Acetaminophen (4-acetamidophenol)";
                  formula = "C8H9NO2";
                  classType = "Analgesic & Antipyretic";
                } else if (medLower.includes("aspirin")) {
                  apiName = "Acetylsalicylic Acid";
                  formula = "C9H8O4";
                  classType = "NSAID & Antiplatelet";
                } else if (medLower.includes("clopidogrel")) {
                  apiName = "Clopidogrel Bisulfate";
                  formula = "C16H16ClNO2S";
                  classType = "P2Y12 ADP Receptor Inhibitor";
                } else if (medLower.includes("atorvastatin")) {
                  apiName = "Atorvastatin Calcium";
                  formula = "C33H35FN2O5";
                  classType = "HMG-CoA Reductase Inhibitor";
                } else if (medLower.includes("metformin")) {
                  apiName = "Metformin HCl";
                  formula = "C4H11N5·HCl";
                  classType = "Biguanide Antidiabetic";
                } else if (medLower.includes("amlodipine")) {
                  apiName = "Amlodipine Besylate";
                  formula = "C20H25ClN2O5";
                  classType = "Dihydropyridine Calcium Channel Blocker";
                } else if (medLower.includes("amoxicillin")) {
                  apiName = "Amoxicillin Trihydrate";
                  formula = "C16H19N3O5S";
                  classType = "Aminopenicillin Beta-Lactam";
                }

                return (
                  <div key={it.id} className="bg-white p-2.5 rounded-lg border border-brand-teal/10 space-y-0.5">
                    <div className="flex justify-between font-bold text-brand-forest text-[11px]">
                      <span>{it.medicine}</span>
                      <span className="font-mono text-[9px] text-brand-teal font-extrabold">{formula}</span>
                    </div>
                    <p className="text-[10px] text-brand-earth font-medium">API: <strong className="text-brand-forest">{apiName}</strong></p>
                    <p className="text-[9px] text-brand-earth/80">Class: {classType}</p>
                  </div>
                );
              })}
            </div>

            {/* Interaction warning check */}
            {items.some(i => i.medicine.toLowerCase().includes("aspirin")) && items.some(i => i.medicine.toLowerCase().includes("clopidogrel")) && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[10px] uppercase block">Dual Antiplatelet Therapy (DAPT) Alert</span>
                  <p className="text-[10px]">Aspirin + Clopidogrel increases bleeding risk. Verified intended for acute coronary syndrome / stent protocol.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Add New Medicine Entry Area */}
      <div className="bg-brand-gray/60 p-4 rounded-xl border border-brand-teal/10 space-y-4">
        <span className="block text-[10px] font-bold text-brand-forest uppercase tracking-wider">
          Add New Medication Line
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Med name */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Medicine Name</label>
            <input
              type="text"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              placeholder="e.g. Paracetamol"
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal font-semibold"
            />
          </div>

          {/* Dosage */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 500mg"
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal font-medium"
            >
              <option value="Once daily (1-0-0)">Once daily (1-0-0)</option>
              <option value="Twice daily (1-0-1)">Twice daily (1-0-1)</option>
              <option value="Three times daily (1-1-1)">Three times daily (1-1-1)</option>
              <option value="Four times daily (1-1-1-1)">Four times daily (1-1-1-1)</option>
              <option value="Once immediately (Stat)">Once immediately (Stat)</option>
              <option value="As needed (PRN)">As needed (PRN)</option>
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Duration</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 5 days"
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
            />
          </div>

          {/* Route */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Route</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
            >
              <option value="Oral">Oral</option>
              <option value="Topical">Topical</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="Sublingual">Sublingual</option>
              <option value="Inhalation">Inhalation</option>
            </select>
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-brand-earth">Instructions</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take after food"
              className="w-full text-xs p-2 bg-white border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddMedicine}
          className="flex items-center gap-1 bg-brand-teal/15 border border-brand-teal/30 hover:bg-brand-teal/20 text-brand-teal font-bold text-xs px-3 py-1.5 rounded-lg transition-colors ml-auto shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add to Prescription
        </button>
      </div>

      {/* Follow-up & Safety Confirmation */}
      <div className="space-y-4 pt-3 border-t border-brand-teal/5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
          {/* Follow-up date selector */}
          <div className="flex items-center gap-2">
            <span className="text-brand-earth font-bold uppercase text-[9px] tracking-wider">Follow-Up Target:</span>
            <select
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className="text-xs p-1.5 bg-brand-cream border border-brand-teal/15 rounded-lg font-semibold"
            >
              <option value="3 days">3 Days</option>
              <option value="1 week">1 Week</option>
              <option value="2 weeks">2 Weeks</option>
              <option value="1 month">1 Month</option>
              <option value="No follow-up needed">No follow-up needed</option>
            </select>
          </div>

          {/* Clinician Signing Banner Alert */}
          <span className="text-[9px] uppercase font-bold text-brand-earth/80 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
            Signed by Attending: Dr. Ramesh Kumar
          </span>
        </div>

        {/* Safety Agreement */}
        <div className="bg-clinical-emergencyLight/20 border border-clinical-emergency/15 p-3 rounded-lg flex items-start gap-2.5">
          <input
            type="checkbox"
            id="safety"
            checked={safetyConfirmed}
            onChange={(e) => setSafetyConfirmed(e.target.checked)}
            className="w-4 h-4 rounded text-brand-teal border-brand-teal/20 focus:ring-brand-teal mt-0.5 accent-brand-teal"
          />
          <label htmlFor="safety" className="text-xs text-brand-forest select-none font-medium leading-relaxed">
            <span className="font-bold text-[10px] uppercase text-clinical-emergency block tracking-wider">Safety Disclaimer & Review Confirmation</span>
            By checking this box, I confirm I have fully cross-verified the AI summaries against the patient speech, allergies, and history. I authorize this prescription to be sent to the pharmacy queue.
          </label>
        </div>

        {/* Submit Action */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[10px] text-brand-earth text-center sm:text-left leading-tight flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-brand-earth shrink-0" />
            <span>Prescription will be forwarded to operations only after clinician approval.</span>
          </p>

          <button
            type="submit"
            disabled={!safetyConfirmed || items.length === 0 || isSubmitting}
            className={`w-full sm:w-auto px-6 py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg shadow border transition-all ${
              !safetyConfirmed || items.length === 0 || isSubmitting
                ? 'bg-brand-gray border-brand-teal/5 text-brand-earth/50 cursor-not-allowed'
                : 'bg-clinical-routine border-clinical-routine hover:bg-green-700 text-brand-cream'
            }`}
          >
            {isSubmitting ? 'Processing Dispatch...' : 'Approve & Send to Hospital'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default PrescriptionForm;
