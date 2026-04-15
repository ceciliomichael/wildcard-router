"use client";

import type { ReactNode } from "react";

interface DashboardPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: ReadonlyArray<{
    label: string;
    value: string;
    detail: string;
  }>;
  actions?: ReactNode;
}

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  highlights,
  actions,
}: DashboardPageHeaderProps) {
  const hasHighlights = Boolean(highlights && highlights.length > 0);

  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1.5rem",
        padding: "1.25rem",
        display: "grid",
        gap: "1rem",
        overflow: "hidden",
      }}
    >
      <div
        className={
          hasHighlights
            ? "dashboard-page-header-grid with-highlights"
            : "dashboard-page-header-grid"
        }
        style={{
          display: "grid",
          gap: "1rem",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "0.8rem",
            padding: "1.1rem",
            borderRadius: "1.25rem",
            background:
              "linear-gradient(180deg, var(--color-surface) 0%, var(--color-brand-soft) 100%)",
            border: "1px solid var(--color-border)",
          }}
        >
          <span className="badge badge-brand" style={{ width: "fit-content" }}>
            {eyebrow}
          </span>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <h1
              style={{
                fontSize: "clamp(1.55rem, 4vw, 2.2rem)",
                fontWeight: "800",
                letterSpacing: "-0.04em",
                color: "var(--color-ink)",
                margin: 0,
                lineHeight: 1,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--color-ink-secondary)",
                margin: 0,
                maxWidth: "44rem",
              }}
            >
              {description}
            </p>
          </div>
          {actions ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              {actions}
            </div>
          ) : null}
        </div>

        {hasHighlights ? (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
            }}
          >
            {highlights?.map((item) => (
              <article
                key={item.label}
                style={{
                  padding: "1rem 1.05rem",
                  borderRadius: "1.15rem",
                  background: "var(--color-brand-lighter)",
                  border: "1px solid var(--color-border)",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--color-ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {item.value}
                </span>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-ink-secondary)",
                  }}
                >
                  {item.detail}
                </span>
              </article>
            ))}
          </div>
        ) : null}
      </div>
      <style>{`
        @media (min-width: 960px) {
          .dashboard-page-header-grid.with-highlights {
            grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
          }
        }
      `}</style>
    </section>
  );
}
