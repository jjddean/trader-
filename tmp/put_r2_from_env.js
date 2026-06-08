const fs = require('fs');
const path = '.env.local';
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// load .env.local into process.env
const s = fs.readFileSync(path, 'utf8');
s.split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([^=#]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2];
});

(async () => {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!endpoint || !bucket) {
    console.error('Missing R2 endpoint or bucket in .env.local');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: 'r2-test-from-env.txt',
      Body: 'ok',
      ContentType: 'text/plain',
    }));
    console.log('R2 put ok');
  } catch (err) {
    console.error('R2 put failed:', err.message || err);
    process.exit(1);
  }
})();
