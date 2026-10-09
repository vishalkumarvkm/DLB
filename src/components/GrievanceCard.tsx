"use client";

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
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
    <div className="w-full bg-slate-50 border border-[#DADCE0] rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] sm:text-xs text-gray-500 font-medium tracking-wide uppercase">Reference Number</p>
        <p className="text-sm sm:text-base font-bold text-[#0288D1]">{ticket.ticketId}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#DADCE0] hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-green-600">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
};
