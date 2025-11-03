import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle raw file upload
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[upload-blob] Received upload request');
    console.log('[upload-blob] Headers:', req.headers);
    
    const fileName = req.headers['x-file-name'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!fileName || !userId) {
      console.error('[upload-blob] Missing headers:', { fileName, userId });
      return res.status(400).json({ error: 'Missing file name or user ID' });
    }

    console.log('[upload-blob] Uploading to Vercel Blob:', fileName);

    // Convert request to blob for upload
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log('[upload-blob] File size:', buffer.length);

    // Upload to Vercel Blob
    const blob = await put(fileName, buffer, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('[upload-blob] Upload successful:', blob.url);

    return res.status(200).json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error: any) {
    console.error('[upload-blob] Upload failed:', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error.message,
    });
  }
}

