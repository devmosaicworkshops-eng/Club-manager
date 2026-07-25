import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import multer from 'multer';

import { verifyToken } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { ObjectStorageService } from '../lib/objectStorage';
import { ObjectNotFoundError } from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const GALLERY_BUCKET = 'gallery';

/**
 * POST /storage/uploads
 *
 * Uploads the file to Supabase Storage (public bucket "gallery") and returns
 * the permanent public URL as `objectPath`.  No Replit Object Storage required.
 * Restricted to Admins.
 */
router.post(
  '/storage/uploads',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload || payload.role !== 'Admin') {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu' });
      return;
    }

    try {
      const ext = (req.file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
      const fileName = `${randomUUID()}.${ext}`;

      // ── 1. Try Supabase Storage (permanent public URL) ──────────────────────
      // Note: bucket must be created in the Supabase dashboard with the name
      // "gallery" and visibility set to "Public". The anon key cannot create
      // buckets, so we skip createBucket() and go straight to upload.
      const { data, error: uploadError } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (!uploadError && data) {
        const { data: { publicUrl } } = supabase.storage
          .from(GALLERY_BUCKET)
          .getPublicUrl(data.path);
        req.log.info({ publicUrl }, 'Uploaded to Supabase Storage');
        res.json({ objectPath: publicUrl });
        return;
      }

      // ── 2. Fallback: base64 data URL (zero-config, always works) ────────────
      // Stored directly in gallery.image_url. Works without a Supabase Storage
      // bucket. For permanent URLs, create a public "gallery" bucket in the
      // Supabase dashboard and this path will be used automatically.
      req.log.warn({ err: uploadError }, 'Supabase Storage unavailable — using base64 fallback');
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      res.json({ objectPath: dataUrl });
    } catch (error: any) {
      req.log.error({ err: error }, 'Error uploading image');
      res.status(500).json({ error: error.message ?? 'Erreur interne' });
    }
  },
);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Restricted to Admins — currently only used for the admin gallery uploader.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    const payload = verifyToken(req.headers.authorization);
    if (!payload || payload.role !== 'Admin') {
      res.status(401).json({ error: 'Non autorisé' });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
