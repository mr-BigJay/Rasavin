# Rasavin architecture decisions

## Non-negotiable product rules
1. Free features and all local patient data remain accessible after a paid subscription expires.
2. Security fixes and bug-fix updates are free for everyone.
3. The desktop app works without an account or network connection.
4. Cloud sync, AI and SMS are opt-in, separately metered services. Do not transmit patient data without explicit informed consent.
5. Never use client-side feature flags as the sole authorization for chargeable cloud operations.

## Current desktop MVP
- React + TypeScript + Vite for Persian RTL UI.
- Tauri 2 for Windows .exe / .msi.
- SQLite in the Tauri app-data directory through official SQL plugin.
- SQL migrations maintained in Rust. All data mutations use bound parameters.
- Browser dev server runs **ephemeral demo mode**, never stores medical data in localStorage.
- Single local operator only. Auth, audit trail, backups, encryption and multi-user access are **not implemented** yet. Do not use with real patient records until they are completed and audited.

## Planned modules
- Entitlements: locally cached signed claims for offline Pro features; server-verification for cloud/SMS/AI.
- API: TypeScript/NestJS multi-tenant backend; PostgreSQL tenant isolation.
- Cloud: opt-in sync with conflict handling and explicit data governance.
- SMS: server-side provider integration and prepaid usage quota.
- AI: server-side provider credentials, patient-data minimization, consent and audit.
- Updater: Tauri signed update bundles, HTTPS manifests, user-approved installation, staged releases.

## Updater activation
The application includes updater checks and install UI logic but DOES NOT activate them until the maintainer:
1. Generates and backs up a Tauri update signing key **outside Git**.
2. Adds public key and HTTPS update manifest endpoint to \`src-tauri/tauri.conf.json\` under \`plugins.updater\`.
3. Enables \`bundle.createUpdaterArtifacts\`, configures CI secret \`TAURI_SIGNING_PRIVATE_KEY\`, and publishes signed packages + manifest on a reliable CDN reachable in Iran.
4. Sets \`VITE_RASAVIN_UPDATER=enabled\` in signed production builds.
Never include private signing keys in Git or disable update signature verification.

## Safety gates before production
Secure local backups + restore test; medical data access control; audit log; privacy/consent flow; migration rollback plan; release signing and independent Windows smoke test.
