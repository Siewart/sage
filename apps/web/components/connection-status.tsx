"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@sage/ui";
export function ConnectionStatus({
  connected,
  desktop,
  onDisconnect,
}: {
  connected: boolean;
  desktop: boolean;
  onDisconnect: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [hovered, setHovered] = useState(false),
    [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPinned(false);
        setHovered(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className="connection-menu"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPinned(false);
          setHovered(false);
        }
      }}
    >
      <button
        ref={trigger}
        className="status-trigger"
        type="button"
        aria-label={
          connected
            ? "Connection status: connected"
            : "Connection status: disconnected"
        }
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((value) => !value)}
        title={
          connected
            ? "Connected to the local service"
            : "Not connected to a local service"
        }
      >
        <span
          className={`status-dot ${connected ? "" : "offline"}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          id={id}
          className="connection-popover stack"
          role="group"
          aria-label="Service connection"
        >
          <strong>{connected ? "Connected" : "Disconnected"}</strong>
          <p>
            {connected
              ? desktop
                ? "SAGE and its data service run on your computer."
                : "This page is connected to the service running on your computer."
              : "Connect to the local service to access your datasets and saved runs."}
          </p>
          {connected && (
            <Button
              className="secondary"
              onClick={() => {
                setPinned(false);
                setHovered(false);
                onDisconnect();
              }}
            >
              Disconnect
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
