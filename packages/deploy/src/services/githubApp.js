'use strict';

const crypto = require('crypto');

/**
 * GitHub App installation-token helper.
 *
 * Extracted so it lives in ONE place — previously duplicated in deployRunner
 * and RachBase's deploymentController. Both should import this.
 *
 * Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM, \n-escaped ok).
 */
async function getInstallationToken(installationId) {
  const APP_ID   = process.env.GITHUB_APP_ID || '';
  const PRIV_KEY = (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const now     = Math.floor(Date.now() / 1000);
  const payload = { iat: now - 60, exp: now + 540, iss: APP_ID };
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto.createSign('RSA-SHA256').update(`${header}.${body}`).sign(PRIV_KEY, 'base64url');
  const appJwt  = `${header}.${body}.${sig}`;

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RachDev',
      },
    }
  );
  if (!res.ok) throw new Error('Failed to get GitHub installation token');
  const data = await res.json();
  return data.token;
}

module.exports = { getInstallationToken };
