'use client';

import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Eye,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/ui';

interface ImageViewerProps {
  src: string;
  alt: string;
  title?: string;
  documentType?: string;
  hash?: string;
  watermarkText?: string;
  className?: string;
}

export function EvidenceImageViewer({
  src,
  alt,
  title = 'Evidence Document Preview',
  documentType = 'EVIDENCE',
  hash,
  watermarkText = 'OFFICIAL EVIDENCE — SOLVEXA CASE MANAGEMENT',
  className,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [inverted, setInverted] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setInverted(false);
    setHighContrast(false);
  };

  const triggerOcrScanEffect = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 4000);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl transition-all duration-300',
        fullscreen ? 'fixed inset-4 z-50 rounded-2xl border-2 border-sky-500' : 'w-full',
        className
      )}
    >
      {/* Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 text-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950">
            <Shield className="h-4 w-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold text-white uppercase tracking-wider">{title}</h4>
            {hash && (
              <p className="truncate text-[10px] font-mono text-slate-400">
                SHA-256: {hash.slice(0, 16)}...
              </p>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={handleZoomIn}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            title="Zoom In (+25%)"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            title="Zoom Out (-25%)"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            title="Rotate Clockwise (90°)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={() => setInverted((v) => !v)}
            className={cn(
              'rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition',
              inverted && 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
            )}
            title="Invert Colors (OCR Inspection)"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setHighContrast((v) => !v)}
            className={cn(
              'rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition',
              highContrast && 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
            )}
            title="High Contrast Enhancement"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5" />
          <button
            type="button"
            onClick={triggerOcrScanEffect}
            disabled={isScanning}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
              isScanning
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isScanning ? 'Scanning...' : 'OCR Scan'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Viewer'}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Display Canvas Area */}
      <div className="relative flex-1 min-h-[360px] max-h-[600px] overflow-auto bg-slate-950 flex items-center justify-center p-6 select-none">
        {/* Scanning Light Beam Effect */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_rgba(56,189,248,0.9)] animate-scanline z-20" />
        )}

        {/* Watermark Overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10 opacity-15 rotate-[-25deg]">
          <span className="text-2xl sm:text-4xl font-extrabold uppercase tracking-widest text-slate-400 border-4 border-slate-400 px-6 py-2 rounded-xl">
            {watermarkText}
          </span>
        </div>

        {/* Scaled & Filtered Image */}
        <div
          className="transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            filter: `${inverted ? 'invert(1)' : ''} ${highContrast ? 'contrast(1.6) brightness(1.1)' : ''}`,
          }}
        >
          {/* eslint-disable-next-html-element-suppression */}
          <img
            src={src}
            alt={alt}
            className="max-h-[500px] w-auto object-contain rounded-lg border border-slate-800 shadow-2xl"
          />
        </div>
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/60 px-4 py-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>Type: <strong className="text-slate-200">{documentType}</strong></span>
          <span>Zoom: <strong className="text-slate-200">{Math.round(zoom * 100)}%</strong></span>
          <span>Rotation: <strong className="text-slate-200">{rotation}°</strong></span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-slate-400 hover:text-white transition underline"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
