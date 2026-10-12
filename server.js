require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { router: authRouter } = require('./routes/auth');
const subscribersRouter = require('./routes/subscribers');
const articlesRouter = require('./routes/articles');
const adsRouter = require('./routes/ads');
const uploadRouter = require('./routes/upload');

const app = express();

app.use(helmet());                          // sets secure HTTP headers (CSP, HSTS, etc.)
app.use(cors({ origin: process.env.SITE_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Global rate limit — tighter limits are applied per-route where it matters (e.g. login)
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use('/api', authRouter);
app.use('/api', subscribersRouter);
app.use('/api', articlesRouter);
app.use('/api', adsRouter);
app.use('/api', uploadRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
