import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Clock, MapPin, Phone, User, FileText, Hash } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface GrievanceTicket {
  ticketId: string;
  name: string;
  phone: string;
  category: string;
  kno?: string;
  address: string;
  details?: string;
  status: 'REGISTERED' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

interface GrievanceCardProps {
  ticket: GrievanceTicket;
}

export const GrievanceCard: React.FC<GrievanceCardProps> = ({ ticket }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket.ticketId);
    setCopied(true);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-5 shadow-2xl text-slate-100 relative overflow-hidden transition-all duration-300 hover:border-cyan-400/60">
      {/* Background Accent Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
      
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
            Grievance Registered
          </span>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          {ticket.createdAt}
        </span>
      </div>

      {/* Ticket ID Box */}
      <div className="bg-slate-950/80 rounded-xl p-3.5 mb-4 border border-cyan-500/20 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono font-medium">Reference Complaint No.</p>
          <p className="text-lg sm:text-xl font-bold font-mono text-cyan-300 tracking-wide">{ticket.ticketId}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-lg border border-cyan-500/30 text-xs font-medium transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
        <div className="flex items-start space-x-2 text-slate-300">
          <User className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-500 block text-[11px]">Complainant</span>
            <span className="font-semibold text-slate-200">{ticket.name}</span>
          </div>
        </div>

        <div className="flex items-start space-x-2 text-slate-300">
          <Phone className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-500 block text-[11px]">Mobile Number</span>
            <span className="font-semibold text-slate-200">{ticket.phone}</span>
          </div>
        </div>

        {ticket.kno && (
          <div className="flex items-start space-x-2 text-slate-300">
            <Hash className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[11px]">KNO / Consumer ID</span>
              <span className="font-mono font-semibold text-cyan-200">{ticket.kno}</span>
            </div>
          </div>
        )}

        <div className="flex items-start space-x-2 text-slate-300">
          <FileText className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-500 block text-[11px]">Category</span>
            <span className="font-semibold text-slate-200">{ticket.category}</span>
          </div>
        </div>

        <div className="sm:col-span-2 flex items-start space-x-2 text-slate-300 pt-1">
          <MapPin className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-slate-500 block text-[11px]">Address / Locality</span>
            <span className="text-slate-300">{ticket.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
