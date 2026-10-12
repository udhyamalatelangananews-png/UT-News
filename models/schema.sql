-- Run this once against your Postgres database to set up tables.
-- (MySQL/MongoDB equivalents follow the same shape — see notes below.)

CREATE TABLE IF NOT EXISTS subscribers (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | confirmed | unsubscribed
  confirm_token   VARCHAR(64),
  unsubscribe_token VARCHAR(64) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Admin/editor accounts (for publishing articles) — separate from newsletter subscribers
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,  -- bcrypt hash, NEVER plain text
  name            VARCHAR(255),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  category        VARCHAR(50) NOT NULL,
  title           TEXT NOT NULL,
  dek             TEXT,
  author          VARCHAR(255),
  body            TEXT[],           -- array of paragraphs
  main_image_url  TEXT,
  main_image_alt  TEXT,
  images          JSONB DEFAULT '[]', -- [{url, alt, caption}]
  videos          JSONB DEFAULT '[]', -- [{url, poster, caption}]
  time_label      VARCHAR(50),      -- display string e.g. "2h ago" (optional; falls back to published_at)
  published_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE
);

-- Ad creative, editable from the admin panel without touching any code.
-- unit_id matches the data-ad-unit attribute on each .ad-slot in the HTML
-- (leaderboard-top, in-feed-1, floating-1, etc). If a unit has no row here,
-- the frontend falls back to whatever sample creative is hardcoded in the HTML.
CREATE TABLE IF NOT EXISTS ads (
  unit_id     VARCHAR(100) PRIMARY KEY,
  type        VARCHAR(10) NOT NULL DEFAULT 'image', -- image | video
  src         TEXT NOT NULL,
  poster      TEXT,                 -- video poster image, optional
  link_url    TEXT,                 -- where clicking the ad sends the visitor
  ad_width    INTEGER,              -- custom slot width in px (NULL = built-in default size)
  ad_height   INTEGER,              -- custom slot height in px (NULL = built-in default size)
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Safe to re-run: adds columns introduced after the first version of the
-- ads table, without touching existing rows.
ALTER TABLE ads ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_width INTEGER;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS ad_height INTEGER;

-- Notes:
-- MySQL: swap SERIAL -> INT AUTO_INCREMENT, TIMESTAMP defaults use CURRENT_TIMESTAMP,
--        JSONB -> JSON, TEXT[] -> JSON (MySQL has no native array type).
-- MongoDB: each table above becomes a collection; use a schema library like
--        Mongoose to enforce the same shape in application code instead of SQL constraints.
