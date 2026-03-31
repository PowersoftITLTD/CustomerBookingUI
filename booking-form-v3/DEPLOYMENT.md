# 25 South Booking Form — v3 Deployment Guide
## Both Errors Fixed

---

## Error 1 Fixed — MIME Type (module script / text/html)

**What was wrong:**
Angular's production build emits `<script type="module" src="main.abc.js">`.
When the browser fetched `main.abc.js`, the request went back through the Suitelet
(because the path was relative to the Suitelet URL). The Suitelet returned `text/html`
for everything it couldn't recognise — browser rejected it as wrong MIME type.

**Fix applied in `25south_booking_suitelet.js` → `onGet()`:**
```javascript
// Inject <base href> pointing to File Cabinet folder BEFORE </head>
// Now browser fetches all JS/CSS directly from File Cabinet
// which correctly returns application/javascript MIME type
const injection = `<base href="${FILE_CABINET_BASE_URL}"/>  ...`;
html = html.replace(/<base[^>]*>/gi, '');     // remove Angular's default base
html = html.replace('</head>', injection + '\n</head>');
```

---

## Error 2 Fixed — https.HostType.APPLICATION

**What was wrong:**
`https.HostType.APPLICATION` is a SuiteScript server-side API for resolving
NetSuite host URLs. It was being used to build the Suitelet's own POST URL.
It is not available in Angular (browser-side) and causes confusion.

**Fix applied in `25south_booking_suitelet.js` → `onGet()`:**
```javascript
// OLD — uses https module, verbose, confusing
const suiteletUrl = https.resolvePath({
  hostType: https.HostType.APPLICATION,
  relative: `/app/site/hosting/scriptlet.nl?script=...`
});

// NEW — uses runtime directly, clean, no imports needed
const script      = runtime.getCurrentScript();
const suiteletUrl = '/app/site/hosting/scriptlet.nl'
  + '?script=' + script.id
  + '&deploy=' + script.deploymentId;
```
This root-relative URL is then injected into `window.__NS_CONFIG__.suiteletUrl`
and Angular reads it automatically — zero hardcoding, zero auth needed.

---

## Step-by-Step Deployment

### STEP 1 — Build Angular

```bash
cd 25south-booking-form
npm install
ng build --configuration production
# Output → dist/25south-booking-form/
```

### STEP 2 — Create File Cabinet Folder

```
Documents → File Cabinet → New Folder
  Name:   25south-booking-form
  Access: Private (authenticated users only)
```

Note the folder's **internal ID** from the URL after saving: `?id=XXXXX`

### STEP 3 — Upload Angular Files

Upload ALL files from `dist/25south-booking-form/`:
- `index.html`
- `main.xxxxxxxx.js`
- `polyfills.xxxxxxxx.js`
- `styles.xxxxxxxx.css`
- `favicon.ico`
- Any other generated files

For each file:
- Available Without Login: **No**
- Check "Online" / Available

### STEP 4 — Get the File Cabinet Base URL

1. Click on any uploaded `.js` file → Properties
2. Copy the full URL e.g.:
   `https://1234567.app.netsuite.com/25south-booking-form/main.abc.js`
3. Remove the filename, keep trailing slash:
   `https://1234567.app.netsuite.com/25south-booking-form/`

This is your `FILE_CABINET_BASE_URL`.

Also note the **internal ID** of `index.html` (shown in Properties → Internal ID).
This is your `ANGULAR_INDEX_FILE_ID`.

### STEP 5 — Create a KYC Upload Folder

```
Documents → File Cabinet → New Folder
  Name:   25south-kyc-uploads
```
Note the folder internal ID → `KYC_UPLOAD_FOLDER_ID`.

### STEP 6 — Update the Suitelet Config

Open `netsuite-suitelet/25south_booking_suitelet.js` and update:

```javascript
const FILE_CABINET_BASE_URL  = 'https://YOUR_ACCOUNT_ID.app.netsuite.com/25south-booking-form/';
const ANGULAR_INDEX_FILE_ID  = 98765;   // ← index.html internal ID
const KYC_UPLOAD_FOLDER_ID   = 12345;   // ← KYC uploads folder ID
```

### STEP 7 — Upload the Suitelet

```
Documents → File Cabinet → SuiteScripts folder (or create SuiteScripts/25South/)
Upload: netsuite-suitelet/25south_booking_suitelet.js
```

### STEP 8 — Create the Script Record

```
Customization → Scripting → Scripts → New

  Script Type:   Suitelet
  Name:          25 South Booking Form
  ID:            _25south_booking_form
  Script File:   25south_booking_suitelet.js
  Function Name: onRequest
```
Save.

### STEP 9 — Deploy

```
Script record → Deployments tab → New

  Title:      25 South Booking Form
  Status:     Released
  Log Level:  Debug  (use Error in production)
  Audience:   Roles that should access the form
```
Save → note the **Suitelet URL** from the deployment record.

### STEP 10 — Add to NetSuite Menu (Optional)

```
Setup → Company → Menu/Navigation → Add Custom Link
  Label: Booking Form — 25 South
  URL:   [paste Suitelet deployment URL]
```

### STEP 11 — Create Custom Record Type & Fields

Run `netsuite-setup/25south_setup_records.js` as a one-time Scheduled Script.
It logs all 90+ field definitions to the Script Execution Log.

Then create the record type and fields manually:
```
Customization → Lists, Records & Fields → Record Types → New
  Name: 25 South Booking
  ID:   _25south_booking
```

---

## Data Flow Summary

```
Authenticated NetSuite User opens Suitelet URL
          ↓
GET → Suitelet loads index.html from File Cabinet
      Injects <base href="https://ACCOUNT.app.netsuite.com/FOLDER/">  ← FIX 1
      Injects window.__NS_CONFIG__.suiteletUrl (no HostType)           ← FIX 2
      Returns HTML
          ↓
Browser loads JS/CSS directly from File Cabinet (correct MIME types ✓)
Angular bootstraps, reads window.__NS_CONFIG__
          ↓
User fills form → clicks Submit
          ↓
POST JSON → Suitelet (same URL, NetSuite session = authenticated ✓)
          ↓
Suitelet creates:
  ├── Customer Record (custentity_25s_* fields)
  ├── Custom Booking Record (custrecord_25s_* fields, linked to Customer)
  └── KYC files attached to both records in File Cabinet
          ↓
Returns { success, customerId, bookingId }
Angular shows success screen ✓
```

---

## Files Reference

| File | Purpose |
|---|---|
| `netsuite-suitelet/25south_booking_suitelet.js` | **Deploy this** — serves Angular + saves records |
| `netsuite-setup/25south_setup_records.js` | Run once — logs all field definitions |
| `src/app/services/netsuite.service.ts` | Angular POST service — reads injected URL |
| `src/environments/environment.ts` | Local dev config only |

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| MIME type error on JS files | Assets loading via Suitelet | Verify `FILE_CABINET_BASE_URL` is correct and ends with `/` |
| Blank page after loading | Angular bootstrap error | Open browser console, check for missing file 404s |
| index.html not found | Wrong `ANGULAR_INDEX_FILE_ID` | Get Internal ID from File Cabinet → index.html → Properties |
| POST fails / 403 | Session expired | User needs to re-login to NetSuite |
| Record not created | Custom fields missing | Run setup script, create all custrecord_25s_* fields |
| Files not attached | Wrong `KYC_UPLOAD_FOLDER_ID` | Check folder ID in File Cabinet |
