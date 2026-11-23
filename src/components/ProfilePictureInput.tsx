import React, { useEffect, useRef, useState } from "react";
import { Camera, Upload, Trash2, X, Check, User } from "lucide-react";
import type { LangCode } from "../types/guardian";

interface ProfilePictureInputProps {
  value: string | null;
  onChange: (nextDataUrl: string | null) => void;
  lang: LangCode;
  fallbackName?: string;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RAW_FILE_BYTES = 5 * 1024 * 1024; // 5 MB raw upload limit before client resize

function compressImageToSquareDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing unavailable.");

  const minSide = Math.min(width, height);
  const sx = Math.max(0, (width - minSide) / 2);
  const sy = Math.max(0, (height - minSide) / 2);

  ctx.drawImage(source, sx, sy, minSide, minSide, 0, 0, size, size);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > 480 * 1024) {
    return canvas.toDataURL("image/jpeg", 0.7);
  }
  return dataUrl;
}

export const ProfilePictureInput: React.FC<ProfilePictureInputProps> = ({
  value,
  onChange,
  lang,
  fallbackName,
}) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
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
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          try {
            track.stop();
          } catch {
            // ignore
          }
        }
      }
    };
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError(
        lang === "hi"
          ? "कृपया केवल JPEG, PNG या WebP फ़ोटो चुनें।"
          : "Please select a valid JPEG, PNG, or WebP image."
      );
      return;
    }
    if (file.size > MAX_RAW_FILE_BYTES) {
      setError(
        lang === "hi"
          ? "फ़ोटो 5 MB से छोटी होनी चाहिए।"
          : "Please choose an image smaller than 5 MB."
      );
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const dataUrl = compressImageToSquareDataUrl(bitmap, bitmap.width, bitmap.height);
      if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
      onChange(dataUrl);
    } catch {
      setError(
        lang === "hi"
          ? "फ़ोटो पढ़ा नहीं जा सका। कृपया दूसरी छवि चुनें।"
          : "Could not read this image file. Please try another photo."
      );
    }
  }

  async function openCameraCapture() {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        lang === "hi"
          ? "इस ब्राउज़र या डिवाइस में कैमरा उपलब्ध नहीं है।"
          : "Camera capture is not supported in this browser."
      );
      return;
    }
    setCameraBusy(true);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      stopCamera();
      setError(
        lang === "hi"
          ? "कैमरा अनुमति नहीं मिली या कैमरा व्यस्त है। आप फ़ोटो अपलोड कर सकते हैं।"
          : "Camera permission was denied or unavailable. You can still upload a photo from your device."
      );
    } finally {
      setCameraBusy(false);
    }
  }

  function captureSnapshot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    try {
      const dataUrl = compressImageToSquareDataUrl(video, video.videoWidth, video.videoHeight);
      onChange(dataUrl);
      stopCamera();
    } catch {
      setError(lang === "hi" ? "फ़ोटो कैप्चर विफल रहा।" : "Failed to capture snapshot.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#C6A15B]/50 bg-[#10243A] flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt={fallbackName || "Profile preview"} className="w-full h-full object-cover" />
          ) : (
            <User className="w-7 h-7 text-[#E6C98A]" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/90 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]">
            <Upload className="w-3.5 h-3.5 text-[#E6C98A]" />
            <span>
              {value
                ? lang === "hi"
                  ? "फ़ोटो बदलें"
                  : "Change Photo"
                : lang === "hi"
                  ? "फ़ोटो अपलोड करें"
                  : "Upload Photo"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={openCameraCapture}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#C6A15B]/30 bg-[#10243A]/90 hover:border-[#E6C98A] text-xs font-semibold text-[#F4F0E6] transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
          >
            <Camera className="w-3.5 h-3.5 text-[#E6C98A]" />
            <span>{lang === "hi" ? "कैमरा से लें" : "Take Photo"}</span>
          </button>

          {value && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E87575]/45 text-xs font-semibold text-[#E87575] hover:bg-[#2E1219]/85 transition-colors cursor-pointer whitespace-nowrap shrink-0 active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === "hi" ? "हटाएं" : "Remove"}</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[#AEBBC9]">
        {lang === "hi"
          ? "वैकल्पिक · केवल JPEG, PNG या WebP · सुरक्षा जांच के लिए कभी उपयोग नहीं किया जाता।"
          : "Optional · JPEG, PNG, or WebP · Preview before saving · Never used for fraud scoring."}
      </p>

      {error && (
        <p role="alert" className="text-xs font-medium text-[#E87575]">
          {error}
        </p>
      )}

      {cameraOpen && (
        <div className="p-4 rounded-2xl border border-[#C6A15B]/45 bg-[#071525]/95 text-[#F4F0E6] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#E6C98A]">
              {lang === "hi" ? "प्रोफ़ाइल फ़ोटो कैमरा पूर्वावलोकन" : "Camera Preview"}
            </span>
            <button
              type="button"
              onClick={stopCamera}
              aria-label={lang === "hi" ? "कैमरा बंद करें" : "Close camera"}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#AEBBC9] hover:text-[#F4F0E6] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="relative rounded-xl overflow-hidden bg-[#10243A] aspect-square max-w-[240px] mx-auto border border-[#C6A15B]/35">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {cameraBusy && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[#AEBBC9]">
                {lang === "hi" ? "कैमरा चालू हो रहा है..." : "Starting camera..."}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2.5">
            <button
              type="button"
              disabled={cameraBusy}
              onClick={captureSnapshot}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl gm-gold-btn text-xs font-bold cursor-pointer disabled:opacity-60 active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              {lang === "hi" ? "फ़ोटो खींचें" : "Capture Photo"}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-[#C6A15B]/30 text-xs font-semibold text-[#F4F0E6] cursor-pointer"
            >
              {lang === "hi" ? "रद्द करें" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
