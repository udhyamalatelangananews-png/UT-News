const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/** Uploads a file buffer (from multer's memory storage) to Cloudinary and
 *  resolves with its permanent HTTPS URL. resourceType should be 'image'
 *  or 'video' — Cloudinary handles each differently. */
function uploadBuffer(buffer, resourceType = 'image') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'udhyamala-telangana-news' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadBuffer };
