"use client";
import { useEffect, useRef, useState } from "react";
import type {
  InspectionResult,
  MatchInfo,
  SpatialEntry,
} from "@sage/contracts/explorer";
import { Button } from "@sage/ui";
import type { MatchMapRenderer } from "./match-map-renderer";

export function MatchMap({
  info,
  entries,
  terrain,
  selected,
  point,
  onSelect,
}: {
  info: MatchInfo;
  entries: SpatialEntry[];
  terrain: NonNullable<InspectionResult["terrain"]>;
  selected: number[];
  point?: { x: number; y: number };
  onSelect: (ids: number[]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<MatchMapRenderer | null>(null);
  const [ready, setReady] = useState(0),
    [error, setError] = useState(""),
    [backend, setBackend] = useState("Starting GPU…");
  const drag = useRef<{
    start: [number, number];
    last: [number, number];
    box: boolean;
    moved: boolean;
  } | null>(null);
  const [box, setBox] = useState<[number, number, number, number] | null>(null);
  useEffect(() => {
    let disposed = false;
    void import("./match-map-renderer")
      .then(async ({ MatchMapRenderer }) => {
        if (disposed || !canvas.current) return;
        const value = await MatchMapRenderer.create(
          canvas.current!,
          info.mapWidth,
          info.mapHeight,
          setError,
        );
        if (disposed) {
          value.destroy();
          return;
        }
        renderer.current = value;
        setBackend(value.backend);
        setReady((n) => n + 1);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      renderer.current?.destroy();
      renderer.current = null;
    };
  }, [info.key, info.mapWidth, info.mapHeight]);
  useEffect(() => {
    renderer.current?.setTerrain(terrain);
  }, [terrain, ready]);
  useEffect(() => {
    renderer.current?.setEntries(
      entries,
      new Map(info.players.map((p) => [Number(p.id), Number(p.color)])),
    );
  }, [entries, info.players, ready]);
  useEffect(() => {
    renderer.current?.select(new Set(selected), point);
  }, [selected, entries, ready, point?.x, point?.y]);
  useEffect(() => {
    const el = canvas.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      renderer.current?.magnify(Math.exp(-e.deltaY * 0.001));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const pointerPoint = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  return (
    <div className="stack">
      <div className="row">
        <strong>Spatial view</strong>
        <span className="small muted">
          {backend} · {entries.length.toLocaleString()} markers · ≤3 batched
          draws
        </span>
        <Button
          className="secondary"
          onClick={() => renderer.current?.magnify(1.3)}
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          className="secondary"
          onClick={() => renderer.current?.magnify(1 / 1.3)}
          aria-label="Zoom out"
        >
          −
        </Button>
        <Button className="secondary" onClick={() => renderer.current?.reset()}>
          Fit map
        </Button>
      </div>
      {error && (
        <p className="error" role="alert">
          Map unavailable: {error}. Event and snapshot tables remain usable.
        </p>
      )}
      <div className="match-map-wrap">
        <canvas
          ref={canvas}
          className="match-map"
          tabIndex={0}
          aria-label="Match map. Drag to pan, scroll to zoom, click to select, shift drag to select a region. Arrow keys pan; plus and minus zoom; Escape clears selection."
          onKeyDown={(e) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "+",
                "=",
                "-",
                "Escape",
                "r",
              ].includes(e.key)
            )
              e.preventDefault();
            if (e.key === "ArrowLeft") renderer.current?.pan(30, 0);
            if (e.key === "ArrowRight") renderer.current?.pan(-30, 0);
            if (e.key === "ArrowUp") renderer.current?.pan(0, 30);
            if (e.key === "ArrowDown") renderer.current?.pan(0, -30);
            if (e.key === "+" || e.key === "=") renderer.current?.magnify(1.3);
            if (e.key === "-") renderer.current?.magnify(1 / 1.3);
            if (e.key === "r") renderer.current?.reset();
            if (e.key === "Escape") onSelect([]);
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = pointerPoint(e);
            drag.current = { start: p, last: p, box: e.shiftKey, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = pointerPoint(e);
            d.moved ||= Math.hypot(p[0] - d.start[0], p[1] - d.start[1]) > 4;
            if (d.box)
              setBox([
                Math.min(p[0], d.start[0]),
                Math.min(p[1], d.start[1]),
                Math.abs(p[0] - d.start[0]),
                Math.abs(p[1] - d.start[1]),
              ]);
            else if (d.moved)
              renderer.current?.pan(p[0] - d.last[0], p[1] - d.last[1]);
            d.last = p;
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = pointerPoint(e);
            if (d.box && d.moved)
              onSelect(renderer.current?.box(d.start, p) ?? []);
            else if (!d.moved) {
              const hit = renderer.current?.pick(...p);
              onSelect(hit ? [hit.id] : []);
            }
            drag.current = null;
            setBox(null);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setBox(null);
          }}
        />
        {box && (
          <div
            className="map-selection-box"
            style={{ left: box[0], top: box[1], width: box[2], height: box[3] }}
          />
        )}
      </div>
      <p className="small muted">
        Drag to pan · scroll to zoom · click a marker or Shift-drag a region.
        White markers are selected. Terrain shading indicates recorded
        terrain/elevation; markers are schematic.
      </p>
    </div>
  );
}
