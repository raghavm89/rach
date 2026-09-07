'use strict';

/**
 * Stateful-image guardrail (go-live audit P0 #1).
 *
 * Shared "container" workloads render as a stateless Deployment with a read-only root filesystem
 * and only bounded emptyDir scratch (see site-controller manifests.js) — there is NO persistent
 * volume, so anything a container writes to disk is lost on every pod reschedule, node reboot, or
 * redeploy. A customer who runs a database image there gets a database that silently loses all its
 * data. Until PVC/StatefulSet support lands, we refuse stateful images on the container path and
 * point people at the durable options (RachBase managed Postgres, or the VM/Max path).
 *
 * Detection is deliberately precise: `postgres`/`postgresql` are blocked, but `postgrest` (the
 * stateless PostgREST API) is NOT.
 */

// Canonical image names for data stores / stateful services where losing the write path is silent
// and harmful. Matched against the image NAME (last path segment), not arbitrary substrings.
const STATEFUL_NAMES = new Set([
  // relational
  'postgres', 'postgresql', 'mysql', 'mariadb', 'percona', 'cockroachdb', 'cockroach', 'yugabytedb',
  // document / wide-column / graph
  'mongo', 'mongodb', 'cassandra', 'scylladb', 'scylla', 'couchdb', 'couchbase', 'rethinkdb',
  'arangodb', 'neo4j', 'surrealdb',
  // key-value / cache-with-persistence
  'redis', 'valkey', 'keydb', 'etcd', 'memcached',
  // search / analytics / timeseries
  'elasticsearch', 'opensearch', 'clickhouse', 'influxdb', 'timescaledb', 'questdb',
  'victoriametrics', 'prometheus', 'druid', 'pinot',
  // brokers / object store (persistent by nature)
  'rabbitmq', 'kafka', 'zookeeper', 'nats', 'pulsar', 'minio',
]);

// Split "[registry[:port]/]repo[:tag][@digest]" → the image NAME (last repo segment, lowercased).
function imageName(image) {
  if (!image || typeof image !== 'string') return '';
  let ref = image.trim().toLowerCase();
  ref = ref.split('@')[0];                 // drop digest
  const lastSlash = ref.lastIndexOf('/');
  const repoAndMaybeReg = ref;
  // Tag is a ':' AFTER the last '/'. A ':' before the last '/' is a registry port — leave it.
  const afterSlash = lastSlash === -1 ? repoAndMaybeReg : repoAndMaybeReg.slice(lastSlash + 1);
  const name = afterSlash.split(':')[0];   // drop tag
  return name;
}

/**
 * Classify an image. Returns { stateful:boolean, name, match:string|null }.
 * Matches when the image name is a known store, or its first `-`/`_`-delimited part is
 * (so `redis-stack`, `clickhouse-server`, `postgres-16` match; `postgrest` does not).
 */
function classifyStatefulImage(image) {
  const name = imageName(image);
  if (!name) return { stateful: false, name, match: null };
  if (STATEFUL_NAMES.has(name)) return { stateful: true, name, match: name };
  const head = name.split(/[-_]/)[0];
  if (head && STATEFUL_NAMES.has(head)) return { stateful: true, name, match: head };
  return { stateful: false, name, match: null };
}

// True when this service is on the ephemeral container path (shared compute). VM/dedicated targets
// have a real disk and are unaffected.
function isContainerPath(computeTarget) {
  return String(computeTarget || 'shared') === 'shared';
}

/**
 * Throw a 400 (with a helpful message) when a stateful image is being run on the container path.
 * No-op for the VM path, non-docker sources, or stateless images.
 */
function assertContainerImageAllowed({ image, computeTarget, sourceType } = {}) {
  if (sourceType && sourceType !== 'docker_image') return; // GitHub-repo builds aren't user DB images
  if (!isContainerPath(computeTarget)) return;
  const c = classifyStatefulImage(image);
  if (!c.stateful) return;
  const err = new Error(
    `"${c.match}" is a database/stateful image, but the container path has no persistent storage yet — ` +
    `its data would be wiped on every restart or redeploy. Use RachBase managed Postgres for a database, ` +
    `or deploy this on the VM (Max) path, which has a persistent disk.`
  );
  err.status = 400;
  err.code = 'stateful_image_not_supported';
  err.details = { image, match: c.match };
  throw err;
}

module.exports = { classifyStatefulImage, assertContainerImageAllowed, isContainerPath, imageName, STATEFUL_NAMES };
