"use client";

interface StatusBannerProps {
  message: string | null;
  kind?: "error" | "warning" | "info";
  onDismiss?: () => void;
}

export function StatusBanner({
  message,
  kind = "error",
  onDismiss,
}: StatusBannerProps) {
  if (!message) return null;

  const styles: Record<
    "error" | "warning" | "info",
    { bg: string; border: string; color: string; dotClass: string }
  > = {
    error: {
      bg: "var(--color-error-bg)",
      border: "var(--color-error-border)",
      color: "var(--color-error)",
      dotClass: "dot dot-offline",
    },
    warning: {
      bg: "var(--color-warning-bg)",
      border: "var(--color-warning-border)",
      color: "var(--color-warning)",
      dotClass: "dot dot-warning",
    },
    info: {
      bg: "var(--color-brand-lighter)",
      border: "rgba(135,113,255,0.2)",
      color: "var(--color-brand)",
      dotClass: "dot",
    },
  };

  const s = styles[kind];

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.625rem 1rem",
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "0.75rem",
        fontSize: "0.875rem",
        color: s.color,
      }}
    >
      <span className={s.dotClass} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost btn-icon btn-sm"
          style={{ color: s.color, marginRight: "-0.25rem" }}
          aria-label="Dismiss"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <title>Dismiss</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
