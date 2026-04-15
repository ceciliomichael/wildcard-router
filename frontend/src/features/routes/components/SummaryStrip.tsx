"use client";

import type { Route } from "../types";

interface SummaryStripProps {
  routes: Route[];
}

interface MetricCardProps {
  label: string;
  value: number | string;
  accent?: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, accent, icon }: MetricCardProps) {
  return (
    <div
      className="summary-metric-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        padding: "1rem 1.25rem",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1rem",
        boxShadow: "var(--shadow-card)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "0.75rem",
          background: accent ?? "var(--color-surface-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: "1.375rem",
            fontWeight: "700",
            letterSpacing: "-0.03em",
            color: "var(--color-ink)",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-ink-muted)",
            fontWeight: "500",
            marginTop: "0.125rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function SummaryStrip({ routes }: SummaryStripProps) {
  const total = routes.length;
  const enabled = routes.filter((r) => r.enabled).length;
  const disabled = total - enabled;

  return (
    <>
      <div className="summary-strip-grid">
        <MetricCard
          label="Total routes"
          value={total}
          accent="var(--color-brand-light)"
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Total</title>
              <path d="M9 17H5a2 2 0 0 0-2 2" />
              <path d="M15 17h4a2 2 0 0 1 2 2" />
              <circle cx="12" cy="9" r="3" />
              <path d="M6.1 20a6 6 0 0 1 11.8 0" />
            </svg>
          }
        />
        <MetricCard
          label="Active routes"
          value={enabled}
          accent="var(--color-success-bg)"
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Active</title>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <MetricCard
          label="Disabled routes"
          value={disabled}
          accent="var(--color-surface-subtle)"
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-ink-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Disabled</title>
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          }
        />
      </div>
      <style>{`
        .summary-strip-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.625rem;
        }
        .summary-metric-card {
          width: 100%;
        }
        @media (min-width: 768px) {
          .summary-strip-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.75rem;
          }
        }
      `}</style>
    </>
  );
}
