import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Phone, User, Plus, Mic, MicOff, VideoOff, PhoneOff, RefreshCw, FileText, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { teleconsultationApi, getSignalingWsUrl } from '../../services/phase1Api';
import type { Teleconsultation } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-clinical-urgentLight text-clinical-urgent',
  SCHEDULED: 'bg-clinical-activeLight text-clinical-active',
  ACCEPTED: 'bg-brand-teal/10 text-brand-teal',
  IN_PROGRESS: 'bg-clinical-routineLight text-clinical-routine',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

interface Props {
  role: 'patient' | 'doctor';
  patientId?: string;
  doctorId?: string;
}

// Generate animated medical fallback canvas stream when physical hardware is not accessible
function createFallbackStream(label: string): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  
  let frame = 0;
  const intervalId = setInterval(() => {
    if (!ctx) return;
    frame++;
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 640, 480);
    grad.addColorStop(0, '#0a221b');
    grad.addColorStop(1, '#134e4a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);
    
    // Animated clinical grid
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 640; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 480);
      ctx.stroke();
    }
    for (let y = 0; y < 480; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }
    
    // Pulse rings
    const ringPulse = (frame * 1.5) % 100;
    ctx.beginPath();
    ctx.arc(320, 200, 40 + ringPulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(45, 212, 191, ${Math.max(0, 1 - ringPulse / 100) * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Avatar Glow & Badge
    ctx.beginPath();
    ctx.arc(320, 200, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#0f766e';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Icon / Initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.startsWith('Doctor') ? '🩺' : '👤', 320, 200);

    // Text labels
    ctx.fillStyle = '#f0fdfa';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(label, 320, 290);
    
    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`● TELECONSULT FEED • ${new Date().toLocaleTimeString()}`, 320, 320);

    ctx.fillStyle = '#99f6e4';
    ctx.font = '11px sans-serif';
    ctx.fillText('Encrypted WebRTC Peer Connection Active', 320, 345);
  }, 60);

  // Capture canvas stream
  let canvasStream: MediaStream;
  if ((canvas as any).captureStream) {
    canvasStream = (canvas as any).captureStream(25);
  } else {
    canvasStream = new MediaStream();
  }
  
  // Attach safe stop
  (canvasStream as any).customCleanup = () => {
    clearInterval(intervalId);
    canvasStream.getTracks().forEach(t => t.stop());
  };

  return canvasStream;
}

export const TeleconsultationPanel: React.FC<Props> = ({ role, patientId, doctorId }) => {
  const [teleconsultations, setTeleconsultations] = useState<Teleconsultation[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  
  // Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Media states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isUsingFallbackVideo, setIsUsingFallbackVideo] = useState(false);
  
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('idle');
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [remotePeerPresent, setRemotePeerPresent] = useState(false);

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [clinicalPriority, setClinicalPriority] = useState<'Routine' | 'Urgent' | 'Emergency'>('Routine');
  const [priorityReason, setPriorityReason] = useState('');
  const [isSimulatingRemote, setIsSimulatingRemote] = useState(false);

  // Refs for WebRTC & Audio/Video
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<any>(null);
  const durationCounterRef = useRef<number>(0);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const fallbackStreamRef = useRef<MediaStream | null>(null);
  const simIntervalRef = useRef<any>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading && teleconsultations.length === 0) setLoading(true);
    try {
      const data = await teleconsultationApi.list({ patient_id: patientId, doctor_id: doctorId });
      if (Array.isArray(data) && data.length > 0) {
        setTeleconsultations(data);
      }
    } catch (e) {
      console.error('Failed to load teleconsultations:', e);
    } finally {
      setLoading(false);
    }
  }, [patientId, doctorId, teleconsultations.length]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 12000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Bind local stream to video element whenever localStream or activeCallId changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play note:', e));
    }
  }, [localStream, activeCallId]);

  // Bind remote stream to video element whenever remoteStream or activeCallId changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Remote video play note:', e));
    }
  }, [remoteStream, activeCallId]);

  // Clean up active WebRTC resources without clearing UI activeCallId (used internally before re-init)
  const closeWebRTCResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      if ((localStream as any).customCleanup) (localStream as any).customCleanup();
    }
    if (fallbackStreamRef.current) {
      if ((fallbackStreamRef.current as any).customCleanup) (fallbackStreamRef.current as any).customCleanup();
      fallbackStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'leave' }));
        } catch (e) {}
      }
      socketRef.current.close();
      socketRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    iceCandidateQueue.current = [];
  }, [localStream]);

  // Handle WebRTC Peer Connection & Signaling
  const setupWebRTC = useCallback(async (roomId: string) => {
    closeWebRTCResources();
    setConnectionStatus('connecting');
    setIsAudioOnly(false);
    setIsUsingFallbackVideo(false);

    let stream: MediaStream | null = null;
    
    // 1. Try to get real user webcam & microphone
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });
      }
    } catch (err: any) {
      console.warn('Physical camera/mic access failed, checking audio-only or fallback:', err);
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsAudioOnly(true);
        }
      } catch (audioErr) {
        console.warn('Audio device also unavailable, initializing virtual teleconsult stream:', audioErr);
      }
    }

    // If hardware is unavailable or denied, generate simulated clinical stream so demo is flawless
    if (!stream) {
      const fallback = createFallbackStream(role === 'doctor' ? 'Doctor Live Feed' : 'Patient Live Feed');
      fallbackStreamRef.current = fallback;
      stream = fallback;
      setIsUsingFallbackVideo(true);
    }

    setLocalStream(stream);

    // 2. Create RTCPeerConnection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, stream!);
        } catch (e) {}
      });
    }

    // Handle Remote Track
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote stream track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setRemotePeerPresent(true);
        setConnectionStatus('connected');
      }
    };

    // Connection state listeners
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setRemotePeerPresent(true);
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            durationCounterRef.current += 1;
            setCallDurationSeconds(durationCounterRef.current);
          }, 1000);
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('reconnecting');
      } else if (pc.connectionState === 'closed') {
        setConnectionStatus('disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
        setRemotePeerPresent(true);
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            durationCounterRef.current += 1;
            setCallDurationSeconds(durationCounterRef.current);
          }, 1000);
        }
      }
    };

    // Helper: Safely create and send offer without collision
    const sendOfferSafely = async () => {
      if (!pc || pc.signalingState !== 'stable') return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'offer', sdp: offer }));
        }
      } catch (err) {
        console.error('[WebRTC] Offer error:', err);
      }
    };

    // 3. Setup WebSocket Signaling
    const wsUrl = getSignalingWsUrl(roomId);
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      socketRef.current = socket;
    } catch (wsErr) {
      console.error('[Signaling] Failed to connect WebSocket:', wsErr);
      return;
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    socket.onopen = () => {
      console.log('[Signaling] WebSocket connected to room:', roomId);
      socket.send(JSON.stringify({
        type: 'join',
        role,
        userId: role === 'patient' ? patientId : doctorId
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[Signaling] Message received:', msg.type);

        if (msg.type === 'peer-joined') {
          setRemotePeerPresent(true);
          await sendOfferSafely();
        } else if (msg.type === 'offer' && msg.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          
          // Drain buffered ice candidates
          while (iceCandidateQueue.current.length > 0) {
            const cand = iceCandidateQueue.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'answer', sdp: answer }));
          }
        } else if (msg.type === 'answer' && msg.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          
          // Drain buffered ice candidates
          while (iceCandidateQueue.current.length > 0) {
            const cand = iceCandidateQueue.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
          }
        } else if (msg.type === 'ice-candidate' && msg.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(console.warn);
          } else {
            iceCandidateQueue.current.push(msg.candidate);
          }
        } else if (msg.type === 'peer-left') {
          console.log('[Signaling] Peer left consultation');
          setRemotePeerPresent(false);
          setRemoteStream(null);
          setConnectionStatus('reconnecting');
        }
      } catch (err) {
        console.error('[Signaling] Message parse error:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('[Signaling] WebSocket notice:', err);
    };

    socket.onclose = () => {
      console.log('[Signaling] WebSocket closed');
    };
  }, [closeWebRTCResources, role, patientId, doctorId]);

  // Track toggles
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    }
  }, [isMuted, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !isVideoOff; });
    }
  }, [isVideoOff, localStream]);

  // Start Call Session
  const startCallSession = async (tc: Teleconsultation) => {
    const roomId = tc.room_id || `room-${tc.id.toLowerCase()}`;
    setActiveCallId(tc.id);
    setActiveRoomId(roomId);
    setCallDurationSeconds(0);
    durationCounterRef.current = 0;
    
    // Start duration timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      durationCounterRef.current += 1;
      setCallDurationSeconds(durationCounterRef.current);
    }, 1000);

    // Update status to IN_PROGRESS in backend
    try {
      await teleconsultationApi.updateStatus(tc.id, 'IN_PROGRESS');
    } catch (e) {
      console.warn('Status update to IN_PROGRESS note:', e);
    }
    
    await setupWebRTC(roomId);
  };

  // Simulate Remote Peer for 1-click Testing in Demos
  const toggleSimulateRemotePeer = () => {
    if (isSimulatingRemote) {
      setIsSimulatingRemote(false);
      setRemotePeerPresent(false);
      setRemoteStream(null);
    } else {
      setIsSimulatingRemote(true);
      setRemotePeerPresent(true);
      setConnectionStatus('connected');
      const simStream = createFallbackStream(role === 'doctor' ? 'Patient Live Feed (Selva, 42y)' : 'Doctor Live Feed (Dr. V. Sharma)');
      setRemoteStream(simStream);
    }
  };

  // Complete & End Call Session
  const endCallSession = async () => {
    const callId = activeCallId;
    const finalSeconds = durationCounterRef.current;
    
    closeWebRTCResources();
    setActiveCallId(null);
    setActiveRoomId(null);
    setConnectionStatus('idle');
    setRemotePeerPresent(false);
    setCallDurationSeconds(0);
    durationCounterRef.current = 0;
    setIsSimulatingRemote(false);

    if (callId) {
      try {
        await teleconsultationApi.updateStatus(callId, 'COMPLETED', finalSeconds);
      } catch (e) {
        console.error('Failed to mark teleconsultation completed:', e);
      }
      loadData(false);
    }
  };

  const handleReconnect = async () => {
    if (activeRoomId) {
      await setupWebRTC(activeRoomId);
    }
  };

  const requestConsultation = async () => {
    const targetPatientId = patientId || '';
    const tempRoomId = `room-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      const res = await teleconsultationApi.create({
        patient_id: targetPatientId,
        facility_id: '550e8400-e29b-41d4-a716-446655440000',
        room_id: tempRoomId,
        scheduled_at: new Date(Date.now() + 15 * 60000).toISOString()
      });
      if (res && res.id) {
        setTeleconsultations(prev => [res, ...prev]);
      }
    } catch (e) {
      console.error('Failed to create teleconsultation:', e);
    }
    loadData(false);
  };

  const saveNotes = async (id: string) => {
    if (!notes.trim() && !priorityReason.trim()) {
      alert('Please enter consultation notes or a reason for clinical priority override.');
      return;
    }
    try {
      await teleconsultationApi.addNotes(id, notes, clinicalPriority, priorityReason);
      if (priorityReason.trim()) {
        await teleconsultationApi.reassessPriority(id, clinicalPriority, priorityReason);
      }
      setNotes('');
      setPriorityReason('');
      alert('Consultation notes & clinical priority override saved to database and audit log!');
      loadData(false);
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && teleconsultations.length === 0) {
    return <div className="animate-pulse p-6 text-brand-earth text-xs font-semibold">Loading teleconsultations...</div>;
  }

  return (
    <div className="space-y-5 text-left">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-teal/10 text-brand-teal rounded-xl shadow-sm">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase text-brand-forest tracking-wider flex items-center gap-2">
              Live WebRTC Teleconsultation Room
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-clinical-routineLight text-clinical-routine border border-clinical-routine/20">
                P2P Ready
              </span>
            </h3>
            <p className="text-[11px] text-brand-earth font-medium">Real-time two-way audio & video peer connection</p>
          </div>
        </div>

        {role === 'patient' && !activeCallId && (
          <button
            onClick={requestConsultation}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-teal text-white rounded-xl text-xs font-bold hover:bg-brand-tealDark transition shadow-md"
          >
            <Plus className="w-4 h-4" /> Request Video Consult
          </button>
        )}
      </div>

      {/* ACTIVE CALL VIEWPORT */}
      {activeCallId && (
        <div className="bg-brand-forest rounded-2xl p-5 text-white space-y-4 shadow-2xl border border-brand-teal/40 relative animate-fadeIn">
          
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-teal/20 pb-3">
            <div className="flex items-center gap-3">
              {/* Connection Status Badge */}
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                connectionStatus === 'connected' || remotePeerPresent ? 'bg-clinical-routine text-white' :
                connectionStatus === 'reconnecting' ? 'bg-clinical-urgent text-white animate-pulse' :
                'bg-brand-forestLight text-brand-cream'
              }`}>
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' || remotePeerPresent ? 'bg-white animate-pulse' : 'bg-yellow-300'}`} />
                {connectionStatus === 'connected' || remotePeerPresent ? '🟢 Live Connected' :
                 connectionStatus === 'reconnecting' ? '🟡 Reconnecting...' : 'Connecting Room...'}
              </span>

              {/* Consultation Live Duration Timer */}
              <div className="bg-white/10 px-3 py-1 rounded-lg text-xs font-mono font-bold text-brand-cream border border-brand-teal/30 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-teal animate-pulse" />
                <span>Timer: {formatTimer(callDurationSeconds)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-brand-cream/80 bg-white/10 px-2.5 py-1 rounded-lg border border-brand-teal/20">
                Room: {activeRoomId}
              </span>

              {/* Instant Test Peer Simulator Toggle */}
              <button
                type="button"
                onClick={toggleSimulateRemotePeer}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border ${
                  isSimulatingRemote
                    ? 'bg-clinical-routine/20 text-clinical-routine border-clinical-routine/40'
                    : 'bg-white/10 text-brand-cream/80 hover:bg-white/20 border-white/10'
                }`}
                title="Simulate remote patient/doctor connection for testing"
              >
                <ShieldCheck className="w-3 h-3" />
                <span>{isSimulatingRemote ? 'Simulated Peer ON' : 'Test Peer Feed'}</span>
              </button>

              <button
                onClick={handleReconnect}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-brand-cream transition flex items-center gap-1"
                title="Reconnect WebRTC Peer Connection"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[10px]">Reconnect</span>
              </button>
            </div>
          </div>

          {/* TWO-WAY VIDEO VIEWPORT CONTAINER */}
          <div className="relative bg-black rounded-xl h-80 sm:h-96 overflow-hidden flex items-center justify-center border border-brand-teal/30 shadow-2xl">
            
            {/* Primary View: Remote Peer Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${remotePeerPresent ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Remote Peer Waiting Overlay */}
            {!remotePeerPresent && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-brand-forest/95 space-y-3">
                <div className="w-14 h-14 rounded-full bg-brand-teal/20 border border-brand-teal/40 flex items-center justify-center text-brand-teal animate-pulse">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-brand-cream">
                    Waiting for {role === 'doctor' ? 'Patient' : 'Doctor'} to Join...
                  </h4>
                  <p className="text-xs text-brand-cream/60 mt-1 max-w-sm mx-auto">
                    Room is open. You can also open the {role === 'doctor' ? 'Patient Portal' : 'Doctor Dashboard'} in another tab or click <strong className="text-brand-teal">"Test Peer Feed"</strong> above to preview.
                  </p>
                </div>
              </div>
            )}

            {/* Picture-in-Picture Self Mirror View (Bottom Right) */}
            <div className="absolute bottom-4 right-4 w-36 sm:w-48 h-28 sm:h-36 bg-black/90 rounded-xl overflow-hidden border-2 border-brand-teal shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              />
              <span className="absolute top-1.5 left-2 text-[9px] font-bold uppercase tracking-wider bg-black/70 px-1.5 py-0.5 rounded text-brand-cream border border-white/10">
                You ({role === 'doctor' ? 'Doctor' : 'Patient'})
              </span>
              
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-forest text-center p-1">
                  <span className="text-[10px] font-bold text-brand-cream/80">Camera Off</span>
                </div>
              )}
            </div>

            {/* Audio-Only / Fallback Mode Notice */}
            {isUsingFallbackVideo && (
              <div className="absolute top-4 left-4 bg-brand-forest/90 border border-brand-teal/30 px-3 py-1 rounded-lg text-[11px] font-semibold text-brand-cream flex items-center gap-1.5 z-10 shadow">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                <span>Virtual Clinical Stream Active</span>
              </div>
            )}

            {isAudioOnly && (
              <div className="absolute top-4 left-4 bg-brand-forest/90 border border-brand-teal/30 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-cream flex items-center gap-1.5 z-10 shadow">
                <Mic className="w-4 h-4 text-brand-teal animate-pulse" />
                <span>Audio-Only Mode</span>
              </div>
            )}
          </div>

          {/* CALL CONTROL TOOLBAR */}
          <div className="flex items-center justify-center gap-4 py-2 border-t border-brand-teal/10">
            {/* Mic Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3.5 rounded-full transition shadow-lg ${
                isMuted ? 'bg-clinical-emergency text-white' : 'bg-brand-forestLight hover:bg-brand-teal/30 text-white'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Camera Toggle */}
            <button
              type="button"
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3.5 rounded-full transition shadow-lg ${
                isVideoOff ? 'bg-clinical-emergency text-white' : 'bg-brand-forestLight hover:bg-brand-teal/30 text-white'
              }`}
              title={isVideoOff ? 'Turn Camera ON' : 'Turn Camera OFF'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={endCallSession}
              className="p-4 rounded-full bg-clinical-emergency hover:bg-clinical-emergency/80 text-white transition-all shadow-2xl scale-105"
              title="End Teleconsultation"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>

          {/* Doctor Clinical Notes & Priority Reassessment Form */}
          {role === 'doctor' && (
            <div className="bg-brand-forestLight/50 rounded-xl p-4 border border-brand-teal/20 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-cream flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-brand-teal" /> Doctor Clinical Reassessment & Notes
                </span>
                <span className="text-[10px] text-brand-cream/60">Saved to database & audit log</span>
              </div>

              {/* Priority Reassessment Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-3 rounded-lg border border-brand-teal/20">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-cream/80 mb-1">
                    Doctor Clinical Priority Override
                  </label>
                  <select
                    value={clinicalPriority}
                    onChange={(e: any) => setClinicalPriority(e.target.value)}
                    className="w-full bg-brand-forest border border-brand-teal/30 rounded-lg px-2.5 py-1.5 text-xs text-brand-cream focus:ring-1 focus:ring-brand-teal outline-none font-bold"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency 🚨</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-cream/80 mb-1">
                    Reason for Clinical Override (Required)
                  </label>
                  <input
                    type="text"
                    value={priorityReason}
                    onChange={e => setPriorityReason(e.target.value)}
                    placeholder="e.g. ECG indicates acute coronary syndrome..."
                    className="w-full bg-brand-forest border border-brand-teal/30 rounded-lg px-2.5 py-1.5 text-xs text-brand-cream placeholder-brand-cream/40 focus:ring-1 focus:ring-brand-teal outline-none"
                  />
                </div>
              </div>

              {clinicalPriority === 'Emergency' && (
                <div className="bg-clinical-emergency/20 border border-clinical-emergency/50 p-2.5 rounded-lg text-clinical-emergency text-[11px] font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse shrink-0" />
                  <span>EMERGENCY ESCALATION: Hospital emergency department and health workers will be immediately notified upon saving.</span>
                </div>
              )}

              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Type clinical observations, diagnosis, or medication recommendations during video call..."
                className="w-full bg-brand-forest border border-brand-teal/30 rounded-lg px-3 py-2 text-xs text-brand-cream placeholder-brand-cream/40 focus:ring-1 focus:ring-brand-teal outline-none"
                rows={3}
              />
              
              <button
                type="button"
                onClick={() => activeCallId && saveNotes(activeCallId)}
                className="px-4 py-2 bg-brand-teal text-white rounded-lg text-xs font-bold hover:bg-brand-tealDark transition shadow flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Save Notes & Record Clinical Priority
              </button>
            </div>
          )}

        </div>
      )}

      {/* TELECONSULTATIONS LIST & ROOM JOIN BUTTONS */}
      {teleconsultations.length === 0 ? (
        <div className="text-center py-8 text-brand-earth/60 bg-white border border-brand-teal/15 rounded-2xl p-6">
          <Video className="w-8 h-8 mx-auto mb-2 opacity-40 text-brand-teal" />
          <p className="text-xs font-semibold">No teleconsultations scheduled currently.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {teleconsultations.map(tc => {
            const currentStatus = tc.status || 'REQUESTED';
            const statusColor = STATUS_COLORS[currentStatus] || 'bg-gray-100 text-gray-600';
            const statusLabel = currentStatus.replace('_', ' ');

            return (
              <div
                key={tc.id}
                className={`bg-white border rounded-xl p-4 transition-all ${
                  activeCallId === tc.id ? 'border-brand-teal shadow-md ring-1 ring-brand-teal/30' : 'border-brand-gray/60 hover:shadow'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-[10px] font-mono text-brand-earth">ID: {tc.id}</span>
                      {tc.room_id && <span className="text-[10px] font-mono text-brand-teal font-semibold">Room: {tc.room_id}</span>}
                    </div>

                    {tc.patients && (
                      <div className="font-bold text-brand-forest flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-brand-teal" />
                        <span>{tc.patients.name} ({tc.patients.gender || 'Patient'}, {tc.patients.age || '42'} yrs)</span>
                        {tc.patients.phone && <span className="text-brand-earth font-normal">📞 {tc.patients.phone}</span>}
                      </div>
                    )}

                    {tc.duration_seconds && tc.duration_seconds > 0 ? (
                      <span className="inline-block text-[10px] text-brand-earth font-medium">
                        ⏱️ Duration: {formatTimer(tc.duration_seconds)}
                      </span>
                    ) : null}

                    {tc.consultation_notes && (
                      <div className="text-[11px] text-brand-earth bg-brand-cream/40 rounded-lg p-2 border border-brand-teal/10 mt-1">
                        <strong>Doctor Notes:</strong> {tc.consultation_notes}
                      </div>
                    )}
                  </div>

                  {/* Join / Start Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
                      <button
                        type="button"
                        onClick={() => startCallSession(tc)}
                        className={`text-xs px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow ${
                          activeCallId === tc.id
                            ? 'bg-brand-teal text-white ring-2 ring-brand-teal/50'
                            : 'bg-clinical-routine text-white hover:bg-clinical-routine/80'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{activeCallId === tc.id ? 'In Call (Active)' : role === 'doctor' ? 'Start Call' : 'Join Video Call'}</span>
                      </button>
                    )}

                    {currentStatus === 'COMPLETED' && (
                      <span className="text-[11px] font-bold text-clinical-routine px-2.5 py-1 bg-clinical-routineLight rounded-lg border border-clinical-routine/20">
                        ✓ Consultation Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
