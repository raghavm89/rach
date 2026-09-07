'use strict';

/**
 * The api facade — receiving end of the site API (contract §4/§5). Authenticates the
 * partner JWT, enforces idempotency by canonical request hash, validates the DTO, and
 * creates the request CRD (its ONLY cluster write). Returns 202 + normalized status;
 * never leaks raw internals. Deps are injected so handlers are unit-testable.
 */

const http = require('http');
const { requestHash, tenantPutDTO, appPutDTO, releasePostDTO, appDeleteDTO, tenantDeleteDTO, tenantSuspendDTO, tenantResumeDTO } = require('@rach/site-contracts');
const { registry, routeTemplate, metrics } = require('../metrics');

const resp = (status, body) => ({ status, body });
const bearer = (headers) => (headers.authorization || '').replace(/^Bearer /, '');

// Shared prelude: authenticate → validate DTO → idempotency. Returns { error } (a
// response to send) OR { claims, dto, idemKey, hash } to continue.
async function prelude({ method, route, tenantId, headers, body }, deps, validate) {
  let claims;
  try { claims = deps.verifyJwt(bearer(headers)); } catch { return { error: resp(401, { error: 'UNAUTHENTICATED' }) }; }
  let dto;
  try { dto = validate(body); } catch (e) { return { error: resp(400, { error: 'INVALID_REQUEST', message: e.message }) }; }
  const idemKey = headers['idempotency-key'];
  if (!idemKey) return { error: resp(400, { error: 'INVALID_REQUEST', message: 'Idempotency-Key required' }) };
  const hash = requestHash({ method, route, siteId: deps.siteId, partnerId: claims.sub || '', tenantId, body });
  const idem = await deps.idempotency.check(idemKey, hash); // awaitable: sync in-memory or durable async
  if (idem.status === 'conflict') return { error: resp(409, { error: 'IDEMPOTENCY_CONFLICT' }) };
  if (idem.status === 'replay') return { error: resp(202, idem.response) };
  return { claims, dto, idemKey, hash };
}

const accept = async (deps, p, resourceId, operationId, type) => {
  const envelope = { operationId, siteId: deps.siteId, resourceId, state: 'ACCEPTED', statusUrl: `/v1/operations/${operationId}` };
  await deps.idempotency.put(p.idemKey, p.hash, envelope);
  if (type) metrics.operation(type, 'ACCEPTED');
  return resp(202, envelope);
};

// PUT /v1/tenants/:tenantId
async function handleTenantPut(ctx, deps) {
  const p = await prelude(ctx, deps, tenantPutDTO);
  if (p.error) return p.error;
  await deps.createClaim({ tenantId: ctx.tenantId, plan: p.dto.plan, customerRef: p.dto.customerRef, generation: p.dto.generation, operationId: p.dto.operationId });
  return accept(deps, p, ctx.tenantId, p.dto.operationId, 'tenant.upsert');
}

// PUT /v1/tenants/:tenantId/apps/:appId
async function handleAppPut(ctx, deps) {
  const p = await prelude(ctx, deps, appPutDTO);
  if (p.error) return p.error;
  await deps.createApp({ tenantId: ctx.tenantId, appId: ctx.appId, runtime: p.dto.runtime || null, image: p.dto.image, port: p.dto.port, resources: p.dto.resources, owner: p.dto.owner || null, env: p.dto.env || null, command: p.dto.command || null, host: p.dto.host || null, operationId: p.dto.operationId });
  return accept(deps, p, ctx.appId, p.dto.operationId, 'app.upsert');
}

// POST /v1/tenants/:tenantId/apps/:appId/releases
async function handleReleasePost(ctx, deps) {
  const p = await prelude(ctx, deps, releasePostDTO);
  if (p.error) return p.error;
  await deps.createRelease({ tenantId: ctx.tenantId, appId: ctx.appId, deploymentId: p.dto.deploymentId, source: p.dto.source, image: p.dto.image, externalImage: p.dto.externalImage || null, applicationGeneration: p.dto.applicationGeneration, operationId: p.dto.operationId });
  return accept(deps, p, ctx.appId, p.dto.operationId, 'release.create');
}

// DELETE /v1/tenants/:tenantId/apps/:appId — decommission an app.
async function handleAppDelete(ctx, deps) {
  const p = await prelude(ctx, deps, appDeleteDTO);
  if (p.error) return p.error;
  await deps.deleteApp({ tenantId: ctx.tenantId, appId: ctx.appId, operationId: p.dto.operationId });
  return accept(deps, p, ctx.appId, p.dto.operationId, 'app.delete');
}

// DELETE /v1/tenants/:tenantId — decommission a tenant (namespace teardown).
async function handleTenantDelete(ctx, deps) {
  const p = await prelude(ctx, deps, tenantDeleteDTO);
  if (p.error) return p.error;
  await deps.deleteTenant({ tenantId: ctx.tenantId, operationId: p.dto.operationId });
  return accept(deps, p, ctx.tenantId, p.dto.operationId, 'tenant.delete');
}

// POST /v1/tenants/:tenantId:suspend — stop mutations; mode drives routing/runtime.
async function handleTenantSuspend(ctx, deps) {
  const p = await prelude(ctx, deps, tenantSuspendDTO);
  if (p.error) return p.error;
  await deps.suspendTenant({ tenantId: ctx.tenantId, mode: p.dto.mode, reasonCode: p.dto.reasonCode, generation: p.dto.generation, operationId: p.dto.operationId });
  return accept(deps, p, ctx.tenantId, p.dto.operationId, 'tenant.suspend');
}

// POST /v1/tenants/:tenantId:resume — reconstruct runtime from retained desired state.
async function handleTenantResume(ctx, deps) {
  const p = await prelude(ctx, deps, tenantResumeDTO);
  if (p.error) return p.error;
  await deps.resumeTenant({ tenantId: ctx.tenantId, generation: p.dto.generation, operationId: p.dto.operationId });
  return accept(deps, p, ctx.tenantId, p.dto.operationId, 'tenant.resume');
}

// GET /v1/operations/:operationId
async function handleGetOperation(operationId, deps) {
  const op = await deps.getOperation(operationId);
  if (!op) return resp(404, { error: 'NOT_FOUND' });
  return resp(200, op); // already normalized by the store
}

// GET /v1/tenants/:tenantId/registry/images — normalized approved-image list. SpaceArk
// owns the registry, so `listRegistryImages` is the seam it implements; until then the
// injected stub returns []. Read-only, no side effects.
async function handleRegistryImages(tenantId, deps) {
  const images = deps.listRegistryImages ? await deps.listRegistryImages(tenantId) : [];
  return resp(200, { images: Array.isArray(images) ? images : [] });
}

// ── HTTP server wiring (behind SpaceArk's TLS-terminating gateway) ──────────────
const lower = (h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

function readJson(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve(null); } });
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body ?? {}));
}

async function route(req, res, deps) {
  const url = new URL(req.url, 'http://x');
  const headers = lower(req.headers);
  const T = 't-[a-z0-9]{8,32}';
  const A = 'a-[a-z0-9]{8,15}';
  let m;
  if (req.method === 'POST' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})/apps/(${A})/releases$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleReleasePost({ method: 'POST', route: url.pathname, tenantId: m[1], appId: m[2], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'PUT' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})/apps/(${A})$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleAppPut({ method: 'PUT', route: url.pathname, tenantId: m[1], appId: m[2], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'PUT' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleTenantPut({ method: 'PUT', route: url.pathname, tenantId: m[1], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'POST' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T}):suspend$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleTenantSuspend({ method: 'POST', route: url.pathname, tenantId: m[1], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'POST' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T}):resume$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleTenantResume({ method: 'POST', route: url.pathname, tenantId: m[1], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'DELETE' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})/apps/(${A})$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleAppDelete({ method: 'DELETE', route: url.pathname, tenantId: m[1], appId: m[2], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'DELETE' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})$`)))) {
    const body = await readJson(req); if (body === null) return send(res, 400, { error: 'INVALID_REQUEST' });
    const r = await handleTenantDelete({ method: 'DELETE', route: url.pathname, tenantId: m[1], headers, body }, deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'GET' && (m = url.pathname.match(new RegExp(`^/v1/tenants/(${T})/registry/images$`)))) {
    const r = await handleRegistryImages(m[1], deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'GET' && (m = url.pathname.match(/^\/v1\/operations\/([\w-]+)$/))) {
    const r = await handleGetOperation(m[1], deps);
    return send(res, r.status, r.body);
  }
  if (req.method === 'GET' && url.pathname === '/v1/site') return send(res, 200, { site: deps.siteId, ready: true });
  return send(res, 404, { error: 'NOT_FOUND' });
}

// The @kubernetes/client-node wrapper often throws a terse "HTTP request failed" that hides
// the real cause (a 4xx/5xx from the API server, or a transport error like ECONNREFUSED /
// self-signed cert / timeout in `.cause`). Surface everything useful for diagnosis.
function describeError(e) {
  const parts = [e && e.message ? e.message : String(e)];
  const status = e && (e.statusCode ?? e.response?.statusCode ?? e.body?.code);
  if (status) parts.push(`status=${status}`);
  const body = e && (e.body ?? e.response?.body);
  if (body) parts.push(`body=${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  const cause = e && (e.cause || e.error);
  if (cause) parts.push(`cause=${cause.code || cause.message || cause}`);
  if (e && e.code) parts.push(`code=${e.code}`);
  return parts.join(' | ');
}

function startApiServer(deps, { port = Number(process.env.API_PORT) || 8443 } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/metrics') {
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
      return res.end(registry.render());
    }
    // Bounded-cardinality request metric + a concise access log (skip /metrics scrapes),
    // recorded once the response is sent — so successful 202s are visible, not just errors.
    res.on('finish', () => {
      metrics.apiRequest(routeTemplate(url.pathname), req.method, res.statusCode);
      if (url.pathname !== '/metrics') console.log(`[api] ${req.method} ${url.pathname} → ${res.statusCode}`);
    });
    route(req, res, deps).catch((e) => { console.error('[api] handler error:', describeError(e)); if (!res.headersSent) send(res, 500, { error: 'SITE_UNAVAILABLE' }); });
  });
  server.listen(port, () => console.log(`api facade listening on :${port} (+ /metrics)`));
  return server;
}

module.exports = { handleTenantPut, handleAppPut, handleReleasePost, handleAppDelete, handleTenantDelete, handleTenantSuspend, handleTenantResume, handleGetOperation, handleRegistryImages, startApiServer };
