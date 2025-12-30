/**
 * PDF Generation Utilities
 *
 * Uses pdf-lib to generate professional PDF reports
 * with embedded images and proper pagination.
 */

import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { ORG_CONFIG } from '../config/org.js';
import { IMAGE_CONFIG } from './image.js';

// Page dimensions (US Letter)
const PAGE_WIDTH = 612;  // 8.5 inches * 72 points
const PAGE_HEIGHT = 792; // 11 inches * 72 points

// Activity configuration (must match main.js)
const ACTIVITY_CONFIG = [
  {
    number: 1,
    title: 'Home Country Cultural Activity',
    prompt: 'Describe an activity for your classroom, larger host school or host district population, or the community at large designed to give an overview of the history, traditions, heritage, culture, economy, educational system, and/or other attributes of your home country.',
    hasExtraFields: false
  },
  {
    number: 2,
    title: 'Virtual Exchange Activity',
    prompt: 'Describe an activity that involves U.S student dialogue with schools or students in another country, preferably in the home school, through virtual exchange – in other words, through the Internet. If unsure what this means, contact the Cordell Hull Foundation for a more detailed handout (explanation).',
    hasExtraFields: true
  },
  {
    number: 3,
    title: 'Cross-Cultural Outreach Activity',
    prompt: 'Exchange teachers placed at International schools must conduct at least one cross-cultural activity per academic year outside the host school in nearby schools or communities where international opportunities may be more limited.',
    hasExtraFields: false,
    optional: true
  }
];

/**
 * PDF Generator Class
 * Handles the creation of the Cultural Activities Report PDF
 */
export class PDFGenerator {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = null;
    this.currentY = 0;
    this.font = null;
    this.fontBold = null;
    this.margins = ORG_CONFIG.pdf.margins;
    this.colors = ORG_CONFIG.pdf.colors;
    this.fonts = ORG_CONFIG.pdf.fonts;
    this.contentWidth = PAGE_WIDTH - this.margins.left - this.margins.right;
  }

  /**
   * Initialize the PDF document
   */
  async init() {
    this.pdfDoc = await PDFDocument.create();
    this.pdfDoc.setTitle(ORG_CONFIG.pdf.title);
    this.pdfDoc.setAuthor(ORG_CONFIG.pdf.author);
    this.pdfDoc.setSubject(ORG_CONFIG.pdf.subject);
    this.pdfDoc.setCreationDate(new Date());

    // Load standard fonts
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add first page
    this.addNewPage();
  }

  /**
   * Add a new page to the document
   */
  addNewPage() {
    this.currentPage = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.currentY = PAGE_HEIGHT - this.margins.top;
    return this.currentPage;
  }

  /**
   * Check if we need a new page and add one if necessary
   * @param {number} neededHeight - Height needed for next element
   * @returns {boolean} - True if new page was added
   */
  addPageIfNeeded(neededHeight) {
    if (this.currentY - neededHeight < this.margins.bottom) {
      this.addNewPage();
      return true;
    }
    return false;
  }

  /**
   * Draw text with word wrapping
   * @param {string} text - Text to draw
   * @param {number} x - X position
   * @param {number} maxWidth - Maximum width for wrapping
   * @param {object} options - Drawing options
   * @returns {number} - Height used
   */
  drawWrappedText(text, x, maxWidth, options = {}) {
    const {
      fontSize = this.fonts.body,
      font = this.font,
      color = this.colors.text,
      lineHeight = 1.3,
      align = 'left'
    } = options;

    if (!text || text.trim() === '') return 0;

    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    // Break text into lines that fit within maxWidth
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    const actualLineHeight = fontSize * lineHeight;
    let totalHeight = lines.length * actualLineHeight;

    // Check if we need a new page for all the text
    if (this.currentY - totalHeight < this.margins.bottom) {
      // Try to fit at least some lines on current page
      const availableHeight = this.currentY - this.margins.bottom;
      const linesOnCurrentPage = Math.floor(availableHeight / actualLineHeight);

      if (linesOnCurrentPage < 2) {
        // Not enough space, start fresh on new page
        this.addNewPage();
      }
    }

    // Draw each line
    for (const line of lines) {
      // Check if we need a new page before drawing each line
      if (this.currentY - actualLineHeight < this.margins.bottom) {
        this.addNewPage();
      }

      let drawX = x;
      if (align === 'center') {
        const lineWidth = font.widthOfTextAtSize(line, fontSize);
        drawX = x + (maxWidth - lineWidth) / 2;
      } else if (align === 'right') {
        const lineWidth = font.widthOfTextAtSize(line, fontSize);
        drawX = x + maxWidth - lineWidth;
      }

      this.currentPage.drawText(line, {
        x: drawX,
        y: this.currentY - fontSize,
        size: fontSize,
        font: font,
        color: rgb(color.r, color.g, color.b)
      });

      this.currentY -= actualLineHeight;
    }

    return totalHeight;
  }

  /**
   * Draw a section heading
   * @param {string} text - Heading text
   * @param {number} level - Heading level (1 = main, 2 = sub)
   */
  drawHeading(text, level = 1) {
    const fontSize = level === 1 ? this.fonts.heading : this.fonts.subheading;
    const spaceAbove = level === 1 ? 20 : 15;
    const spaceBelow = level === 1 ? 10 : 8;

    // Ensure enough space for heading
    this.addPageIfNeeded(spaceAbove + fontSize + spaceBelow);

    this.currentY -= spaceAbove;

    this.currentPage.drawText(text, {
      x: this.margins.left,
      y: this.currentY - fontSize,
      size: fontSize,
      font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });

    this.currentY -= fontSize + spaceBelow;
  }

  /**
   * Draw a labeled field (label: value format)
   * @param {string} label - Field label
   * @param {string} value - Field value
   */
  drawField(label, value) {
    const labelWidth = this.fontBold.widthOfTextAtSize(label + ': ', this.fonts.body);
    const lineHeight = this.fonts.body * 1.4;

    this.addPageIfNeeded(lineHeight);

    // Draw label
    this.currentPage.drawText(label + ': ', {
      x: this.margins.left,
      y: this.currentY - this.fonts.body,
      size: this.fonts.body,
      font: this.fontBold,
      color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
    });

    // Draw value (wrapped if needed)
    const valueX = this.margins.left + labelWidth;
    const valueMaxWidth = this.contentWidth - labelWidth;

    // Simple case: value fits on one line
    const valueWidth = this.font.widthOfTextAtSize(value, this.fonts.body);
    if (valueWidth <= valueMaxWidth) {
      this.currentPage.drawText(value, {
        x: valueX,
        y: this.currentY - this.fonts.body,
        size: this.fonts.body,
        font: this.font,
        color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
      });
      this.currentY -= lineHeight;
    } else {
      // Value needs wrapping - draw on next line
      this.currentY -= lineHeight;
      this.drawWrappedText(value, this.margins.left + 20, this.contentWidth - 20);
    }
  }

  /**
   * Draw an image at current position
   * @param {Uint8Array} imageBytes - Image data
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height (optional)
   * @returns {number} - Height used
   */
  async drawImage(imageBytes, maxWidth, maxHeight = null) {
    const jpgImage = await this.pdfDoc.embedJpg(imageBytes);

    // Calculate dimensions maintaining aspect ratio
    const aspectRatio = jpgImage.width / jpgImage.height;
    let drawWidth = maxWidth;
    let drawHeight = drawWidth / aspectRatio;

    if (maxHeight && drawHeight > maxHeight) {
      drawHeight = maxHeight;
      drawWidth = drawHeight * aspectRatio;
    }

    // Check if image fits on current page
    if (this.addPageIfNeeded(drawHeight + 10)) {
      // Added new page
    }

    this.currentPage.drawImage(jpgImage, {
      x: this.margins.left,
      y: this.currentY - drawHeight,
      width: drawWidth,
      height: drawHeight
    });

    this.currentY -= drawHeight + 10;

    return drawHeight + 10;
  }

  /**
   * Draw a grid of images
   * @param {Array<Uint8Array>} images - Array of image data
   * @param {number} columns - Number of columns
   * @param {number} gap - Gap between images
   */
  async drawImageGrid(images, columns = 2, gap = 10) {
    if (images.length === 0) return;

    const imageWidth = (this.contentWidth - gap * (columns - 1)) / columns;
    const imageHeight = imageWidth / (IMAGE_CONFIG.width / IMAGE_CONFIG.height);

    let col = 0;
    let rowImages = [];

    for (let i = 0; i < images.length; i++) {
      rowImages.push(images[i]);
      col++;

      if (col === columns || i === images.length - 1) {
        // Draw this row
        const rowHeight = imageHeight + gap;

        // Check if row fits on current page
        if (this.addPageIfNeeded(rowHeight)) {
          // New page added
        }

        for (let j = 0; j < rowImages.length; j++) {
          const jpgImage = await this.pdfDoc.embedJpg(rowImages[j]);
          const x = this.margins.left + j * (imageWidth + gap);

          this.currentPage.drawImage(jpgImage, {
            x: x,
            y: this.currentY - imageHeight,
            width: imageWidth,
            height: imageHeight
          });
        }

        this.currentY -= rowHeight;
        rowImages = [];
        col = 0;
      }
    }
  }

  /**
   * Draw a horizontal line
   */
  drawLine() {
    this.addPageIfNeeded(15);
    this.currentY -= 5;

    this.currentPage.drawLine({
      start: { x: this.margins.left, y: this.currentY },
      end: { x: PAGE_WIDTH - this.margins.right, y: this.currentY },
      thickness: 0.5,
      color: rgb(this.colors.lightGray.r, this.colors.lightGray.g, this.colors.lightGray.b)
    });

    this.currentY -= 10;
  }

  /**
   * Add vertical space
   * @param {number} space - Space in points
   */
  addSpace(space) {
    this.currentY -= space;
  }

  /**
   * Draw the organization header (logo + contact info)
   * @param {Uint8Array} logoBytes - Logo image data (optional)
   */
  async drawOrgHeader(logoBytes = null) {
    const headerHeight = 80;

    // Draw logo if available
    if (logoBytes) {
      try {
        // Try PNG first, then JPEG
        let logoImage;
        try {
          logoImage = await this.pdfDoc.embedPng(logoBytes);
        } catch {
          logoImage = await this.pdfDoc.embedJpg(logoBytes);
        }

        const logoMaxHeight = 60;
        const logoMaxWidth = 150;
        const logoAspect = logoImage.width / logoImage.height;

        let logoWidth = logoMaxWidth;
        let logoHeight = logoWidth / logoAspect;

        if (logoHeight > logoMaxHeight) {
          logoHeight = logoMaxHeight;
          logoWidth = logoHeight * logoAspect;
        }

        this.currentPage.drawImage(logoImage, {
          x: this.margins.left,
          y: this.currentY - logoHeight,
          width: logoWidth,
          height: logoHeight
        });
      } catch (e) {
        console.warn('Could not embed logo:', e);
      }
    }

    // Draw organization name and address on the right
    const rightX = PAGE_WIDTH - this.margins.right;
    let textY = this.currentY - 12;

    // Organization name
    const nameWidth = this.fontBold.widthOfTextAtSize(ORG_CONFIG.name, 11);
    this.currentPage.drawText(ORG_CONFIG.name, {
      x: rightX - nameWidth,
      y: textY,
      size: 11,
      font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    textY -= 14;

    // Address lines
    for (const line of ORG_CONFIG.address) {
      const lineWidth = this.font.widthOfTextAtSize(line, 9);
      this.currentPage.drawText(line, {
        x: rightX - lineWidth,
        y: textY,
        size: 9,
        font: this.font,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      textY -= 12;
    }

    // Website
    const webWidth = this.font.widthOfTextAtSize(ORG_CONFIG.website, 9);
    this.currentPage.drawText(ORG_CONFIG.website, {
      x: rightX - webWidth,
      y: textY,
      size: 9,
      font: this.font,
      color: rgb(this.colors.accent.r, this.colors.accent.g, this.colors.accent.b)
    });

    this.currentY -= headerHeight;
    this.drawLine();
  }

  /**
   * Draw the document title
   * @param {string} title - Main title
   */
  drawTitle(title) {
    this.addSpace(10);

    const titleWidth = this.fontBold.widthOfTextAtSize(title, this.fonts.title);
    const centerX = (PAGE_WIDTH - titleWidth) / 2;

    this.currentPage.drawText(title, {
      x: centerX,
      y: this.currentY - this.fonts.title,
      size: this.fonts.title,
      font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });

    this.currentY -= this.fonts.title + 20;
  }

  /**
   * Draw student distribution table
   * @param {Array<{label: string, percent: number}>} categories
   */
  drawDistributionTable(categories) {
    this.drawHeading('Student Distribution', 2);

    const colWidth = this.contentWidth / 2;
    const rowHeight = 20;
    let col = 0;
    let startY = this.currentY;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      if (cat.percent === 0) continue;

      const x = this.margins.left + (col * colWidth);

      // Check if we need new page
      if (this.currentY - rowHeight < this.margins.bottom) {
        this.addNewPage();
        startY = this.currentY;
      }

      // Draw category label and percentage
      const text = `${cat.label}: ${cat.percent}%`;
      this.currentPage.drawText(text, {
        x: x + 10,
        y: this.currentY - 14,
        size: this.fonts.body,
        font: this.font,
        color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
      });

      // Draw simple bar
      const barWidth = (cat.percent / 100) * (colWidth - 80);
      this.currentPage.drawRectangle({
        x: x + 10,
        y: this.currentY - rowHeight + 2,
        width: barWidth,
        height: 4,
        color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
      });

      col++;
      if (col === 2) {
        col = 0;
        this.currentY -= rowHeight;
      }
    }

    if (col !== 0) {
      this.currentY -= rowHeight;
    }

    this.addSpace(10);
  }

  /**
   * Draw an activity section
   * @param {object} activity - Activity data
   * @param {number} index - Activity number
   * @param {object} config - Activity configuration with prompts
   */
  async drawActivity(activity, index, config) {
    // Start each activity on a new page
    this.addNewPage();

    // Activity heading
    this.drawHeading(`Activity #${index}`, 1);

    // Activity details
    this.drawField('Date', activity.date);
    this.drawField('Location', activity.location);
    this.drawField('Participants', activity.participants);

    // Extra fields for Activity 2 (Virtual Exchange)
    if (activity.typeIndex === 1) {
      const mediumDisplay = activity.medium === 'Other'
        ? `Other: ${activity.mediumOther}`
        : activity.medium;
      this.drawField('Communication Medium', mediumDisplay);
      this.drawField('Foreign Country', activity.foreignCountry);
      this.drawField('Foreign School', activity.foreignSchoolName);
      this.drawField('School Address', activity.foreignSchoolAddress);
    }

    this.addSpace(10);

    // Description
    this.currentPage.drawText('Description:', {
      x: this.margins.left,
      y: this.currentY - this.fonts.body,
      size: this.fonts.body,
      font: this.fontBold,
      color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
    });
    this.currentY -= this.fonts.body * 1.5;

    this.drawWrappedText(activity.description, this.margins.left + 10, this.contentWidth - 10);

    this.addSpace(10);

    // Impact
    this.currentPage.drawText('Estimated Impact:', {
      x: this.margins.left,
      y: this.currentY - this.fonts.body,
      size: this.fonts.body,
      font: this.fontBold,
      color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
    });
    this.currentY -= this.fonts.body * 1.5;

    this.drawWrappedText(activity.impact, this.margins.left + 10, this.contentWidth - 10);

    this.addSpace(15);

    // Photos
    if (activity.photos && activity.photos.length > 0) {
      this.currentPage.drawText('Activity Photos:', {
        x: this.margins.left,
        y: this.currentY - this.fonts.body,
        size: this.fonts.body,
        font: this.fontBold,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      this.currentY -= this.fonts.body * 1.5 + 5;

      // Convert blobs to Uint8Arrays and draw grid
      const imageBytes = [];
      for (const photo of activity.photos) {
        const arrayBuffer = await photo.blob.arrayBuffer();
        imageBytes.push(new Uint8Array(arrayBuffer));
      }

      // Use 2 columns for 3+ images, 1 column for 1-2 images
      const columns = imageBytes.length <= 2 ? 1 : 2;
      await this.drawImageGrid(imageBytes, columns, 10);
    }

    this.drawLine();
  }

  /**
   * Generate the complete PDF
   * @param {object} report - Complete report data
   * @param {function} onProgress - Progress callback
   * @returns {Uint8Array} - PDF bytes
   */
  async generate(report, onProgress = () => {}) {
    onProgress('Initializing PDF...');
    await this.init();

    // Fetch header image (decorative banner) if available
    let headerImageBytes = null;
    try {
      const headerResponse = await fetch(ORG_CONFIG.headerImagePath);
      if (headerResponse.ok) {
        const headerBlob = await headerResponse.blob();
        headerImageBytes = new Uint8Array(await headerBlob.arrayBuffer());
      }
    } catch (e) {
      console.warn('Could not load header image:', e);
    }

    // Draw header image at the very top of the first page
    if (headerImageBytes) {
      onProgress('Adding header image...');
      await this.drawImage(headerImageBytes, this.contentWidth, 150);
      this.addSpace(10);
    }

    // Title
    this.drawTitle('Cultural Activities Annual Report');

    // Header photo (at the top, before general info)
    if (report.headerPhoto && report.headerPhoto.blob) {
      onProgress('Embedding header photo...');
      const headerImageBytes = new Uint8Array(await report.headerPhoto.blob.arrayBuffer());
      await this.drawImage(headerImageBytes, this.contentWidth, 250);
    }

    this.addSpace(10);

    // General Information
    this.drawHeading('General Information', 2);
    this.drawField('School Year', report.schoolYear);
    this.drawField('Instructor Name', report.instructorName);
    this.drawField('SEVIS ID', report.sevisId);
    this.drawField('School Type', report.schoolType);

    this.addSpace(15);

    // Student Distribution
    if (report.distribution && report.distribution.categories) {
      this.drawDistributionTable(report.distribution.categories);
    }

    // Activities
    for (let i = 0; i < report.activities.length; i++) {
      onProgress(`Processing activity ${i + 1} of ${report.activities.length}...`);
      const activity = report.activities[i];
      const config = ACTIVITY_CONFIG[activity.typeIndex] || ACTIVITY_CONFIG[i];
      await this.drawActivity(activity, i + 1, config);
    }

    onProgress('Finalizing PDF...');

    // Save and return the PDF bytes
    return await this.pdfDoc.save();
  }
}

/**
 * Generate PDF from report data
 * @param {object} report - Complete report data
 * @param {function} onProgress - Progress callback
 * @returns {Uint8Array} - PDF bytes
 */
export async function generatePDF(report, onProgress = () => {}) {
  const generator = new PDFGenerator();
  return await generator.generate(report, onProgress);
}

/**
 * Generate a sanitized filename for the PDF
 * @param {string} schoolYear - School year
 * @param {string} instructorName - Full instructor name
 * @returns {string} - Sanitized filename
 */
export function generateFilename(schoolYear, instructorName) {
  // Extract last name (last word of name)
  const nameParts = instructorName.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1] || 'Unknown';

  // Sanitize: remove special characters, replace spaces with underscores
  const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');

  const sanitizedYear = sanitize(schoolYear);
  const sanitizedName = sanitize(lastName);

  return `Cultural_Activities_Report_${sanitizedYear}_${sanitizedName}.pdf`;
}

/**
 * Trigger browser download of PDF
 * @param {Uint8Array} pdfBytes - PDF data
 * @param {string} filename - Filename for download
 */
export function downloadPDF(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default {
  PDFGenerator,
  generatePDF,
  generateFilename,
  downloadPDF
};
