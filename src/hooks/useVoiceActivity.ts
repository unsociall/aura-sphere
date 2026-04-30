import { useEffect, useRef, useState } from "react";

/**
 * Detects voice activity / volume from the microphone using WebAudio.
 * Returns a smoothed volume (0..1) and an `active` flag that is true while
 * speech is detected. Automatically stops when `enabled` is false.
 */
export function useVoiceActivity(enabled: boolean) {
  const [volume, setVolume] = useState(0);
  const [active, setActive] = useState(false);
  const volumeRef = useRef(0);
  const activeRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimer = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const THRESHOLD = 0.06;
        const SILENCE_MS = 450;
        let lastSpoke = 0;

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          // Smooth volume
          volumeRef.current += (rms - volumeRef.current) * 0.25;
          setVolume(volumeRef.current);

          const now = performance.now();
          if (volumeRef.current > THRESHOLD) {
            lastSpoke = now;
            if (!activeRef.current) {
              activeRef.current = true;
              setActive(true);
            }
          } else if (activeRef.current && now - lastSpoke > SILENCE_MS) {
            activeRef.current = false;
            setActive(false);
          }
          silenceTimer.current = now;
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        // Permission denied or unsupported — silently disable.
        console.warn("Voice activity detection unavailable", e);
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      activeRef.current = false;
      volumeRef.current = 0;
      setActive(false);
      setVolume(0);
    };
  }, [enabled]);

  return { volume, active };
}