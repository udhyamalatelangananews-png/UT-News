const express = require('express');
const pool = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

// Limits keep a typo (e.g. 7280 instead of 728) from breaking the page layout.
// The frontend also clamps every slot to the width of its column, so even a
// maximum-size ad can never overflow or push other content around.
const MIN_W = 50, MAX_W = 1200;
const MIN_H = 30, MAX_H = 900;

function parseDimension(value, min, max, label) {
  if (value === undefined || value === null || value === '') return { value: null };
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label} must be a whole number between ${min} and ${max}` };
  }
  return { value: n };
}

// GET /api/ads — public. Returns { unitId: {type, src, poster, linkUrl, width, height} }
// for every ad unit that has been customized. Units with no row here
// simply aren't included, and the frontend falls back to its built-in size
// and (if any) hardcoded creative.
router.get('/ads', async (req, res) => {
  const result = await pool.query('SELECT * FROM ads');
  const map = {};
  result.rows.forEach((row) => {
    map[row.unit_id] = {
      type: row.type,
      src: row.src,
      poster: row.poster,
      linkUrl: row.link_url,
      width: row.ad_width,
      height: row.ad_height
    };
  });
  res.json(map);
});

// PUT /api/ads/:unitId — admin only. Creates or updates one ad unit.
router.put('/ads/:unitId', requireAuth, async (req, res) => {
  const { type, src, poster, linkUrl, width, height } = req.body;
  if (!src) return res.status(400).json({ error: 'src is required' });

  const w = parseDimension(width, MIN_W, MAX_W, 'Width');
  if (w.error) return res.status(400).json({ error: w.error });
  const h = parseDimension(height, MIN_H, MAX_H, 'Height');
  if (h.error) return res.status(400).json({ error: h.error });

  // A slot needs both numbers to have a shape — one without the other is a mistake.
  if ((w.value === null) !== (h.value === null)) {
    return res.status(400).json({ error: 'Enter both width and height, or leave both blank for the default size' });
  }

  await pool.query(
    `INSERT INTO ads (unit_id, type, src, poster, link_url, ad_width, ad_height, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (unit_id) DO UPDATE
       SET type=$2, src=$3, poster=$4, link_url=$5, ad_width=$6, ad_height=$7, updated_at=NOW()`,
    [req.params.unitId, type || 'image', src, poster || null, linkUrl || null, w.value, h.value]
  );
  res.json({ message: 'Ad saved' });
});

// DELETE /api/ads/:unitId — admin only. Removes the override entirely, so the
// slot goes back to its built-in size and whatever creative is hardcoded.
router.delete('/ads/:unitId', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM ads WHERE unit_id=$1', [req.params.unitId]);
  res.json({ message: 'Ad override removed' });
});

module.exports = router;
