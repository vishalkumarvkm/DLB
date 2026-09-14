import React, { useState } from "react";
import { Play, ArrowLeft, ExternalLink } from "lucide-react";
import DJBVoicePanel from "./components/DJBVoicePanel";

export default function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col justify-end md:justify-center items-center overflow-hidden relative select-none p-0 md:p-4 font-sans">
      {/* Landing Page Content */}
      <div className="absolute inset-0 z-0 flex flex-col bg-white overflow-y-auto">
        {/* Header */}
        <header className="w-full flex items-center justify-between px-3 sm:px-6 md:px-8 py-2.5 sm:py-3.5 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all shrink-0 cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
              <img
                src="/djb-logo.png"
                alt="Delhi Jal Board Logo"
                className="h-7 xs:h-8 sm:h-10 md:h-11 w-auto max-w-[160px] xs:max-w-[210px] sm:max-w-none object-contain shrink-1"
              />
            </div>
          </div>
          <a
            href="https://djb.gov.in/DJBRMSPortal/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-[#0288D1] hover:text-[#0277BD] bg-[#0288D1]/5 hover:bg-[#0288D1]/10 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-[#0288D1]/20 transition-all shrink-0 whitespace-nowrap"
          >
            <span>DJB RMS Portal</span>
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </a>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 text-center max-w-2xl mx-auto w-full">
          <div className="h-16 xs:h-20 sm:h-24 px-4 sm:px-6 py-2 sm:py-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center mb-4 sm:mb-6 max-w-[220px] xs:max-w-[260px] sm:max-w-xs w-full">
            <img
              src="/djb-logo.png"
              alt="Delhi Jal Board Official Logo"
              className="h-full w-auto object-contain"
            />
          </div>

          <span className="text-[10px] sm:text-[11px] font-extrabold tracking-[0.15em] sm:tracking-[0.2em] text-[#0288D1] uppercase mb-2.5 sm:mb-3 px-2.5 py-1 bg-[#0288D1]/10 rounded-full">
            GOVT SERVICE AI ASSISTANT
          </span>

          <h1 className="text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-black text-[#202124] tracking-tight mb-3 sm:mb-4">
            Talk to Neha Sharma
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#5F6368] mb-6 sm:mb-8 font-medium leading-relaxed max-w-lg px-2">
            Delhi Jal Board's official Citizen Assistance Officer AI. Ask about your water bill, KNO lookup, new connections, pipeline leakage, sewer blockage, or water tanker delivery in Hindi or English.
          </p>

          <button
            onClick={async () => {
              try {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioCtxClass({ latencyHint: 'playback' });
                await ctx.resume();
                (window as any).__primedAudioContext = ctx;
              } catch (e) {}
              setIsOpen(true);
            }}
            className="w-auto inline-flex items-center justify-center gap-2.5 bg-[#0288D1] hover:bg-[#0277BD] text-white font-semibold px-6 sm:px-7 py-3.5 text-xs sm:text-sm rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation mb-8 sm:mb-12 mx-auto whitespace-nowrap"
          >
            <Play size={14} fill="currentColor" className="text-white shrink-0" />
            <span className="whitespace-nowrap">Start Voice Call with Neha Sharma</span>
          </button>
        </main>
      </div>

      {/* Voice Assistant Modal */}
      <DJBVoicePanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
