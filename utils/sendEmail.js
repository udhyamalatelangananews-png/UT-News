/* Uses Mailjet's HTTPS API instead of raw SMTP. This matters specifically
   because most cloud hosts (Render, Vercel, DigitalOcean, etc.) block
   outbound SMTP ports on their standard/free tiers as an anti-spam
   measure — so nodemailer+SMTP times out (ETIMEDOUT) no matter how
   correct the credentials are. The API travels over HTTPS (port 443),
   which is never blocked.

   Reuses the same SMTP_USER/SMTP_PASS env vars — for Mailjet, those ARE
   your API Key and Secret Key, so nothing needs to change in .env. */
const Mailjet = require('node-mailjet');

const mailjet = Mailjet.apiConnect(process.env.SMTP_USER, process.env.SMTP_PASS);

/* EMAIL_FROM is stored as a single string like:
     "Udhyamala Telangana News <news@example.com>"
   Mailjet's API wants Name and Email as separate fields, so this pulls
   them apart. Falls back to treating the whole value as the email if the
   "Name <email>" format isn't used. */
function parseFromAddress() {
  const raw = process.env.EMAIL_FROM || '';
  const match = raw.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { Name: match[1].trim(), Email: match[2].trim() };
  return { Name: '', Email: raw.trim() };
}

async function sendEmail({ to, subject, html }) {
  const From = parseFromAddress();
  return mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From,
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html
      }
    ]
  });
}

/** Sends a "new article" email to every confirmed subscriber, one at a time
 *  with a small delay to stay well within Mailjet's rate limits. For real
 *  volume (thousands of subscribers), Mailjet's API also accepts multiple
 *  Messages in a single request instead of looping — worth switching to
 *  once your subscriber count grows. */
async function sendNewArticleEmail(article, subscribers) {
  const articleUrl = `${process.env.SITE_URL}/article.html?slug=${article.slug}`;

  for (const sub of subscribers) {
    const unsubscribeUrl = `${process.env.SITE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;
    await sendEmail({
      to: sub.email,
      subject: `New: ${article.title}`,
      html: `
        <h2>${article.title}</h2>
        <p>${article.dek || ''}</p>
        <p><a href="${articleUrl}">Read the full story &rarr;</a></p>
        <hr>
        <p style="font-size:12px;color:#888;">
          You're receiving this because you subscribed to Udhyamala Telangana News.
          <a href="${unsubscribeUrl}">Unsubscribe</a>
        </p>`
    });
    await new Promise((r) => setTimeout(r, 100)); // simple throttle
  }
}

module.exports = { sendEmail, sendNewArticleEmail };
