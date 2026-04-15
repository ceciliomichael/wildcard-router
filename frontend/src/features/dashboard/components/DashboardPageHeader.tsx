"use client";

export function DashboardPageHeader() {
  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "1rem",
        padding: "1rem 1rem 0.875rem",
      }}
    >
      <span className="badge badge-brand" style={{ marginBottom: "0.5rem" }}>
        Route operations
      </span>
      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: "800",
          letterSpacing: "-0.03em",
          color: "var(--color-ink)",
          margin: "0 0 0.3rem",
          lineHeight: 1.15,
        }}
      >
        Route manager
      </h1>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--color-ink-secondary)",
          margin: 0,
        }}
      >
        Manage wildcard subdomain proxy routes and keep traffic healthy.
      </p>
    </section>
  );
}
