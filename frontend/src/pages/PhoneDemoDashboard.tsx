import React, { useState, useEffect, useRef } from 'react';
import { Phone, MapPin, Mic, Square, Sparkles, Shield, AlertTriangle, ArrowRight, Play, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useCase } from '../hooks/useCase';
import { api } from '../services/api';
import type { ClinicalCase } from '../types';

const PRESET_MOCK_VOICES = [
  {
    label: 'Cardiac Emergency (Tamil-English mixed)',
    transcript: 'நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது. மூச்சு விட ரொம்ப கஷ்டமா இருக்கு.',
    language: 'Tamil + English',
  },
  {
    label: 'Deep Laceration (Tamil)',
    transcript: 'வலது கை விரல்ல கத்தி பட்டு ஆழமா வெட்டிடுச்சு. ரத்தம் நிக்காம போய்ட்டே இருக்கு.',
    language: 'Tamil',
  },
  {
    label: 'General Joint Pain (English)',
    transcript: 'I have severe pain in my right knee for three days. Difficulty in walking. Also need to check blood pressure.',
    language: 'English',
  }
];

export const PhoneDemoDashboard: React.FC = () => {
  const { addNotification, setCurrentRole, setCases, setActiveCaseId } = useCase();

  // Call status: 'offline' | 'ringing' | 'connected' | 'collecting_location' | 'location_received' | 'collecting_symptoms' | 'processing' | 'completed' | 'error'
  const [callStatus, setCallStatus] = useState<'offline' | 'ringing' | 'connected' | 'collecting_location' | 'collecting_symptoms' | 'processing' | 'completed' | 'error'>('offline');
  const [demoPhone, setDemoPhone] = useState<string>('+91 XXXXX XXXXX');
  const [ivrMode, setIvrMode] = useState<string>('demo');
  console.log('Phone demo active with mode:', ivrMode);

  // Location Form State
  const [address, setAddress] = useState('');
  const [village, setVillage] = useState('');
  const [street, setStreet] = useState('');
  const [landmark, setLandmark] = useState('');
  const [district, setDistrict] = useState('');
  const [locationCompiled, setLocationCompiled] = useState('');

  // Audio/Symptom recording State
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [triageRecommend, setTriageRecommend] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Web Audio and live visualizer
  const [selectedLanguage, setSelectedLanguage] = useState<'ta-IN' | 'en-US'>('ta-IN');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [audioData, setAudioData] = useState<number[]>(new Array(8).fill(8));
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');

  // Load configuration from backend
  useEffect(() => {
    const loadIvrConfig = async () => {
      try {
        const config = await api.getIvrConfig();
        setDemoPhone(config.demo_patient_phone || '+91 XXXXX XXXXX');
        setIvrMode(config.ivr_mode);
        console.log('Phone demo IVR Mode loaded:', config.ivr_mode);
      } catch (e) {
        console.error('Failed to load IVR config:', e);
      }
    };
    loadIvrConfig();
  }, []);

  // Timer for audio recording
  useEffect(() => {
    if (callStatus === 'collecting_symptoms' && seconds > 0) {
      // Audio timer runs
    }
  }, [callStatus]);

  const initiateCall = () => {
    setCallStatus('ringing');
    addNotification('Demo Call: Initiating simulation call...');
    setTimeout(() => {
      setCallStatus('collecting_location');
      addNotification('Demo Call: Call connected. Gathering location first...');
    }, 2000);
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address && !village && !landmark) {
      alert('Please enter at least Address, Village or Nearby Landmark to proceed.');
      return;
    }
    const compiled = [street, address, village, landmark, district].filter(Boolean).join(', ');
    setLocationCompiled(compiled);
    setCallStatus('collecting_symptoms');
    addNotification('Demo Call: Location registered. Proceeding to symptom reporting...');
  };

  const handleUseLandmarkPreset = () => {
    setStreet('3/142, West Street');
    setAddress('Near Panchayat Office');
    setVillage('Melur');
    setLandmark('Opposite Primary Health Sub-centre');
    setDistrict('Madurai District');
  };

  // Start Mic Symptom Recording
  const startMicRecording = async () => {
    setErrorMessage(null);
    setTranscript(null);
    setLiveTranscript('');
    latestTranscriptRef.current = '';
    audioChunksRef.current = [];
    setSeconds(0);
    setAudioData(new Array(8).fill(8));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize MediaRecorder
      const options = { mimeType: 'audio/webm' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
      };

      // Web Audio Visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Map frequencies to simple amplitudes
        const bars = Array.from(dataArray).slice(0, 8).map(v => Math.max(4, Math.floor(v / 8)));
        setAudioData(bars.length ? bars : new Array(8).fill(8));
        animationFrameRef.current = requestAnimationFrame(drawVisualizer);
      };
      drawVisualizer();

      // Native Speech Recognition for real-time visual feedback
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = selectedLanguage;

        rec.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              latestTranscriptRef.current += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          setLiveTranscript(latestTranscriptRef.current + interim);
        };

        rec.onerror = (err: any) => {
          console.warn('Speech recognition warning:', err);
        };

        rec.start();
        recognitionRef.current = rec;
      }

      recorder.start(250);
      
      // Timer
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      addNotification('Demo Call: Recording symptoms via microphone active.');
    } catch (err: any) {
      console.error('Microphone error:', err);
      setErrorMessage('Microphone permissions denied or not available. Please use Preset scenarios instead.');
    }
  };

  const stopMicRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Stop all tracks on the stream
      try {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch(e) {}
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
    }

    const finalSpeech = liveTranscript.trim() || 'நேத்து nightல இருந்து chest pain இருக்கு, left shoulder-க்கு pain பரவுது.';
    setTranscript(finalSpeech);
    setLanguage(selectedLanguage === 'ta-IN' ? 'Tamil' : 'English');
  };

  const handlePresetSelect = (preset: typeof PRESET_MOCK_VOICES[0]) => {
    setAudioBlob(null);
    setTranscript(preset.transcript);
    setLanguage(preset.language);
    addNotification(`Demo Call: Preset symptoms loaded: ${preset.label}`);
  };

  // Submit Simulation call to backend AI Pipeline
  const submitPhoneCallDemo = async () => {
    if (!transcript) return;
    setCallStatus('processing');
    addNotification('Demo Call: Submitting location & symptoms to AI clinical pipeline...');

    const generatedCaseId = `RT-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      // 1. Create Patient Profile mock
      const patientProfile = {
        name: 'Demo Phone Call Patient',
        age: 39,
        gender: 'Male',
        phone: demoPhone,
        patientId: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
        address: locationCompiled,
        emergencyContact: 'Emergency Call Route',
        allergies: 'None',
        medicalHistory: 'Hypertension',
        currentMedications: 'None'
      };

      let audioPath = '';
      if (audioBlob) {
        const upload = await api.uploadAudio(generatedCaseId, audioBlob);
        audioPath = upload.audio_path;
        await api.transcribeAudio(generatedCaseId, audioPath);
      } else {
        const dummyBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);
        const dummyBlob = new Blob([dummyBytes], { type: 'audio/wav' });
        const upload = await api.uploadAudio(generatedCaseId, dummyBlob);
        audioPath = upload.audio_path;
        await api.transcribeAudio(generatedCaseId, audioPath, transcript);
      }

      // Create Case with caller phone details & location
      const newCase = await api.analyzeCase(
        generatedCaseId,
        patientProfile,
        transcript,
        'phone_demo',
        demoPhone,
        locationCompiled,
        'phone_demo'
      );

      setCreatedCaseId(newCase.id);
      setTriageRecommend(newCase.aiTriageRecommend);
      setCallStatus('completed');
      
      // Update cases in useCase context
      setCases((prev: ClinicalCase[]) => [newCase, ...prev]);
      setActiveCaseId(newCase.id);
      addNotification(`Case ${newCase.id} successfully created! Triage Recommendation: ${newCase.aiTriageRecommend}`);
    } catch (err) {
      console.error('Call simulation pipeline error:', err);
      setCallStatus('error');
      setErrorMessage('Failed to trigger clinical AI analysis. Make sure FastAPI and Ollama are running.');
    }
  };

  const hangupCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch(e){}
    }
    setCallStatus('offline');
    setTranscript(null);
    setAudioBlob(null);
    setLocationCompiled('');
    setAddress('');
    setVillage('');
    setStreet('');
    setLandmark('');
    setDistrict('');
    setCreatedCaseId(null);
    setErrorMessage(null);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-screen bg-waves">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-5xl mx-auto w-full">
        
        {/* Banner highlighting Prototype scope */}
        <div className="bg-brand-teal/5 border border-brand-teal/20 p-5 rounded-2xl flex gap-3 text-xs text-brand-forest shadow-inner">
          <Shield className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-brand-teal uppercase tracking-wider block text-[10px]">
              Prototype scope explanation
            </span>
            <p className="leading-relaxed">
              For this current prototype, we are using the configured demo number to demonstrate the patient phone consultation flow. The production version will connect this exact workflow to an IVR-based toll-free number through a telephony provider (e.g., Twilio webhook endpoints).
            </p>
          </div>
        </div>

        {/* Primary Call Simulation Console */}
        <div className="bg-white rounded-3xl shadow-sm border border-brand-teal/15 p-6 md:p-8 relative overflow-hidden bg-dot-grid">
          {/* Top visual accents */}
          <div className="absolute right-0 top-0 text-brand-teal/5 pointer-events-none transform translate-x-12 -translate-y-12">
            <Phone className="w-64 h-64" />
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-brand-teal/10 pb-5 mb-8 gap-4">
            <div>
              <h1 className="text-xl font-black text-brand-forest tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-teal animate-pulse"></span>
                Rural Triage — Demo Phone Consultation
              </h1>
              <p className="text-xs text-brand-earth mt-1 font-semibold">
                Simulating toll-free IVR workflow for remote patients without smartphones
              </p>
            </div>
            
            <div className="flex items-center gap-2.5 bg-brand-gray border border-brand-teal/10 px-4 py-2 rounded-2xl text-xs">
              <span className="font-bold text-[10px] text-brand-teal uppercase tracking-widest">Active Phone:</span>
              <span className="font-mono text-brand-forest font-bold">{demoPhone}</span>
            </div>
          </div>

          {/* Console Body */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Call State tracker left panel */}
            <div className="md:col-span-1 border-r border-brand-teal/10 pr-0 md:pr-8 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-brand-forest/60 uppercase tracking-widest mb-3">Call Tracker</h3>
                <div className="space-y-3">
                  {[
                    { key: 'ringing', label: 'Call Connected', desc: 'Patient dials in' },
                    { key: 'collecting_location', label: 'Location Collection', desc: 'Landmark / Village' },
                    { key: 'collecting_symptoms', label: 'Symptom Consultation', desc: 'Tamil / English voice' },
                    { key: 'processing', label: 'AI Extraction Running', desc: 'Whisper & Qwen Pipeline' },
                    { key: 'completed', label: 'Triage Case Created', desc: 'Sent to Doctor Dashboard' },
                  ].map((step, idx) => {
                    const states = ['offline', 'ringing', 'collecting_location', 'collecting_symptoms', 'processing', 'completed', 'error'];
                    const currentIdx = states.indexOf(callStatus);
                    const stepIdx = states.indexOf(step.key);
                    const isActive = callStatus === step.key;
                    const isPassed = currentIdx > stepIdx && callStatus !== 'offline';

                    return (
                      <div key={step.key} className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-150 ${
                        isActive 
                          ? 'bg-brand-teal/5 border-brand-teal/30 shadow-sm'
                          : isPassed 
                            ? 'bg-brand-gray/30 border-brand-teal/5 opacity-70'
                            : 'bg-transparent border-transparent opacity-40'
                      }`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-brand-teal text-white animate-pulse'
                            : isPassed
                              ? 'bg-brand-forest text-brand-cream'
                              : 'bg-brand-gray text-brand-earth'
                        }`}>
                          {isPassed ? '✓' : idx + 1}
                        </div>
                        <div>
                          <span className={`block font-bold text-xs ${isActive ? 'text-brand-forest' : 'text-brand-earth'}`}>
                            {step.label}
                          </span>
                          <span className="block text-[10px] text-brand-earth/80 mt-0.5">{step.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {callStatus !== 'offline' && (
                <button
                  onClick={hangupCall}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-150"
                >
                  Hang Up Call
                </button>
              )}
            </div>

            {/* Active Simulation Screen (Colspan 2) */}
            <div className="md:col-span-2 flex flex-col justify-center min-h-[300px]">
              
              {/* STATE: OFFLINE */}
              {callStatus === 'offline' && (
                <div className="text-center space-y-6 py-8">
                  <div className="w-20 h-20 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto border border-brand-teal/20 text-brand-teal animate-pulse">
                    <Phone className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-brand-forest">Phone Triage Offline</h3>
                    <p className="text-xs text-brand-earth mt-1 max-w-sm mx-auto leading-relaxed">
                      Start the prototype phone-call simulation to record patient location coordinates and clinical voice symptoms.
                    </p>
                  </div>
                  <button
                    onClick={initiateCall}
                    className="inline-flex items-center gap-2 bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-bold px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow transition-all duration-150"
                  >
                    <span>Simulate Incoming Patient Call</span>
                    <ArrowRight className="w-4 h-4 text-brand-teal" />
                  </button>
                </div>
              )}

              {/* STATE: RINGING */}
              {callStatus === 'ringing' && (
                <div className="text-center space-y-4 py-8">
                  <div className="w-16 h-16 bg-brand-teal text-white rounded-full flex items-center justify-center mx-auto border border-brand-teal animate-bounce">
                    <Phone className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-brand-forest">Connecting Call...</h3>
                    <p className="text-xs text-brand-earth font-mono">Incoming from: {demoPhone}</p>
                  </div>
                </div>
              )}

              {/* STATE: COLLECTING LOCATION */}
              {callStatus === 'collecting_location' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-brand-teal/5 pb-2">
                    <MapPin className="w-4 h-4 text-brand-teal" />
                    <h3 className="text-xs font-bold text-brand-forest uppercase tracking-wider">
                      Step 1: Patient Location Collection (Required first)
                    </h3>
                  </div>
                  
                  <p className="text-xs text-brand-earth bg-brand-gray p-3.5 rounded-xl border border-brand-teal/5 leading-relaxed">
                    💡 <strong>System Prompt (Audio played to caller):</strong> "Vanakkam. Please provide your current address, village, street, or nearby landmark so we can dispatch medical help if needed."
                  </p>

                  <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-brand-forest uppercase tracking-wider mb-1">Street Address</label>
                        <input
                          type="text"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="e.g. 3/142, West Street"
                          className="w-full text-xs p-3 border border-brand-teal/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-brand-forest uppercase tracking-wider mb-1">Village/Town</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. Melur"
                          className="w-full text-xs p-3 border border-brand-teal/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-brand-forest uppercase tracking-wider mb-1">Nearby Landmark</label>
                        <input
                          type="text"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Opp. Panchayat Office"
                          className="w-full text-xs p-3 border border-brand-teal/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-brand-forest uppercase tracking-wider mb-1">District</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g. Madurai District"
                          className="w-full text-xs p-3 border border-brand-teal/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleUseLandmarkPreset}
                        className="bg-brand-gray hover:bg-brand-teal/10 border border-brand-teal/10 text-brand-forest font-bold px-4 py-2.5 rounded-xl text-xs transition-all duration-150"
                      >
                        Load Preset Location
                      </button>
                      <button
                        type="submit"
                        className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-bold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow transition-all duration-150"
                      >
                        Proceed to symptoms
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STATE: COLLECTING SYMPTOMS */}
              {callStatus === 'collecting_symptoms' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-brand-teal/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Mic className="w-4 h-4 text-brand-teal" />
                      <h3 className="text-xs font-bold text-brand-forest uppercase tracking-wider">
                        Step 2: Voice Symptom Consultation
                      </h3>
                    </div>
                    <span className="text-[10px] text-brand-earth bg-brand-gray px-2 py-0.5 rounded-md font-mono">
                      Location: {locationCompiled.slice(0, 30)}...
                    </span>
                  </div>

                  <p className="text-xs text-brand-earth bg-brand-gray p-3.5 rounded-xl border border-brand-teal/5 leading-relaxed">
                    💡 <strong>System Prompt:</strong> "Thank you. Now, please describe your health problem or symptoms clearly in Tamil, English, or both."
                  </p>

                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-brand-teal/20 rounded-2xl bg-brand-gray/10 gap-5">
                    
                    {/* Live Waveform Simulation if recording */}
                    {mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-1.5 justify-center h-10">
                          {audioData.map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h * 4}px` }}
                              className="w-1.5 bg-brand-teal rounded-full transition-all duration-100"
                            ></span>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-brand-teal animate-pulse">
                          Recording Mic... {formatTimer(seconds)}
                        </span>
                        
                        {liveTranscript && (
                          <div className="max-w-md bg-white border border-brand-teal/10 p-3 rounded-xl shadow-inner text-xs text-brand-forest italic text-center">
                            "{liveTranscript}"
                          </div>
                        )}

                        <button
                          onClick={stopMicRecording}
                          className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full flex items-center justify-center shadow-lg transition-all duration-150"
                        >
                          <Square className="w-4 h-4 fill-white" />
                        </button>
                      </div>
                    ) : transcript ? (
                      <div className="w-full space-y-4">
                        <div className="bg-white border border-brand-teal/10 p-4 rounded-xl shadow-sm space-y-2">
                          <span className="block font-bold text-[10px] text-brand-teal uppercase tracking-wider">
                            Speech-to-Text Transcript ({language})
                          </span>
                          <p className="text-xs text-brand-forest italic leading-relaxed">
                            "{transcript}"
                          </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => { setTranscript(null); setAudioBlob(null); }}
                            className="bg-brand-gray border border-brand-teal/15 text-brand-forest text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                          >
                            Re-record
                          </button>
                          <button
                            onClick={submitPhoneCallDemo}
                            className="bg-brand-teal hover:bg-brand-teal/95 text-white text-xs font-black uppercase tracking-wider px-6 py-2.5 rounded-xl shadow transition-all"
                          >
                            Create Case & Run Triage
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 w-full">
                        {/* Audio capture controls */}
                        <div className="flex items-center bg-brand-gray/50 border border-brand-teal/10 p-1 rounded-xl text-xs font-semibold gap-1 mb-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLanguage('ta-IN')}
                            className={`px-3 py-1.5 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                              selectedLanguage === 'ta-IN' ? 'bg-brand-teal text-white shadow-sm' : 'text-brand-earth'
                            }`}
                          >
                            Tamil (தமிழ்)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedLanguage('en-US')}
                            className={`px-3 py-1.5 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                              selectedLanguage === 'en-US' ? 'bg-brand-teal text-white shadow-sm' : 'text-brand-earth'
                            }`}
                          >
                            English
                          </button>
                        </div>

                        <button
                          onClick={startMicRecording}
                          className="bg-brand-teal hover:bg-brand-teal/95 text-white p-4 rounded-full flex items-center justify-center shadow-lg transition-all duration-150"
                        >
                          <Mic className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-[10px] text-brand-earth uppercase tracking-widest font-semibold">
                          Click to record real voice input
                        </span>

                        {errorMessage && (
                          <p className="text-red-500 text-[10px] text-center font-bold px-2">{errorMessage}</p>
                        )}

                        <div className="w-full border-t border-brand-teal/10 pt-4 mt-2">
                          <span className="block text-[10px] text-brand-forest/60 uppercase font-black tracking-wider mb-2.5 text-center">
                            Or Load Preset Patient Scenario
                          </span>
                          <div className="flex flex-col gap-2 max-w-md mx-auto">
                            {PRESET_MOCK_VOICES.map((preset, i) => (
                              <button
                                key={i}
                                onClick={() => handlePresetSelect(preset)}
                                className="bg-white hover:bg-brand-teal/5 border border-brand-teal/10 text-left p-2.5 rounded-xl text-xs text-brand-forest flex justify-between items-center transition-all shadow-sm"
                              >
                                <span>{preset.label}</span>
                                <Play className="w-3 h-3 text-brand-teal fill-brand-teal" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STATE: PROCESSING */}
              {callStatus === 'processing' && (
                <div className="text-center space-y-5 py-8">
                  <div className="relative w-16 h-16 mx-auto">
                    <span className="absolute inset-0 rounded-full border-4 border-brand-teal/20"></span>
                    <span className="absolute inset-0 rounded-full border-4 border-t-brand-teal border-r-brand-teal animate-spin"></span>
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-brand-forest">Running AI Clinical Pipeline...</h3>
                    <p className="text-xs text-brand-earth mt-1 leading-relaxed max-w-xs mx-auto">
                      Qwen2.5:0.5b is extracting clinical markers, compiling summaries, and determining the deterministic triage level.
                    </p>
                  </div>
                </div>
              )}

              {/* STATE: COMPLETED */}
              {callStatus === 'completed' && (
                <div className="space-y-6">
                  <div className="text-center space-y-4 py-4 border-b border-brand-teal/5 pb-6">
                    <CheckCircle2 className="w-12 h-12 text-brand-forest mx-auto" />
                    <div>
                      <h3 className="text-md font-bold text-brand-forest">Phone Consultation Completed!</h3>
                      <p className="text-xs text-brand-earth mt-1">
                        Case successfully registered on Supabase database.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-brand-gray/50 border border-brand-teal/10 p-3.5 rounded-2xl">
                      <span className="block text-[10px] text-brand-earth uppercase tracking-widest font-semibold">Case ID</span>
                      <span className="text-sm font-bold text-brand-forest font-mono">{createdCaseId}</span>
                    </div>
                    <div className="bg-brand-gray/50 border border-brand-teal/10 p-3.5 rounded-2xl">
                      <span className="block text-[10px] text-brand-earth uppercase tracking-widest font-semibold">AI Triage Level</span>
                      <span className={`text-sm font-bold uppercase tracking-wider ${
                        triageRecommend === 'Emergency' ? 'text-red-500' : triageRecommend === 'Urgent' ? 'text-amber-500' : 'text-brand-teal'
                      }`}>{triageRecommend}</span>
                    </div>
                  </div>

                  <div className="bg-brand-forest/5 border border-brand-forest/15 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed text-brand-forest">
                    <Sparkles className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Supabase Realtime Alert:</strong>
                      This case has been dispatched to the Doctor Dashboard in real-time. Clinician verification can happen immediately.
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      onClick={hangupCall}
                      className="bg-brand-gray hover:bg-brand-teal/10 border border-brand-teal/10 text-brand-forest font-bold px-5 py-3 rounded-xl text-xs uppercase transition-all duration-150"
                    >
                      Start New Call
                    </button>
                    <button
                      onClick={() => setCurrentRole('doctor')}
                      className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-black uppercase tracking-wider px-6 py-3 rounded-xl text-xs shadow transition-all duration-150"
                    >
                      Go to Doctor Dashboard
                    </button>
                  </div>
                </div>
              )}

              {/* STATE: ERROR */}
              {callStatus === 'error' && (
                <div className="text-center space-y-6 py-8">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 text-red-500">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-red-500">Clinical Analysis Pipeline Failed</h3>
                    <p className="text-xs text-brand-earth max-w-sm mx-auto leading-relaxed mt-1">
                      {errorMessage || 'Make sure your backend server and Ollama instance are running.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setCallStatus('collecting_symptoms')}
                    className="inline-flex items-center gap-1.5 bg-brand-gray border border-brand-teal/10 hover:bg-brand-teal/10 text-brand-forest font-bold px-5 py-2.5 rounded-xl text-xs transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try again</span>
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default PhoneDemoDashboard;
