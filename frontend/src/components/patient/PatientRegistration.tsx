import React, { useState } from 'react';
import { useCase } from '../../hooks/useCase';
import { User, Clipboard, Edit2, Check, X, ShieldAlert } from 'lucide-react';

export const PatientRegistration: React.FC = () => {
  const { patientProfile, updatePatientProfile, addNotification } = useCase();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...patientProfile });

  const handleSave = () => {
    updatePatientProfile(formData);
    setIsEditing(false);
    addNotification('Patient clinical profile updated successfully.');
  };

  const handleCancel = () => {
    setFormData({ ...patientProfile });
    setIsEditing(false);
  };

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm bg-plus-grid">
      <div className="flex justify-between items-center pb-3 mb-4 border-b border-brand-teal/5">
        <div className="flex items-center gap-2">
          <Clipboard className="w-4 h-4 text-brand-teal" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest">
            Patient Demographics & Medical History
          </h3>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-brand-teal hover:text-brand-tealDark transition-colors bg-brand-teal/5 border border-brand-teal/15 px-2.5 py-1 rounded-lg"
          >
            <Edit2 className="w-3 h-3" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 text-[11px] font-bold text-clinical-routine hover:text-clinical-routine bg-clinical-routineLight/50 border border-clinical-routine/25 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 text-[11px] font-bold text-clinical-emergency hover:text-clinical-emergency bg-clinical-emergencyLight/50 border border-clinical-emergency/25 px-2.5 py-1 rounded-lg transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Demographics */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-earth uppercase tracking-wider mb-2">
            <User className="w-3.5 h-3.5 text-brand-teal" />
            <span>Demographic Information</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
                />
              ) : (
                <p className="text-sm font-bold text-brand-forest">{patientProfile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Patient ID</label>
              <p className="text-sm font-mono font-bold text-brand-teal mt-0.5">{patientProfile.patientId}</p>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Age</label>
              {isEditing ? (
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
                />
              ) : (
                <p className="text-sm font-semibold text-brand-forest">{patientProfile.age} Years</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Gender</label>
              {isEditing ? (
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <p className="text-sm font-semibold text-brand-forest">{patientProfile.gender}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Mobile Number</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
              />
            ) : (
              <p className="text-sm font-semibold text-brand-forest">{patientProfile.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Residential Address</label>
            {isEditing ? (
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal resize-none"
              />
            ) : (
              <p className="text-xs text-brand-forest leading-relaxed">{patientProfile.address}</p>
            )}
          </div>
        </div>

        {/* Right Column: Medical History */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-earth uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-clinical-emergency" />
            <span>Clinical History & Safety Profile</span>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Allergies</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal border-clinical-emergency/25"
              />
            ) : (
              <p className="text-xs font-bold text-clinical-emergency bg-clinical-emergencyLight/30 border border-clinical-emergency/10 rounded px-2 py-1 mt-0.5 inline-block">
                {patientProfile.allergies}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Prior Medical History</label>
            {isEditing ? (
              <textarea
                value={formData.medicalHistory}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                rows={2}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal resize-none"
              />
            ) : (
              <p className="text-xs text-brand-forest leading-relaxed">{patientProfile.medicalHistory}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Current Routine Medications</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.currentMedications}
                onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
              />
            ) : (
              <p className="text-xs text-brand-forest leading-relaxed font-semibold">{patientProfile.currentMedications}</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-brand-earth/80">Emergency Contact</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.emergencyContact}
                onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                className="w-full text-xs font-semibold p-2 bg-brand-cream border border-brand-teal/15 rounded-lg focus:outline-brand-teal"
              />
            ) : (
              <p className="text-xs font-bold text-brand-forest">{patientProfile.emergencyContact}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientRegistration;
