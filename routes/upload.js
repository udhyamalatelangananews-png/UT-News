const express = require('express');
const multer = require('multer');
const { requireAuth } = require('./auth');
const { uploadBuffer } = require('../utils/uploadFile');

const router = express.Router();

// Files are held in memory only long enough to forward to Cloudinary —
// never written to Render's disk, which is wiped on every redeploy anyway.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — plenty for a photo or short ad clip
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/|^video\//;
    if (!allowed.test(file.mimetype)) return cb(new Error('Only image or video files are allowed'));
    cb(null, true);
  }
});

// POST /api/upload — admin only. Send as multipart/form-data with a
// single field named "file". Returns { url, type }.
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const resourceType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

  try {
    const result = await uploadBuffer(req.file.buffer, resourceType);
    res.json({ url: result.secure_url, type: resourceType });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed. Check your Cloudinary credentials.' });
  }
});

module.exports = router;
