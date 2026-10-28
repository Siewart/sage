"use client";
import { useEffect, useRef, useState } from "react";
import type { MatchVideo as VideoSettings } from "@sage/contracts/explorer";
import { Button } from "@sage/ui";

type Player = {
  seekTo: (time: number, ahead: boolean) => void;
  getCurrentTime: () => number;
  destroy: () => void;
};
type YouTube = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host: string;
      playerVars: Record<string, string | number>;
      events: { onReady: () => void; onError: () => void };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YouTube;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<YouTube> | undefined;
function youtube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return (apiPromise ??= new Promise<YouTube>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => {
      apiPromise = undefined;
      reject(
        new Error("YouTube player could not load. Check your connection."),
      );
    }, 20000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      clearTimeout(timeout);
      apiPromise = undefined;
      reject(new Error("YouTube player could not load"));
    };
    document.head.append(script);
  }));
}
export function youtubeId(value: string) {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (
      [
        "www.youtube.com",
        "youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtube-nocookie.com",
      ].includes(url.hostname)
    ) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.slice(1)
          : (url.searchParams.get("v") ?? url.pathname.split("/").at(-1));
      if (id && /^[\w-]{11}$/.test(id)) return id;
    }
  } catch {}
  return undefined;
}
export function MatchVideo({
  saved,
  seek,
  onTime,
  onSave,
}: {
  saved: VideoSettings | null | undefined;
  seek: { timeMs: number; sequence: number };
  onTime: (ms: number) => void;
  onSave: (video: VideoSettings) => Promise<unknown>;
}) {
  const [loadKey, setLoadKey] = useState(0);
  const [source, setSource] = useState(""),
    [videoId, setVideoId] = useState<string>(),
    [file, setFile] = useState<File | null>(null),
    [localUrl, setLocalUrl] = useState("");
  const [offset, setOffset] = useState(saved?.offsetSeconds ?? 0),
    [rate, setRate] = useState(saved?.gameRate ?? 1.65),
    [follow, setFollow] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const host = useRef<HTMLDivElement>(null),
    player = useRef<Player | null>(null),
    native = useRef<HTMLVideoElement>(null),
    lastUpdate = useRef(0),
    seekRef = useRef(seek),
    onTimeRef = useRef(onTime);
  const syncRef = useRef({ offset, rate });
  syncRef.current = { offset, rate };
  const lastSeek = useRef(0);
  const playerReady = useRef(false);
  seekRef.current = seek;
  onTimeRef.current = onTime;
  useEffect(() => {
    if (saved) {
      setOffset(saved.offsetSeconds);
      setRate(saved.gameRate);
      setSource(saved.youtubeId ?? "");
      setVideoId(saved.youtubeId);
    }
  }, [saved]);
  useEffect(() => {
    if (!file) {
      setLocalUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    playerReady.current = false;
    if (!videoId || file) return;
    let disposed = false;
    const target = document.createElement("div");
    host.current!.append(target);
    void youtube()
      .then((api) => {
        if (disposed) return;
        const value = new api.Player(target, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { origin: location.origin, playsinline: 1, rel: 0 },
          events: {
            onReady: () => {
              if (!disposed) {
                playerReady.current = true;
                player.current = value;
                value.seekTo(
                  Math.max(
                    0,
                    syncRef.current.offset +
                      seekRef.current.timeMs / 1000 / syncRef.current.rate,
                  ),
                  true,
                );
              }
            },
            onError: () => {
              if (!disposed)
                setError(
                  "YouTube could not play this video. It may be unavailable or disallow embedding.",
                );
            },
          },
        });
        player.current = value;
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      player.current?.destroy();
      player.current = null;
      target.remove();
    };
  }, [videoId, file, loadKey]);
  useEffect(() => {
    lastSeek.current = Date.now();
    const seconds = Math.max(0, offset + seek.timeMs / 1000 / rate);
    if (native.current && Math.abs(native.current.currentTime - seconds) > 0.3)
      native.current.currentTime = seconds;
    player.current?.seekTo(seconds, true);
  }, [seek, offset, rate]);
  useEffect(() => {
    if (!follow) return;
    const timer = setInterval(() => {
      const seconds = playerReady.current
        ? player.current?.getCurrentTime()
        : undefined;
      if (seconds !== undefined && Date.now() - lastSeek.current > 1000)
        onTimeRef.current(Math.max(0, (seconds - offset) * rate * 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [follow, offset, rate, videoId]);
  return (
    <div className="stack">
      <strong>Match video</strong>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const id = youtubeId(source.trim());
          if (!id) {
            setError("Enter a YouTube video URL or 11-character video ID.");
            return;
          }
          setError("");
          setFile(null);
          setVideoId(id);
          setLoadKey((n) => n + 1);
          void onSave({
            youtubeId: id,
            label: source,
            offsetSeconds: offset,
            gameRate: rate,
          })
            .then(() =>
              setNotice("Video and synchronization saved for this match."),
            )
            .catch((e) => setError(e.message));
        }}
      >
        <label>
          YouTube URL or ID
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <div className="row">
          <Button>Load YouTube video</Button>
          <label className="small">
            Or open a local video
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setOffset(0);
                setVideoId(undefined);
                setFollow(false);
                setError("");
              }}
            />
          </label>
        </div>
      </form>
      {!file && saved?.label && !saved.youtubeId && (
        <p className="small muted">
          Previously opened: {saved.label}. Select the local file again to play
          it.
        </p>
      )}
      {file && (
        <>
          <p className="small">{file.name}</p>
          <video
            ref={native}
            src={localUrl}
            controls
            preload="metadata"
            className="match-video"
            onLoadedMetadata={() => {
              if (native.current)
                native.current.currentTime = Math.max(
                  0,
                  syncRef.current.offset +
                    seekRef.current.timeMs / 1000 / syncRef.current.rate,
                );
            }}
            onTimeUpdate={(e) => {
              if (
                follow &&
                Date.now() - lastSeek.current > 1000 &&
                Date.now() - lastUpdate.current > 500
              ) {
                lastUpdate.current = Date.now();
                onTimeRef.current(
                  Math.max(
                    0,
                    (e.currentTarget.currentTime - offset) * rate * 1000,
                  ),
                );
              }
            }}
            onError={() =>
              setError(
                "This video could not be decoded. Try a browser-compatible MP4 or WebM file.",
              )
            }
          />
        </>
      )}
      <div
        ref={host}
        className={videoId && !file ? "match-video youtube-host" : ""}
      />
      <div className="row">
        <label>
          Video seconds at GT 0
          <input
            type="number"
            step="0.01"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </label>
        <label>
          Game seconds per video second
          <input
            type="number"
            min="0.05"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 0.05 && v <= 100) setRate(v);
            }}
          />
        </label>
      </div>
      <div className="row">
        <Button
          className="secondary"
          onClick={() =>
            void onSave({
              youtubeId: file ? undefined : videoId,
              label: file?.name ?? source,
              offsetSeconds: offset,
              gameRate: rate,
            })
              .then(() => setNotice("Synchronization saved."))
              .catch((e) => setError(e.message))
          }
        >
          Save synchronization
        </Button>
        <label className="check">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          Follow video
        </label>
      </div>
      <p className="small muted">
        Video time = offset + game time ÷ rate. Calibrate for this recording;
        pauses and edits can cause drift. Local files stay on your device and
        must be reselected after reopening. Video analysis is planned for later.
      </p>
      {notice && (
        <p className="small" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
