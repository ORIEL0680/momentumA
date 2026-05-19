/**
 * R55 (R45 SMART INPUT, day 2) — thin React hook over the Web Speech API
 * for Hebrew dictation.
 *
 * Privacy: recognition is performed by the browser/OS; the transcript is
 * kept only in client React state and is NEVER sent anywhere by this
 * hook. Nothing here touches the network.
 *
 * The Web Speech API is not in the TS DOM lib, so we declare the minimal
 * structural shape we use — no `any`, no `@ts-ignore`.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechAlt {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlt;
}
interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}
interface SpeechEvent {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface SpeechErrorEvent {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceStatus =
  | "idle"
  | "listening"
  | "denied"
  | "error"
  | "unsupported";

export interface UseSpeech {
  /** API present in this browser at all. */
  supported: boolean;
  status: VoiceStatus;
  /** Committed (final) text accumulated so far. */
  transcript: string;
  /** Live, not-yet-final words (shown greyed; not parsed). */
  interim: string;
  errorMsg: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = "he-IL"): UseSpeech {
  // Resolve support via useState lazy initializers (runs once, no ref
  // read during render, no setState from inside an effect).
  const [supported] = useState(() => getCtor() !== null);
  const [status, setStatus] = useState<VoiceStatus>(() =>
    getCtor() ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // True while the user *wants* to be listening — drives auto-restart
  // across the browser's short per-utterance sessions.
  const wantRef = useRef(false);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setStatus("listening");

    rec.onresult = (e: SpeechEvent) => {
      let finalChunk = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript ?? "";
        if (r.isFinal) finalChunk += txt;
        else live += txt;
      }
      if (finalChunk) {
        setTranscript((prev) => (prev ? `${prev} ${finalChunk}` : finalChunk));
      }
      setInterim(live);
    };

    rec.onerror = (e: SpeechErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // transient
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setStatus("denied");
        setErrorMsg("הגישה למיקרופון נחסמה. אפשר/י אותה בהגדרות הדפדפן.");
        return;
      }
      wantRef.current = false;
      setStatus("error");
      setErrorMsg("הקול לא נקלט. נסו שוב, או הזינו ידנית.");
    };

    rec.onend = () => {
      setInterim("");
      // The browser ends sessions on its own (silence / time). If the
      // user hasn't pressed "stop", transparently resume.
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          /* already starting — ignore */
        }
      } else {
        setStatus((s) => (s === "listening" ? "idle" : s));
      }
    };

    recRef.current = rec;
    return () => {
      wantRef.current = false;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    setErrorMsg(null);
    wantRef.current = true;
    try {
      rec.start();
      setStatus("listening");
    } catch {
      // start() throws if already running — that's fine, we're listening.
      setStatus("listening");
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    wantRef.current = false;
    setInterim("");
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
    setStatus((s) => (s === "listening" ? "idle" : s));
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setErrorMsg(null);
  }, []);

  return { supported, status, transcript, interim, errorMsg, start, stop, reset };
}
