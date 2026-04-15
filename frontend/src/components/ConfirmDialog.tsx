"use client";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal"
        style={{ maxWidth: "400px", padding: "1.75rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: "2.75rem",
            height: "2.75rem",
            borderRadius: "0.875rem",
            background: "var(--color-error-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-error)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Warning</title>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: "1rem",
            fontWeight: "700",
            margin: "0 0 0.5rem",
            color: "var(--color-ink)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-ink-secondary)",
            margin: "0 0 1.5rem",
            lineHeight: "1.6",
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
            id="confirm-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isLoading}
            id="confirm-delete"
          >
            {isLoading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
