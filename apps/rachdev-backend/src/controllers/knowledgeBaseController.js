'use strict';

/**
 * Knowledge base management for the agent product. A tenant_admin adds reference
 * docs (paste text or upload .txt/.md/.pdf); each doc is chunked for retrieval.
 * An agent's knowledge tool then searches these chunks (see agentTools.js).
 * Tenant-scoped throughout.
 */

const Busboy = require('busboy');
const { KnowledgeBase } = require('@rach/core');

const noWorkspace = (req, res) => {
  if (req.user.tenant_id == null) { res.status(400).json({ error: 'No workspace provisioned for this account yet', code: 'no_tenant' }); return true; }
  return false;
};

exports.list = async (req, res) => {
  if (req.user.tenant_id == null) return res.json({ docs: [] });
  res.json({ docs: await KnowledgeBase.listDocs(req.user.tenant_id) });
};

exports.create = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const title = String((req.body && req.body.title) || '').trim();
  const body = String((req.body && req.body.body) || '').trim();
  const citation = req.body && req.body.citation ? String(req.body.citation).trim() : null;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const doc = await KnowledgeBase.addDoc(req.user.tenant_id, { title, body, citation, userId: req.user.id });
  res.status(201).json({ doc });
};

exports.remove = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const ok = await KnowledgeBase.deleteDoc(req.user.tenant_id, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true });
};

// Extract plain text from an uploaded file buffer by extension.
async function extractText(filename, buffer) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (['txt', 'md', 'markdown', 'csv', 'text'].includes(ext)) return buffer.toString('utf8');
  if (ext === 'pdf') {
    try {
      // unpdf is ESM-only; dynamic import keeps this CJS module happy.
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join('\n') : String(text || '');
    } catch {
      const err = new Error("Couldn't read text from this PDF — it may be scanned/image-only or corrupt. Paste the text instead.");
      err.status = 422;
      throw err;
    }
  }
  const err = new Error('Unsupported file type. Upload .txt, .md, or .pdf.');
  err.status = 415;
  throw err;
}

// POST /api/kb/upload (multipart) — parse a file into a knowledge doc.
exports.upload = async (req, res, next) => {
  if (noWorkspace(req, res)) return;
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  const fields = {};
  let filename = '';
  let tooBig = false;
  const chunks = [];

  bb.on('field', (name, val) => { fields[name] = val; });
  bb.on('file', (_name, file, info) => {
    filename = info.filename || 'document';
    file.on('data', (d) => chunks.push(d));
    file.on('limit', () => { tooBig = true; file.resume(); });
  });
  bb.on('error', next);
  bb.on('close', async () => {
    try {
      if (tooBig) return res.status(413).json({ error: 'File too large (max 5 MB).' });
      if (!chunks.length) return res.status(400).json({ error: 'No file uploaded.' });
      const text = (await extractText(filename, Buffer.concat(chunks))).trim();
      if (!text) return res.status(422).json({ error: 'No readable text found in the file.' });
      const title = String(fields.title || filename.replace(/\.[^.]+$/, '')).trim() || 'Untitled';
      const citation = fields.citation ? String(fields.citation).trim() : filename;
      const doc = await KnowledgeBase.addDoc(req.user.tenant_id, { title, body: text, citation, userId: req.user.id });
      res.status(201).json({ doc });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  });

  req.pipe(bb);
};
