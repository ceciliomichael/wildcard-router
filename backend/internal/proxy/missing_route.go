package proxy

import (
	"html/template"
	"net/http"
)

type missingRoutePageData struct {
	RequestedHost string
}

var missingRoutePageTemplate = template.Must(template.New("missing-route-page").Parse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>404 - Subdomain not found</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #101011;
      --ink-secondary: #606266;
      --ink-muted: #9a9ca2;
      --surface-muted: #f7f8fc;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      min-height: 100%;
    }

    body {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top, rgba(16, 16, 17, 0.08), transparent 32%),
        linear-gradient(180deg, var(--surface-muted) 0%, #fbfbfd 58%, #f6f7fa 100%);
      line-height: 1.5;
    }

    main {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
      text-align: center;
    }

    .shell {
      width: min(100%, 42rem);
      display: grid;
      gap: 0.9rem;
    }

    .eyebrow {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 8vw, 4.8rem);
      line-height: 0.98;
      letter-spacing: -0.06em;
    }

    p {
      margin: 0;
      font-size: 1rem;
      color: var(--ink-secondary);
    }

    .note {
      font-size: 0.875rem;
      color: var(--ink-muted);
    }
  </style>
</head>
<body>
  <main>
    <section class="shell" aria-labelledby="missing-route-title">
      <p class="eyebrow">RouteGate</p>
      <h1 id="missing-route-title">This subdomain does not exist.</h1>
      <p>
        We could not find a route for <strong>{{.RequestedHost}}</strong>.
      </p>
      <p class="note">
        RouteGate could not find a match for this request.
      </p>
    </section>
  </main>
</body>
</html>`))

func (h *Handler) writeMissingRoutePage(
	writer http.ResponseWriter,
	_ *http.Request,
	host string,
	_ string,
) {
	data := missingRoutePageData{RequestedHost: host}

	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("X-Robots-Tag", "noindex, nofollow")
	writer.WriteHeader(http.StatusNotFound)

	if err := missingRoutePageTemplate.Execute(writer, data); err != nil {
		http.Error(writer, "not found", http.StatusNotFound)
	}
}
