const fs = require('fs');
const path = require('path');

/**
 * Safely deletes a local file from public directory given its relative URL path.
 * e.g. deleteLocalFile('/uploads/products/product-12345.jpg')
 */
const deleteLocalFile = (relativeUrlPath) => {
  if (!relativeUrlPath || typeof relativeUrlPath !== 'string') return false;

  // Only delete files in /uploads/ to prevent path traversal
  if (relativeUrlPath.startsWith('/uploads/')) {
    const fullPath = path.join(__dirname, '../public', relativeUrlPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Successfully deleted uploaded file: ${fullPath}`);
        return true;
      } catch (err) {
        console.error(`Failed to delete file ${fullPath}:`, err);
      }
    }
  }
  return false;
};

module.exports = {
  deleteLocalFile
};
