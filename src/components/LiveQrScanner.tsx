import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  SwitchCamera,
  X,
  AlertTriangle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { LangCode } from "../types/guardian";

interface LiveQrScannerProps {
  lang: LangCode;
  busy: boolean;
  onDecoded: (rawPayload: string) => Promise<void> | void;
  onClose: () => void;
}

export const LiveQrScanner: React.FC<LiveQrScannerProps> = ({ lang, busy, onDecoded, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodedRef = useRef<string | null>(null);
  const scanLockedRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [decodeNote, setDecodeNote] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const sanitizeQrText = (raw: string): string => {
    // Strip non-printable control characters and clamp length safely
    return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 4096);
  };

  const scanFrameLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scanLockedRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      const targetWidth = Math.min(640, video.videoWidth);
      const scale = targetWidth / video.videoWidth;
      const targetHeight = Math.round(video.videoHeight * scale);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (code && code.data) {
          const clean = sanitizeQrText(code.data);
          if (!clean) {
            setDecodeNote(
              lang === "hi"
                ? "QR कोड पढ़ा नहीं जा सका। कृपया कोड को बॉक्स के अंदर स्थिर रखें।"
                : "QR code could not be decoded cleanly. Hold steady inside the frame."
            );
          } else if (clean !== lastDecodedRef.current) {
            lastDecodedRef.current = clean;
            scanLockedRef.current = true;
            setScannedPayload(clean);
            setDecodeNote(null);
            Promise.resolve(onDecoded(clean)).catch(() => {
              setDecodeNote(
                lang === "hi"
                  ? "QR विश्लेषण पूरा नहीं हो सका। कृपया पुनः स्कैन करें।"
                  : "Could not verify QR payload. Tap Rescan to try again."
              );
            });
            return;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrameLoop);
  }, [lang, onDecoded]);

  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);
    setDecodeNote(null);
    setStarting(true);
    scanLockedRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStarting(false);
      setCameraError(
        lang === "hi"
          ? "इस डिवाइस या ब्राउज़र में लाइव कैमरा समर्थित नहीं है। आप 'QR छवि अपलोड करें' का उपयोग कर सकते हैं।"
          : "Live camera access is unavailable in this browser. Please use Upload QR Image below."
      );
      return;
    }

    try {
      const videoConstraints: MediaTrackConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === "function") {
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps.torch));
      }

      if (navigator.mediaDevices.enumerateDevices) {
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "videoinput"));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStarting(false);
      if (!scanLockedRef.current) {
        rafRef.current = requestAnimationFrame(scanFrameLoop);
      }
    } catch {
      stopStream();
      setStarting(false);
      setCameraError(
        lang === "hi"
          ? "कैमरा अनुमति अस्वीकार की गई या कैमरा उपलब्ध नहीं है। आप नीचे 'QR छवि अपलोड करें' का उपयोग जारी रख सकते हैं।"
          : "Camera permission was denied or no camera was detected. The Upload QR Image inspector remains available below."
      );
    }
  }, [facingMode, lang, scanFrameLoop, selectedDeviceId, stopStream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  function handleRescan() {
    lastDecodedRef.current = null;
    scanLockedRef.current = false;
    setScannedPayload(null);
    setDecodeNote(null);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(scanFrameLoop);
  }

  function switchCameraFacing() {
    setSelectedDeviceId("");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  return (
    <div className="gm-glass-card rounded-2xl border border-[#C6A15B]/55 text-[#F4F0E6] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0D2A33] border border-[#6CC4E8]/45 flex items-center justify-center shrink-0">
            <QrCode className="w-4 h-4 text-[#E6C98A]" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-[#F4F0E6]">
              {lang === "hi" ? "लाइव QR स्कैनर (सुरक्षित पूर्वावलोकन)" : "Live QR Scanner (Safe Inspection)"}
            </h3>
            <p className="text-[11px] text-[#AEBBC9]">
              {lang === "hi"
                ? "लिंक खोले बिना या भुगतान शुरू किए बिना QR कोड को रीयल-टाइम जांचता है।"
                : "Inspects QR codes in real time without ever opening links or starting payments."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C6A15B]/35 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
        >
          <X className="w-4 h-4" />
          <span>{lang === "hi" ? "कैमरा बंद करें" : "Exit Scanner"}</span>
        </button>
      </div>

      {/* Camera Frame */}
      {cameraError ? (
        <div className="rounded-xl border border-[#E6C98A]/45 bg-[#2B2112]/90 p-4 space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5 text-[#E6C98A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold">{cameraError}</p>
          </div>
          <button
            type="button"
            onClick={startCamera}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl gm-gold-btn text-xs font-bold cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {lang === "hi" ? "कैमरा पुनः आज़माएं" : "Retry Camera"}
          </button>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-[#071525] border border-[#C6A15B]/35 aspect-[4/3] max-h-[320px] w-full flex items-center justify-center">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Golden Matte Viewfinder Reticle */}
          {!scannedPayload && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl border-2 border-[#E6C98A] shadow-[0_0_0_9999px_rgba(7,21,37,0.62),0_0_24px_rgba(198,161,91,0.42)] flex items-end justify-center pb-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#071525]/90 border border-[#C6A15B]/45 text-[11px] font-semibold text-[#E6C98A]">
                  {starting
                    ? lang === "hi"
                      ? "कैमरा शुरू हो रहा है..."
                      : "Starting camera..."
                    : lang === "hi"
                      ? "QR कोड बॉक्स में रखें"
                      : "Align QR inside frame"}
                </span>
              </div>
            </div>
          )}

          {/* Scanned Overlay Confirmation */}
          {scannedPayload && (
            <div className="absolute inset-0 bg-[#071525]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-[#E6C98A]" />
              <p className="text-sm font-bold text-[#F4F0E6]">
                {busy
                  ? lang === "hi"
                    ? "QR सुरक्षा जांच जारी है..."
                    : "Inspecting QR payload..."
                  : lang === "hi"
                    ? "QR डिकोड हुआ — नीचे परिणाम देखें"
                    : "QR Decoded — View Result Below"}
              </p>
              <p className="text-[11px] font-mono text-[#AEBBC9] break-all line-clamp-2 max-w-md">
                {scannedPayload}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleRescan}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                {lang === "hi" ? "नया QR स्कैन करें" : "Scan Another QR"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Camera Hardware Controls */}
      {!cameraError && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={switchCameraFacing}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C6A15B]/30 bg-[#10243A] hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
            >
              <SwitchCamera className="w-4 h-4 text-[#E6C98A]" />
              <span>
                {facingMode === "environment"
                  ? lang === "hi"
                    ? "फ्रंट कैमरा"
                    : "Switch Camera"
                  : lang === "hi"
                    ? "रियर कैमरा"
                    : "Rear Camera"}
              </span>
            </button>

            {devices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                aria-label={lang === "hi" ? "कैमरा चुनें" : "Select camera"}
                className="min-h-[40px] rounded-xl border border-[#C6A15B]/30 bg-[#10243A] px-2.5 py-1.5 text-xs text-[#F4F0E6] max-w-[180px]"
              >
                <option value="">{lang === "hi" ? "स्वतः कैमरा" : "Auto Camera"}</option>
                {devices.map((d, idx) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98] ${
                  torchOn ? "gm-gold-btn border-transparent" : "border-[#C6A15B]/30 bg-[#10243A] text-[#F4F0E6]"
                }`}
              >
                {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                <span>{lang === "hi" ? (torchOn ? "फ़्लैश बंद" : "फ़्लैश चालू") : torchOn ? "Torch ON" : "Torch"}</span>
              </button>
            )}
          </div>

          {scannedPayload && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRescan}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl gm-gold-btn text-xs font-bold cursor-pointer active:scale-[0.98]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === "hi" ? "पुनः स्कैन करें" : "Rescan"}
            </button>
          )}
        </div>
      )}

      {decodeNote && (
        <p className="text-xs font-medium text-[#E6C98A] flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 shrink-0" />
          <span>{decodeNote}</span>
        </p>
      )}
    </div>
  );
};
