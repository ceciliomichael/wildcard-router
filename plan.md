# Wildcard Catcher Frontend Plan

## Goal

Build a small, production-minded admin frontend for the wildcard router backend. The frontend should feel like a control surface, not a marketing site. It must prioritize clarity, route visibility, and safe route management.

The first screen must be a lock screen that asks for the API key before the user can enter the dashboard.

## Product Shape

The frontend should have two user states:

1. Locked state
   - Shows only the access gate.
   - Accepts the API key as the password.
   - Prevents any dashboard data from rendering until the key is validated.

2. Unlocked state
   - Shows the route management dashboard.
   - Lets the user view, create, edit, delete, and disable routes.
   - Surfaces backend status and proxy health clearly.

## Visual Direction

The interface should match the existing product language:

- Light surfaces
- Neutral borders
- Soft shadows
- Rounded cards
- Purple accent only for primary actions and active states

The layout should feel dense and useful, not empty.

### Overall Look

- Use a calm white or near-white canvas.
- Use card sections with subtle borders and compact spacing.
- Keep typography strong and readable.
- Use visible hierarchy so the important admin actions are obvious.
- Avoid decorative filler and unnecessary motion.

### Layout Tone

- Desktop: structured dashboard with a left summary column and a main working area.
- Tablet: stacked cards with a route table still prominent.
- Mobile: single column, full-width actions, and simplified route editing.

## Authentication Gate

The dashboard must be protected by an API-key entry screen before any route data is shown.

### Behavior

- The user lands on a lock screen first.
- The key is entered like a password.
- On submit, the frontend validates the key by calling the backend CRUD API.
- If valid, the frontend transitions to the dashboard.
- If invalid, it shows a clear error and keeps the user locked out.

### Security Rules

- Do not render route data before auth succeeds.
- Do not log the API key in the console.
- Do not expose the key in plain text after entry.
- Prefer session-only storage over persistent storage.
- Provide a logout action that clears the session and returns to the lock screen.
- If the backend is later extended, prefer exchanging the API key for a short-lived session token rather than reusing the raw key everywhere.

### Practical Storage Decision

For the first version:

- Keep the key in memory or session storage only.
- Avoid localStorage unless there is no other workable option.
- Re-authenticate after tab close or explicit logout.

## Dashboard Structure

The dashboard should be built around route management and quick inspection.

### Top Bar

- Brand/title on the left
- Current backend status on the right
- Logout button
- Small badge showing connection state

### Summary Strip

Show a compact row of at-a-glance metrics:

- Total routes
- Enabled routes
- Disabled routes
- Failed/invalid destinations if detected

### Main Work Area

The main panel should contain:

- Route table
- Create route button
- Search/filter controls
- Inline status indicators

### Secondary Panel

If space allows, include a right-side panel or collapsible area for:

- Selected route details
- Destination URL
- Notes
- Last updated time
- Actions: edit, disable, delete

## Route Table Design

The route table is the primary operational surface.

### Columns

- Subdomain
- Full hostname
- Destination
- Status
- Updated time
- Actions

### Table Behavior

- Search by subdomain or destination
- Filter by enabled/disabled
- Sort by updated time
- Highlight the active or selected row
- Use compact rows without losing readability

### Row Actions

- Edit
- Disable/enable
- Delete with confirmation

### Empty State

If there are no routes:

- Explain that no routes exist yet
- Show a primary CTA to create the first route
- Keep the empty state informative, not decorative

## Create / Edit Route Flow

Route creation and editing should use a focused modal or drawer.

### Fields

- Subdomain
- Destination URL
- Enabled toggle
- Optional note

### Validation

- Subdomain must be non-empty and DNS-safe
- Destination must be a valid absolute URL
- Duplicate subdomains should be blocked
- Display backend validation errors inline

### UX

- Save button disabled until required fields are valid
- Destructive actions require confirmation
- Keep forms short and direct

## Security Considerations

The frontend should assume this is an admin surface.

### Auth and Session

- Treat the API key like an admin password, not a casual login.
- Keep the auth gate separate from the dashboard UI.
- Clear auth state on logout and on failed validation.

### Data Handling

- Do not cache route data longer than needed.
- Refresh the route list after create, update, delete, or disable actions.
- Show loading states while fetching or mutating.

### Safe Defaults

- Disable unsafe form submission states.
- Confirm destructive actions.
- Show exact backend failures when possible, but avoid leaking secrets.

### Operational Safety

- Display API availability clearly.
- If the backend returns 401, immediately return the user to the lock screen.
- If the backend returns 5xx, keep the last known route list visible with a warning rather than blanking the page.

## Suggested Page Composition

The frontend should be split into focused pieces instead of one large screen file.

- `App` or root shell
  - Determines whether the user is locked or unlocked
  - Owns session state

- `AuthGate`
  - API-key input form
  - Validation and submit flow

- `DashboardShell`
  - Top bar
  - Summary strip
  - Route management layout

- `RouteTable`
  - Search, sort, filter, and row actions

- `RouteForm`
  - Create/edit modal or drawer

- `StatusBanner`
  - Backend errors, connection state, and notices

## Backend Integration

The frontend should talk to the Go backend over the same service origin when possible.

### Required API Usage

- `GET /api/routes`
- `POST /api/routes`
- `PUT /api/routes/{id}`
- `DELETE /api/routes/{id}`

### Auth Header

- `X-API-Key: <key>`
  or
- `Authorization: Bearer <key>`

### Request Strategy

- Store the key after successful unlock.
- Attach the key to every CRUD request.
- If a request returns 401, force re-authentication.

## Responsive Rules

### Mobile

- Single column
- Full-width buttons
- Route table becomes stacked cards if needed
- Keep the auth gate simple and centered

### Tablet

- Summary cards in two columns
- Route table remains primary
- Modal or drawer forms are full-height and easy to reach

### Desktop

- Use a wider dashboard with strong spacing rhythm
- Keep the route table central
- Use a side panel for detail and action context if helpful

## Visual Acceptance Criteria

The frontend is done when:

- The first screen is an API-key gate
- No dashboard content appears before authentication
- The dashboard clearly shows route health and CRUD controls
- The UI is usable on mobile and desktop
- The design looks like a production admin tool, not a placeholder

## Implementation Order

1. Build the API-key gate and session handling.
2. Build the dashboard shell and summary metrics.
3. Add the route table with fetch, search, and refresh.
4. Add create/edit/delete flows with validation.
5. Add error handling, logout, and 401 fallback.
6. Polish responsive layout and empty states.

