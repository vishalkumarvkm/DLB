"use client";

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  state: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
  audioVolume: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ state, audioVolume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      step += 0.05;

      // Base line styling
      ctx.lineWidth = 3;
      
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      if (state === 'speaking') {
        gradient.addColorStop(0, '#00a8e8');
        gradient.addColorStop(0.5, '#00c49f');
        gradient.addColorStop(1, '#005691');
      } else if (state === 'listening') {
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(0.5, '#818cf8');
        gradient.addColorStop(1, '#0284c7');
      } else if (state === 'connecting') {
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#d97706');
      } else if (state === 'error') {
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(1, '#991b1b');
      } else {
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 168, 232, 0.3)');
      }

      ctx.strokeStyle = gradient;
      ctx.shadowColor = state === 'speaking' ? '#00c49f' : '#00a8e8';
      ctx.shadowBlur = state === 'idle' ? 4 : 15;

      ctx.beginPath();
      const amplitude = state === 'speaking' || state === 'listening'
        ? Math.max(10, audioVolume * 65)
        : state === 'connecting' ? 12 : 4;

      for (let x = 0; x < width; x += 2) {
        const normalizedX = x / width;
        const windowFactor = Math.sin(normalizedX * Math.PI); // tapering at edges
        const wave1 = Math.sin(x * 0.04 + step * 2) * amplitude * windowFactor;
        const wave2 = Math.cos(x * 0.02 - step * 1.5) * (amplitude * 0.5) * windowFactor;
        const y = centerY + wave1 + wave2;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      animIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, [state, audioVolume]);

  return (
    <div className="w-full h-24 flex items-center justify-center my-2 relative">
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full h-full max-w-md object-contain"
      />
    </div>
  );
};
