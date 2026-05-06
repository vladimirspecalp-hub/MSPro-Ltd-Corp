import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

const HEALTH_URL = "http://127.0.0.1:3100/api/health";
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 30_000;

interface SplashScreenProps {
  onReady: () => void;
}

export function SplashScreen({ onReady }: SplashScreenProps) {
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    function resolve() {
      if (resolved || cancelled) return;
      resolved = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      onReadyRef.current();
    }

    async function poll() {
      if (resolved || cancelled) return;
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(400) });
        if (res.ok) resolve();
      } catch {
        // keep polling
      }
    }

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);

    timeoutId = setTimeout(() => {
      if (resolved || cancelled) return;
      if (intervalId !== null) clearInterval(intervalId);
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [attempt]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <svg viewBox="0 0 32 32" fill="none" className="h-9 w-9" aria-hidden="true">
            <rect x="4" y="8" width="24" height="3" rx="1.5" fill="currentColor" />
            <rect x="4" y="14.5" width="16" height="3" rx="1.5" fill="currentColor" />
            <rect x="4" y="21" width="20" height="3" rx="1.5" fill="currentColor" />
          </svg>
        </div>

        {!timedOut ? (
          <>
            {/* Spinner */}
            <svg
              className="h-8 w-8 animate-spin text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>

            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-foreground">Загружается сервер...</p>
              <p className="text-sm text-muted-foreground">Это может занять 10 секунд при первом запуске</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-base font-medium text-destructive">Сервер не отвечает</p>
              <button
                type="button"
                onClick={() => {
                  setTimedOut(false);
                  setAttempt((a) => a + 1);
                }}
                className={cn(
                  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
                  "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                )}
              >
                Повторить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
