const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');

const router = express.Router();

// Slow down brute-force login attempts
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// POST /api/login  { email, password }
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const result = await pool.query('SELECT * FROM admin_users WHERE email=$1', [email]);
  const user = result.rows[0];

  // Always run bcrypt.compare even if user is missing, to avoid leaking
  // via response-time whether an email exists in the system
  const validPassword = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, '$2b$10$invalidsaltinvalidsaltinvalidsalte');

  if (!user || !validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });

  res.cookie('token', token, {
    httpOnly: true,
    // sameSite:'none' is required for the cookie to be sent on cross-origin
    // fetch requests (frontend and backend usually live on different
    // domains once deployed) — but browsers require secure:true whenever
    // sameSite is 'none', so this only works over HTTPS in production.
    // Locally over plain http, 'lax' + non-secure still works fine.
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 2 * 60 * 60 * 1000
  });
  res.json({ message: 'Logged in' });
});

// GET /api/me — lets the admin panel check "am I still logged in?" on load
router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

/* Reference for creating an admin account (run once, e.g. in a setup script —
   never expose a public "create admin" endpoint):

   const hash = await bcrypt.hash(plainTextPassword, 12);
   await pool.query(
     'INSERT INTO admin_users (email, password_hash, name) VALUES ($1,$2,$3)',
     [email, hash, name]
   );
*/

// Middleware: protects routes that require a logged-in admin
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = { router, requireAuth };
