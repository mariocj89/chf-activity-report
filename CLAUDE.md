# Cultural Activities Annual Report

Static web app (no build step) for J-1 Cultural Teachers to generate PDF reports. Runs entirely in the browser using ES modules and pdf-lib.

## Local Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Must be served over HTTP — `file://` won't work due to ES module imports.

## Versioning

Version is defined in `config/version.js` as the single source of truth. It is displayed in the page footer and included in debug reports.

**When releasing changes**, update both:
1. `APP_VERSION` in `config/version.js`
2. The `?v=` query strings on `<link>` and `<script>` tags in `index.html`

The `?v=` query strings are what actually bust browser caches. They must match the version in `config/version.js`.

## Key Files

- `index.html` — Main page, activity/photo templates
- `main.js` — Wizard logic, state management, validation
- `lib/pdf.js` — PDF generation with pdf-lib (WinAnsi encoding — no raw control characters in drawText)
- `lib/image.js` — Client-side image processing (canvas crop to 16:9)
- `lib/storage.js` — Generic localStorage draft auto-save module (reusable across CHF forms)
- `config/org.js` — Organization branding, PDF styling constants
- `config/version.js` — App version constant
- `styles.css` — All styles

## Auto-save

Drafts are saved to `localStorage` every 30 seconds and on step transitions. On page load, a modal prompts the user to resume or discard. Drafts are cleared after successful PDF download. Photos are not stored (too large for localStorage) — a notice tells users to re-upload them after restoring a draft.

## PDF Generation Notes

- Uses standard Helvetica font (WinAnsi encoding) — text passed to `drawText()` must not contain control characters (`\n`, `\r`, etc.). The `drawField` method sanitizes these; `drawWrappedText` handles them via whitespace splitting.
- Images are embedded as JPEG directly in the PDF.
- Each activity starts on a new page.
