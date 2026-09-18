#!/usr/bin/env node
'use strict';

/**
 * RachBase site-controller — entrypoint.
 *
 * Production: runs ONE component, selected by SITE_CONTROLLER_PROFILE
 * (api|tenant|workload|build), immutable for the process lifetime — never
 * changeable via HTTP (contract §3). Deployed as four separate Deployments with
 * separate ServiceAccounts, sharing this one image.
 *
 *   SITE_CONTROLLER_PROFILE=api node index.js run
 *
 * Dev helpers (local, against the ARKA test kubeconfig):
 *   node index.js health          # cluster connectivity
 *   node index.js bootstrap       # one-time: create the requests namespace + apply the CRDs
 *   node index.js provision-demo  # render + apply the hardened namespace (renderer check)
 *   node index.js teardown-demo
 *
 * NOTE: `bootstrap` is a DEV convenience. In production SpaceArk SRE installs the CRDs +
 * namespace (§13); the running profiles have no RBAC to create cluster resources (§11.2).
 */

try { require('dotenv').config(); } catch { /* dotenv optional */ }

const agent = require('./src/cluster/arkaClient');
const { selectProfile, PROFILES } = require('./src/profiles');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = () => process.argv[3] || '1';

const COMMANDS = {
  async run() {
    // SITE_CONTROLLER_PROFILE selects the component(s) to run. A single value is the
    // least-privilege split (each its own Deployment + ServiceAccount, §11.2). A
    // comma-separated list runs several in ONE process — supported in production too
    // (see deploy/site-controller-all-in-one.yaml), at the cost of one ServiceAccount
    // holding the UNION of their RBAC (the public api listener then shares that token).
    const names = String(process.env.SITE_CONTROLLER_PROFILE || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) {
      console.error(`SITE_CONTROLLER_PROFILE must be one (or a comma-separated list) of: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(2);
    }
    const chosen = names.map((n) => [n, selectProfile(n)]);
    const bad = chosen.filter(([, p]) => !p).map(([n]) => n);
    if (bad.length) {
      console.error(`unknown profile(s): ${bad.join(', ')}. valid: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(2);
    }
    if (chosen.length > 1) {
      console.warn(`site-controller: combined mode — ${chosen.length} profiles in one process (${names.join(', ')}). The ServiceAccount must hold the union of their RBAC; the public api listener shares that token (blast-radius trade-off vs the split deployment).`);
    }
    for (const [n, p] of chosen) console.log(`site-controller: profile "${n}" — ${p.describe}`);
    // Each start() sets up its watchers/server then blocks forever; Promise.all keeps the
    // process alive with all of them active. Leases differ per profile, so no contention.
    await Promise.all(chosen.map(([, p]) => p.start()));
  },

  // DEV-only one-time bootstrap: create the requests namespace + apply the CRDs, using the
  // SAME kubeconfig the controller uses (ARKA_KUBECONFIG / KUBECONFIG). Prod never runs this —
  // SpaceArk SRE installs these; the controller's RBAC can't create CRDs (§11.2/§13).
  async bootstrap() {
    const { execFileSync } = require('child_process');
    const path = require('path');
    const ns = process.env.SITE_REQUESTS_NAMESPACE || 'spaceark-site-requests';
    const crdDir = path.join(__dirname, 'deploy', 'crds');
    const kubeconfig = process.env.ARKA_KUBECONFIG || process.env.KUBECONFIG || '';
    const kflag = kubeconfig ? ['--kubeconfig', kubeconfig] : [];
    console.log(`→ bootstrapping platform resources${kubeconfig ? ` (kubeconfig ${kubeconfig})` : ''} …`);
    execFileSync('kubectl', [...kflag, 'apply', '-f', '-'], {
      input: `apiVersion: v1\nkind: Namespace\nmetadata: { name: ${ns} }\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    execFileSync('kubectl', [...kflag, 'apply', '-f', crdDir], { stdio: 'inherit' });
    console.log(`\n✅ bootstrap done — namespace "${ns}" + CRDs applied (one-time per cluster).`);
    console.log('   now run a profile:  SITE_CONTROLLER_PROFILE=workload node apps/site-controller/index.js run');
  },

  async health() {
    const h = await agent.health();
    console.log(`→ cluster: ${h.clusterName} @ ${h.server}`);
    console.log(`✓ k8s version: ${h.version} (${h.platform})`);
    console.log(`✓ nodes (${h.nodes.length}):`);
    for (const n of h.nodes) console.log(`   - ${n.name}  ready=${n.ready}  ${n.kubelet}`);
    console.log(`✓ namespaces (${h.namespaces.length}): ${h.namespaces.join(', ')}`);
    console.log('\n✅ site-controller: cluster reachable.');
  },

  async 'provision-demo'() {
    const t = tid();
    console.log(`→ provisioning hardened namespace for tenant ${t} …`);
    const { namespace } = await agent.provisionNamespace(t);
    console.log(`✓ namespace ${namespace} (PSS restricted + quota + limitrange + default-deny netpol)`);
    console.log('→ deploying demo container (traefik/whoami, fully hardened) …');
    await agent.deployWorkload({ tenantId: t, name: 'demo', image: 'traefik/whoami', port: 8080, args: ['--port', '8080'] });
    for (let i = 0; i < 20; i++) {
      const s = await agent.workloadStatus(t, 'demo');
      process.stdout.write(`   ready ${s.ready}/${s.replicas}\r`);
      if (s.ready >= 1) {
        console.log(`\n✅ demo workload running in ${namespace} — hardened container passed restricted PSS.`);
        console.log(`   verify: kubectl get all,networkpolicy,resourcequota -n ${namespace}`);
        return;
      }
      await sleep(1500);
    }
    console.log(`\n! demo not ready yet — kubectl get pods -n ${namespace} (describe for PSS/scheduling)`);
  },

  async 'status-demo'() {
    const s = await agent.workloadStatus(tid(), 'demo');
    console.log(`${s.namespace}/${s.name}: ready ${s.ready}/${s.replicas} (available ${s.available})`);
  },

  async 'reconcile-tenant'() {
    const t = process.argv[3] || '1';
    const plan = process.argv[4] || 'pro';
    const { reconcileOnce } = require('./src/reconcilers/tenant');
    console.log(`→ reconciling tenant ${t} (plan ${plan}) — converge → verify …`);
    const s = await reconcileOnce({ tenantId: t, plan });
    console.log(`state: ${s.state}${s.reason ? ` (${s.reason})` : ''}`);
    if (s.state === 'ACTIVE') console.log(`✅ tenant ${t} boundary ACTIVE (namespace rb-t-${t} verified)`);
  },

  async 'teardown-demo'() {
    const { namespace } = await agent.teardownNamespace(tid());
    console.log(`✓ deleting namespace ${namespace} (cascades to all workloads in it)`);
  },

  // One reconcile cycle over all TenantClaims: list → converge → verify → write status.
  async 'reconcile-claims'() {
    const claimStore = require('./src/api/claimStore');
    const R = require('./src/reconcilers/tenant');
    const items = await claimStore.listClaims();
    console.log(`→ ${items.length} TenantClaim(s) in ${claimStore.NAMESPACE}`);
    for (const crd of items) {
      const input = R.claimToInput(crd);
      const s = await R.reconcileOnce(input);
      await claimStore.patchStatus(input.name, R.statusPatch(s, input.generation));
      console.log(`   ${input.name} (plan ${input.plan}) → ${s.state}${s.reason ? ` (${s.reason})` : ''}`);
    }
  },
};

async function main() {
  const cmd = process.argv[2] || 'health';
  const fn = COMMANDS[cmd];
  if (!fn) {
    console.error(`unknown command: ${cmd}. try: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(2);
  }
  await fn();
}

main().catch((e) => {
  console.error('\n❌', e?.body?.message || e?.body?.reason || e.message);
  process.exit(1);
});
