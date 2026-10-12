const express = require('express');
const pool = require('../db');
const { requireAuth } = require('./auth');
const { sendNewArticleEmail } = require('../utils/sendEmail');

const router = express.Router();

// POST /api/articles  — protected, admin only
// This is the endpoint your CMS/admin panel calls when you hit "Publish".
router.post('/articles', requireAuth, async (req, res) => {
  const { slug, category, title, dek, author, body, mainImage, images, videos, timeLabel } = req.body;

  if (!slug || !title || !category) {
    return res.status(400).json({ error: 'slug, title, and category are required' });
  }

  try {
    const insert = await pool.query(
      `INSERT INTO articles (slug, category, title, dek, author, body, main_image_url, main_image_alt, images, videos, time_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [slug, category, title, dek, author, body, mainImage?.url, mainImage?.alt,
       JSON.stringify(images || []), JSON.stringify(videos || []), timeLabel || null]
    );
    const article = insert.rows[0];

    // Fire off the newsletter — don't block the publish response on email sending
    notifySubscribers(article).catch((err) => console.error('Newsletter send failed:', err));

    res.status(201).json({ message: 'Article published', article });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to publish article' });
  }
});

async function notifySubscribers(article) {
  const { rows: subscribers } = await pool.query(
    `SELECT email, unsubscribe_token FROM subscribers WHERE status='confirmed'`
  );
  if (subscribers.length === 0) return;

  await sendNewArticleEmail(article, subscribers);
  await pool.query('UPDATE articles SET newsletter_sent = TRUE WHERE id = $1', [article.id]);
}

// GET /api/articles — public, powers the homepage. Optional ?category=politics filter.
router.get('/articles', async (req, res) => {
  const { category } = req.query;
  const query = category
    ? { text: 'SELECT * FROM articles WHERE category=$1 ORDER BY published_at DESC', values: [category] }
    : { text: 'SELECT * FROM articles ORDER BY published_at DESC' };
  const result = await pool.query(query);
  res.json(result.rows);
});

// PUT /api/articles/:slug — protected, admin only. Edits do NOT trigger a
// newsletter send — only the initial POST /api/articles publish does.
router.put('/articles/:slug', requireAuth, async (req, res) => {
  const { category, title, dek, author, body, mainImage, images, videos, timeLabel } = req.body;

  try {
    const result = await pool.query(
      `UPDATE articles SET
         category=$1, title=$2, dek=$3, author=$4, body=$5,
         main_image_url=$6, main_image_alt=$7, images=$8, videos=$9, time_label=$10
       WHERE slug=$11
       RETURNING *`,
      [category, title, dek, author, body, mainImage?.url, mainImage?.alt,
       JSON.stringify(images || []), JSON.stringify(videos || []), timeLabel || null, req.params.slug]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ message: 'Article updated', article: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// DELETE /api/articles/:slug — protected, admin only
router.delete('/articles/:slug', requireAuth, async (req, res) => {
  const result = await pool.query('DELETE FROM articles WHERE slug=$1', [req.params.slug]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Article not found' });
  res.json({ message: 'Article deleted' });
});

// GET /api/articles/:slug — public, used by article.html instead of static JSON
router.get('/articles/:slug', async (req, res) => {
  const result = await pool.query('SELECT * FROM articles WHERE slug=$1', [req.params.slug]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

module.exports = router;
