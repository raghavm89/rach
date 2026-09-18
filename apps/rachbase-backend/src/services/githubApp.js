'use strict';

/**
 * Minimal GitHub App REST client for READING repo contents (app-type auto-detection).
 * Mirrors the App-JWT → installation-token flow used by deploymentController; kept here as
 * a small self-contained reader so services can inspect a repo without importing a controller.
 */

const crypto = require('crypto');
const { pool } = require('@rach/core');

const GITHUB_APP_ID = process.env.GITHUB_APP_ID || '';
const GITHUB_APP_PRIVATE_KEY = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function buildAppJwt() {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) throw new Error('GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is not configured');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 540, iss: GITHUB_APP_ID })).toString('base64url');
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${body}`).sign(GITHUB_APP_PRIVATE_KEY, 'base64url');
  return `${header}.${body}.${sig}`;
}

const GH_HEADERS = (auth) => ({
  Authorization: auth,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'RachDev',
});

// The first (oldest) GitHub App installation for a tenant, or null.
async function installationIdForTenant(tenantId) {
  const { rows } = await pool.query(
    'SELECT installation_id FROM deployment_github_installations WHERE tenant_id = $1 ORDER BY installed_at LIMIT 1',
    [tenantId],
  );
  return rows[0]?.installation_id || null;
}

// A short-lived installation access token.
async function installationToken(installationId) {
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST', headers: GH_HEADERS(`Bearer ${buildAppJwt()}`),
  });
  if (!res.ok) throw new Error(`installation token failed (${res.status})`);
  return (await res.json()).token;
}

// Root-level file names of a repo at `ref` (files only, not directories).
async function repoRootFiles({ token, owner, repo, ref }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents?ref=${encodeURIComponent(ref)}`, {
    headers: GH_HEADERS(`token ${token}`),
  });
  if (!res.ok) throw new Error(`repo contents failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data.filter((f) => f.type === 'file').map((f) => f.name) : [];
}

// Resolve a ref (branch/tag/sha) to its exact commit SHA — so a deploy pins an immutable
// commit instead of a moving branch (contract §7.2 requires an exact commit, not a branch).
async function latestCommit({ token, owner, repo, ref }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, {
    headers: GH_HEADERS(`token ${token}`),
  });
  if (!res.ok) throw new Error(`resolve commit failed (${res.status})`);
  const data = await res.json();
  return data && data.sha ? data.sha : null;
}

// Raw text of a single file (base64-decoded) or null.
async function repoFile({ token, owner, repo, ref, path }) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers: GH_HEADERS(`token ${token}`),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.content ? Buffer.from(data.content, 'base64').toString('utf8') : null;
}

module.exports = { installationIdForTenant, installationToken, repoRootFiles, repoFile, latestCommit };
