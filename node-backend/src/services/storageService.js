/**
 * FinPro — Cloud Storage Service Abstraction
 * Supports Local Disk (development) and S3-Compatible Cloud Object Storage (production).
 * Compatible with AWS S3, Cloudflare R2, Oracle Cloud Object Storage, MinIO, and Backblaze B2.
 * Owner: Jinay Golecha (jinay_golecha)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ----------------------------------------------------------------------------
// Local Disk Storage Provider (Default for Development)
// ----------------------------------------------------------------------------
class LocalDiskProvider {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir || path.join(__dirname, '..', '..', 'uploads'));
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (err) {
        console.warn('[Storage] Notice creating uploads dir:', err.message);
      }
    }
  }

  _resolveSafePath(key) {
    // Sanitize key to prevent directory traversal attacks
    const sanitizedKey = key.replace(/^(\.\.[\/\\])+/, '').replace(/[\\]/g, '/');
    const fullPath = path.join(this.baseDir, sanitizedKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Invalid storage key path: directory traversal detected');
    }
    return fullPath;
  }

  async upload({ buffer, key, contentType = 'application/octet-stream', metadata = {} }) {
    const fullPath = this._resolveSafePath(key);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);
    const stat = await fs.promises.stat(fullPath);

    return {
      success: true,
      key,
      url: `/api/v1/storage/file/${encodeURIComponent(key)}`,
      size: stat.size,
      contentType,
      provider: 'local',
      etag: crypto.createHash('md5').update(buffer).digest('hex'),
      createdAt: new Date().toISOString(),
      metadata,
    };
  }

  async download(key) {
    const fullPath = this._resolveSafePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Object not found: ${key}`);
    }
    const buffer = await fs.promises.readFile(fullPath);
    const ext = path.extname(key).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.txt': 'text/plain',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    return {
      buffer,
      size: buffer.length,
      contentType,
      key,
      provider: 'local',
    };
  }

  async delete(key) {
    const fullPath = this._resolveSafePath(key);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
    return { success: true, key, provider: 'local' };
  }

  async getPublicOrSignedUrl(key) {
    return `/api/v1/storage/file/${encodeURIComponent(key)}`;
  }

  async checkHealth() {
    const start = Date.now();
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      const testFile = path.join(this.baseDir, `.healthcheck-${crypto.randomBytes(6).toString('hex')}`);
      await fs.promises.writeFile(testFile, `health-${Date.now()}`);
      await fs.promises.readFile(testFile);
      try { await fs.promises.unlink(testFile); } catch {}
      const latencyMs = Date.now() - start;
      return {
        available: true,
        status: 'available',
        provider: 'local',
        directory: path.basename(this.baseDir),
        latencyMs,
      };
    } catch (err) {
      return {
        available: false,
        status: 'error',
        provider: 'local',
        error: err.message,
        latencyMs: Date.now() - start,
      };
    }
  }
}

// ----------------------------------------------------------------------------
// S3-Compatible Cloud Object Storage Provider (Production)
// Implements AWS Signature V4 REST API without external bloat
// ----------------------------------------------------------------------------
class S3CloudProvider {
  constructor(config = {}) {
    this.endpoint = config.endpoint || process.env.S3_ENDPOINT || 'https://s3.amazonaws.com';
    this.region = config.region || process.env.S3_REGION || 'us-east-1';
    this.bucket = config.bucket || process.env.S3_BUCKET || 'finpro-cloud-documents';
    this.accessKeyId = config.accessKeyId || process.env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || '';
    this.forcePathStyle = config.forcePathStyle === true || process.env.S3_FORCE_PATH_STYLE === 'true';
    this.publicUrl = config.publicUrl || process.env.S3_PUBLIC_URL || '';
  }

  _isConfigured() {
    return !!(
      this.accessKeyId &&
      this.accessKeyId !== 'YOUR_S3_ACCESS_KEY_ID' &&
      this.secretAccessKey &&
      this.secretAccessKey !== 'YOUR_S3_SECRET_ACCESS_KEY'
    );
  }

  _signRequest(method, urlStr, headers = {}, payloadHash = 'UNSIGNED-PAYLOAD') {
    const parsedUrl = new URL(urlStr);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    headers['host'] = parsedUrl.host;
    headers['x-amz-date'] = amzDate;
    headers['x-amz-content-sha256'] = payloadHash;

    const sortedHeaders = Object.keys(headers)
      .map(k => k.toLowerCase())
      .sort();
    const canonicalHeaders = sortedHeaders.map(k => `${k}:${headers[k].trim()}\n`).join('');
    const signedHeaders = sortedHeaders.join(';');

    const canonicalRequest = [
      method,
      parsedUrl.pathname,
      parsedUrl.search.replace(/^\?/, ''),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return headers;
  }

  _buildObjectUrl(key) {
    const cleanKey = encodeURI(key.replace(/^\//, ''));
    const endpointUrl = new URL(this.endpoint);
    const hasPath = endpointUrl.pathname && endpointUrl.pathname !== '/';
    if (this.forcePathStyle || hasPath || endpointUrl.host.includes('supabase.co') || endpointUrl.host.includes('cloudflarestorage.com')) {
      const basePath = endpointUrl.pathname.replace(/\/$/, '');
      return `${endpointUrl.origin}${basePath}/${this.bucket}/${cleanKey}`;
    }
    return `${endpointUrl.protocol}//${this.bucket}.${endpointUrl.host}/${cleanKey}`;
  }

  async upload({ buffer, key, contentType = 'application/octet-stream', metadata = {} }) {
    if (!this._isConfigured()) {
      throw new Error('Cloud S3 Object Storage is not configured with valid credentials in .env');
    }

    const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const url = this._buildObjectUrl(key);
    const headers = {
      'content-type': contentType,
      'content-length': String(buffer.length),
    };

    const signedHeaders = this._signRequest('PUT', url, headers, payloadHash);

    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'http:' ? http : https;
      const req = transport.request(
        url,
        { method: 'PUT', headers: signedHeaders },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              key,
              url: this.publicUrl ? `${this.publicUrl.replace(/\/$/, '')}/${encodeURI(key)}` : url,
              size: buffer.length,
              contentType,
              provider: 's3',
              etag: res.headers.etag || payloadHash,
              createdAt: new Date().toISOString(),
              metadata,
            });
          } else {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => reject(new Error(`S3 Upload Failed (${res.statusCode}): ${data}`)));
          }
        }
      );

      req.on('error', reject);
      req.write(buffer);
      req.end();
    });
  }

  async download(key) {
    if (!this._isConfigured()) {
      throw new Error('Cloud S3 Object Storage is not configured');
    }
    const url = this._buildObjectUrl(key);
    const signedHeaders = this._signRequest('GET', url, {});

    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'http:' ? http : https;
      const req = transport.request(url, { method: 'GET', headers: signedHeaders }, (res) => {
        if (res.statusCode === 404) {
          return reject(Object.assign(new Error(`File not found in storage (${key})`), { statusCode: 404 }));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`S3 Download Failed (${res.statusCode})`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            size: buffer.length,
            contentType: res.headers['content-type'] || 'application/octet-stream',
            key,
            provider: 's3',
          });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  async delete(key) {
    if (!this._isConfigured()) return { success: false, error: 'S3 not configured' };
    const url = this._buildObjectUrl(key);
    const signedHeaders = this._signRequest('DELETE', url, {});

    return new Promise((resolve) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'http:' ? http : https;
      const req = transport.request(url, { method: 'DELETE', headers: signedHeaders }, (res) => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, key, provider: 's3' });
      });
      req.on('error', err => resolve({ success: false, error: err.message, key }));
      req.end();
    });
  }

  async getPublicOrSignedUrl(key, { expiresIn = 3600 } = {}) {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${encodeURI(key)}`;
    }
    return this._buildObjectUrl(key);
  }

  async checkHealth() {
    const start = Date.now();
    if (!this._isConfigured()) {
      return {
        available: false,
        status: 'not_configured',
        provider: 's3',
        note: 'S3 Object Storage configured in fallback or unconfigured mode. Set S3_ACCESS_KEY_ID in .env for production cloud store.',
        bucket: this.bucket,
        latencyMs: 0,
      };
    }

    try {
      const endpointUrl = new URL(this.endpoint);
      const hasPath = endpointUrl.pathname && endpointUrl.pathname !== '/';
      const usePathStyle = this.forcePathStyle || hasPath || endpointUrl.host.includes('supabase.co') || endpointUrl.host.includes('cloudflarestorage.com');
      const url = usePathStyle
        ? `${this.endpoint.replace(/\/$/, '')}/${this.bucket}`
        : `${endpointUrl.protocol}//${this.bucket}.${endpointUrl.host}`;
      const signedHeaders = this._signRequest('HEAD', url, {});

      return await new Promise((resolve) => {
        const parsed = new URL(url);
        const transport = parsed.protocol === 'http:' ? http : https;
        const req = transport.request(url, { method: 'HEAD', headers: signedHeaders, timeout: 5000 }, (res) => {
          const latencyMs = Date.now() - start;
          const ok = res.statusCode >= 200 && res.statusCode < 400;
          resolve({
            available: ok,
            status: ok ? 'available' : 'degraded',
            statusCode: res.statusCode,
            provider: 's3',
            bucket: this.bucket,
            region: this.region,
            latencyMs,
          });
        });
        req.on('timeout', () => {
          req.destroy();
          resolve({ available: false, status: 'timeout', provider: 's3', latencyMs: Date.now() - start });
        });
        req.on('error', (err) => {
          resolve({ available: false, status: 'unreachable', error: err.message, provider: 's3', latencyMs: Date.now() - start });
        });
        req.end();
      });
    } catch (err) {
      return {
        available: false,
        status: 'error',
        error: err.message,
        provider: 's3',
        latencyMs: Date.now() - start,
      };
    }
  }
}

// ----------------------------------------------------------------------------
// Storage Service Singleton Manager
// ----------------------------------------------------------------------------
class StorageService {
  constructor() {
    this.localProvider = new LocalDiskProvider(process.env.STORAGE_LOCAL_DIR);
    this.cloudProvider = new S3CloudProvider();
  }

  get activeProvider() {
    const prov = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
    return (prov === 's3' || prov === 'cloud') ? this.cloudProvider : this.localProvider;
  }

  get providerName() {
    const prov = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
    return (prov === 's3' || prov === 'cloud') ? 's3' : 'local';
  }

  async upload({ buffer, key, contentType, metadata, isPublic }) {
    return this.activeProvider.upload({ buffer, key, contentType, metadata, isPublic });
  }

  async download(key) {
    return this.activeProvider.download(key);
  }

  async delete(key) {
    return this.activeProvider.delete(key);
  }

  async getPublicOrSignedUrl(key, options) {
    return this.activeProvider.getPublicOrSignedUrl(key, options);
  }

  async checkStorageHealth() {
    return this.activeProvider.checkHealth();
  }
}

const storageService = new StorageService();

module.exports = storageService;
