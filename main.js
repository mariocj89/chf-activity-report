/**
 * Cultural Activities Report - Main Application
 *
 * Single-page wizard application for J-1 Teacher cultural activity reports.
 * Handles state management, form validation, and PDF generation.
 */

import { processImageToLandscape16x9, formatFileSize, revokePreviewUrl } from './lib/image.js';
import { generatePDF, generateFilename, downloadPDF } from './lib/pdf.js';

// ========================================
// Application State
// ========================================

/**
 * Main application state object
 * Holds all form data in memory (no persistence)
 */
const report = {
  schoolYear: '',
  instructorName: '',
  schoolType: '',
  headerPhoto: null, // { blob, width, height, previewUrl, bytes }
  distribution: {
    categories: [
      { label: 'American', percent: 0 },
      { label: 'French', percent: 0 },
      { label: 'Spanish', percent: 0 },
      { label: 'Chinese', percent: 0 },
      { label: 'Mixed', percent: 0 },
      { label: 'Other', percent: 0 }
    ]
  },
  activities: [] // Array of activity objects
};

// Current wizard step (1-4)
let currentStep = 1;
const TOTAL_STEPS = 4;

// Activity constraints
const MIN_ACTIVITIES = 2;
const MAX_ACTIVITIES_STANDARD = 2;
const MAX_ACTIVITIES_INTERNATIONAL = 3;
const MIN_PHOTOS = 1;
const MAX_PHOTOS = 6;

// School types that require a third activity
const INTERNATIONAL_SCHOOL_TYPES = ['International', 'Immersion'];

// Activity prompts and titles
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
    hasExtraFields: true // Medium, Country, Foreign school
  },
  {
    number: 3,
    title: 'Cultural Activity 3',
    prompt: 'For INTERNATIONAL or FOREIGN LANGUAGE IMMERSION teachers – all GRADE LEVELS',
    hasExtraFields: false,
    optional: true
  }
];

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initSchoolYearDropdown();
  initDistributionListeners();
  initActivitySection();
  initNavigationButtons();
  initHeaderPhotoUpload();
  initSchoolTypeListener();
  initAutoExpandTextareas();
  initInstructorNameListener();

  // Create default 2 activities
  addActivity(0); // Activity 1
  addActivity(1); // Activity 2

  updateActivityCount();
});

// ========================================
// Header Display Updates
// ========================================

/**
 * Update the header to display instructor name and school year
 */
function updateHeaderDisplay() {
  const nameHeader = document.getElementById('instructorNameHeader');
  const yearDisplay = document.getElementById('schoolYearDisplay');

  if (report.instructorName) {
    nameHeader.textContent = report.instructorName;
  } else {
    nameHeader.textContent = '';
  }

  if (report.schoolYear) {
    const [startYear, endYear] = report.schoolYear.split('-');
    yearDisplay.textContent = `School Year ${startYear} - ${endYear}`;
  } else {
    yearDisplay.textContent = '';
  }
}

/**
 * Initialize listener for instructor name changes
 */
function initInstructorNameListener() {
  const nameInput = document.getElementById('instructorName');

  nameInput.addEventListener('input', (e) => {
    report.instructorName = e.target.value.trim();
    updateHeaderDisplay();
  });

  nameInput.addEventListener('change', (e) => {
    report.instructorName = e.target.value.trim();
    updateHeaderDisplay();
  });
}

// ========================================
// Auto-expanding Textareas
// ========================================

/**
 * Initialize auto-expand behavior for textareas
 */
function initAutoExpandTextareas() {
  // Use event delegation for dynamically created textareas
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('auto-expand')) {
      autoExpandTextarea(e.target);
    }
  });
}

/**
 * Auto-expand a textarea to fit its content
 * @param {HTMLTextAreaElement} textarea
 */
function autoExpandTextarea(textarea) {
  // Reset height to auto to get the correct scrollHeight
  textarea.style.height = 'auto';
  // Set height to scrollHeight to fit content
  textarea.style.height = textarea.scrollHeight + 'px';
}

// ========================================
// School Year Dropdown
// ========================================

/**
 * Calculate current school year and populate dropdown
 * School year runs Sep-Jun, so Dec 2025 = 2025-2026
 */
function initSchoolYearDropdown() {
  const select = document.getElementById('schoolYear');
  const today = new Date();
  const month = today.getMonth(); // 0-11
  const year = today.getFullYear();

  // Determine current school year
  // If month >= 8 (September), we're in year-year+1
  // Otherwise, we're in year-1-year
  let currentSchoolYear;
  if (month >= 8) {
    currentSchoolYear = `${year}-${year + 1}`;
  } else {
    currentSchoolYear = `${year - 1}-${year}`;
  }

  // Generate options: 2025-26 through 2031-32
  const options = [
    '2025-2026',
    '2026-2027',
    '2027-2028',
    '2028-2029',
    '2029-2030',
    '2030-2031',
    '2031-2032'
  ];

  // Populate select
  select.innerHTML = options.map(opt =>
    `<option value="${opt}" ${opt === currentSchoolYear ? 'selected' : ''}>${opt}</option>`
  ).join('');

  // Set initial value in state
  report.schoolYear = currentSchoolYear || options[0];

  // Listen for changes
  select.addEventListener('change', (e) => {
    report.schoolYear = e.target.value;
    updateHeaderDisplay();
  });

  // Initial header display
  updateHeaderDisplay();
}

// ========================================
// Header Photo Upload
// ========================================

function initHeaderPhotoUpload() {
  const input = document.getElementById('headerPhotoInput');
  const placeholder = document.getElementById('headerPhotoPlaceholder');
  const previewContainer = document.getElementById('headerPhotoPreview');
  const processing = document.getElementById('headerPhotoProcessing');
  const removeBtn = previewContainer.querySelector('.btn-remove-image');

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show processing indicator
    placeholder.style.display = 'none';
    previewContainer.style.display = 'none';
    processing.style.display = 'flex';

    try {
      // Process image
      const processed = await processImageToLandscape16x9(file);

      // Clean up old preview URL if exists
      if (report.headerPhoto?.previewUrl) {
        revokePreviewUrl(report.headerPhoto.previewUrl);
      }

      // Store in state
      report.headerPhoto = processed;

      // Update preview
      const img = previewContainer.querySelector('.image-preview');
      img.src = processed.previewUrl;

      const dimensions = previewContainer.querySelector('.image-dimensions');
      dimensions.textContent = `${processed.width} × ${processed.height}`;

      const size = previewContainer.querySelector('.image-size');
      size.textContent = formatFileSize(processed.bytes);

      // Show preview
      processing.style.display = 'none';
      previewContainer.style.display = 'block';

      // Clear error
      clearError('headerPhotoError');

    } catch (error) {
      console.error('Header photo processing failed:', error);
      showError('headerPhotoError', 'Failed to process image. Please try another file.');
      processing.style.display = 'none';
      placeholder.style.display = 'flex';
    }

    // Reset input to allow re-selecting same file
    input.value = '';
  });

  // Remove button handler
  removeBtn.addEventListener('click', () => {
    if (report.headerPhoto?.previewUrl) {
      revokePreviewUrl(report.headerPhoto.previewUrl);
    }
    report.headerPhoto = null;
    previewContainer.style.display = 'none';
    placeholder.style.display = 'flex';
  });
}

// ========================================
// Student Distribution
// ========================================

function initDistributionListeners() {
  const container = document.getElementById('distributionContainer');
  const addBtn = document.getElementById('addCategoryBtn');
  const newCategoryInput = document.getElementById('newCategoryLabel');

  // Listen for changes on distribution inputs
  container.addEventListener('input', (e) => {
    if (e.target.classList.contains('distribution-input')) {
      updateDistributionValue(e.target);
    }
  });

  // Add custom category
  addBtn.addEventListener('click', () => {
    const label = newCategoryInput.value.trim();
    if (label) {
      addDistributionCategory(label);
      newCategoryInput.value = '';
    }
  });

  // Enter key to add category
  newCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });

  // Initial total calculation
  updateDistributionTotal();
}

function updateDistributionValue(input) {
  const category = input.dataset.category;
  let value = parseFloat(input.value) || 0;

  // Clamp value to 0-100
  if (value < 0) value = 0;
  if (value > 100) value = 100;
  input.value = value;

  // Update state
  const cat = report.distribution.categories.find(c => c.label === category);
  if (cat) {
    cat.percent = value;
  }

  updateDistributionTotal();
}

function addDistributionCategory(label) {
  // Check if category already exists
  const exists = report.distribution.categories.some(
    c => c.label.toLowerCase() === label.toLowerCase()
  );

  if (exists) {
    alert('This category already exists.');
    return;
  }

  // Add to state
  report.distribution.categories.push({ label, percent: 0 });

  // Add to DOM
  const container = document.getElementById('distributionContainer');
  const row = document.createElement('div');
  row.className = 'distribution-row custom';
  row.dataset.category = label;
  row.innerHTML = `
    <label>${escapeHtml(label)}</label>
    <div class="input-with-suffix">
      <input type="number" min="0" max="100" step="0.1" value="0"
             class="distribution-input" data-category="${escapeHtml(label)}">
      <span class="suffix">%</span>
    </div>
    <button type="button" class="btn-icon-only btn-remove-category" title="Remove category">✕</button>
  `;

  // Add remove handler
  row.querySelector('.btn-remove-category').addEventListener('click', () => {
    removeDistributionCategory(label);
  });

  container.appendChild(row);
}

function removeDistributionCategory(label) {
  // Remove from state
  const index = report.distribution.categories.findIndex(c => c.label === label);
  if (index > -1) {
    report.distribution.categories.splice(index, 1);
  }

  // Remove from DOM
  const row = document.querySelector(`.distribution-row[data-category="${label}"]`);
  if (row) {
    row.remove();
  }

  updateDistributionTotal();
}

function updateDistributionTotal() {
  const total = report.distribution.categories.reduce((sum, cat) => sum + cat.percent, 0);
  const totalEl = document.getElementById('totalPercentage');
  const statusEl = document.getElementById('totalStatus');
  const containerEl = document.getElementById('distributionTotal');

  totalEl.textContent = `${total.toFixed(1)}%`;

  if (Math.abs(total - 100) < 0.01) {
    containerEl.classList.remove('invalid');
    containerEl.classList.add('valid');
    statusEl.textContent = '✓ Valid';
  } else {
    containerEl.classList.remove('valid');
    containerEl.classList.add('invalid');
    statusEl.textContent = `Must equal 100% (${(100 - total).toFixed(1)}% remaining)`;
  }
}

function getDistributionTotal() {
  return report.distribution.categories.reduce((sum, cat) => sum + cat.percent, 0);
}

// ========================================
// School Type Listener (for conditional third activity)
// ========================================

function initSchoolTypeListener() {
  const schoolTypeInput = document.getElementById('schoolType');

  schoolTypeInput.addEventListener('change', handleSchoolTypeChange);
  schoolTypeInput.addEventListener('input', handleSchoolTypeChange);
}

function handleSchoolTypeChange() {
  const schoolType = document.getElementById('schoolType').value.trim();
  report.schoolType = schoolType;

  const isInternational = INTERNATIONAL_SCHOOL_TYPES.some(
    type => schoolType.toLowerCase().includes(type.toLowerCase())
  );

  updateThirdActivityVisibility(isInternational);
}

function isInternationalSchoolType() {
  const schoolType = report.schoolType || '';
  return INTERNATIONAL_SCHOOL_TYPES.some(
    type => schoolType.toLowerCase().includes(type.toLowerCase())
  );
}

function updateThirdActivityVisibility(isInternational) {
  const addBtn = document.getElementById('addActivityBtn');

  if (isInternational) {
    // Auto-add third activity if not already present
    if (report.activities.length < MAX_ACTIVITIES_INTERNATIONAL) {
      addActivity(2); // Activity 3 (Cross-Cultural Outreach)
    }
    // Hide add button since we auto-add
    addBtn.style.display = 'none';
  } else {
    // Remove third activity if it exists (not international school)
    if (report.activities.length > MAX_ACTIVITIES_STANDARD) {
      removeActivity(2);
    }
    // Hide add button for non-international schools
    addBtn.style.display = 'none';
  }

  updateActivityCount();
}

// ========================================
// Activities Section
// ========================================

function initActivitySection() {
  const addBtn = document.getElementById('addActivityBtn');

  addBtn.addEventListener('click', () => {
    const maxActivities = isInternationalSchoolType() ? MAX_ACTIVITIES_INTERNATIONAL : MAX_ACTIVITIES_STANDARD;
    if (report.activities.length < maxActivities) {
      addActivity(report.activities.length);
      updateActivityCount();
    }
  });

  // Initially hide add button (will be shown for international schools)
  addBtn.style.display = 'none';
}

function addActivity(activityTypeIndex) {
  const config = ACTIVITY_CONFIG[activityTypeIndex];

  // Create activity data with type-specific fields
  const activity = {
    typeIndex: activityTypeIndex,
    date: '',
    location: '',
    participants: '',
    description: '',
    impact: '',
    photos: [], // Array of { blob, width, height, previewUrl, bytes }
    // Extra fields for Activity 2 (Virtual Exchange)
    medium: '',
    mediumOther: '',
    foreignCountry: '',
    foreignSchoolName: '',
    foreignSchoolAddress: ''
  };

  report.activities.push(activity);

  const index = report.activities.length - 1;
  renderActivity(index);

  return activity;
}

function renderActivity(index) {
  const template = document.getElementById('activityTemplate');
  const container = document.getElementById('activitiesContainer');
  const clone = template.content.cloneNode(true);

  const card = clone.querySelector('.activity-card');
  card.dataset.activityIndex = index;

  const activity = report.activities[index];
  const config = ACTIVITY_CONFIG[activity.typeIndex];

  // Set activity number and title
  const numberEl = card.querySelector('.activity-number');
  numberEl.textContent = index + 1;

  const titleEl = card.querySelector('.activity-title-display');
  titleEl.innerHTML = `Activity #<span class="activity-number">${index + 1}</span>`;

  // Set the prompt
  const promptEl = card.querySelector('.activity-prompt');
  promptEl.textContent = config.prompt;

  // Show/hide extra fields for Activity 2
  const extraFieldsContainer = card.querySelector('.activity-extra-fields');
  if (activity.typeIndex === 1) {
    extraFieldsContainer.style.display = 'block';
  } else {
    extraFieldsContainer.style.display = 'none';
  }

  // Show/hide remove button (only for optional third activity)
  const removeBtn = card.querySelector('.btn-remove-activity');
  if (activity.typeIndex === 2) {
    removeBtn.style.display = 'inline-flex';
  } else {
    removeBtn.style.display = 'none';
  }

  // Hide reorder buttons (activities have fixed order now)
  card.querySelector('.btn-move-up').style.display = 'none';
  card.querySelector('.btn-move-down').style.display = 'none';

  // Bind form fields
  bindActivityFormFields(card, index);

  // Bind control buttons
  bindActivityControls(card, index);

  // Bind photo upload
  bindActivityPhotoUpload(card, index);

  container.appendChild(clone);

  updateActivityButtons();
}

function bindActivityFormFields(card, index) {
  const activity = report.activities[index];

  const fields = [
    { class: 'activity-date', prop: 'date' },
    { class: 'activity-location', prop: 'location' },
    { class: 'activity-participants', prop: 'participants' },
    { class: 'activity-description', prop: 'description' },
    { class: 'activity-impact', prop: 'impact' },
    // Extra fields for Activity 2
    { class: 'activity-medium', prop: 'medium' },
    { class: 'activity-medium-other', prop: 'mediumOther' },
    { class: 'activity-foreign-country', prop: 'foreignCountry' },
    { class: 'activity-foreign-school-name', prop: 'foreignSchoolName' },
    { class: 'activity-foreign-school-address', prop: 'foreignSchoolAddress' }
  ];

  fields.forEach(({ class: className, prop }) => {
    const input = card.querySelector(`.${className}`);
    if (input) {
      input.addEventListener('input', () => {
        activity[prop] = input.value;
      });
      input.addEventListener('change', () => {
        activity[prop] = input.value;

        // Handle medium "Other" visibility
        if (className === 'activity-medium') {
          const otherContainer = card.querySelector('.medium-other-container');
          if (input.value === 'Other') {
            otherContainer.style.display = 'block';
          } else {
            otherContainer.style.display = 'none';
          }
        }
      });
    }
  });
}

function bindActivityControls(card, index) {
  const moveUpBtn = card.querySelector('.btn-move-up');
  const moveDownBtn = card.querySelector('.btn-move-down');
  const removeBtn = card.querySelector('.btn-remove-activity');

  moveUpBtn.addEventListener('click', () => moveActivity(index, -1));
  moveDownBtn.addEventListener('click', () => moveActivity(index, 1));
  removeBtn.addEventListener('click', () => removeActivity(index));
}

function bindActivityPhotoUpload(card, activityIndex) {
  const input = card.querySelector('.activity-photos-input');
  const previewGrid = card.querySelector('.activity-photos-preview');
  const processing = card.querySelector('.activity-photos-processing');

  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const activity = report.activities[activityIndex];
    const currentCount = activity.photos.length;
    const remaining = MAX_PHOTOS - currentCount;

    if (remaining <= 0) {
      alert(`Maximum ${MAX_PHOTOS} photos allowed per activity.`);
      input.value = '';
      return;
    }

    // Limit files to remaining slots
    const filesToProcess = files.slice(0, remaining);

    processing.style.display = 'flex';

    try {
      for (const file of filesToProcess) {
        const processed = await processImageToLandscape16x9(file);
        activity.photos.push(processed);
        renderActivityPhoto(card, activityIndex, activity.photos.length - 1);
      }

      // Clear error
      const errorEl = card.querySelector('.activity-photos-error');
      errorEl.textContent = '';

    } catch (error) {
      console.error('Photo processing failed:', error);
      const errorEl = card.querySelector('.activity-photos-error');
      errorEl.textContent = 'Failed to process one or more images.';
    }

    processing.style.display = 'none';
    input.value = '';

    // Hide upload area if max photos reached
    if (activity.photos.length >= MAX_PHOTOS) {
      card.querySelector('.photos-upload-area').style.display = 'none';
    }
  });
}

function renderActivityPhoto(card, activityIndex, photoIndex) {
  const template = document.getElementById('photoPreviewTemplate');
  const previewGrid = card.querySelector('.activity-photos-preview');
  const clone = template.content.cloneNode(true);

  const item = clone.querySelector('.photo-preview-item');
  item.dataset.photoIndex = photoIndex;

  const photo = report.activities[activityIndex].photos[photoIndex];

  const img = item.querySelector('.photo-thumbnail');
  img.src = photo.previewUrl;

  const dimensions = item.querySelector('.photo-dimensions');
  dimensions.textContent = `${photo.width}×${photo.height}`;

  const size = item.querySelector('.photo-size');
  size.textContent = formatFileSize(photo.bytes);

  // Remove button handler
  const removeBtn = item.querySelector('.btn-remove-photo');
  removeBtn.addEventListener('click', () => {
    removeActivityPhoto(activityIndex, photoIndex);
  });

  previewGrid.appendChild(clone);
}

function removeActivityPhoto(activityIndex, photoIndex) {
  const activity = report.activities[activityIndex];
  const photo = activity.photos[photoIndex];

  // Revoke preview URL
  if (photo?.previewUrl) {
    revokePreviewUrl(photo.previewUrl);
  }

  // Remove from state
  activity.photos.splice(photoIndex, 1);

  // Re-render activity photos
  const card = document.querySelector(`.activity-card[data-activity-index="${activityIndex}"]`);
  const previewGrid = card.querySelector('.activity-photos-preview');
  previewGrid.innerHTML = '';

  activity.photos.forEach((_, i) => {
    renderActivityPhoto(card, activityIndex, i);
  });

  // Show upload area if under max
  if (activity.photos.length < MAX_PHOTOS) {
    card.querySelector('.photos-upload-area').style.display = 'block';
  }
}

function moveActivity(currentIndex, direction) {
  const newIndex = currentIndex + direction;

  if (newIndex < 0 || newIndex >= report.activities.length) return;

  // Swap in state
  const temp = report.activities[currentIndex];
  report.activities[currentIndex] = report.activities[newIndex];
  report.activities[newIndex] = temp;

  // Re-render all activities
  reRenderAllActivities();
}

function removeActivity(index) {
  // Only allow removing the third (optional) activity
  if (report.activities.length <= MIN_ACTIVITIES) {
    alert(`Minimum ${MIN_ACTIVITIES} activities required.`);
    return;
  }

  // Only the third activity can be removed
  if (index !== 2) {
    return;
  }

  // Clean up photo preview URLs
  const activity = report.activities[index];
  activity.photos.forEach(photo => {
    if (photo?.previewUrl) {
      revokePreviewUrl(photo.previewUrl);
    }
  });

  // Remove from state
  report.activities.splice(index, 1);

  // Re-render all activities
  reRenderAllActivities();
  updateActivityCount();
}

function reRenderAllActivities() {
  const container = document.getElementById('activitiesContainer');

  // Store current form values before clearing
  const savedValues = report.activities.map((activity, i) => {
    const card = container.querySelector(`.activity-card[data-activity-index="${i}"]`);
    if (card) {
      const values = {
        date: card.querySelector('.activity-date')?.value || '',
        location: card.querySelector('.activity-location')?.value || '',
        participants: card.querySelector('.activity-participants')?.value || '',
        description: card.querySelector('.activity-description')?.value || '',
        impact: card.querySelector('.activity-impact')?.value || ''
      };

      // Extra fields for Activity 2
      if (activity.typeIndex === 1) {
        values.medium = card.querySelector('.activity-medium')?.value || '';
        values.mediumOther = card.querySelector('.activity-medium-other')?.value || '';
        values.foreignCountry = card.querySelector('.activity-foreign-country')?.value || '';
        values.foreignSchoolName = card.querySelector('.activity-foreign-school-name')?.value || '';
        values.foreignSchoolAddress = card.querySelector('.activity-foreign-school-address')?.value || '';
      }

      return values;
    }
    return null;
  }).filter(Boolean);

  // Update state with saved values
  savedValues.forEach((values, i) => {
    if (report.activities[i]) {
      Object.assign(report.activities[i], values);
    }
  });

  // Clear container
  container.innerHTML = '';

  // Re-render each activity
  report.activities.forEach((activity, index) => {
    renderActivity(index);

    // Restore form values
    const card = container.querySelector(`.activity-card[data-activity-index="${index}"]`);
    if (card) {
      card.querySelector('.activity-date').value = activity.date;
      card.querySelector('.activity-location').value = activity.location;
      card.querySelector('.activity-participants').value = activity.participants;
      card.querySelector('.activity-description').value = activity.description;
      card.querySelector('.activity-impact').value = activity.impact;

      // Restore extra fields for Activity 2
      if (activity.typeIndex === 1) {
        const mediumSelect = card.querySelector('.activity-medium');
        if (mediumSelect) mediumSelect.value = activity.medium || '';

        const mediumOther = card.querySelector('.activity-medium-other');
        if (mediumOther) mediumOther.value = activity.mediumOther || '';

        const otherContainer = card.querySelector('.medium-other-container');
        if (otherContainer) {
          otherContainer.style.display = activity.medium === 'Other' ? 'block' : 'none';
        }

        const foreignCountry = card.querySelector('.activity-foreign-country');
        if (foreignCountry) foreignCountry.value = activity.foreignCountry || '';

        const foreignSchoolName = card.querySelector('.activity-foreign-school-name');
        if (foreignSchoolName) foreignSchoolName.value = activity.foreignSchoolName || '';

        const foreignSchoolAddress = card.querySelector('.activity-foreign-school-address');
        if (foreignSchoolAddress) foreignSchoolAddress.value = activity.foreignSchoolAddress || '';
      }

      // Re-render photos
      const previewGrid = card.querySelector('.activity-photos-preview');
      previewGrid.innerHTML = '';
      activity.photos.forEach((_, photoIndex) => {
        renderActivityPhoto(card, index, photoIndex);
      });

      // Hide upload area if max photos
      if (activity.photos.length >= MAX_PHOTOS) {
        card.querySelector('.photos-upload-area').style.display = 'none';
      }
    }
  });

  updateActivityButtons();
}

function updateActivityButtons() {
  const addBtn = document.getElementById('addActivityBtn');
  const maxActivities = isInternationalSchoolType() ? MAX_ACTIVITIES_INTERNATIONAL : MAX_ACTIVITIES_STANDARD;

  // Show/hide add button based on school type and current count
  if (isInternationalSchoolType() && report.activities.length < maxActivities) {
    addBtn.style.display = 'inline-flex';
    addBtn.disabled = false;
  } else {
    addBtn.style.display = 'none';
  }
}

function updateActivityCount() {
  const countEl = document.getElementById('activityCount');
  const maxActivities = isInternationalSchoolType() ? MAX_ACTIVITIES_INTERNATIONAL : MAX_ACTIVITIES_STANDARD;

  if (isInternationalSchoolType()) {
    countEl.textContent = `${report.activities.length} of ${maxActivities} activities`;
  } else {
    countEl.textContent = `${report.activities.length} activities`;
  }
}

// ========================================
// Wizard Navigation
// ========================================

function initNavigationButtons() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  prevBtn.addEventListener('click', goToPreviousStep);
  nextBtn.addEventListener('click', goToNextStep);

  updateNavigationButtons();
}

function goToPreviousStep() {
  if (currentStep > 1) {
    currentStep--;
    updateWizardUI();
  }
}

function goToNextStep() {
  // Validate current step before advancing
  if (!validateCurrentStep()) {
    return;
  }

  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateWizardUI();

    // If entering review step, render the review
    if (currentStep === 4) {
      renderReview();
    }
  }
}

function updateWizardUI() {
  // Update step visibility
  document.querySelectorAll('.wizard-step').forEach((step, index) => {
    step.classList.toggle('active', index + 1 === currentStep);
  });

  // Update progress indicator
  document.querySelectorAll('.progress-step').forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');

    if (stepNum === currentStep) {
      step.classList.add('active');
    } else if (stepNum < currentStep) {
      step.classList.add('completed');
    }
  });

  updateNavigationButtons();

  // Scroll to top of content
  document.querySelector('.wizard-content').scrollIntoView({ behavior: 'smooth' });
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  // Show/hide back button
  prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';

  // Update next button text
  if (currentStep === TOTAL_STEPS) {
    nextBtn.style.visibility = 'hidden';
  } else {
    nextBtn.style.visibility = 'visible';
    nextBtn.textContent = currentStep === TOTAL_STEPS - 1 ? 'Review →' : 'Next →';
  }
}

// ========================================
// Validation
// ========================================

function validateCurrentStep() {
  switch (currentStep) {
    case 1:
      return validateGeneralInfo();
    case 2:
      return validateDistribution();
    case 3:
      return validateActivities();
    case 4:
      return true; // Review step, no validation needed
    default:
      return true;
  }
}

function validateGeneralInfo() {
  let isValid = true;

  // Update state from form fields
  report.instructorName = document.getElementById('instructorName').value.trim();
  report.schoolType = document.getElementById('schoolType').value.trim();

  // Validate instructor name
  if (!report.instructorName) {
    showError('instructorNameError', 'Full name is required.');
    markInvalid('instructorName');
    isValid = false;
  } else {
    clearError('instructorNameError');
    markValid('instructorName');
  }

  // Validate school type
  if (!report.schoolType) {
    showError('schoolTypeError', 'School type is required.');
    markInvalid('schoolType');
    isValid = false;
  } else {
    clearError('schoolTypeError');
    markValid('schoolType');
  }

  // Validate header photo
  if (!report.headerPhoto) {
    showError('headerPhotoError', 'Header photo is required.');
    isValid = false;
  } else {
    clearError('headerPhotoError');
  }

  return isValid;
}

function validateDistribution() {
  const total = getDistributionTotal();

  if (Math.abs(total - 100) > 0.01) {
    showError('distributionError', `Distribution must total exactly 100%. Currently: ${total.toFixed(1)}%`);
    return false;
  }

  clearError('distributionError');
  return true;
}

function validateActivities() {
  let isValid = true;

  // Sync form values to state
  syncActivitiesFromForm();

  report.activities.forEach((activity, index) => {
    const card = document.querySelector(`.activity-card[data-activity-index="${index}"]`);
    if (!card) return;

    // Validate date
    if (!activity.date) {
      card.querySelector('.activity-date-error').textContent = 'Date is required.';
      card.querySelector('.activity-date').classList.add('invalid');
      isValid = false;
    } else {
      card.querySelector('.activity-date-error').textContent = '';
      card.querySelector('.activity-date').classList.remove('invalid');
    }

    // Validate location
    if (!activity.location.trim()) {
      card.querySelector('.activity-location-error').textContent = 'Location is required.';
      card.querySelector('.activity-location').classList.add('invalid');
      isValid = false;
    } else {
      card.querySelector('.activity-location-error').textContent = '';
      card.querySelector('.activity-location').classList.remove('invalid');
    }

    // Validate participants
    if (!activity.participants.trim()) {
      card.querySelector('.activity-participants-error').textContent = 'Participants is required.';
      card.querySelector('.activity-participants').classList.add('invalid');
      isValid = false;
    } else {
      card.querySelector('.activity-participants-error').textContent = '';
      card.querySelector('.activity-participants').classList.remove('invalid');
    }

    // Validate description
    if (!activity.description.trim()) {
      card.querySelector('.activity-description-error').textContent = 'Description is required.';
      card.querySelector('.activity-description').classList.add('invalid');
      isValid = false;
    } else {
      card.querySelector('.activity-description-error').textContent = '';
      card.querySelector('.activity-description').classList.remove('invalid');
    }

    // Validate impact
    if (!activity.impact.trim()) {
      card.querySelector('.activity-impact-error').textContent = 'Estimated impact is required.';
      card.querySelector('.activity-impact').classList.add('invalid');
      isValid = false;
    } else {
      card.querySelector('.activity-impact-error').textContent = '';
      card.querySelector('.activity-impact').classList.remove('invalid');
    }

    // Validate photos
    if (activity.photos.length < MIN_PHOTOS) {
      card.querySelector('.activity-photos-error').textContent = `At least ${MIN_PHOTOS} photo is required.`;
      isValid = false;
    } else {
      card.querySelector('.activity-photos-error').textContent = '';
    }

    // Extra validation for Activity 2 (Virtual Exchange)
    if (activity.typeIndex === 1) {
      // Validate medium
      if (!activity.medium) {
        const mediumError = card.querySelector('.activity-medium-error');
        if (mediumError) mediumError.textContent = 'Communication medium is required.';
        card.querySelector('.activity-medium')?.classList.add('invalid');
        isValid = false;
      } else {
        const mediumError = card.querySelector('.activity-medium-error');
        if (mediumError) mediumError.textContent = '';
        card.querySelector('.activity-medium')?.classList.remove('invalid');
      }

      // Validate medium other if "Other" selected
      if (activity.medium === 'Other' && !activity.mediumOther?.trim()) {
        const otherError = card.querySelector('.activity-medium-other-error');
        if (otherError) otherError.textContent = 'Please specify the communication medium.';
        card.querySelector('.activity-medium-other')?.classList.add('invalid');
        isValid = false;
      } else {
        const otherError = card.querySelector('.activity-medium-other-error');
        if (otherError) otherError.textContent = '';
        card.querySelector('.activity-medium-other')?.classList.remove('invalid');
      }

      // Validate foreign country
      if (!activity.foreignCountry?.trim()) {
        const countryError = card.querySelector('.activity-foreign-country-error');
        if (countryError) countryError.textContent = 'Country is required.';
        card.querySelector('.activity-foreign-country')?.classList.add('invalid');
        isValid = false;
      } else {
        const countryError = card.querySelector('.activity-foreign-country-error');
        if (countryError) countryError.textContent = '';
        card.querySelector('.activity-foreign-country')?.classList.remove('invalid');
      }

      // Validate foreign school name
      if (!activity.foreignSchoolName?.trim()) {
        const nameError = card.querySelector('.activity-foreign-school-name-error');
        if (nameError) nameError.textContent = 'School name is required.';
        card.querySelector('.activity-foreign-school-name')?.classList.add('invalid');
        isValid = false;
      } else {
        const nameError = card.querySelector('.activity-foreign-school-name-error');
        if (nameError) nameError.textContent = '';
        card.querySelector('.activity-foreign-school-name')?.classList.remove('invalid');
      }

      // Validate foreign school address
      if (!activity.foreignSchoolAddress?.trim()) {
        const addressError = card.querySelector('.activity-foreign-school-address-error');
        if (addressError) addressError.textContent = 'School address is required.';
        card.querySelector('.activity-foreign-school-address')?.classList.add('invalid');
        isValid = false;
      } else {
        const addressError = card.querySelector('.activity-foreign-school-address-error');
        if (addressError) addressError.textContent = '';
        card.querySelector('.activity-foreign-school-address')?.classList.remove('invalid');
      }
    }
  });

  return isValid;
}

function syncActivitiesFromForm() {
  report.activities.forEach((activity, index) => {
    const card = document.querySelector(`.activity-card[data-activity-index="${index}"]`);
    if (!card) return;

    activity.date = card.querySelector('.activity-date')?.value || '';
    activity.location = card.querySelector('.activity-location')?.value || '';
    activity.participants = card.querySelector('.activity-participants')?.value || '';
    activity.description = card.querySelector('.activity-description')?.value || '';
    activity.impact = card.querySelector('.activity-impact')?.value || '';

    // Extra fields for Activity 2
    if (activity.typeIndex === 1) {
      activity.medium = card.querySelector('.activity-medium')?.value || '';
      activity.mediumOther = card.querySelector('.activity-medium-other')?.value || '';
      activity.foreignCountry = card.querySelector('.activity-foreign-country')?.value || '';
      activity.foreignSchoolName = card.querySelector('.activity-foreign-school-name')?.value || '';
      activity.foreignSchoolAddress = card.querySelector('.activity-foreign-school-address')?.value || '';
    }
  });
}

// ========================================
// Review Section
// ========================================

function renderReview() {
  // Sync all data from form
  report.instructorName = document.getElementById('instructorName').value.trim();
  report.schoolType = document.getElementById('schoolType').value.trim();
  syncActivitiesFromForm();

  const container = document.getElementById('reviewContainer');

  // Filter categories with values
  const activeCategories = report.distribution.categories.filter(c => c.percent > 0);

  container.innerHTML = `
    <!-- Header Photo (at the top) -->
    <div class="review-section">
      <h3>Header Photo</h3>
      <div class="review-field">
        <div class="review-value">
          ${report.headerPhoto ? `<img src="${report.headerPhoto.previewUrl}" alt="Header photo" class="review-image review-header-photo">` : '<em>Not uploaded</em>'}
        </div>
      </div>
    </div>

    <!-- General Information -->
    <div class="review-section">
      <h3>General Information</h3>
      <div class="review-field">
        <span class="review-label">School Year:</span>
        <span class="review-value">${escapeHtml(report.schoolYear)}</span>
      </div>
      <div class="review-field">
        <span class="review-label">Instructor Name:</span>
        <span class="review-value">${escapeHtml(report.instructorName)}</span>
      </div>
      <div class="review-field">
        <span class="review-label">School Type:</span>
        <span class="review-value">${escapeHtml(report.schoolType)}</span>
      </div>
    </div>

    <!-- Student Distribution -->
    <div class="review-section">
      <h3>Student Distribution</h3>
      ${activeCategories.map(cat => `
        <div class="review-field">
          <span class="review-label">${escapeHtml(cat.label)}:</span>
          <span class="review-value">${cat.percent}%</span>
        </div>
      `).join('')}
    </div>

    <!-- Activities -->
    <div class="review-section">
      <h3>Cultural Activities (${report.activities.length})</h3>
      ${report.activities.map((activity, index) => {
        const config = ACTIVITY_CONFIG[activity.typeIndex];
        const mediumDisplay = activity.medium === 'Other'
          ? `Other: ${escapeHtml(activity.mediumOther)}`
          : escapeHtml(activity.medium);

        return `
        <div class="review-activity">
          <h4>Activity #${index + 1}</h4>
          <p class="review-prompt"><em>${escapeHtml(config.prompt)}</em></p>
          <div class="review-field">
            <span class="review-label">Date or Time Period:</span>
            <span class="review-value">${escapeHtml(activity.date)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Location:</span>
            <span class="review-value">${escapeHtml(activity.location)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Audience for and Participants in:</span>
            <span class="review-value">${escapeHtml(activity.participants)}</span>
          </div>
          ${activity.typeIndex === 1 ? `
          <div class="review-field">
            <span class="review-label">Medium:</span>
            <span class="review-value">${mediumDisplay}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Foreign Country:</span>
            <span class="review-value">${escapeHtml(activity.foreignCountry)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Foreign School:</span>
            <span class="review-value">${escapeHtml(activity.foreignSchoolName)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">School Address:</span>
            <span class="review-value">${escapeHtml(activity.foreignSchoolAddress)}</span>
          </div>
          ` : ''}
          <div class="review-field">
            <span class="review-label">Description:</span>
            <span class="review-value multiline">${escapeHtml(activity.description)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Impact:</span>
            <span class="review-value multiline">${escapeHtml(activity.impact)}</span>
          </div>
          <div class="review-field">
            <span class="review-label">Photos:</span>
            <div class="review-photos-grid">
              ${activity.photos.map(photo => `
                <img src="${photo.previewUrl}" alt="Activity photo" class="review-photo">
              `).join('')}
            </div>
          </div>
        </div>
      `}).join('')}
    </div>
  `;

  // Bind generate button
  document.getElementById('generatePdfBtn').addEventListener('click', generateReport);
}

// ========================================
// PDF Generation
// ========================================

async function generateReport() {
  // Final validation
  if (!validateAllSteps()) {
    alert('Please complete all required fields before generating the report.');
    return;
  }

  const overlay = document.getElementById('generatingOverlay');
  const statusEl = document.getElementById('generatingStatus');

  overlay.style.display = 'flex';

  try {
    // Generate PDF
    const pdfBytes = await generatePDF(report, (status) => {
      statusEl.textContent = status;
    });

    // Generate filename
    const filename = generateFilename(report.schoolYear, report.instructorName);

    // Trigger download
    statusEl.textContent = 'Downloading...';
    downloadPDF(pdfBytes, filename);

    // Success message
    statusEl.textContent = 'Complete!';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 1000);

  } catch (error) {
    console.error('PDF generation failed:', error);
    overlay.style.display = 'none';
    alert('Failed to generate PDF. Please try again.\n\nError: ' + error.message);
  }
}

function validateAllSteps() {
  // Validate each step
  const originalStep = currentStep;

  currentStep = 1;
  const step1Valid = validateGeneralInfo();

  currentStep = 2;
  const step2Valid = validateDistribution();

  currentStep = 3;
  const step3Valid = validateActivities();

  currentStep = originalStep;

  return step1Valid && step2Valid && step3Valid;
}

// ========================================
// Utility Functions
// ========================================

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
  }
}

function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = '';
  }
}

function markInvalid(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.add('invalid');
  }
}

function markValid(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.classList.remove('invalid');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
