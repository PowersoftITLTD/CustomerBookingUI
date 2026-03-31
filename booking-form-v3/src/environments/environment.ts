// ─────────────────────────────────────────────────────────
// DEVELOPMENT environment
// The suiteletUrl is injected at runtime by NetSuite when
// served via Suitelet (window.__NS_CONFIG__.suiteletUrl).
// This fallback is only used during local `ng serve`.
// ─────────────────────────────────────────────────────────
export const environment = {
  production: false,

  // ── Local dev mock endpoint (use a simple Express/json-server) ──
  devSuiteletUrl: 'http://localhost:3000/api/booking',

  // ── NetSuite File Cabinet base URL ──────────────────────────────
  // Set this AFTER uploading dist/ files to File Cabinet.
  // Format: https://<accountId>.app.netsuite.com/<folderPath>/
  // Example: https://1234567.app.netsuite.com/25south-booking-form/
  fileCabinetBaseUrl: 'https://YOUR_ACCOUNT_ID.app.netsuite.com/YOUR_FOLDER_PATH/'
};
