"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DownloadCloud, ImageIcon, Loader2, RefreshCw, Video } from "lucide-react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { create } from "zustand";
import { AnimationSettings, PreparedImage } from "@/lib/types";
import { createDisplacementFromSource, fetchImageAsDataUrl } from "@/lib/image-utils";

const ParallaxStudio = dynamic(() => import("@/components/ParallaxStudio"), {
  ssr: false
});

type AnimatorState = {
  settings: AnimationSettings;
  setValue: <K extends keyof AnimationSettings>(key: K, value: AnimationSettings[K]) => void;
  reset: () => void;
};

const useAnimatorStore = create<AnimatorState>((set) => ({
  settings: {
    duration: 8,
    depth: 0.35,
    sway: 0.6,
    zoom: 0.12,
    roll: 0.08,
    wave: 0.15,
    exposure: 1.05,
    vignette: 0.25
  },
  setValue: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value
      }
    })),
  reset: () =>
    set({
      settings: {
        duration: 8,
        depth: 0.35,
        sway: 0.6,
        zoom: 0.12,
        roll: 0.08,
        wave: 0.15,
        exposure: 1.05,
        vignette: 0.25
      }
    })
}));

const defaultImage =
  "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=1600&q=80";

export default function Animator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [playSignal, setPlaySignal] = useState(0);
  const { settings, setValue, reset } = useAnimatorStore();

  const prepareImage = useCallback(async (dataUrl: string, name: string): Promise<PreparedImage> => {
    const result = await createDisplacementFromSource(dataUrl);
    return {
      id: crypto.randomUUID(),
      displayName: name,
      originalUrl: dataUrl,
      displacementUrl: result.mapUrl,
      aspect: result.aspectRatio
    };
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const dataUrl = await fetchImageAsDataUrl(defaultImage);
      if (!active) return;
      const mapped = await prepareImage(dataUrl, "Dreamscape Muse");
      if (!active) return;
      setPrepared(mapped);
      setIsLoading(false);
    };

    bootstrap().catch((error) => {
      console.error(error);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [prepareImage]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setDownloadUrl(null);

      const reader = new FileReader();
      reader.onload = async () => {
        if (!reader.result || typeof reader.result !== "string") {
          setIsLoading(false);
          return;
        }
        try {
          const mapped = await prepareImage(reader.result, file.name);
          setPrepared(mapped);
        } catch (error) {
          console.error(error);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [prepareImage]
  );

  const handleRecord = useCallback(async () => {
    if (!canvasRef.current || isRecording) {
      return;
    }
    const canvas = canvasRef.current;
    const stream = canvas.captureStream(60);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";

    const recorder = new MediaRecorder(stream, {
      mimeType
    });

    recorderRef.current = recorder;
    chunksRef.current = [];
    setDownloadUrl(null);

    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsRecording(false);
    };

    setIsRecording(true);
    setPlaySignal((signal) => signal + 1);
    recorder.start();

    window.setTimeout(() => {
      recorder.stop();
    }, settings.duration * 1000);
  }, [isRecording, settings.duration]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const activeAspect = useMemo(() => prepared?.aspect ?? 16 / 9, [prepared?.aspect]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Cinematic 3D Animator</h1>
          <p className="text-xs text-neutral-400">
            Upload any photo and generate a looping parallax animation perfect for social feeds.
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-accent hover:text-foreground"
        >
          <RefreshCw size={14} />
          Reset Parameters
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <aside className="flex w-full flex-col gap-6 rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-lg lg:w-80">
          <div className="flex flex-col gap-3">
            <label
              htmlFor="image-upload"
              className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-white/20 bg-black/20 p-6 text-sm text-neutral-300 transition hover:border-accent hover:text-foreground"
            >
              <ImageIcon size={18} />
              <span>Upload Image</span>
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {prepared && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-neutral-400">
                <p className="truncate font-medium text-neutral-200">{prepared.displayName}</p>
                <p>{Math.round(activeAspect * 100) / 100}:1 aspect ratio</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <SettingSlider
              label="Depth Sculpt"
              min={0}
              max={0.8}
              step={0.01}
              value={settings.depth}
              onChange={(value) => setValue("depth", value)}
            />
            <SettingSlider
              label="Sway Motion"
              min={0}
              max={1.5}
              step={0.01}
              value={settings.sway}
              onChange={(value) => setValue("sway", value)}
            />
            <SettingSlider
              label="Zoom Pulse"
              min={0}
              max={0.4}
              step={0.005}
              value={settings.zoom}
              onChange={(value) => setValue("zoom", value)}
            />
            <SettingSlider
              label="Roll Drift"
              min={0}
              max={0.2}
              step={0.005}
              value={settings.roll}
              onChange={(value) => setValue("roll", value)}
            />
            <SettingSlider
              label="Liquid Wave"
              min={0}
              max={0.4}
              step={0.005}
              value={settings.wave}
              onChange={(value) => setValue("wave", value)}
            />
            <SettingSlider
              label="Exposure"
              min={0.6}
              max={1.5}
              step={0.01}
              value={settings.exposure}
              onChange={(value) => setValue("exposure", value)}
            />
            <SettingSlider
              label="Vignette"
              min={0}
              max={0.65}
              step={0.01}
              value={settings.vignette}
              onChange={(value) => setValue("vignette", value)}
            />
            <SettingSlider
              label="Duration (seconds)"
              min={4}
              max={14}
              step={1}
              value={settings.duration}
              onChange={(value) => setValue("duration", value)}
            />
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              onClick={handleRecord}
              disabled={!prepared || isLoading || isRecording}
              className={clsx(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition",
                isRecording
                  ? "bg-red-600/80 text-white shadow-lg shadow-red-600/30"
                  : "bg-accent text-black shadow-lg shadow-accent/30 hover:shadow-accent/60",
                (!prepared || isLoading) && "cursor-not-allowed opacity-60"
              )}
            >
              {isRecording ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Recording...
                </>
              ) : (
                <>
                  <Video size={18} />
                  Start Capture
                </>
              )}
            </button>
            {isRecording && (
              <button
                onClick={stopRecording}
                className="rounded-xl border border-white/20 bg-black/30 py-2 text-xs font-medium text-neutral-200 transition hover:text-accent"
              >
                Stop early
              </button>
            )}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="cinematic-parallax.webm"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 py-3 text-sm font-medium text-neutral-200 transition hover:border-accent hover:text-foreground"
              >
                <DownloadCloud size={18} />
                Download Video
              </a>
            )}
          </div>
        </aside>

        <section className="relative flex-1">
          <div
            className="relative h-full w-full overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-b from-white/5 via-black/40 to-black/90 shadow-2xl"
            style={{
              aspectRatio: `${activeAspect}`
            }}
          >
            {prepared && !isLoading ? (
              <ParallaxStudio
                key={prepared.id}
                image={prepared}
                settings={settings}
                registerCanvas={(canvas) => {
                  canvasRef.current = canvas;
                }}
                playSignal={playSignal}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/40">
                <Loader2 className="animate-spin text-neutral-400" size={28} />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function SettingSlider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span className="font-mono text-neutral-200">{value.toFixed(2)}</span>
      </div>
      <input
        className="appearance-none rounded-full bg-black/40 accent-accent"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
