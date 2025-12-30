# Cultural Activities Annual Report

A static web application for J-1 Cultural Teachers to generate PDF reports of their cultural activities throughout the school year.

## Features

- **Step-by-step wizard interface** for easy form completion
- **Client-side image processing** - all images are normalized to 16:9 landscape (1600×900)
- **Professional PDF generation** using pdf-lib
- **No backend required** - runs entirely in the browser
- **GitHub Pages compatible** - deploy as a simple static site

## Quick Start

### Option 1: Simple HTTP Server (Recommended for Development)

Since the app uses ES modules, you need to serve it via HTTP (not file://):

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 2: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

## Project Structure

```
cultural-activity-report/
├── index.html              # Main HTML file
├── styles.css              # Application styles
├── main.js                 # Main application logic
├── config/
│   └── org.js              # Organization constants (logo, name, address)
├── lib/
│   ├── image.js            # Image processing utilities
│   └── pdf.js              # PDF generation with pdf-lib
├── assets/
│   └── logo-placeholder.svg # Placeholder logo (replace with official)
└── README.md               # This file
```

## Customization

### Replacing the Logo

1. Replace `assets/logo-placeholder.svg` with your official logo
2. Supported formats: SVG, PNG, or JPEG
3. Update the path in `config/org.js` if using a different filename:

```javascript
logoPath: './assets/your-logo.png',
```

### Editing Organization Constants

Edit `config/org.js` to update:

- Organization name
- Address block
- Contact information
- Website
- PDF styling (colors, fonts, margins)

```javascript
export const ORG_CONFIG = {
  name: 'Your Organization Name',
  logoPath: './assets/your-logo.svg',
  address: [
    '123 Main Street',
    'Suite 100',
    'City, State ZIP'
  ],
  phone: '(555) 123-4567',
  email: 'info@example.org',
  website: 'www.example.org',
  // ... PDF settings
};
```

## Deployment to GitHub Pages

### Method 1: Direct Deploy (Simplest)

1. Push all files to a GitHub repository
2. Go to repository **Settings** → **Pages**
3. Under "Source", select `main` branch and `/ (root)` folder
4. Click **Save**
5. Your site will be available at `https://[username].github.io/[repo-name]/`

### Method 2: Using GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

## Form Sections

### 1. General Information
- School Year (auto-detected based on current date)
- Instructor Full Name
- SEVIS ID (validation included)
- School Type/Curriculum (with suggestions)
- Header Photo (required, processed to 16:9)

### 2. Student Distribution
- Percentage breakdown by nationality
- Supports custom categories
- Must total exactly 100%

### 3. Activities (1-5 activities)
- Date, Location, Participants
- Title and Description
- Estimated Impact
- 1-6 photos per activity

### 4. Review & Generate
- Full preview of all entered data
- Validates all fields before generation
- Generates downloadable PDF

## Technical Details

### Image Processing
All uploaded images are:
1. Loaded into an HTML5 Canvas
2. Center-cropped to 16:9 aspect ratio
3. Scaled to 1600×900 pixels
4. Re-encoded as JPEG at 80% quality
5. Displayed with dimensions and file size

### PDF Generation
- Uses [pdf-lib](https://pdf-lib.js.org/) loaded via ESM CDN
- Standard Helvetica font (no custom font embedding)
- US Letter size (8.5" × 11")
- Automatic page breaks for activities
- Images embedded directly (no external links)

### Browser Compatibility
- Modern Chrome (90+)
- Modern Firefox (88+)
- Modern Safari (14+)
- Modern Edge (90+)

## Output

The generated PDF includes:
- Organization header with logo and contact info
- Report title and general information
- Header photo (large, 16:9)
- Student distribution table with visual bars
- All activities with photos in grid layout

**Filename format:** `Cultural_Activities_Report_[SchoolYear]_[LastName].pdf`

## Limitations

- No data persistence (refresh loses all data)
- No draft saving
- Single session use only
- Requires modern browser with ES module support

## License

This project is provided as-is for educational and organizational use.

## Support

For technical issues:
1. Check browser console for errors (F12 → Console)
2. Ensure you're serving via HTTP (not file://)
3. Try a different browser to isolate the issue
