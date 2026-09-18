'use strict';

/**
 * Load the ARKA cluster's kubeconfig into a configured KubeConfig — DEV ONLY.
 *
 * In production the site-controller runs IN the cluster and authenticates with a
 * projected Kubernetes ServiceAccount token against kubernetes.default.svc:443 —
 * SpaceArk does NOT hand out a kubeconfig for production (contract §13). This
 * loader exists so the reconcilers can be developed/tested locally against the
 * ARKA test cluster, using the decrypted kubeconfig ARKA provided.
 *
 * Priority: ARKA_KUBECONFIG_B64 → ARKA_KUBECONFIG → KUBECONFIG → in-cluster/default.
 */

const k8s = require('@kubernetes/client-node');

function loadArkaKubeConfig() {
  const kc = new k8s.KubeConfig();

  if (process.env.ARKA_KUBECONFIG_B64) {
    const yaml = Buffer.from(process.env.ARKA_KUBECONFIG_B64, 'base64').toString('utf8');
    kc.loadFromString(yaml);
  } else if (process.env.ARKA_KUBECONFIG) {
    kc.loadFromFile(process.env.ARKA_KUBECONFIG);
  } else if (process.env.KUBECONFIG) {
    kc.loadFromFile(process.env.KUBECONFIG);
  } else {
    // In-cluster (projected ServiceAccount) when running as a real site-controller Pod.
    kc.loadFromDefault();
  }

  if (!kc.getCurrentCluster()) {
    throw new Error(
      'No current cluster — set ARKA_KUBECONFIG (dev) or run in-cluster with a ServiceAccount (prod).'
    );
  }
  return kc;
}

module.exports = { loadArkaKubeConfig };
