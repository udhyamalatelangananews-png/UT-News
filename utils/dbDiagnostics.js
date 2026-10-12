/* Plain-English checks and error explanations for the one-time setup scripts
   (run-schema.js, create-admin.js). Nothing here ever prints your password —
   only the host name and database name. */

function checkDatabaseUrl() {
  const raw = (process.env.DATABASE_URL || '').trim();

  if (!raw) {
    return { ok: false, message: [
      'DATABASE_URL is not set, so the script has no idea where your database is.',
      '',
      'Check these, in order:',
      '  1. You are running this command from INSIDE the server folder',
      '     (the folder that contains package.json and .env).',
      '  2. A file named exactly  .env  exists there. On Windows, Notepad often saves it',
      '     as  .env.txt  by mistake. In File Explorer: View > Show > File name extensions.',
      '     Or run   dir /a   in this terminal and look for the exact name.',
      '  3. Inside that file there is a line starting with  DATABASE_URL=  followed by your',
      '     Neon connection string, with no spaces and no quotes, and the file is saved.'
    ].join('\n') };
  }

  let u;
  try { u = new URL(raw); } catch {
    return { ok: false, message: 'DATABASE_URL is set, but it is not a valid address. It should look like\n  postgresql://user:password@host/dbname\nCopy it again from Neon, with no quotes or spaces around it.' };
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    return { ok: false, message: `DATABASE_URL must start with postgresql:// but starts with "${u.protocol}//". Copy the connection string again from Neon.` };
  }
  if (u.hostname === 'host' || u.username === 'username' || /replace-with/i.test(raw)) {
    return { ok: false, message: 'DATABASE_URL still contains the example text from .env.example. Replace the whole line with your real connection string from Neon.' };
  }
  return { ok: true, target: `${u.hostname}${u.port ? ':' + u.port : ''}/${u.pathname.replace(/^\//, '')}` };
}

const HINTS = {
  ECONNREFUSED: 'Nothing is accepting connections at that address. If the host shown above is localhost or 127.0.0.1, your DATABASE_URL is not the Neon one.',
  ENOTFOUND: 'That host name does not exist. The connection string was probably copied incorrectly — copy it again from Neon.',
  EAI_AGAIN: 'Could not look up the host name. Check your internet connection (or VPN/proxy), then try again.',
  ETIMEDOUT: 'The connection timed out. Check your internet connection and any VPN, firewall or antivirus that may block it, then try again.',
  ECONNRESET: 'The connection was cut off. Try again; if it keeps happening, check your network or VPN.',
  '28P01': 'Wrong username or password in DATABASE_URL. Copy the connection string again from Neon.',
  '28000': 'Wrong username or password in DATABASE_URL. Copy the connection string again from Neon.',
  '3D000': 'That database name does not exist. Copy the connection string again from Neon.',
  '42P01': 'A table is missing. Run  node run-schema.js  first.'
};

/* Node reports some network failures as an "AggregateError" whose own message is
   blank — the real reasons are inside err.errors. This digs them out. */
function explainError(err) {
  const lines = [];
  const parts = (err && Array.isArray(err.errors) && err.errors.length) ? err.errors : [err];
  const seen = new Set();
  for (const e of parts) {
    const text = [e && e.code, e && e.message].filter(Boolean).join(' — ') || String(e);
    if (!seen.has(text)) { seen.add(text); lines.push('  - ' + text); }
  }
  const codes = parts.map((e) => e && e.code).filter(Boolean);
  const hintCode = codes.find((c) => HINTS[c]);
  if (hintCode) lines.push('', 'What this usually means: ' + HINTS[hintCode]);
  return lines.join('\n');
}

module.exports = { checkDatabaseUrl, explainError };
