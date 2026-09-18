'use strict';

/**
 * Auto-detect the "type of app" a GitHub repo deploys, and map it to a Docker Hub image
 * used as the DEFAULT deploy image (editable — BYOI always wins). Decided 2026-08-21:
 *   - "Both": prefer a RUNNABLE off-the-shelf image (a Dockerfile FROM a known service),
 *     else fall back to the detected language's BASE RUNTIME image.
 *   - Tags are PINNED to majors for reproducibility.
 *
 * The pure `detectFromFiles(rootFiles, dockerfile)` is unit-tested; `detectRepoImage`
 * layers the GitHub read on top (needs the tenant's installation token).
 */

// Off-the-shelf SERVICE images (runnable as-is). Keyed by the base image's repo name, so a
// Dockerfile `FROM postgres:16` (or `FROM library/postgres`) resolves to a service.
const SERVICE_IMAGES = {
  postgres:  'postgres:16',
  mysql:     'mysql:8',
  mariadb:   'mariadb:11',
  redis:     'redis:7',
  mongo:     'mongo:7',
  mongodb:   'mongo:7',
  rabbitmq:  'rabbitmq:3-management',
  memcached: 'memcached:1.6',
  nginx:     'nginx:1.27-alpine',
};

// LANGUAGE base-runtime images (a smart default; the app still needs a build to run).
const LANGUAGE_IMAGES = {
  node:   'node:20-alpine',
  python: 'python:3.12-slim',
  go:     'golang:1.22-alpine',
  ruby:   'ruby:3.3-slim',
  java:   'eclipse-temurin:21-jre',
  php:    'php:8.3-apache',
  rust:   'rust:1-slim',
  static: 'nginx:1.27-alpine',
};

// Root manifest file → language.
const MANIFESTS = [
  { type: 'node',   files: ['package.json'] },
  { type: 'python', files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'] },
  { type: 'go',     files: ['go.mod'] },
  { type: 'ruby',   files: ['Gemfile'] },
  { type: 'java',   files: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
  { type: 'php',    files: ['composer.json'] },
  { type: 'rust',   files: ['Cargo.toml'] },
];

// A base image ref (`ghcr.io/foo/bar:tag@sha256:…`) → its bare repo name (`bar`).
function baseName(ref) {
  if (!ref) return null;
  const noDigest = String(ref).split('@')[0];
  const noTag = noDigest.split(':')[0];
  return noTag.split('/').pop().toLowerCase() || null;
}

// The first `FROM <image>` in a Dockerfile (ignores `--platform`, ARG-only lines).
function dockerfileFrom(content) {
  if (!content) return null;
  const m = String(content).match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/im);
  return m ? m[1] : null;
}

// Map a Dockerfile base image → a language type (so `FROM node:20` → node).
const BASE_TO_LANG = {
  node: 'node', python: 'python', golang: 'go', go: 'go', ruby: 'ruby',
  php: 'php', rust: 'rust', openjdk: 'java', 'eclipse-temurin': 'java', amazoncorretto: 'java',
};

/**
 * PURE. Given a repo's root file names (+ optional Dockerfile contents), return the detected
 * { type, image, source } or null (→ leave blank for BYOI). `image` may be null when a
 * Dockerfile exists with an unrecognized base (they'll build from their Dockerfile).
 */
function detectFromFiles(rootFiles = [], dockerfileContent = null) {
  const files = new Set((rootFiles || []).map((f) => String(f)));

  if (files.has('Dockerfile')) {
    const from = dockerfileFrom(dockerfileContent);
    const name = baseName(from);
    // 1) Runnable-first: FROM a known off-the-shelf service.
    if (name && SERVICE_IMAGES[name]) {
      return { type: name, image: from && from.includes(':') ? from : SERVICE_IMAGES[name], source: 'dockerfile-service' };
    }
    // 2) FROM a language base → that language's pinned runtime.
    if (name && BASE_TO_LANG[name]) {
      const lang = BASE_TO_LANG[name];
      return { type: lang, image: LANGUAGE_IMAGES[lang], source: 'dockerfile-lang' };
    }
    // 3) Dockerfile with an unknown base → they build from it; no prefill.
    return { type: 'dockerfile', image: null, source: 'dockerfile' };
  }

  // 4) Language base by root manifest.
  for (const m of MANIFESTS) {
    if (m.files.some((f) => files.has(f))) {
      return { type: m.type, image: LANGUAGE_IMAGES[m.type], source: 'manifest' };
    }
  }

  // 5) Static site.
  if (files.has('index.html')) return { type: 'static', image: LANGUAGE_IMAGES.static, source: 'static' };

  // 6) Unknown → BYOI.
  return null;
}

/**
 * Detect the default image for a tenant's GitHub repo. Best-effort: returns null if GitHub
 * isn't connected, the repo can't be read, or nothing matches. Never throws to the caller.
 */
async function detectRepoImage({ tenantId, repoFullName, branch }) {
  try {
    const gh = require('./githubApp');
    const installationId = await gh.installationIdForTenant(tenantId);
    if (!installationId) return null;
    const [owner, repo] = String(repoFullName || '').split('/');
    if (!owner || !repo) return null;
    const token = await gh.installationToken(installationId);
    const ref = branch || 'main';
    const files = await gh.repoRootFiles({ token, owner, repo, ref });
    const dockerfile = files.includes('Dockerfile') ? await gh.repoFile({ token, owner, repo, ref, path: 'Dockerfile' }) : null;
    return detectFromFiles(files, dockerfile);
  } catch {
    return null;
  }
}

// Detected app type → contract runtime id (§7.1 app spec `runtime`, e.g. "nodejs-22").
const RUNTIME_FOR = {
  node: 'nodejs-22',
  python: 'python-3.12',
  go: 'go-1.22',
  ruby: 'ruby-3.3',
  java: 'java-21',
  php: 'php-8.3',
  rust: 'rust-1',
  static: 'static',
};
function runtimeFor(appType) {
  return RUNTIME_FOR[String(appType || '')] || null;
}

// Suggested run command per detected type. This is ONLY a UI prefill/suggestion: if the
// user leaves the run command blank we send nothing and the built image's own ENTRYPOINT/CMD
// runs (for a source build that is what the buildpack/runtime set; for an external image its
// own CMD). Returning null means "no suggestion — rely on the image default".
const DEFAULT_COMMAND = {
  node: 'npm start',
  python: 'python app.py',
  ruby: 'bundle exec ruby app.rb',
  go: './app',
  java: 'java -jar app.jar',
  php: 'php -S 0.0.0.0:8080',
  rust: './app',
  static: null,
};
function defaultCommandFor(appType) {
  const t = String(appType || '');
  return Object.prototype.hasOwnProperty.call(DEFAULT_COMMAND, t) ? DEFAULT_COMMAND[t] : null;
}

module.exports = { SERVICE_IMAGES, LANGUAGE_IMAGES, RUNTIME_FOR, DEFAULT_COMMAND, baseName, dockerfileFrom, detectFromFiles, detectRepoImage, runtimeFor, defaultCommandFor };
