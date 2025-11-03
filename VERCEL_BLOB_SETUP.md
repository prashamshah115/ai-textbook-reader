# Vercel Blob Setup

## Get Your Token:

1. Go to https://vercel.com/dashboard
2. Select your project (or create one)
3. Go to **Storage** tab
4. Click **Create Database** → **Blob**
5. Copy the **BLOB_READ_WRITE_TOKEN**

## Add to .env:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

## Restart Dev Server:

```bash
pkill -f vite
npm run dev
```

## Test Upload:

Hard refresh browser (`Cmd + Shift + R`) and upload a PDF!

Should see:
```
1️⃣ Starting...
2️⃣ Will upload to Vercel Blob...
3️⃣ Uploading to Vercel Blob...
4️⃣ Vercel Blob upload SUCCESS
5️⃣ Creating database record...
✅ COMPLETE!
```

## Benefits:

- No policies needed
- No auth complexity
- Works on localhost AND production
- Instant uploads
- Free tier: 500GB transfer/month

