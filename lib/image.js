/**
 * Image Processing Utilities
 *
 * Handles image normalization to 16:9 landscape format (1600x900)
 * with center-crop and JPEG re-encoding.
 */

// Target dimensions for processed images
export const IMAGE_CONFIG = {
  width: 1600,
  height: 900,
  aspectRatio: 16 / 9,
  quality: 0.8,
  mimeType: 'image/jpeg'
};

/**
 * Process an image file to standardized 16:9 landscape format
 *
 * @param {File} file - The image file to process
 * @returns {Promise<{blob: Blob, width: number, height: number, previewUrl: string, bytes: number}>}
 */
export async function processImageToLandscape16x9(file) {
  return new Promise((resolve, reject) => {
    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Clean up the object URL after loading
        URL.revokeObjectURL(objectUrl);

        const { width: targetWidth, height: targetHeight, aspectRatio, quality, mimeType } = IMAGE_CONFIG;

        // Calculate source crop dimensions for center-crop to 16:9
        const srcAspect = img.width / img.height;
        let srcX, srcY, srcWidth, srcHeight;

        if (srcAspect > aspectRatio) {
          // Source is wider than 16:9 - crop horizontally
          srcHeight = img.height;
          srcWidth = img.height * aspectRatio;
          srcX = (img.width - srcWidth) / 2;
          srcY = 0;
        } else {
          // Source is taller than 16:9 - crop vertically
          srcWidth = img.width;
          srcHeight = img.width / aspectRatio;
          srcX = 0;
          srcY = (img.height - srcHeight) / 2;
        }

        // Create canvas and draw cropped/scaled image
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');

        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the center-cropped and scaled image
        ctx.drawImage(
          img,
          srcX, srcY, srcWidth, srcHeight,  // Source crop rectangle
          0, 0, targetWidth, targetHeight    // Destination (full canvas)
        );

        // Convert canvas to JPEG blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create image blob'));
              return;
            }

            // Create preview URL for the processed image
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              blob,
              width: targetWidth,
              height: targetHeight,
              previewUrl,
              bytes: blob.size
            });
          },
          mimeType,
          quality
        );
      } catch (error) {
        reject(new Error(`Image processing failed: ${error.message}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Format file size in human-readable format
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Revoke a preview URL to free memory
 *
 * @param {string} previewUrl - The blob URL to revoke
 */
export function revokePreviewUrl(previewUrl) {
  if (previewUrl && previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
}

/**
 * Process multiple image files
 *
 * @param {FileList|File[]} files - Array of files to process
 * @param {function} onProgress - Progress callback (index, total)
 * @returns {Promise<Array>} - Array of processed image objects
 */
export async function processMultipleImages(files, onProgress = () => {}) {
  const results = [];
  const fileArray = Array.from(files);

  for (let i = 0; i < fileArray.length; i++) {
    onProgress(i, fileArray.length);
    const result = await processImageToLandscape16x9(fileArray[i]);
    results.push(result);
  }

  onProgress(fileArray.length, fileArray.length);
  return results;
}

export default {
  processImageToLandscape16x9,
  processMultipleImages,
  formatFileSize,
  revokePreviewUrl,
  IMAGE_CONFIG
};
