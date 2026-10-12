const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

// POST /api/subscribe  { email, name? }
router.post('/subscribe',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Valid email required' });

    const { email, name } = req.body;
    const confirmToken = crypto.randomBytes(24).toString('hex');
    const unsubscribeToken = crypto.randomBytes(24).toString('hex');

    try {
      await pool.query(
        `INSERT INTO subscribers (email, name, status, confirm_token, unsubscribe_token)
         VALUES ($1, $2, 'pending', $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [email, name || null, confirmToken, unsubscribeToken]
      );

      const confirmUrl = `${process.env.SITE_URL}/api/confirm?token=${confirmToken}`;
      await sendEmail({
        to: email,
        subject: 'Confirm your subscription to Udhyamala Telangana News',
        html: `<p>Click to confirm: <a href="${confirmUrl}">${confirmUrl}</a></p>`
      });

      res.json({ message: 'Check your email to confirm your subscription.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Try again later.' });
    }
  }
);

// GET /api/confirm?token=...  (double opt-in — required for CAN-SPAM/GDPR compliance)
router.get('/confirm', async (req, res) => {
  const { token } = req.query;
  const result = await pool.query(
    `UPDATE subscribers SET status='confirmed', confirm_token=NULL
     WHERE confirm_token=$1 RETURNING email`,
    [token]
  );
  if (result.rowCount === 0) return res.status(400).send('Invalid or expired confirmation link.');
  res.send('Subscription confirmed — thanks for signing up!');
});

// GET /api/unsubscribe?token=...
router.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;
  await pool.query(`UPDATE subscribers SET status='unsubscribed' WHERE unsubscribe_token=$1`, [token]);
  res.send('You have been unsubscribed.');
});

module.exports = router;
