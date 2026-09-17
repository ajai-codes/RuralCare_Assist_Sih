import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, RefreshCw, Sparkles, AlertCircle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { useCase } from '../../hooks/useCase';
import { api } from '../../services/api';

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

export const VoiceRecorder: React.FC = () => {
  const { analyzeCase, addNotification } = useCase();
  
  // UI states: 'idle' | 'recording' | 'processing' | 'completed' | 'error'
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'completed' | 'error'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [showPresets, setShowPresets] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Web Audio and Speech Recognition Refs/States
  const [selectedLanguage, setSelectedLanguage] = useState<'ta-IN' | 'en-US'>('ta-IN');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [audioData, setAudioData] = useState<number[]>(new Array(8).fill(8));
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');

  // Recording Timer
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Clean up Web Audio node structures and Speech Recognition context on component unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          console.error('Failed to close AudioContext:', e);
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error('Failed to abort SpeechRecognition:', e);
        }
      }
    };
  }, []);

  const startRecording = async () => {
    setStatus('recording');
    setSeconds(0);
    setAudioBlob(null);
    setTranscript(null);
    setLanguage(null);
    setErrorMessage(null);
    setLiveTranscript('');
    latestTranscriptRef.current = '';
    audioChunksRef.current = [];
    setAudioData(new Array(8).fill(8));

    // Pre-generate unique Case ID
    const generatedCaseId = `RT-${Math.floor(10000 + Math.random() * 90000)}`;
    setCaseId(generatedCaseId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Setup Web Audio API volume visualizer
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Small fftSize is enough for 8 frequency bars
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const updateVisuals = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            
            // Map the dataArray frequencies to 8 bars
            const newAudioData = [];
            const step = Math.max(1, Math.floor(bufferLength / 8));
            for (let i = 0; i < 8; i++) {
              let sum = 0;
              const startIdx = i * step;
              for (let j = 0; j < step; j++) {
                sum += dataArray[startIdx + j] || 0;
              }
              const average = sum / step;
              // Scale average (0-255) to a height between 8px (idle) and 48px (loud)
              const heightVal = Math.max(8, Math.min(48, 8 + (average / 255) * 40));
              newAudioData.push(heightVal);
            }
            setAudioData(newAudioData);
            animationFrameRef.current = requestAnimationFrame(updateVisuals);
          }
        };
        updateVisuals();
      } catch (audioErr) {
        console.error('Failed to initialize Web Audio analyzer:', audioErr);
      }

      // 2. Setup Web Speech API for live transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = selectedLanguage;

          let finalTranscript = '';
          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const currentText = (finalTranscript + interim).trim();
            latestTranscriptRef.current = currentText;
            setLiveTranscript(currentText);
          };

          recognition.onerror = (recErr: any) => {
            console.error('Web Speech Recognition error:', recErr.error);
            if (recErr.error === 'not-allowed') {
              addNotification('Speech recognition permission denied.');
            }
          };

          recognition.onend = () => {
            console.log('Web Speech Recognition engine stopped.');
          };

          recognitionRef.current = recognition;
          recognition.start();
          addNotification('Live transcription active...');
        } catch (recInitErr) {
          console.error('Web Speech Recognition initialization failed:', recInitErr);
        }
      } else {
        console.warn('Web Speech API is not supported in this browser.');
      }

      // 3. Setup standard MediaRecorder for capturing file blob
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }

      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // Stop microphone stream tracks immediately
        stream.getTracks().forEach(track => track.stop());

        // Cleanup Web Audio API volume loops
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
          } catch (e) {
            console.error(e);
          }
        }

        // Wait slightly for recognition's last onresult triggers to propagate, then process
        setTimeout(async () => {
          const finalOverride = latestTranscriptRef.current.trim();
          await processAudio(generatedCaseId, blob, finalOverride || undefined);
        }, 400);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      addNotification('Microphone captured. Speak clearly now...');
    } catch (err: any) {
      console.error('Microphone acquisition error:', err);
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please click the camera/microphone icon in your browser address bar to allow permissions and reload.');
      } else {
        setErrorMessage('No microphone device found or audio hardware is busy. Please connect a microphone and try again.');
      }
      addNotification('Error: Microphone permissions denied or device missing.');
    }
  };

  const stopRecording = () => {
    // Stop SpeechRecognition engine immediately to finalize transcripts
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setStatus('processing');
      addNotification('Processing voice recording...');
    }
  };

  const processAudio = async (cid: string, blob: Blob, overrideText?: string) => {
    setStatus('processing');
    try {
      // 1. Upload audio WebM
      const upload = await api.uploadAudio(cid, blob);
      
      // 2. Transcribe using Whisper (with override text from client-side Web Speech Recognition if available)
      const res = await api.transcribeAudio(cid, upload.audio_path, overrideText || undefined);
      
      if (!res.transcript || res.transcript.trim() === '') {
        throw new Error('NoSpeechDetected');
      }

      setTranscript(res.transcript);
      setLanguage(res.detected_language);
      setStatus('completed');
      addNotification(`Live STT completed. Detected: ${res.detected_language}`);
    } catch (err: any) {
      console.error('Speech-to-text pipeline failed:', err);
      setStatus('error');
      if (err.message === 'NoSpeechDetected') {
        setErrorMessage('We could not detect any speech. Please hold the microphone closer, speak clearly, and record again.');
      } else {
        setErrorMessage('Unable to process your voice recording. Please check your microphone and try again.');
      }
      addNotification('Error: Speech recognition failed.');
    }
  };

  const handlePresetSelect = (preset: typeof PRESET_MOCK_VOICES[0]) => {
    const generatedCaseId = `RT-${Math.floor(10000 + Math.random() * 90000)}`;
    setCaseId(generatedCaseId);
    setAudioBlob(null); // Presets do not have real audio
    setTranscript(preset.transcript);
    setLanguage(preset.language);
    setStatus('completed');
    addNotification(`Preset scenario loaded: ${preset.label}`);
  };

  const submitToDashboard = async () => {
    if (!caseId || !transcript || !language) return;
    setStatus('processing');
    try {
      if (audioBlob) {
        // Real microphone path: patient registers, case created, AI summarization runs
        await analyzeCase(caseId, transcript, language);
      } else {
        // Preset mock path: upload a dummy wav file first to maintain database integrity, then run AI analysis
        const dummyBytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);
        const dummyBlob = new Blob([dummyBytes], { type: 'audio/wav' });
        const upload = await api.uploadAudio(caseId, dummyBlob);
        await api.transcribeAudio(caseId, upload.audio_path, transcript);
        await analyzeCase(caseId, transcript, language);
      }
      addNotification(`Case ${caseId} submitted to clinical triage.`);
      resetRecorder();
    } catch (err) {
      console.error('Triage analysis submission failed:', err);
      setStatus('error');
      setErrorMessage('Failed to trigger clinical AI analysis. Please check your backend FastAPI / Ollama service.');
    }
  };

  const resetRecorder = () => {
    setStatus('idle');
    setSeconds(0);
    setTranscript(null);
    setLanguage(null);
    setAudioBlob(null);
    setCaseId(null);
    setErrorMessage(null);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full bg-white rounded-xl border border-brand-teal/15 p-6 shadow-sm relative overflow-hidden bg-dot-grid">
      {/* Background Graphic Accent */}
      <div className="absolute right-0 top-0 text-brand-teal/5 pointer-events-none transform translate-x-8 -translate-y-8">
        <Mic className="w-36 h-36" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-6 border-b border-brand-teal/5 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-forest">
              Voice Consultation Hub
            </h3>
            <p className="text-xs text-brand-earth">Automatic Tamil, English & Mixed language detection</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-teal bg-brand-teal/5 border border-brand-teal/10 px-2.5 py-1 rounded-lg">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Real Microphone Active</span>
          </div>
        </div>

        {/* 1. Recorder Widget Container */}
        <div className="flex flex-col items-center justify-center py-6">
          
          {/* STATE: IDLE */}
          {status === 'idle' && (
            <div className="flex flex-col items-center text-center space-y-5 w-full">
              {/* Language Selection Tabs */}
              <div className="flex bg-brand-gray/50 border border-brand-teal/10 p-1 rounded-xl shadow-inner text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('ta-IN')}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                    selectedLanguage === 'ta-IN'
                      ? 'bg-brand-teal text-white shadow-sm'
                      : 'text-brand-earth hover:text-brand-forest'
                  }`}
                >
                  Tamil (தமிழ்)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en-US')}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 uppercase tracking-wider ${
                    selectedLanguage === 'en-US'
                      ? 'bg-brand-teal text-white shadow-sm'
                      : 'text-brand-earth hover:text-brand-forest'
                  }`}
                >
                  English
                </button>
              </div>

              <div className="relative">
                <span className="absolute -inset-3 rounded-full bg-brand-teal/10 animate-pulse"></span>
                <button
                  onClick={startRecording}
                  className="relative p-8 rounded-full border border-brand-tealDark bg-brand-teal text-brand-cream hover:bg-brand-tealLight hover:scale-105 transition-transform shadow-lg duration-200 active:scale-95 flex items-center justify-center"
                >
                  <Mic className="w-8 h-8" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-brand-forest uppercase tracking-wider">
                  Click to Start Speaking
                </p>
                <p className="text-[11px] text-brand-earth max-w-sm">
                  Speak clearly in the selected language. Your voice will be captured and transcribed live.
                </p>
              </div>
            </div>
          )}

          {/* STATE: RECORDING */}
          {status === 'recording' && (
            <div className="flex flex-col items-center text-center space-y-4 w-full">
              <div className="relative">
                <span className="absolute -inset-4 rounded-full bg-clinical-emergency/15 animate-ping-slow"></span>
                <span className="absolute -inset-8 rounded-full bg-clinical-emergency/5 animate-pulse"></span>
                <button
                  onClick={stopRecording}
                  className="relative p-8 rounded-full border border-clinical-emergency bg-clinical-emergency text-brand-cream shadow-lg active:scale-95 flex items-center justify-center"
                >
                  <Square className="w-8 h-8 fill-brand-cream" />
                </button>
              </div>
              
              <div className="space-y-3 w-full max-w-sm">
                <p className="text-xs font-bold text-clinical-emergency tracking-widest uppercase flex items-center gap-1.5 justify-center">
                  <span className="h-2 w-2 bg-clinical-emergency rounded-full animate-ping" />
                  Listening ({selectedLanguage === 'ta-IN' ? 'Tamil' : 'English'})... {formatTime(seconds)}
                </p>
                
                {/* Waveform Visualization (Web Audio API driven) */}
                <div className="flex gap-1.5 justify-center items-center h-12 py-1 bg-brand-gray/20 rounded-xl px-4 border border-brand-teal/5">
                  {audioData.map((height, idx) => (
                    <div
                      key={idx}
                      className="w-1.5 bg-clinical-emergency rounded-full transition-all duration-75"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>

                {/* Real-time Web Speech Transcription Output */}
                <div className="min-h-12 flex items-center justify-center">
                  {liveTranscript ? (
                    <div className="w-full p-3 bg-brand-gray/30 rounded-xl border border-brand-teal/5 shadow-inner text-left animate-fade-in animate-duration-300">
                      <p className="text-[9px] font-bold text-clinical-emergency uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-clinical-emergency rounded-full animate-pulse" />
                        Live Voice Transcribing...
                      </p>
                      <p className="text-xs font-medium text-brand-forest italic leading-relaxed">
                        "{liveTranscript}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-brand-earth italic">Waiting for speech detection...</p>
                  )}
                </div>
                
                <p className="text-[11px] text-brand-earth italic">Click the square button when you are finished speaking.</p>
              </div>
            </div>
          )}

          {/* STATE: PROCESSING */}
          {status === 'processing' && (
            <div className="w-full max-w-sm py-4">
              <div className="flex flex-col items-center justify-center p-6 bg-brand-gray/40 border border-brand-teal/10 rounded-xl shadow-inner text-center">
                <div className="relative mb-4">
                  <span className="absolute -inset-2 rounded-full bg-brand-teal/20 animate-ping"></span>
                  <div className="relative bg-brand-teal/15 p-3 rounded-full border border-brand-teal/30">
                    <RefreshCw className="w-5 h-5 text-brand-teal animate-spin" />
                  </div>
                </div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-forest">Processing Speech</h4>
                <p className="text-[11px] text-brand-earth mt-1 leading-relaxed">
                  Transcribing acoustics and identifying spoken dialect...
                </p>
              </div>
            </div>
          )}

          {/* STATE: COMPLETED */}
          {status === 'completed' && transcript && (
            <div className="w-full max-w-md bg-brand-gray/50 border border-brand-teal/10 p-5 rounded-xl space-y-4 shadow-inner">
              <div className="flex items-center gap-2 text-brand-forest border-b border-brand-teal/5 pb-2">
                <CheckCircle className="w-4 h-4 text-brand-teal" />
                <span className="text-xs font-bold uppercase tracking-wider">Speech Capture Complete</span>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-wider mb-1">
                  Detected Language:
                </span>
                <span className="inline-block text-xs font-bold uppercase tracking-wider bg-brand-teal/10 text-brand-teal px-2.5 py-1 rounded border border-brand-teal/10 font-mono shadow-sm">
                  {language}
                </span>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-brand-earth uppercase tracking-wider mb-1">
                  Patient Statement:
                </span>
                <blockquote className="text-sm font-medium bg-white p-3 rounded-lg border border-brand-teal/5 text-brand-forest relative shadow-sm">
                  <span className="text-brand-teal font-serif text-2xl absolute -left-1 -top-2 select-none opacity-40">“</span>
                  <span className="pl-4 italic">{transcript}</span>
                </blockquote>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={resetRecorder}
                  className="flex-1 py-2 bg-white hover:bg-brand-gray/60 border border-brand-teal/20 text-brand-forest rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Record Again
                </button>
                <button
                  onClick={submitToDashboard}
                  className="flex-1 py-2 bg-brand-teal hover:bg-brand-tealDark text-white rounded-lg shadow font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze Symptoms
                </button>
              </div>
            </div>
          )}

          {/* STATE: ERROR / PERMISSION DENIED */}
          {status === 'error' && (
            <div className="w-full max-w-sm bg-clinical-emergency/5 border border-clinical-emergency/20 p-5 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-clinical-emergency">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Voice Input Unavailable</h4>
              </div>
              <p className="text-xs text-brand-forest leading-relaxed">
                {errorMessage}
              </p>
              <button
                onClick={resetRecorder}
                className="w-full py-2 bg-white hover:bg-clinical-emergency/10 border border-clinical-emergency/30 text-clinical-emergency rounded-lg font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Dismiss & Retry
              </button>
            </div>
          )}

        </div>

        {/* 2. Collapsible Demo Preset Drawer */}
        <div className="mt-4 border-t border-brand-teal/5 pt-4">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="w-full flex justify-between items-center text-xs text-brand-earth hover:text-brand-forest transition-colors py-1.5 px-2.5 bg-brand-gray/40 rounded-lg border border-brand-teal/5"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
              <span className="font-semibold uppercase tracking-wider text-[10px]">Demo Presenter Assist (Presets)</span>
            </span>
            {showPresets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showPresets && (
            <div className="mt-3 bg-brand-gray/20 p-3 rounded-xl border border-brand-teal/5 space-y-2 animate-fade-in">
              <label className="block text-[9px] font-bold text-brand-earth uppercase tracking-wider">
                Click a mock scenario to pre-populate consultation data for presentation:
              </label>
              <div className="space-y-1.5">
                {PRESET_MOCK_VOICES.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full text-left text-xs p-2 rounded-lg border border-brand-teal/5 hover:border-brand-teal/20 bg-white hover:bg-brand-gray/30 transition-all flex justify-between items-center"
                  >
                    <span className="font-medium text-brand-forest">{preset.label}</span>
                    <span className="text-[8px] uppercase bg-brand-teal/10 text-brand-teal px-1.5 py-0.5 rounded border border-brand-teal/10 font-mono">
                      {preset.language}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VoiceRecorder;
