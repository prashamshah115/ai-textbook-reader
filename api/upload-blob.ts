import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[upload-blob] Received upload request');
    
    // Get file from request
    const contentType = req.headers['content-type'];
    if (!contentType?.includes('application/pdf')) {
      return res.status(400).json({ error: 'Only PDF files allowed' });
    }

    const fileName = req.headers['x-file-name'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!fileName || !userId) {
      return res.status(400).json({ error: 'Missing file name or user ID' });
    }

    console.log('[upload-blob] Uploading to Vercel Blob:', fileName);

    // Upload to Vercel Blob
    const blob = await put(fileName, req, {
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

