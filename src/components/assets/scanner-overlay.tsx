"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, ScanBarcode, Keyboard, Zap } from "lucide-react";

interface ScannerOverlayProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function ScannerOverlay({ open, onClose, onScan }: ScannerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startBarcodeDetection();
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
        setError("Camera not available. Use manual entry.");
        setManualMode(true);
      } else {
        setError("Could not access camera.");
        setManualMode(true);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startBarcodeDetection = useCallback(async () => {
    if (!("BarcodeDetector" in window)) {
      return;
    }

    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
      });

      const detect = async () => {
        if (!videoRef.current || !cameraActive) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              setScanning(true);
              stopCamera();
              onScan(code);
              return;
            }
          }
        } catch {
          // Detection frame error, continue scanning
        }
        if (cameraActive) {
          requestAnimationFrame(detect);
        }
      };
      requestAnimationFrame(detect);
    } catch {
      // BarcodeDetector not supported
    }
  }, [cameraActive, stopCamera, onScan]);

  useEffect(() => {
    if (open && !manualMode) {
      startCamera();
    }
    return () => stopCamera();
  }, [open, manualMode, startCamera, stopCamera]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  const handleClose = () => {
    stopCamera();
    setManualMode(false);
    setManualCode("");
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col bg-black"
        >
          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <ScanBarcode size={18} className="text-emerald-400" />
              <span className="text-[14px] font-medium text-white">Scanner</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setManualMode(!manualMode);
                  if (!manualMode) stopCamera();
                  else startCamera();
                }}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                {manualMode ? <Camera size={18} /> : <Keyboard size={18} />}
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Camera / Manual */}
          <div className="flex flex-1 items-center justify-center">
            {manualMode ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm px-6"
              >
                <div className="mb-4 text-center">
                  <Keyboard size={32} className="mx-auto mb-3 text-zinc-600" />
                  <p className="text-[14px] font-medium text-zinc-300">Manual Entry</p>
                  <p className="mt-1 text-[11px] text-zinc-600">Type the barcode or serial number</p>
                </div>
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                    placeholder="Enter code..."
                    className="h-12 w-full rounded-xl border border-emerald-500/20 bg-white/[0.03] px-4 text-center font-mono text-[16px] text-white placeholder-zinc-700 outline-none shadow-[0_0_20px_-8px_rgba(16,185,129,0.2)] focus:border-emerald-500/40"
                  />
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[13px] font-medium text-black shadow-[0_0_20px_-6px_rgba(16,185,129,0.3)] transition-all disabled:opacity-30"
                >
                  <Zap size={14} />
                  Look Up
                </button>
              </motion.div>
            ) : (
              <div className="relative h-full w-full">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />

                {/* Viewfinder overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Dark overlay with cutout */}
                  <div className="absolute inset-0 bg-black/40" />

                  {/* Viewfinder box */}
                  <div className="relative z-10 h-56 w-56 sm:h-64 sm:w-64">
                    {/* Corner brackets */}
                    <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-emerald-500" />
                    <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-emerald-500" />
                    <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-emerald-500" />
                    <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-emerald-500" />

                    {/* Scanning line */}
                    <motion.div
                      animate={{ y: [0, 200, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-60"
                    />
                  </div>
                </div>

                {/* Status text */}
                <div className="absolute bottom-8 left-0 right-0 text-center">
                  {error ? (
                    <p className="text-[12px] text-red-400">{error}</p>
                  ) : scanning ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin text-emerald-400" />
                      <p className="text-[12px] text-emerald-400">Code detected!</p>
                    </div>
                  ) : (
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-[12px] text-zinc-400"
                    >
                      Position barcode within the frame
                    </motion.p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
