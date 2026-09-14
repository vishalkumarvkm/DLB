import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Modality, Type as SchemaType } from "@google/genai";
import { djbAgent } from '../lib/djbAgent';
import { resampleAudio, resampleInt16, parseSpokenPhoneNumber } from '../lib/audioUtils';
import { GrievanceCard, type GrievanceTicket } from './GrievanceCard';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

interface DJBVoicePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;

export default function DJBVoicePanel({ isOpen, onClose }: DJBVoicePanelProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<GrievanceTicket[]>([]);

  const wakeLockRef = useRef<any>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const scheduledEndRef = useRef(0);
  const activeConnectionIdRef = useRef(0);
  const connectingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const processedToolCallsRef = useRef<Set<string>>(new Set());
  const actualMicRateRef = useRef<number>(INPUT_SAMPLE_RATE);
  const [audioVolume, setAudioVolume] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  const videoWakeLockRef = useRef<HTMLVideoElement | null>(null);

  // Screen WakeLock + Mobile Video Keep-Alive
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        if (!wakeLockRef.current || wakeLockRef.current.released) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[DJBVoicePanel] Screen WakeLock active');
          
          wakeLockRef.current.addEventListener('release', () => {
            if (isOpen) {
              setTimeout(() => { requestWakeLock(); }, 1000);
            }
          });
        }
      }
    } catch (e) {
      console.warn('[DJBVoicePanel] WakeLock failed, using video keep-alive:', e);
    }

    try {
      if (!videoWakeLockRef.current && typeof document !== 'undefined') {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.muted = true;
        video.loop = true;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAptZGF0AAAAAA==';
        document.body.appendChild(video);
        videoWakeLockRef.current = video;
      }
      if (videoWakeLockRef.current) {
        videoWakeLockRef.current.play().catch(() => {});
      }
    } catch (_) {}
  }, [isOpen]);

  const releaseWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    } catch {}
    try {
      if (videoWakeLockRef.current) {
        videoWakeLockRef.current.pause();
        if (videoWakeLockRef.current.parentNode) {
          videoWakeLockRef.current.parentNode.removeChild(videoWakeLockRef.current);
        }
        videoWakeLockRef.current = null;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [isOpen, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isOpen) {
        if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
          try { await playbackCtxRef.current.resume(); } catch {}
        }
        if (micCtxRef.current && micCtxRef.current.state === 'suspended') {
          try { await micCtxRef.current.resume(); } catch {}
        }
        await requestWakeLock();
      }
    };
    const handleFocus = async () => {
      if (isOpen) {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isOpen, requestWakeLock]);

  // Audio Playback Helper
  const ensurePlaybackCtx = async (): Promise<AudioContext> => {
    const primed = (window as any).__primedAudioContext;
    const isPrimedValid = primed && primed.state !== 'closed';

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      playbackCtxRef.current = isPrimedValid ? primed : new AudioCtx({ latencyHint: 'playback' });
    }
    if (playbackCtxRef.current!.state === 'suspended') {
      await playbackCtxRef.current!.resume();
    }
    return playbackCtxRef.current!;
  };

  const scheduleAudioChunk = useCallback(async (base64Data: string) => {
    if (isMuted) return;
    try {
      const ctx = await ensurePlaybackCtx();
      const binary = atob(base64Data);
      const bytes = Uint8Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i));
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = Float32Array.from(pcm16, s => s / 32768.0);

      let sum = 0;
      for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
      const rms = Math.sqrt(sum / float32.length);
      setAudioVolume(Math.min(1.0, rms * 5.0));

      const actualRate = ctx.sampleRate;
      let audioData: Float32Array = new Float32Array(float32);
      let bufferRate = OUTPUT_SAMPLE_RATE;
      if (actualRate !== OUTPUT_SAMPLE_RATE) {
        audioData = resampleAudio(float32, OUTPUT_SAMPLE_RATE, actualRate);
        bufferRate = actualRate;
      }

      const buffer = ctx.createBuffer(1, audioData.length, bufferRate);
      buffer.getChannelData(0).set(audioData);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.5;
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;
      const startTime = Math.max(now, scheduledEndRef.current);
      source.start(startTime);
      scheduledEndRef.current = startTime + buffer.duration;
      setTimeout(() => setAudioVolume(0), (audioData.length / bufferRate) * 1000);
    } catch (e) {
      console.error("Error scheduling audio chunk:", e);
    }
  }, [isMuted]);

  const teardown = useCallback(() => {
    activeConnectionIdRef.current++;
    processedToolCallsRef.current.clear();
    scheduledEndRef.current = 0;

    if (playbackCtxRef.current) {
      try { playbackCtxRef.current.close().catch(() => {}); } catch (_) {}
      playbackCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (micProcessorRef.current) {
      try { micProcessorRef.current.disconnect(); } catch (_) {}
      micProcessorRef.current = null;
    }
    if (micCtxRef.current) {
      try { micCtxRef.current.close(); } catch (_) {}
      micCtxRef.current = null;
    }
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (_) {}
      sessionRef.current = null;
    }

    connectingRef.current = false;
    setState('idle');
    setAudioVolume(0);
    releaseWakeLock();
  }, [releaseWakeLock]);

  const startMic = async () => {
    try {
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
          video: false
        });
        micStreamRef.current = stream;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const micCtx = new AudioCtx({ sampleRate: INPUT_SAMPLE_RATE });
      micCtxRef.current = micCtx;
      actualMicRateRef.current = micCtx.sampleRate;
      if (micCtx.state === 'suspended') await micCtx.resume();

      const source = micCtx.createMediaStreamSource(stream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(micCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || state === 'connecting' || isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        let pcm16: Int16Array;
        let sum = 0;

        if (actualMicRateRef.current !== INPUT_SAMPLE_RATE) {
          pcm16 = resampleInt16(inputData, actualMicRateRef.current, INPUT_SAMPLE_RATE);
          for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        } else {
          pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
            sum += inputData[i] * inputData[i];
          }
        }

        const rms = Math.sqrt(sum / inputData.length);
        if (state === 'listening') setAudioVolume(Math.min(1.0, rms * 5.0));

        const u8 = new Uint8Array(pcm16.buffer);
        const CHUNK_SIZE = 8192;
        let binary = '';
        for (let i = 0; i < u8.length; i += CHUNK_SIZE) {
          const slice = u8.subarray(i, Math.min(i + CHUNK_SIZE, u8.length));
          binary += String.fromCharCode.apply(null, Array.from(slice));
        }
        const base64 = btoa(binary);

        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          });
        } catch (err) {}
      };
    } catch (err: any) {
      console.error('Mic access denied:', err);
      setState('error');
      setConnectionError('Microphone access denied. Please allow microphone permissions.');
      teardown();
    }
  };

  const startConnection = useCallback(async () => {
    const connectionId = ++activeConnectionIdRef.current;
    if (connectingRef.current) return;
    connectingRef.current = true;

    setState('connecting');
    setConnectionError(null);

    try {
      await ensurePlaybackCtx();
    } catch (e) {}

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
        video: false
      });
      micStreamRef.current = stream;
    } catch (err: any) {
      console.error('Microphone permission denied:', err);
      setState('error');
      setConnectionError('Microphone access denied. Please allow microphone permissions.');
      connectingRef.current = false;
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setConnectionError('VITE_GEMINI_API_KEY is not configured in .env.local');
      setState('error');
      connectingRef.current = false;
      return;
    }

    try {
      await ensurePlaybackCtx();
      if (connectionId !== activeConnectionIdRef.current) return;

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { apiVersion: 'v1alpha' } as any
      });

      const sessionPromise = (ai as any).live.connect({
        model: GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: {
            parts: [{ text: djbAgent.systemInstruction }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "capture_djb_grievance_or_request",
                description: "Registers a Delhi Jal Board citizen grievance or service request.",
                parameters: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING, description: "Full Name of the citizen." },
                    phone: { type: SchemaType.STRING, description: "10-digit Mobile Number of the citizen." },
                    category: { type: SchemaType.STRING, description: "Service Category: Water Supply, Sewerage, Billing, Meter, Tanker Request, Water Quality, New Connection, Mutation, or Other." },
                    address: { type: SchemaType.STRING, description: "Complete address and landmark in Delhi." },
                    kno: { type: SchemaType.STRING, description: "KNO (Consumer ID) or ARN if provided." },
                    details: { type: SchemaType.STRING, description: "Detailed description of the citizen's complaint or request." }
                  },
                  required: ["name", "phone", "category", "address"]
                }
              }
            ]
          }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            if (connectionId !== activeConnectionIdRef.current) {
              teardown();
              return;
            }
            setState('listening');
            connectingRef.current = false;

            const sessionId = `djb-${Date.now()}`;
            sessionIdRef.current = sessionId;

            sessionPromise.then((session: any) => {
              if (connectionId !== activeConnectionIdRef.current) return;
              sessionRef.current = session;

              const greetingText = `User joined. Introduce yourself as Neha Sharma, Citizen Assistance Officer for Delhi Jal Board (DJB). Opening greeting: "${djbAgent.greeting}". Keep it warm, polite, and attentive in Hindi/Hinglish strictly using female verb endings (bol rahi hoon, kar sakti hoon, samajh sakti hoon).`;
              try {
                session.sendRealtimeInput({ text: greetingText });
              } catch(e) {}
              startMic();
            });
          },

          onmessage: async (msg: any) => {
            if (connectionId !== activeConnectionIdRef.current) return;

            const functionCalls = msg.toolCall?.functionCalls || 
                                 msg.serverContent?.modelTurn?.parts?.filter((p: any) => p.functionCall).map((p: any) => p.functionCall) ||
                                 [];

            for (const call of functionCalls) {
              const callId = call.id || call.name;
              if (processedToolCallsRef.current.has(callId)) continue;

              if (call.name === "capture_djb_grievance_or_request") {
                processedToolCallsRef.current.add(callId);
                const { name, phone, category, address, kno, details } = call.args;
                
                const cleanedPhone = parseSpokenPhoneNumber(phone);
                const ticketId = `DJB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

                const newTicket: GrievanceTicket = {
                  ticketId,
                  name: name || "Citizen",
                  phone: cleanedPhone || phone || "",
                  category: category || "General Water Supply",
                  kno: kno,
                  address: address || "Delhi NCT",
                  details: details || "Registered via Voice Bot",
                  status: 'REGISTERED',
                  createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setTickets(prev => [newTicket, ...prev]);

                sessionRef.current?.sendToolResponse({
                  functionResponses: [{
                    id: call.id,
                    name: "capture_djb_grievance_or_request",
                    response: { success: true, referenceNumber: ticketId, message: "Grievance details captured successfully." }
                  }]
                });
              }
            }

            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setState('speaking');
              scheduleAudioChunk(audio);
            }
          },

          onerror: (err: any) => {
            console.error('Gemini Live Error:', err);
            setState('error');
            setConnectionError(err?.message || 'Voice session connection failed.');
            connectingRef.current = false;
          },

          onclose: () => {
            if (connectionId === activeConnectionIdRef.current && state !== 'idle') {
              setState('idle');
            }
          }
        }
      });
    } catch (err: any) {
      console.error('Live session init error:', err);
      setState('error');
      setConnectionError(err?.message || 'Failed to establish Gemini Live connection');
      connectingRef.current = false;
    }
  }, [teardown, scheduleAudioChunk, isMuted, state]);

  useEffect(() => {
    if (isOpen) {
      startConnection();
    } else {
      teardown();
    }
    return () => teardown();
  }, [isOpen]);

  // Canvas Blue Waveform Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      phase += 0.08;

      let numWaves = 3;
      let amplitude = 0;
      let frequency = 0.02;
      let speedFactor = 1;

      if (state === 'listening') {
        amplitude = 6 + audioVolume * 36;
        frequency = 0.02;
        numWaves = 4;
        speedFactor = 1.1;
      } else if (state === 'speaking') {
        amplitude = 8 + audioVolume * 45;
        frequency = 0.025;
        numWaves = 5;
        speedFactor = 1.4;
      } else if (state === 'connecting') {
        amplitude = 3;
        frequency = 0.01;
        numWaves = 2;
        speedFactor = 0.6;
      } else {
        amplitude = 0.5;
        frequency = 0.005;
        numWaves = 1;
        speedFactor = 0.15;
      }

      ctx.lineWidth = 1.25;

      for (let i = 0; i < numWaves; i++) {
        ctx.beginPath();
        const yOffset = (i - (numWaves - 1) / 2) * 1.5;
        const wavePhase = phase * speedFactor + i * (Math.PI / 8);
        const opacity = 0.8 - (i / numWaves) * 0.5;
        
        ctx.strokeStyle = `rgba(2, 136, 209, ${opacity})`;

        for (let x = 0; x < width; x++) {
          const envelope = Math.sin((x / width) * Math.PI);
          const y = height / 2 + yOffset + Math.sin(x * frequency + wavePhase) * amplitude * envelope;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [state, audioVolume]);

  const handleTryClose = () => {
    teardown();
    onClose();
  };

  const handleRetry = () => {
    teardown();
    ensurePlaybackCtx().catch(() => {});
    startConnection();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-md p-0 md:p-4 transition-all duration-300">
      <div className="absolute inset-0" onClick={handleTryClose} />

      <AnimatePresence>
        <motion.div
          initial={{ y: "100%", opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-full sm:max-w-[460px] bg-white border-t sm:border border-[#DADCE0]/80 rounded-t-[28px] sm:rounded-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col z-10 p-5 sm:p-6 pb-6 select-none"
        >
          {/* Mobile Bottom Sheet Handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden block" />

          {/* Top Status & Close Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                state === 'listening' ? 'bg-[#0288D1]' :
                state === 'speaking' ? 'bg-[#0288D1]' :
                state === 'connecting' ? 'bg-amber-400 animate-pulse' :
                state === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest text-[#0288D1]">
                {state === 'connecting' ? 'CONNECTING...' :
                 state === 'listening' ? 'LISTENING...' :
                 state === 'speaking' ? 'NEHA SHARMA SPEAKING...' :
                 state === 'error' ? 'ERROR' : 'READY'}
              </span>
            </div>

            <button
              onClick={handleTryClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#F1F3F4] text-gray-600 hover:bg-gray-200 transition-all cursor-pointer border border-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Agent Info Banner */}
          <div className="flex items-center gap-3 mb-4 bg-slate-50 p-2.5 sm:p-3 rounded-2xl border border-slate-100">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-[#DADCE0] p-1 flex items-center justify-center overflow-hidden shrink-0">
              <img src="/djb-logo.png" alt="Delhi Jal Board Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">Neha Sharma</h3>
              <p className="text-[11px] sm:text-xs text-gray-500 font-medium truncate">DJB Citizen Assistance Officer</p>
            </div>
          </div>

          {/* Wave Visualizer & Status Content */}
          <div className="flex-1 flex flex-col items-center justify-center my-2 sm:my-4 min-h-[140px] sm:min-h-[160px]">
            <div className="w-full h-20 sm:h-24 relative mb-3 sm:mb-4">
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>

            <div className="text-center px-3">
              {state === 'connecting' && (
                <p className="text-xs sm:text-sm font-medium text-[#0288D1] animate-pulse">Connecting to Delhi Jal Board Assistant...</p>
              )}
              {state === 'listening' && (
                <p className="text-xs sm:text-sm font-medium text-gray-600">Listening... Speak now in Hindi or English</p>
              )}
              {state === 'speaking' && (
                <p className="text-xs sm:text-sm font-medium text-[#0288D1]">Neha Sharma is speaking...</p>
              )}
              {state === 'error' && (
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-red-600 font-medium mb-3">{connectionError || 'Connection error'}</p>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-[#0288D1] text-white text-xs font-semibold rounded-full hover:bg-[#0277BD] transition-colors"
                  >
                    Retry Call
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Registered Grievances List */}
          {tickets.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto space-y-2 pr-1">
              {tickets.map(t => (
                <GrievanceCard key={t.ticketId} ticket={t} />
              ))}
            </div>
          )}

          {/* Footer Assistance Info */}
          <div className="mt-auto pt-3 sm:pt-4 border-t border-gray-100 flex items-center justify-between text-[11px] sm:text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${state === 'listening' || state === 'speaking' ? 'bg-green-500 animate-ping' : 'bg-gray-300'}`} />
              Live Assistance
            </span>
            <span className="font-medium text-gray-600">Helpline: 1916</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
