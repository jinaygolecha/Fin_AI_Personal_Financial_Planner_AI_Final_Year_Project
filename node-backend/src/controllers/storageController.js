/**
 * FinPro — Cloud Storage Controller
 * Handles document uploads, downloads, and cloud file management.
 * Owner: Jinay Golecha (jinay_golecha)
 */

const storageService = require('../services/storageService');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/v1/storage/upload
 * Accepts base64 encoded document/image or raw payload and stores via storageService
 */
const uploadDocument = async (req, res, next) => {
  try {
    const userId = req.user?.id || 'public';
    const { fileData, fileName, contentType, documentType = 'receipt' } = req.body;

    if (!fileData) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'fileData (base64 string or data URL) is required.' },
      });
    }

    let buffer = null;
    let detectedMime = contentType || 'application/octet-stream';

    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const match = fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else if (typeof fileData === 'string') {
      buffer = Buffer.from(fileData, 'base64');
    } else if (Buffer.isBuffer(fileData)) {
      buffer = fileData;
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: 'Supplied file data is empty or invalid.' },
      });
    }

    // Limit to 15MB
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'File exceeds 15MB maximum size limit.' },
      });
    }

    const safeDocType = documentType.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanExt = fileName ? path.extname(fileName) : (detectedMime.includes('png') ? '.png' : detectedMime.includes('pdf') ? '.pdf' : '.jpg');
    const storageKey = `documents/${userId}/${safeDocType}_${Date.now()}_${uuidv4().slice(0, 8)}${cleanExt}`;

    const uploadResult = await storageService.upload({
      buffer,
      key: storageKey,
      contentType: detectedMime,
      metadata: {
        userId,
        originalName: fileName || 'uploaded_document',
        documentType: safeDocType,
      },
    });

    return res.status(201).json({
      success: true,
      data: uploadResult,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/storage/file/:key*
 * Retrieves stored file via storageService
 */
const getFile = async (req, res, next) => {
  try {
    const rawKey = req.params.key || req.params[0] || '';
    if (!rawKey) {
      return res.status(400).json({ success: false, message: 'Storage key is required' });
    }

    const decodedKey = decodeURIComponent(rawKey);
    const downloaded = await storageService.download(decodedKey);

    res.setHeader('Content-Type', downloaded.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', downloaded.size);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(downloaded.buffer);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ success: false, error: 'File not found in storage' });
    }
    next(err);
  }
};

/**
 * DELETE /api/v1/storage/file/:key*
 */
const deleteFile = async (req, res, next) => {
  try {
    const rawKey = req.params.key || req.params[0] || '';
    const decodedKey = decodeURIComponent(rawKey);
    const result = await storageService.delete(decodedKey);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/storage/status
 */
const getStorageStatus = async (req, res) => {
  const health = await storageService.checkStorageHealth();
  return res.status(health.available ? 200 : 503).json({
    success: health.available,
    ...health,
  });
};

module.exports = {
  uploadDocument,
  getFile,
  deleteFile,
  getStorageStatus,
};
