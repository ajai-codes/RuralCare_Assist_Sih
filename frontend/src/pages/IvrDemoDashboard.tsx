import React, { useState, useEffect, useRef } from 'react';
import { Phone, MapPin, Mic, Square, Shield, Play, CheckCircle2, Volume2, Clock, ChevronRight, Activity, Globe } from 'lucide-react';
import { useCase } from '../hooks/useCase';
import { api } from '../services/api';
import type { ClinicalCase } from '../types';

const PRESET_SCENARIOS = [
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

type IvrState =
  | 'IDLE'
  | 'INCOMING_CALL'
  | 'CALL_CONNECTED'
  | 'SELECT_LANGUAGE'
  | 'COLLECTING_LOCATION'
  | 'LOCATION_CAPTURED'
  | 'COLLECTING_SYMPTOMS'
  | 'AUDIO_PROCESSING'
  | 'TRANSCRIBING'
  | 'CLINICAL_EXTRACTION'
  | 'CLINICAL_SUMMARY'
  | 'PRELIMINARY_TRIAGE'
  | 'CASE_CREATED'
  | 'DOCTOR_QUEUE';

export const IvrDemoDashboard: React.FC = () => {
  const { addNotification, setCurrentRole, setCases, setActiveCaseId } = useCase();

  // State Machine
  const [ivrState, setIvrState] = useState<IvrState>('IDLE');
  
  // Call configuration
  const [demoPhone, setDemoPhone] = useState<string>('+91 XXXXX XXXXX');
  const [callTimer, setCallTimer] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Selected language
  const [languageCode, setLanguageCode] = useState<'ta' | 'en' | null>(null);

  // Collected Data
  const [locationText, setLocationText] = useState<string>('');
  const [locationInputMode, setLocationInputMode] = useState<'text' | 'voice'>('text');
  
  const [symptomTranscript, setSymptomTranscript] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('Tamil-English mixed');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // AI/Case Outputs
  const [createdCaseId, setCreatedCaseId] = useState<string>('');
  const [clinicalAbstract, setClinicalAbstract] = useState<any>(null);
  const [triagePriority, setTriagePriority] = useState<string>('');
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Mic states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTarget, setRecordingTarget] = useState<'location' | 'symptoms' | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Speech Recognition Refs
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');

  // Web Audio Visualizer
  const [audioData, setAudioData] = useState<number[]>(new Array(8).fill(8));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Symptom transcript preview status
  const [symptomTranscriptStatus, setSymptomTranscriptStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');

  // E2E Simulation & Response Monitoring
  const [dbCaseDetails, setDbCaseDetails] = useState<any>(null);

  const refreshCaseStatus = async () => {
    if (!createdCaseId) return;
    try {
      const kase = await api.getCase(createdCaseId);
      setDbCaseDetails(kase);
    } catch (e) {
      console.error('Failed to sync case status:', e);
    }
  };

  // Poll case status every 2.5 seconds when case is created
  useEffect(() => {
    if (!createdCaseId) return;
    refreshCaseStatus();
    const interval = setInterval(refreshCaseStatus, 2500);
    return () => clearInterval(interval);
  }, [createdCaseId]);

  const simulatedDoctorApprove = async () => {
    if (!createdCaseId || !dbCaseDetails) return;
    try {
      addLog('Simulating Doctor review and approval...');
      
      // 1. Submit review (uses case UUID 'createdCaseId')
      await fetch(`http://localhost:8000/api/doctor/cases/${createdCaseId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_name: "Dr. Ramesh Kumar",
          doctor_registration_id: "REG-87421",
          clinical_observations: "ACS Triage approved.",
          final_priority: triagePriority === 'Emergency' ? 'Emergency' : 'Routine',
          department: triagePriority === 'Emergency' ? 'Cardiology' : 'General Medicine'
        })
      });

      if (triagePriority !== 'Emergency') {
        // Create prescription draft (uses case string ID 'dbCaseDetails.case_id')
        const presRes = await fetch(`http://localhost:8000/api/prescriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id: dbCaseDetails.case_id,
            doctor_name: "Dr. Ramesh Kumar",
            doctor_registration_id: "REG-87421",
            clinical_assessment: "ACS Triage approved.",
            prescriptionItems: [{ id: '1', medicine: 'Aspirin', route: 'Oral', dosage: '300mg', frequency: 'Once immediately', duration: 'Stat', instructions: 'Chew immediately' }],
            instructions: "Rest and collect medicines.",
            follow_up_date: ""
          })
        });
        const newPres = await presRes.json();
        const pid = newPres.data.id;
        
        await fetch(`http://localhost:8000/api/prescriptions/${pid}/approve`, {
          method: 'POST'
        });
      }

      addLog('Doctor review confirmed.');
      await refreshCaseStatus();
    } catch (e) {
      console.error(e);
      addLog('Failed to simulate doctor approval.');
    }
  };

  const simulatedPharmacyDispense = async () => {
    if (!createdCaseId) return;
    try {
      addLog('Simulating Pharmacy dispensing...');
      await api.updatePharmacyStatus(createdCaseId, 'Dispensed');
      addLog('Medicines dispensed successfully.');
      await refreshCaseStatus();
    } catch (e) {
      console.error(e);
      addLog('Failed to simulate pharmacy dispense.');
    }
  };

  // Load configuration from backend settings
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getIvrConfig();
        setDemoPhone(config.demo_patient_phone || '+91 XXXXX XXXXX');
      } catch (e) {
        console.error('Failed to fetch config:', e);
      }
    };
    fetchConfig();
  }, []);

  // Initialize browser voices cache
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Utterance creator with strict voice constraints and normalizer
  const createUtterance = (text: string, langCode: 'ta' | 'en') => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    const isLangMatch = (voiceLang: string, targetLang: string) => {
      const normalizedVoice = voiceLang.replace('_', '-').toLowerCase();
      const normalizedTarget = targetLang.toLowerCase();
      return normalizedVoice === normalizedTarget || normalizedVoice.startsWith(normalizedTarget + '-');
    };

    if (langCode === 'ta') {
      selectedVoice = voices.find(v => isLangMatch(v.lang, 'ta-IN')) || null;
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('ta')) || null;
      }
      utterance.lang = 'ta-IN';
    } else {
      selectedVoice = voices.find(v => isLangMatch(v.lang, 'en-IN')) || null;
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en')) || null;
      }
      utterance.lang = 'en-IN';
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`Utterance voice explicitly bound: ${selectedVoice.name} (${selectedVoice.lang})`);
    } else {
      console.warn(`No language-specific voice matched for ${langCode}. Using default browser engine.`);
    }

    utterance.rate = 0.95;
    utterance.volume = 1.0;
    
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    return utterance;
  };

  // Speaks welcome prompt sequentially without co-mingling languages in one utterance
  const speakWelcomeChain = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const speakWelcome = () => {
      const u1 = createUtterance("Welcome to Rural Triage.", 'en');
      u1.onend = () => {
        const u2 = createUtterance("தமிழுக்கு ஒன்று அழுத்தவும்.", 'ta');
        u2.onend = () => {
          const u3 = createUtterance("For English, press two.", 'en');
          u3.onend = () => {
            setIsSpeaking(false);
          };
          window.speechSynthesis.speak(u3);
        };
        window.speechSynthesis.speak(u2);
      };
      u1.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(u1);
    };

    speakWelcome();
  };

  const speakIVR = (text: string, langCode: 'ta' | 'en') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const utterance = createUtterance(text, langCode);
    currentUtteranceRef.current = utterance;

    utterance.onend = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReplay = () => {
    if (ivrState === 'SELECT_LANGUAGE') {
      speakWelcomeChain();
    } else if (ivrState === 'COLLECTING_LOCATION') {
      const prompt = languageCode === 'ta'
        ? "தயவுசெய்து உங்கள் தற்போதைய இருப்பிடம், கிராமம், முகவரி அல்லது அருகிலுள்ள முக்கிய இடத்தைத் தெரிவிக்கவும்."
        : "Please tell us your current location, village, address, or nearby landmark.";
      speakIVR(prompt, languageCode || 'en');
    } else if (ivrState === 'LOCATION_CAPTURED') {
      const prompt = languageCode === 'ta'
        ? "நன்றி. உங்கள் இருப்பிடம் பதிவு செய்யப்பட்டுள்ளது."
        : "Thank you. Your location has been recorded.";
      speakIVR(prompt, languageCode || 'en');
    } else if (ivrState === 'COLLECTING_SYMPTOMS') {
      const prompt = languageCode === 'ta'
        ? "நன்றி. இப்போது உங்கள் உடல்நலப் பிரச்சனையைப் பற்றி தெரிவிக்கவும்."
        : "Thank you. Now please describe your health problem.";
      speakIVR(prompt, languageCode || 'en');
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Trigger speech on state/language change
  useEffect(() => {
    if (ivrState === 'SELECT_LANGUAGE') {
      speakWelcomeChain();
    } else if (ivrState === 'COLLECTING_LOCATION') {
      const prompt = languageCode === 'ta'
        ? "தயவுசெய்து உங்கள் தற்போதைய இருப்பிடம், கிராமம், முகவரி அல்லது அருகிலுள்ள முக்கிய இடத்தைத் தெரிவிக்கவும்."
        : "Please tell us your current location, village, address, or nearby landmark.";
      speakIVR(prompt, languageCode || 'en');
    } else if (ivrState === 'LOCATION_CAPTURED') {
      const prompt = languageCode === 'ta'
        ? "நன்றி. உங்கள் இருப்பிடம் பதிவு செய்யப்பட்டுள்ளது."
        : "Thank you. Your location has been recorded.";
      speakIVR(prompt, languageCode || 'en');
    } else if (ivrState === 'COLLECTING_SYMPTOMS') {
      const prompt = languageCode === 'ta'
        ? "நன்றி. இப்போது உங்கள் உடல்நலப் பிரச்சனையைப் பற்றி தெரிவிக்கவும்."
        : "Thank you. Now please describe your health problem.";
      speakIVR(prompt, languageCode || 'en');
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
    }
  }, [ivrState, languageCode]);

  const renderPromptControls = () => {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
          isSpeaking ? 'bg-brand-teal/10 text-brand-teal animate-pulse' : 'bg-brand-gray text-brand-earth'
        }`}>
          {isSpeaking ? '🔊 Speaking...' : '✓ Prompt played'}
        </span>
        <button
          onClick={handleReplay}
          className="bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal text-[8px] font-bold px-2 py-0.5 rounded transition"
        >
          Replay
        </button>
        <button
          onClick={handleStop}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[8px] font-bold px-2 py-0.5 rounded transition"
        >
          Stop
        </button>
      </div>
    );
  };

  // Call Timer
  useEffect(() => {
    if (ivrState !== 'IDLE' && ivrState !== 'INCOMING_CALL') {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setCallTimer((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setCallTimer(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [ivrState]);

  // Log pipeline changes
  const addLog = (log: string) => {
    setPipelineLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  // 1. Simulate Incoming Call
  const simulateIncomingCall = () => {
    setErrorMessage('');
    setIvrState('INCOMING_CALL');
    setLanguageCode(null);
    setPipelineLogs([]);
    addLog('Ringing... Call triggered by Expo simulator');

    setTimeout(() => {
      setIvrState('CALL_CONNECTED');
      addLog('Call connected successfully');
      
      // Transition to Language Selection
      setTimeout(() => {
        setIvrState('SELECT_LANGUAGE');
        addLog('Prompting caller: Select Language (1 - Tamil, 2 - English)');
      }, 1500);
    }, 1500);
  };

  const hangupCall = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      try {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      } catch (e) {}
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIvrState('IDLE');
    setCallTimer(0);
    setLanguageCode(null);
    setLocationText('');
    setSymptomTranscript('');
    setCreatedCaseId('');
    setClinicalAbstract(null);
    setTriagePriority('');
    setIsSpeaking(false);
    setIsRecording(false);
    setRecordingTarget(null);
    setSymptomTranscriptStatus('idle');
    addLog('Call hung up/reset.');
  };

  // 2. Select Language
  const selectLanguage = (code: 'ta' | 'en') => {
    setLanguageCode(code);
    addLog(`Language selected: ${code === 'ta' ? 'Tamil ("ta")' : 'English ("en")'}`);
    
    // Auto transition to location collection
    setTimeout(() => {
      setIvrState('COLLECTING_LOCATION');
      addLog('Prompting caller: Please say or type your location first.');
    }, 1500);
  };

  // 3. Submit Location
  const handleLocationSubmit = (text: string) => {
    if (!text.trim()) {
      alert(languageCode === 'ta' ? 'இருப்பிடம் கட்டாயமாகும்.' : 'Location is required. Please type or provide voice input first.');
      return;
    }
    setLocationText(text);
    setIvrState('LOCATION_CAPTURED');
    addLog(`Location captured: "${text}" (Source: ivr_demo)`);

    setTimeout(() => {
      setIvrState('COLLECTING_SYMPTOMS');
      addLog('Prompting caller: Please describe your symptoms.');
    }, 2500);
  };

  const loadPresetLocation = () => {
    handleLocationSubmit('Coimbatore, near Coimbatore Institute of Technology.');
  };

  const startLocationRecording = async () => {
    setErrorMessage('');
    setLocationText('');
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setAudioData(new Array(8).fill(8));
    latestTranscriptRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize browser SpeechRecognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageCode === 'ta' ? 'ta-IN' : 'en-US';
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalResult = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalResult += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const combined = (finalResult || interimTranscript).trim();
          if (combined) {
            latestTranscriptRef.current = combined;
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch(e) {}
        }

        setIsRecording(false);
        setRecordingTarget(null);

        // Process recorded location after 400ms delay for SpeechRecognition propagation
        setTimeout(async () => {
          const finalOverride = latestTranscriptRef.current.trim();
          await processLocationAudio(blob, finalOverride || undefined);
        }, 400);
      };

      // Visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars = Array.from(dataArray).slice(0, 8).map(v => Math.max(4, Math.floor(v / 8)));
        setAudioData(bars.length ? bars : new Array(8).fill(8));
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      recorder.start(250);
      setIsRecording(true);
      setRecordingTarget('location');
      addLog('Recording location audio...');
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      addLog('Microphone permission denied or device busy.');
      setErrorMessage('Microphone access denied or device busy.');
    }
  };

  const stopLocationRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const processLocationAudio = async (blob: Blob, overrideText?: string) => {
    setIvrState('TRANSCRIBING');
    addLog('Transcribing location voice recording...');
    const tempCaseId = `RT-LOC-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      const upload = await api.uploadAudio(tempCaseId, blob);
      const result = await api.transcribeAudio(tempCaseId, upload.audio_path, overrideText);
      
      if (!result.transcript || result.transcript.trim() === '') {
        throw new Error('NoSpeechDetected');
      }

      addLog(`Location transcription finished: "${result.transcript}"`);
      setLocationText(result.transcript);
      setIvrState('LOCATION_CAPTURED');
      
      setTimeout(() => {
        setIvrState('COLLECTING_SYMPTOMS');
        addLog('Prompting caller: Please describe your health problem.');
      }, 2500);

    } catch (e: any) {
      console.error(e);
      addLog(`Location transcription failed: ${e.message}`);
      setIvrState('COLLECTING_LOCATION');
      setErrorMessage('Unable to extract location text. Please speak clearly or type it instead.');
    }
  };

  // 4. Microphone Recording for Symptoms
  const startSymptomRecording = async () => {
    setErrorMessage('');
    setSymptomTranscript('');
    audioChunksRef.current = [];
    setRecordingSeconds(0);
    setAudioData(new Array(8).fill(8));
    setSymptomTranscriptStatus('idle');
    latestTranscriptRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize browser SpeechRecognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = languageCode === 'ta' ? 'ta-IN' : 'en-US';
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalResult = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalResult += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const combined = (finalResult || interimTranscript).trim();
          if (combined) {
            latestTranscriptRef.current = combined;
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());

        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch(e) {}
        }

        setIsRecording(false);
        setRecordingTarget(null);

        // Fetch transcript preview immediately after 400ms delay
        setTimeout(async () => {
          const finalOverride = latestTranscriptRef.current.trim();
          await processSymptomAudioPreview(blob, finalOverride || undefined);
        }, 400);
      };

      // Visualizer setup
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const draw = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars = Array.from(dataArray).slice(0, 8).map(v => Math.max(4, Math.floor(v / 8)));
        setAudioData(bars.length ? bars : new Array(8).fill(8));
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      recorder.start(250);
      setIsRecording(true);
      setRecordingTarget('symptoms');
      addLog('Recording symptoms voice...');
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      addLog('Microphone permission denied or device busy.');
      setErrorMessage('Microphone not available. Please allow permissions or load a Preset scenario.');
    }
  };

  const stopSymptomRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const processSymptomAudioPreview = async (blob: Blob, overrideText?: string) => {
    setSymptomTranscriptStatus('processing');
    addLog('Transcribing symptom voice recording...');
    const tempCaseId = `RT-SYM-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      const upload = await api.uploadAudio(tempCaseId, blob);
      const result = await api.transcribeAudio(tempCaseId, upload.audio_path, overrideText);
      
      if (!result.transcript || result.transcript.trim() === '') {
        throw new Error('NoSpeechDetected');
      }

      addLog(`Symptom transcription finished: "${result.transcript}"`);
      setSymptomTranscript(result.transcript);
      setDetectedLanguage(result.detected_language || 'Mixed');
      setSymptomTranscriptStatus('completed');
    } catch (e: any) {
      console.error(e);
      addLog(`Symptom transcription failed: ${e.message}`);
      setSymptomTranscriptStatus('error');
      setErrorMessage('Unable to extract symptoms from recording. Please try speaking again.');
    }
  };

  const handleSymptomPresetSelect = (preset: typeof PRESET_SCENARIOS[0]) => {
    setAudioBlob(null);
    setSymptomTranscript(preset.transcript);
    setDetectedLanguage(preset.language);
    setSymptomTranscriptStatus('completed');
    addLog(`Preset selected: "${preset.label}"`);
  };

  // 5. Submit Consultation to Backend Pipeline
  const runClinicalPipeline = async () => {
    if (!symptomTranscript) {
      alert('Symptom transcript is required. Please record voice or select a preset.');
      return;
    }

    setIvrState('AUDIO_PROCESSING');
    addLog('State: AUDIO_PROCESSING — Verifying audio metadata');

    const generatedCaseId = `RT-${Math.floor(10000 + Math.random() * 90000)}`;

    try {
      // Step: TRANSCRIBING
      setIvrState('TRANSCRIBING');
      addLog('State: TRANSCRIBING — Uploading and finalising voice record');

      let audioPath = '';
      if (audioBlob) {
        const upload = await api.uploadAudio(generatedCaseId, audioBlob);
        audioPath = upload.audio_path;
        await api.transcribeAudio(generatedCaseId, audioPath, symptomTranscript);
      } else {
        const dummyBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);
        const dummyBlob = new Blob([dummyBytes], { type: 'audio/wav' });
        const upload = await api.uploadAudio(generatedCaseId, dummyBlob);
        audioPath = upload.audio_path;
        await api.transcribeAudio(generatedCaseId, audioPath, symptomTranscript);
      }
      addLog(`ASR completed. Transcript: "${symptomTranscript}"`);

      // Step: CLINICAL_EXTRACTION
      setIvrState('CLINICAL_EXTRACTION');
      addLog('State: CLINICAL_EXTRACTION — Querying Qwen2.5:0.5b clinical model...');
      
      const patientProfile = {
        name: 'Simulated IVR Caller',
        age: 45,
        gender: 'Female',
        phone: demoPhone,
        patientId: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
        address: locationText,
        emergencyContact: 'Toll-free IVR Gateway',
        allergies: 'None reported',
        medicalHistory: 'Hypertension',
        currentMedications: 'Amlodipine 5mg'
      };

      // Create case via API, specifying channel='ivr_demo', location_source='ivr_demo', and language_code
      const newCase = await api.analyzeCase(
        generatedCaseId,
        patientProfile,
        symptomTranscript,
        'ivr_demo',
        demoPhone,
        locationText,
        'ivr_demo',
        languageCode || undefined
      );

      // Step: CLINICAL_SUMMARY
      setIvrState('CLINICAL_SUMMARY');
      addLog('State: CLINICAL_SUMMARY — Parsing extracted clinical markers...');
      setClinicalAbstract({
        summary: newCase.aiClinicalSummary,
        symptoms: newCase.aiSymptoms,
        severity: newCase.aiSeverity,
        duration: newCase.aiDuration || '3 days'
      });

      // Step: PRELIMINARY_TRIAGE
      setIvrState('PRELIMINARY_TRIAGE');
      addLog('State: PRELIMINARY_TRIAGE — Deterministic clinical categorization');
      setTriagePriority(newCase.aiTriageRecommend);

      setTimeout(() => {
        // Step: CASE_CREATED
        setIvrState('CASE_CREATED');
        setCreatedCaseId(newCase.id);
        addLog(`State: CASE_CREATED — DB Record persisted. Audio saved in canonical patient-audio bucket.`);

        // Step: DOCTOR_QUEUE
        setIvrState('DOCTOR_QUEUE');
        addLog('State: DOCTOR_QUEUE — Broadcast via Supabase Realtime complete. Waiting for doctor review.');
        
        // Update global state
        setCases((prev: ClinicalCase[]) => [newCase, ...prev]);
        setActiveCaseId(newCase.id);
        addNotification(`Case ${newCase.id} successfully created via IVR demo workflow!`);
      }, 1500);

    } catch (err) {
      console.error(err);
      setIvrState('IDLE');
      setErrorMessage('Failed to trigger clinical AI pipeline. Verify FastAPI and Ollama status.');
    }
  };

  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const ss = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${ss}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-screen bg-waves p-4 sm:p-6 lg:p-8 justify-center items-center">
      
      {/* Scope Disclaimer banner */}
      <div className="max-w-xl w-full bg-brand-teal/5 border border-brand-teal/20 p-4 rounded-2xl flex gap-3 text-xs text-brand-forest shadow-sm mb-6">
        <Shield className="w-5 h-5 text-brand-teal shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[10px] text-brand-teal uppercase tracking-wider block">
            Expo Demonstration mode
          </span>
          <p className="leading-relaxed mt-0.5">
            <strong>Simulated IVR Gateway:</strong> Telephony dial-in connection is simulated. However, the complete downstream logic — location collection, microphone voice capture, faster-whisper ASR, Qwen2.5 clinical analysis, and Supabase real-time sync is <strong>real and working</strong>.
          </p>
        </div>
      </div>

      <div className={`w-full grid grid-cols-1 ${
        ['IDLE', 'INCOMING_CALL', 'CALL_CONNECTED'].includes(ivrState) ? 'max-w-2xl' : 'max-w-6xl lg:grid-cols-2 gap-8'
      } items-start justify-center mx-auto`}>
        
        {/* Main Console Box */}
        <div className="bg-white w-full rounded-3xl border border-brand-teal/25 shadow-2xl overflow-hidden flex flex-col relative bg-dot-grid">
        
        {/* Console Header */}
        <div className="bg-brand-forest p-5 flex justify-between items-center text-white border-b border-brand-teal/20">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${ivrState !== 'IDLE' ? 'bg-red-500 animate-pulse' : 'bg-brand-teal'}`}></div>
            <div>
              <h2 className="text-sm font-black tracking-wider uppercase text-brand-cream">📞 Rural Triage</h2>
              <span className="text-[10px] text-brand-cream/70 font-bold uppercase tracking-widest block">IVR Workflow Console</span>
            </div>
          </div>
          {ivrState !== 'IDLE' && (
            <div className="flex items-center gap-4">
              <button
                onClick={hangupCall}
                className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition shadow-sm"
              >
                Hang up
              </button>
              {languageCode && (
                <div className="text-[10px] bg-white/10 px-2 py-1 rounded-lg border border-white/10 font-bold text-brand-cream flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>Language: {languageCode === 'ta' ? '🇮🇳 Tamil' : '🇬🇧 English'}</span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-brand-teal border border-brand-teal/20">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatCallTime(callTimer)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Console Screen Body */}
        <div className="p-6 md:p-8 flex-1 flex flex-col justify-center min-h-[360px] space-y-6">
          
          {/* STATE: IDLE */}
          {ivrState === 'IDLE' && (
            <div className="text-center space-y-6 py-8">
              <div className="w-20 h-20 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto border border-brand-teal/20 text-brand-teal animate-pulse">
                <Phone className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-bold text-brand-forest uppercase tracking-wide">Status: Ready to Receive Call</h3>
                <p className="text-xs text-brand-earth mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Trigger a mock patient call simulation to demonstrate how remote rural patients use their basic keypad phone to consult.
                </p>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-2.5 rounded-xl max-w-sm mx-auto font-semibold">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={simulateIncomingCall}
                className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg transition duration-150 inline-flex items-center gap-2"
              >
                <span>Simulate Incoming Call</span>
                <ChevronRight className="w-4 h-4 text-brand-teal" />
              </button>
            </div>
          )}

          {/* STATE: INCOMING CALL */}
          {ivrState === 'INCOMING_CALL' && (
            <div className="text-center space-y-6 py-8 animate-pulse">
              <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                <Phone className="w-8 h-8 animate-bounce" />
              </div>
              <div>
                <h3 className="text-md font-black text-brand-forest tracking-wider uppercase">📞 INCOMING CALL</h3>
                <p className="text-xs text-brand-earth mt-1 font-mono">{demoPhone}</p>
              </div>
            </div>
          )}

          {/* STATE: CALL CONNECTED */}
          {ivrState === 'CALL_CONNECTED' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-brand-teal text-white rounded-full flex items-center justify-center mx-auto border-2 border-brand-cream shadow">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-md font-bold text-brand-forest uppercase">Call Connected</h3>
                <p className="text-xs text-brand-earth mt-1">Caller ID: {demoPhone}</p>
              </div>
            </div>
          )}

          {/* STATE: SELECT_LANGUAGE */}
          {ivrState === 'SELECT_LANGUAGE' && (
            <div className="space-y-6 text-center">
              <div className="bg-brand-gray border border-brand-teal/10 p-4 rounded-xl flex items-start gap-3 text-left">
                <Volume2 className="w-5 h-5 text-brand-teal shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs text-brand-forest leading-relaxed space-y-2 flex-1">
                  <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 gap-2">
                    <strong className="text-brand-teal uppercase tracking-wider text-[10px]">🔊 IVR Audio Prompt:</strong>
                    {renderPromptControls()}
                  </div>
                  <p className="font-semibold text-brand-forest">"Welcome to Rural Triage. தமிழுக்கு 1 அழுத்தவும். For English, press 2."</p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-brand-earth uppercase tracking-widest mb-3">🌐 Select Language / மொழியைத் தேர்ந்தெடுக்கவும்</h4>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => selectLanguage('ta')}
                    disabled={isSpeaking}
                    className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-bold px-5 py-3.5 rounded-xl text-xs uppercase shadow transition duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>1 — தமிழ்</span>
                  </button>
                  <button
                    onClick={() => selectLanguage('en')}
                    disabled={isSpeaking}
                    className="bg-brand-teal hover:bg-brand-teal/95 text-white font-bold px-5 py-3.5 rounded-xl text-xs uppercase shadow transition duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>2 — English</span>
                  </button>
                </div>
                {isSpeaking ? (
                  <span className="block text-[9px] text-brand-teal mt-3 animate-pulse font-bold">● Wait for audio prompt to finish speaking...</span>
                ) : (
                  <span className="block text-[9px] text-brand-earth mt-3 animate-pulse font-bold">● Waiting for selection...</span>
                )}
              </div>
            </div>
          )}

          {/* STATE: COLLECTING LOCATION */}
          {ivrState === 'COLLECTING_LOCATION' && (
            <div className="space-y-5">
              <div className="bg-brand-gray border border-brand-teal/10 p-4 rounded-xl flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-brand-teal shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs text-brand-forest leading-relaxed space-y-2 flex-1">
                  <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 gap-2">
                    <strong className="text-brand-teal uppercase tracking-wider text-[10px]">🔊 IVR Audio Prompt:</strong>
                    {renderPromptControls()}
                  </div>
                  {languageCode === 'ta' ? (
                    <span className="font-semibold block">"தயவுசெய்து உங்கள் தற்போதைய இருப்பிடம், கிராமம், முகவரி அல்லது அருகிலுள்ள முக்கிய இடத்தைத் தெரிவிக்கவும்."</span>
                  ) : (
                    <span className="font-semibold block">"Please tell us your current location, village, address, or nearby landmark."</span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-brand-earth uppercase tracking-widest">
                    {languageCode === 'ta' ? '📍 இருப்பிடச் சேகரிப்பு' : '📍 Location Collection'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLocationInputMode('text')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        locationInputMode === 'text' ? 'bg-brand-teal text-white' : 'bg-brand-gray text-brand-earth'
                      }`}
                    >
                      {languageCode === 'ta' ? 'எழுதவும்' : 'Type Text'}
                    </button>
                    <button
                      onClick={() => setLocationInputMode('voice')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        locationInputMode === 'voice' ? 'bg-brand-teal text-white' : 'bg-brand-gray text-brand-earth'
                      }`}
                    >
                      {languageCode === 'ta' ? 'பேசவும்' : 'Voice Input'}
                    </button>
                  </div>
                </div>

                {locationInputMode === 'text' ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={languageCode === 'ta' ? 'இருப்பிடத்தை எழுதவும்...' : 'e.g. Coimbatore, near Coimbatore Institute of Technology'}
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      className="flex-1 text-xs p-3 border border-brand-teal/15 rounded-xl focus:outline-brand-teal"
                    />
                    <button
                      onClick={() => handleLocationSubmit(locationText)}
                      className="bg-brand-teal text-white px-4 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-teal/95 transition"
                    >
                      {languageCode === 'ta' ? 'அனுப்பவும்' : 'Submit'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border border-dashed border-brand-teal/20 rounded-2xl bg-brand-gray/30 gap-4">
                    {isRecording && recordingTarget === 'location' ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-1 justify-center h-6">
                          {audioData.map((h, i) => (
                            <span key={i} style={{ height: `${h * 2}px` }} className="w-1 bg-red-500 rounded-full transition-all duration-100"></span>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-red-500 animate-pulse">
                          🔴 Listening... {formatCallTime(recordingSeconds)}
                        </span>
                        <button
                          onClick={stopLocationRecording}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <Square className="w-3.5 h-3.5 fill-white" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={startLocationRecording}
                          disabled={isSpeaking}
                          className="bg-brand-teal disabled:opacity-50 text-white p-3 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition disabled:cursor-not-allowed"
                        >
                          <Mic className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-[10px] text-brand-earth uppercase tracking-widest font-semibold">
                          {isSpeaking 
                            ? (languageCode === 'ta' ? 'கேட்டுக்கொண்டிருக்கிறது...' : 'Prompt is speaking...')
                            : (languageCode === 'ta' ? 'பேச கிளிக் செய்யவும்' : 'Click to speak location')}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {errorMessage && (
                  <p className="text-red-500 text-[10px] text-center font-bold">{errorMessage}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={loadPresetLocation}
                    disabled={isSpeaking || isRecording}
                    className="bg-brand-gray border border-brand-teal/15 hover:bg-brand-teal/10 text-brand-forest text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {languageCode === 'ta' 
                      ? 'இருப்பிடப்Presetஐ ஏற்றுக (Coimbatore, near CIT)' 
                      : 'Load Preset Location (Coimbatore, near CIT)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE: LOCATION_CAPTURED */}
          {ivrState === 'LOCATION_CAPTURED' && (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 bg-brand-teal/10 text-brand-teal rounded-full flex items-center justify-center mx-auto border border-brand-teal/20">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-brand-earth uppercase tracking-widest">
                  {languageCode === 'ta' ? '📍 இருப்பிடம் பதிவுசெய்யப்பட்டது' : '📍 Location Captured'}
                </h4>
                <p className="text-sm font-bold text-brand-forest mt-1">"{locationText}"</p>
              </div>
              <div className="bg-brand-gray/50 border border-brand-teal/10 p-4 rounded-xl max-w-sm mx-auto text-xs text-brand-forest leading-relaxed flex gap-3 text-left">
                <Volume2 className="w-5 h-5 text-brand-teal shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 gap-2">
                    <strong className="text-brand-teal uppercase tracking-wider text-[10px]">🔊 IVR Audio Prompt:</strong>
                    {renderPromptControls()}
                  </div>
                  <span className="block font-semibold">
                    {languageCode === 'ta' 
                      ? '"நன்றி. உங்கள் இருப்பிடம் பதிவு செய்யப்பட்டுள்ளது."' 
                      : '"Thank you. Your location has been recorded."'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STATE: COLLECTING_SYMPTOMS */}
          {ivrState === 'COLLECTING_SYMPTOMS' && (
            <div className="space-y-5">
              <div className="bg-brand-gray border border-brand-teal/10 p-4 rounded-xl flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-brand-teal shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs text-brand-forest leading-relaxed space-y-2 flex-1">
                  <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 gap-2">
                    <strong className="text-brand-teal uppercase tracking-wider text-[10px]">🔊 IVR Audio Prompt:</strong>
                    {renderPromptControls()}
                  </div>
                  {languageCode === 'ta' ? (
                    <span className="font-semibold block">"நன்றி. இப்போது உங்கள் உடல்நலப் பிரச்சனையைப் பற்றி தெரிவிக்கவும்."</span>
                  ) : (
                    <span className="font-semibold block">"Thank you. Now please describe your health problem."</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-brand-teal/20 rounded-2xl bg-brand-gray/10 gap-5">
                {isRecording && recordingTarget === 'symptoms' ? (
                  <div className="flex flex-col items-center gap-3">
                    {/* Visual Waveform */}
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
                      🔴 Listening... {formatCallTime(recordingSeconds)}
                    </span>
                    <button
                      onClick={stopSymptomRecording}
                      className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full flex items-center justify-center shadow-lg transition"
                    >
                      <Square className="w-4 h-4 fill-white" />
                    </button>
                  </div>
                ) : symptomTranscript ? (
                  <div className="w-full space-y-4">
                    <div className="bg-white border border-brand-teal/10 p-4 rounded-xl shadow-inner text-left space-y-2">
                      <span className="block font-bold text-[10px] text-brand-teal uppercase tracking-wider">
                        Speech-to-Text Transcript ({detectedLanguage})
                      </span>
                      {symptomTranscriptStatus === 'processing' ? (
                        <span className="text-xs text-brand-teal font-bold animate-pulse block">Processing voice recording via Whisper...</span>
                      ) : (
                        <p className="text-xs text-brand-forest italic leading-relaxed">
                          "{symptomTranscript}"
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => { setSymptomTranscript(''); setAudioBlob(null); setSymptomTranscriptStatus('idle'); }}
                        disabled={symptomTranscriptStatus === 'processing'}
                        className="bg-brand-gray border border-brand-teal/15 text-brand-forest text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-50"
                      >
                        Re-record
                      </button>
                      <button
                        onClick={runClinicalPipeline}
                        disabled={symptomTranscriptStatus === 'processing'}
                        className="bg-brand-teal hover:bg-brand-teal/95 text-white text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-xl shadow transition disabled:opacity-50"
                      >
                        Trigger AI & DB Persistency
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <button
                      onClick={startSymptomRecording}
                      disabled={isSpeaking}
                      className="bg-brand-teal hover:bg-brand-teal/95 disabled:opacity-50 text-white p-4 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition disabled:cursor-not-allowed"
                    >
                      <Mic className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-[10px] text-brand-earth uppercase tracking-widest font-semibold text-center">
                      {isSpeaking 
                        ? (languageCode === 'ta' ? 'கேட்டுக்கொண்டிருக்கிறது...' : 'Prompt is speaking...')
                        : (languageCode === 'ta' ? 'பேச கிளிக் செய்யவும்' : 'Click to record symptoms voice')}
                    </span>

                    {errorMessage && (
                      <p className="text-red-500 text-[10px] text-center font-bold px-2">{errorMessage}</p>
                    )}

                    <div className="w-full border-t border-brand-teal/10 pt-4 mt-2">
                      <span className="block text-[10px] text-brand-forest/60 uppercase font-black tracking-wider mb-2.5 text-center">
                        Or Load Preset Scenario
                      </span>
                      <div className="flex flex-col gap-2 max-w-md mx-auto">
                        {PRESET_SCENARIOS.map((preset, i) => (
                          <button
                            key={i}
                            onClick={() => handleSymptomPresetSelect(preset)}
                            disabled={isSpeaking}
                            className="bg-white hover:bg-brand-teal/5 disabled:opacity-50 border border-brand-teal/10 text-left p-2.5 rounded-xl text-xs text-brand-forest flex justify-between items-center transition shadow-sm disabled:cursor-not-allowed"
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

          {/* STATE: AUDIO_PROCESSING, TRANSCRIBING, CLINICAL_EXTRACTION */}
          {(ivrState === 'AUDIO_PROCESSING' || ivrState === 'TRANSCRIBING' || ivrState === 'CLINICAL_EXTRACTION') && (
            <div className="text-center space-y-5 py-8">
              <div className="relative w-16 h-16 mx-auto">
                <span className="absolute inset-0 rounded-full border-4 border-brand-teal/20"></span>
                <span className="absolute inset-0 rounded-full border-4 border-t-brand-teal border-r-brand-teal animate-spin"></span>
              </div>
              <div>
                <h3 className="text-md font-bold text-brand-forest">
                  {ivrState === 'AUDIO_PROCESSING' && '⚙️ Processing Audio Streams...'}
                  {ivrState === 'TRANSCRIBING' && '📝 Transcribing Speech (faster-whisper)...'}
                  {ivrState === 'CLINICAL_EXTRACTION' && '🧠 Analyzing Clinical Context (Qwen)...'}
                </h3>
                <p className="text-xs text-brand-earth mt-1 max-w-xs mx-auto leading-relaxed">
                  Executing real clinical analysis on FastAPI backend without mock replacements.
                </p>
              </div>
            </div>
          )}

          {/* STATE: CLINICAL_SUMMARY */}
          {ivrState === 'CLINICAL_SUMMARY' && clinicalAbstract && (
            <div className="space-y-4 text-left">
              <h3 className="text-xs font-bold text-brand-earth uppercase tracking-widest border-b border-brand-teal/5 pb-2">
                🧠 Extracted Clinical Abstract
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-brand-gray/50 p-3 rounded-xl border border-brand-teal/5">
                  <span className="block text-[9px] uppercase font-bold text-brand-earth/80">Chief Complaint</span>
                  <span className="font-semibold text-brand-forest block mt-0.5">"{symptomTranscript.slice(0, 50)}..."</span>
                </div>
                <div className="bg-brand-gray/50 p-3 rounded-xl border border-brand-teal/5">
                  <span className="block text-[9px] uppercase font-bold text-brand-earth/80">Severity & Duration</span>
                  <span className="font-semibold text-brand-forest block mt-0.5">{clinicalAbstract.severity} ({clinicalAbstract.duration})</span>
                </div>
              </div>
              <div className="bg-brand-teal/[0.02] border border-brand-teal/10 p-3 rounded-xl text-xs leading-relaxed text-brand-forest">
                <strong className="block text-[9px] uppercase tracking-wider text-brand-teal mb-0.5">NLP Summary:</strong>
                {clinicalAbstract.summary}
              </div>
            </div>
          )}

          {/* STATE: PRELIMINARY_TRIAGE */}
          {ivrState === 'PRELIMINARY_TRIAGE' && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-brand-teal/10 rounded-full flex items-center justify-center mx-auto text-brand-teal">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-md font-bold text-brand-forest uppercase">Triage Recommendation Determined</h3>
                <span className={`text-lg font-black block mt-1 uppercase ${
                  triagePriority === 'Emergency' ? 'text-red-500' : 'text-brand-teal'
                }`}>
                  {triagePriority}
                </span>
              </div>
            </div>
          )}

          {/* STATE: CASE_CREATED & DOCTOR_QUEUE */}
          {(ivrState === 'CASE_CREATED' || ivrState === 'DOCTOR_QUEUE') && (
            <div className="space-y-6">
              <div className="text-center space-y-3 pb-4 border-b border-brand-teal/5">
                <CheckCircle2 className="w-14 h-14 text-brand-forest mx-auto" />
                <div>
                  <h3 className="text-md font-black text-brand-forest uppercase tracking-wider">Case successfully created!</h3>
                  <p className="text-xs text-brand-earth font-mono mt-1">Case Ref ID: {createdCaseId}</p>
                </div>
              </div>



              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={hangupCall}
                  className="bg-brand-gray border border-brand-teal/15 hover:bg-brand-teal/10 text-brand-forest text-xs font-bold px-5 py-3 rounded-xl uppercase transition duration-150"
                >
                  Start New Call
                </button>
                <button
                  onClick={() => {
                    setCurrentRole('doctor');
                    window.history.pushState({}, '', '/');
                    window.dispatchEvent(new Event('popstate'));
                  }}
                  className="bg-brand-forest hover:bg-brand-forestLight text-brand-cream font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow transition duration-150"
                >
                  Go to Doctor Dashboard
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Pipeline Progress indicator at bottom */}
        {ivrState !== 'IDLE' && (
          <div className="bg-brand-gray/60 p-4 border-t border-brand-teal/10 text-xs">
            <span className="block text-[10px] font-bold text-brand-forest/60 uppercase tracking-widest mb-2.5">
              Consultation Pipeline Progress
            </span>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-bold text-brand-earth">
              {[
                { label: 'Language', active: ['SELECT_LANGUAGE', 'COLLECTING_LOCATION', 'LOCATION_CAPTURED', 'COLLECTING_SYMPTOMS', 'AUDIO_PROCESSING', 'TRANSCRIBING', 'CLINICAL_EXTRACTION', 'CLINICAL_SUMMARY', 'PRELIMINARY_TRIAGE', 'CASE_CREATED', 'DOCTOR_QUEUE'].includes(ivrState) && languageCode !== null },
                { label: 'Location', active: ['COLLECTING_LOCATION', 'LOCATION_CAPTURED', 'COLLECTING_SYMPTOMS', 'AUDIO_PROCESSING', 'TRANSCRIBING', 'CLINICAL_EXTRACTION', 'CLINICAL_SUMMARY', 'PRELIMINARY_TRIAGE', 'CASE_CREATED', 'DOCTOR_QUEUE'].includes(ivrState) },
                { label: 'Voice Captured', active: ['COLLECTING_SYMPTOMS', 'AUDIO_PROCESSING', 'TRANSCRIBING', 'CLINICAL_EXTRACTION', 'CLINICAL_SUMMARY', 'PRELIMINARY_TRIAGE', 'CASE_CREATED', 'DOCTOR_QUEUE'].includes(ivrState) && (symptomTranscript || isRecording) },
                { label: 'Triage Categorized', active: ['CLINICAL_SUMMARY', 'PRELIMINARY_TRIAGE', 'CASE_CREATED', 'DOCTOR_QUEUE'].includes(ivrState) },
                { label: 'Doctor Handed Off', active: ivrState === 'DOCTOR_QUEUE' }
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border transition ${
                    step.active ? 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal shadow-inner' : 'bg-white/40 border-brand-teal/5 opacity-55'
                  }`}
                >
                  {step.active ? '✓' : '○'} {step.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Simulator Logs Console */}
        {pipelineLogs.length > 0 && (
          <div className="bg-black/90 p-4 border-t border-brand-teal/20 text-[10px] font-mono text-green-400 max-h-[140px] overflow-y-auto">
            <div className="font-bold text-white mb-1.5 uppercase tracking-wider text-[9px]">🖥️ Real-time Pipeline Console Logs</div>
            {pipelineLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">{log}</div>
            ))}
          </div>
        )}

      </div>

      {/* Right Column: E2E Response & Pharmacy Monitor */}
      {!['IDLE', 'INCOMING_CALL', 'CALL_CONNECTED'].includes(ivrState) && (
        <div className="bg-white w-full rounded-3xl border border-brand-teal/25 shadow-2xl p-6 space-y-6 relative overflow-hidden bg-dot-grid">
          <div className="border-b border-brand-teal/15 pb-3">
            <h3 className="text-sm font-black uppercase text-brand-forest tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand-teal animate-pulse" />
              E2E Response & Pharmacy Monitor
            </h3>
            <p className="text-[10px] text-brand-earth mt-0.5 font-bold uppercase tracking-wider">
              Real-time status monitor for case: {createdCaseId || 'Pending Creation'}
            </p>
          </div>

          {/* AI Triage Classification Status */}
          <div className="bg-brand-gray border border-brand-teal/10 p-4 rounded-2xl space-y-2">
            <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-widest">
              Step 1: AI Preliminary Triage
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] text-brand-earth font-bold block uppercase">Classification</span>
                <span className="text-xs font-black text-brand-forest">
                  {triagePriority ? (triagePriority === 'Emergency' ? '🚨 EMERGENCY' : '🟢 NON-EMERGENCY') : 'Pending input...'}
                </span>
              </div>
              {triagePriority && (
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  triagePriority === 'Emergency' 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse'
                    : 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal'
                }`}>
                  {triagePriority === 'Emergency' ? 'Critical' : 'Routine'}
                </span>
              )}
            </div>
          </div>

          {/* Simulated Case Journey tracker */}
          {createdCaseId ? (
            <div className="space-y-5">
              <div className="relative pl-6 space-y-5 border-l border-brand-teal/15 ml-3">
                
                {/* Step 2: Doctor Review */}
                <div className="relative">
                  <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                    dbCaseDetails?.status !== 'CREATED' && dbCaseDetails?.status !== 'VOICE_SUBMITTED'
                      ? 'bg-brand-teal border-brand-teal text-white'
                      : 'bg-white border-brand-teal/30 text-brand-teal'
                  }`}>
                    {dbCaseDetails?.status !== 'CREATED' && dbCaseDetails?.status !== 'VOICE_SUBMITTED' ? '✓' : '2'}
                  </span>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-widest">Step 2: Doctor Review & Decision</span>
                    {dbCaseDetails?.status === 'CREATED' || dbCaseDetails?.status === 'VOICE_SUBMITTED' ? (
                      <div className="space-y-2 pt-1">
                        <span className="block text-[11px] text-brand-earth font-bold animate-pulse">
                          ⏳ Waiting for Doctor Review...
                        </span>
                        <button
                          onClick={simulatedDoctorApprove}
                          className="bg-brand-teal hover:bg-brand-teal/90 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition shadow-sm"
                        >
                          Simulate Doctor Approve
                        </button>
                      </div>
                    ) : (
                      <span className="block text-[11px] text-brand-forest font-bold pt-1">
                        ✓ Dr. Ramesh Kumar confirmed review & assessment.
                      </span>
                    )}
                  </div>
                </div>

                {/* BRANCH 1: EMERGENCY RESPONSE */}
                {triagePriority === 'Emergency' && (
                  <div className="relative">
                    <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                      dbCaseDetails?.status !== 'CREATED' && dbCaseDetails?.status !== 'VOICE_SUBMITTED'
                        ? 'bg-red-500 border-red-500 text-white animate-pulse'
                        : 'bg-white border-brand-teal/30 text-brand-teal'
                    }`}>
                      {dbCaseDetails?.status !== 'CREATED' && dbCaseDetails?.status !== 'VOICE_SUBMITTED' ? '🚨' : '3'}
                    </span>
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold text-red-500 uppercase tracking-widest">Step 3: Emergency response dispatch</span>
                      {dbCaseDetails?.status !== 'CREATED' && dbCaseDetails?.status !== 'VOICE_SUBMITTED' ? (
                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl space-y-2">
                          <span className="block text-red-600 font-bold text-[11px] leading-relaxed">
                            🚨 EMERGENCY ACTION COMPLETED:
                          </span>
                          <ul className="text-[10px] text-brand-forest list-disc pl-4 space-y-1 font-semibold">
                            <li>Ambulance dispatched to location: <strong>{locationText}</strong>.</li>
                            <li>Local worker alert sent to phone: <strong>{demoPhone}</strong>.</li>
                          </ul>
                        </div>
                      ) : (
                        <span className="block text-[11px] text-brand-earth italic font-semibold pt-1">
                          Pending Doctor confirmation...
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* BRANCH 2: NON-EMERGENCY PHARMACY TRANSITION */}
                {triagePriority !== 'Emergency' && (
                  <>
                    {/* Step 3: Pharmacy Prep */}
                    <div className="relative">
                      <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                        dbCaseDetails?.status === 'Dispensed'
                          ? 'bg-brand-teal border-brand-teal text-white'
                          : (dbCaseDetails?.status === 'Pharmacy' || dbCaseDetails?.status === 'Prescription' || dbCaseDetails?.status === 'DOCTOR_APPROVED')
                            ? 'bg-brand-teal/20 border-brand-teal text-brand-teal animate-pulse'
                            : 'bg-white border-brand-teal/30 text-brand-teal'
                      }`}>
                        {dbCaseDetails?.status === 'Dispensed' ? '✓' : '3'}
                      </span>
                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-widest">Step 3: Pharmacy Handoff & Prep</span>
                        {dbCaseDetails?.status === 'Pharmacy' || dbCaseDetails?.status === 'Prescription' || dbCaseDetails?.status === 'DOCTOR_APPROVED' ? (
                          <div className="space-y-2 pt-1">
                            <span className="block text-[11px] text-brand-teal font-bold animate-pulse">
                              💊 Preparing medicines at Pharmacy Hub...
                            </span>
                            <button
                              onClick={simulatedPharmacyDispense}
                              className="bg-brand-forest text-brand-cream text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl hover:bg-brand-forestLight transition shadow-sm"
                            >
                              Dispense Medicine (Simulate)
                            </button>
                          </div>
                        ) : dbCaseDetails?.status === 'Dispensed' ? (
                          <span className="block text-[11px] text-brand-forest font-bold pt-1">
                            ✓ Medicines prepared and ready at counter.
                          </span>
                        ) : (
                          <span className="block text-[11px] text-brand-earth italic font-semibold pt-1">
                            Pending Doctor prescription approval...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step 4: Token & SMS */}
                    <div className="relative">
                      <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                        dbCaseDetails?.status === 'Dispensed'
                          ? 'bg-brand-teal border-brand-teal text-white'
                          : 'bg-white border-brand-teal/30 text-brand-teal'
                      }`}>
                        {dbCaseDetails?.status === 'Dispensed' ? '✓' : '4'}
                      </span>
                      <div className="space-y-1.5">
                        <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-widest">Step 4: Medicine Pickup Token & SMS Alert</span>
                        {dbCaseDetails?.status === 'Dispensed' ? (
                          <div className="space-y-2 w-full pt-1">
                            <div className="flex gap-2">
                              <span className="bg-brand-teal text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Token: {dbCaseDetails.tokenNumber || 'C-73'}
                              </span>
                            </div>
                            
                            {/* Simulated Phone Screen */}
                            <div className="border border-brand-teal/20 rounded-2xl bg-brand-gray/80 p-3 shadow-inner relative max-w-sm">
                              <div className="flex justify-between items-center border-b border-brand-teal/5 pb-1 mb-1.5 text-[8px] text-brand-earth uppercase font-bold tracking-widest font-mono">
                                <span>📱 Messages — RURALCARE</span>
                                <span>Now</span>
                              </div>
                              <p className="text-[10px] text-brand-forest leading-relaxed font-semibold italic">
                                "RURALCARE Alert: Medicines are ready. Token: {dbCaseDetails.tokenNumber || 'C-73'}. Present token at counter to collect. You can share this token with a relative or friend to pick it up."
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="block text-[11px] text-brand-earth italic font-semibold pt-1">
                            Waiting for pharmacy dispense...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step 5: Collected */}
                    <div className="relative">
                      <span className={`absolute -left-[30px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${
                        dbCaseDetails?.status === 'Dispensed'
                          ? 'bg-brand-teal border-brand-teal text-white'
                          : 'bg-white border-brand-teal/30 text-brand-teal'
                      }`}>
                        {dbCaseDetails?.status === 'Dispensed' ? '✓' : '5'}
                      </span>
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-widest">Step 5: Medicine Pickup Collection</span>
                        {dbCaseDetails?.status === 'Dispensed' ? (
                          <span className="block text-[11px] text-brand-forest font-black pt-1">
                            ✓ Collected by relative/friend using Token {dbCaseDetails.tokenNumber || 'C-73'}.
                          </span>
                        ) : (
                          <span className="block text-[11px] text-brand-earth italic font-semibold pt-1">
                            Waiting for collection...
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <span className="w-1.5 h-1.5 bg-brand-teal rounded-full animate-ping mx-auto block"></span>
              <span className="text-xs text-brand-earth block font-semibold">
                E2E status updates activate once the IVR call is completed and a case is successfully registered in Supabase.
              </span>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
};

export default IvrDemoDashboard;
