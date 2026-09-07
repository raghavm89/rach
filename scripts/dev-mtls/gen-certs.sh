#!/usr/bin/env bash
# Generate a local dev PKI for the production-style BFF ↔ site-controller loop:
#   - a CA that signs both the terminator's server cert and the BFF's client cert
#   - server cert (SAN localhost/127.0.0.1) for the mTLS terminator
#   - client cert = RachBase's partner identity (the BFF presents this)
#   - an RS256 keypair for signing/verifying the OAuth JWT
#
# Usage:  scripts/dev-mtls/gen-certs.sh [OUT_DIR]     (default: ./secrets, from the repo root)
# Re-run any time; it overwrites. If you regenerate the CA, re-register the site so the BFF
# trusts the new server cert:  node apps/rachbase-backend/scripts/site-upsert.js upsert \
#     --site-id site1 --api-url https://localhost:8443/v1 --audience spaceark-site-api:site1 \
#     --ca-file <OUT_DIR>/ca.crt
set -euo pipefail
OUT="${1:-secrets}"
mkdir -p "$OUT"
cd "$OUT"

# CA
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 -subj "/CN=rachbase-local-ca" -out ca.crt

# Server cert for the terminator (SAN via config file → portable across OpenSSL/LibreSSL)
cat > server.cnf <<'EOF'
[req]
distinguished_name=dn
req_extensions=v3
prompt=no
[dn]
CN=localhost
[v3]
subjectAltName=DNS:localhost,IP:127.0.0.1
EOF
openssl genrsa -out server.key 2048
openssl req -new -key server.key -config server.cnf -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 \
  -extfile server.cnf -extensions v3 -out server.crt

# Client cert = the BFF's partner identity
openssl genrsa -out client.key 2048
openssl req -new -key client.key -subj "/CN=rachbase-bff" -out client.csr
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -out client.crt

# OAuth RS256 keypair (BFF signs with oauth.key; facade verifies with oauth.pub)
openssl genrsa -out oauth.key 2048
openssl rsa -in oauth.key -pubout -out oauth.pub

rm -f server.csr client.csr server.cnf ca.srl
echo "✅ wrote dev PKI to $OUT/:"
echo "   ca.crt  server.crt server.key  client.crt client.key  oauth.key oauth.pub"
