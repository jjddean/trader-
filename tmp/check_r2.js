const fs = require('fs');
const path = '.env.local';
const s = fs.readFileSync(path, 'utf8');
const kv = {};
s.split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([^=#]+)=(.*)$/);
  if (m) kv[m[1].trim()] = m[2];
});
['CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_ENDPOINT'].forEach(k => {
  const v = kv[k];
  if (!v) return console.log(k + ': MISSING');
  const raw = v;
  const trimmed = raw.trim();
  const leadingMatch = raw.match(/^[\s\u0000-\u001F\u007F]+/);
  const trailingMatch = raw.match(/[\s\u0000-\u001F\u007F]+$/);
  const leading = leadingMatch ? leadingMatch[0].length : 0;
  const trailing = trailingMatch ? trailingMatch[0].length : 0;
  const nonPrintable = raw.split('').some(ch => { const c = ch.charCodeAt(0); return c < 32 || c === 127; });
  console.log(`${k}: length=${raw.length}, trimmedLength=${trimmed.length}, leading=${leading}, trailing=${trailing}, hasNonPrintable=${nonPrintable}`);
});
