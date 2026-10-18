"use client";
import { useEffect, useRef } from "react";
import { Button } from "@sage/ui";

export function DestructiveConfirmation({
  title,
  description,
  busy,
  error,
  onCancel,
  onConfirm,
  retentionNote = "Downloaded datasets will stay on your computer.",
  confirmLabel = "Delete permanently",
  items,
}: {
  title: string;
  description: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  retentionNote?: string;
  confirmLabel?: string;
  items?: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    cancel.current?.focus();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="destructive-title"
      aria-describedby="destructive-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="stack">
        <h2 id="destructive-title">{title}</h2>
        <p id="destructive-description">{description} This cannot be undone.</p>
        {items && (
          <ul className="confirmation-items" aria-label="Datasets to delete">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <p className="small muted">{retentionNote}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="row confirmation-actions">
          <button
            ref={cancel}
            className="button secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <Button className="danger" disabled={busy} onClick={onConfirm}>
            {busy ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
