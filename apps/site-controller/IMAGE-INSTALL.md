# Installing the site-controller image WITHOUT a registry (k3s airgapped import)

For a single-node k3s (e.g. `acme-vm-01`) you don't need a container registry — the image can
be shipped as a tarball and imported straight into the node's containerd. This is a good stopgap
for one node; a registry is still the right answer once there's more than one node (each node
would otherwise need its own import).

The image tarball is delivered **separately** from this docs bundle (it's ~60–90 MB gzipped —
too large for email; use scp or a cloud link).

---

## 1. Build + save the tarball (RachBase side, needs Docker)

From the RachBase monorepo root:

```
docker build -f apps/site-controller/Dockerfile -t rachbase-site-controller:1.0.4 .
docker save rachbase-site-controller:1.0.4 | gzip > site-controller-1.0.4.tar.gz
ls -lh site-controller-1.0.4.tar.gz          # note the size
```

`docker save` captures the exact image; `docker load` / `k3s ctr import` on the other side
reproduces it bit-for-bit — no registry involved.

## 2. Get the tarball to the node

Any transport EXCEPT email (size). Simplest, since you already SSH to the box:

```
scp site-controller-1.0.4.tar.gz root@<node-public-ip>:/root/
```

Or upload to a cloud link (Drive/Dropbox/S3 presigned) and `curl -O` it on the node.

## 3. Import into k3s containerd (on the node)

```
sudo k3s ctr images import <(gunzip -c /root/site-controller-1.0.4.tar.gz)
sudo k3s ctr images ls | grep rachbase-site-controller
# expect: docker.io/library/rachbase-site-controller:1.0.4
```

`k3s ctr` imports into the `k8s.io` containerd namespace that the kubelet reads, so the image is
immediately available to pods on this node.

## 4. Apply the manifests using the LOCAL image tag

The manifests already set `imagePullPolicy: IfNotPresent`, so kubelet uses the imported image and
never reaches for a registry. Substitute the local tag for the `IMAGE` placeholder:

```
sed 's#IMAGE#docker.io/library/rachbase-site-controller:1.0.4#' \
  deploy/site-controller.yaml | kubectl apply -f -
```

(Follow DEPLOY.md §4–§6 for namespaces, CRDs, the OAuth secret, and the edge gateway — only the
image source differs on this path.)

## 5. Verify

```
kubectl -n spaceark-site-system get pods         # Running, not ImagePullBackOff
kubectl -n spaceark-site-system logs deploy/site-controller-workload --tail=30
```

If a pod shows `ImagePullBackOff` / `ErrImagePull`, the Deployment's image string doesn't match
the imported tag exactly, or `imagePullPolicy` isn't `IfNotPresent`/`Never`. Compare:

```
kubectl -n spaceark-site-system get deploy site-controller-workload -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
sudo k3s ctr images ls | grep rachbase-site-controller
```
The two strings must be identical.

---

## Notes / caveats

- **Single node only.** The import lands on this one node's containerd. Add a node later → import
  there too, or switch to a registry.
- **Upgrades** = new tag (e.g. `1.0.4`) → new `docker save` → import → re-apply with the new tag.
  With `IfNotPresent`, re-using the SAME tag won't re-pull a changed image, so always bump the tag.
- **To go back to a registry** later, just `build-image.sh <registry> 1.0.4 --push` and substitute
  the registry reference instead — no manifest change needed (`IfNotPresent` still works).
