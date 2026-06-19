#!/usr/bin/env python3
"""
Generate iOS Distribution Certificate and Provisioning Profile via Apple Developer API,
then configure EAS local credentials for non-interactive builds.
"""
import jwt
import time
import requests
import json
import base64
import sys
import os
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
from cryptography.x509.oid import NameOID
from cryptography.hazmat.backends import default_backend

KEY_ID = "7N7T2FPQN2"
ISSUER_ID = "b79da7bd-6f34-47ab-abd1-2a65ae9774a1"
P8_KEY_PATH = "/home/ubuntu/yafoot/asc-key.p8"
TEAM_ID = "83PWQ46HYA"
BUNDLE_ID = "com.axelcassou.yafoot"
BASE_URL = "https://api.appstoreconnect.apple.com/v1"
P12_PASSWORD = "YaFoot2026Dist"
OUTPUT_DIR = "/home/ubuntu/yafoot/credentials"

def generate_jwt():
    with open(P8_KEY_PATH, 'r') as f:
        private_key = f.read()
    now = int(time.time())
    payload = {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"}
    return jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": KEY_ID})

def headers():
    return {"Authorization": f"Bearer {generate_jwt()}", "Content-Type": "application/json"}

def api_get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=headers(), params=params)
    r.raise_for_status()
    return r.json()

def api_post(path, body):
    r = requests.post(f"{BASE_URL}{path}", headers=headers(), json=body)
    if r.status_code not in (200, 201):
        print(f"  ERROR {r.status_code}: {r.text[:500]}")
        r.raise_for_status()
    return r.json()

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── 1. Check existing distribution certificates ───────────────────────────
print("\n=== Step 1: Check existing certificates ===")
data = api_get("/certificates")
certs = data.get("data", [])
print(f"  Total certificates: {len(certs)}")
for c in certs:
    attrs = c["attributes"]
    print(f"    id={c['id']} type={attrs.get('certificateType')} name={attrs.get('name')} expires={attrs.get('expirationDate')}")

# ─── 2. Generate RSA key + CSR ─────────────────────────────────────────────
print("\n=== Step 2: Generate RSA key + CSR ===")
dist_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
csr = (
    x509.CertificateSigningRequestBuilder()
    .subject_name(x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "iPhone Distribution"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, TEAM_ID),
    ]))
    .sign(dist_key, hashes.SHA256(), default_backend())
)
csr_b64 = base64.b64encode(csr.public_bytes(Encoding.DER)).decode()
print("  CSR generated")

# ─── 3. Submit CSR to Apple for Distribution Certificate ───────────────────
print("\n=== Step 3: Create Distribution Certificate ===")
resp = api_post("/certificates", {
    "data": {
        "type": "certificates",
        "attributes": {"certificateType": "IOS_DISTRIBUTION", "csrContent": csr_b64}
    }
})
cert_id = resp["data"]["id"]
cert_content_b64 = resp["data"]["attributes"]["certificateContent"]
cert_name = resp["data"]["attributes"]["name"]
cert_expires = resp["data"]["attributes"]["expirationDate"]
print(f"  Created IOS_DISTRIBUTION: {cert_name} (id={cert_id}, expires={cert_expires})")

# ─── 4. Build p12 ─────────────────────────────────────────────────────────
print("\n=== Step 4: Build p12 ===")
cert_der = base64.b64decode(cert_content_b64)
cert = x509.load_der_x509_certificate(cert_der, default_backend())
p12_data = pkcs12.serialize_key_and_certificates(
    name=b"iPhone Distribution",
    key=dist_key,
    cert=cert,
    cas=None,
    encryption_algorithm=serialization.BestAvailableEncryption(P12_PASSWORD.encode()),
)
p12_path = os.path.join(OUTPUT_DIR, "dist-cert.p12")
with open(p12_path, "wb") as f:
    f.write(p12_data)
print(f"  Written: {p12_path}")

# ─── 5. Find or create App ID ─────────────────────────────────────────────
print("\n=== Step 5: Find or create App ID ===")
bundle_resp = api_get("/bundleIds", {"filter[identifier]": BUNDLE_ID})
bundle_ids = bundle_resp.get("data", [])
if bundle_ids:
    app_id = bundle_ids[0]["id"]
    print(f"  Found existing App ID: {app_id}")
else:
    create_resp = api_post("/bundleIds", {
        "data": {
            "type": "bundleIds",
            "attributes": {
                "identifier": BUNDLE_ID,
                "name": "YaFoot",
                "platform": "IOS",
            }
        }
    })
    app_id = create_resp["data"]["id"]
    print(f"  Created App ID: {app_id}")

# ─── 6. Create App Store provisioning profile ──────────────────────────────
print("\n=== Step 6: Create App Store provisioning profile ===")
profile_resp = api_post("/profiles", {
    "data": {
        "type": "profiles",
        "attributes": {
            "name": "YaFoot App Store",
            "profileType": "IOS_APP_STORE",
        },
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": app_id}},
            "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
        }
    }
})
profile_id = profile_resp["data"]["id"]
profile_content_b64 = profile_resp["data"]["attributes"]["profileContent"]
profile_name = profile_resp["data"]["attributes"]["name"]
profile_expires = profile_resp["data"]["attributes"]["expirationDate"]
print(f"  Created: {profile_name} (id={profile_id}, expires={profile_expires})")

mobileprovision_path = os.path.join(OUTPUT_DIR, "profile.mobileprovision")
with open(mobileprovision_path, "wb") as f:
    f.write(base64.b64decode(profile_content_b64))
print(f"  Written: {mobileprovision_path}")

# ─── 7. Write credentials.json for EAS local mode ─────────────────────────
print("\n=== Step 7: Write credentials.json ===")
credentials = {
    "ios": {
        "distributionCertificate": {
            "path": "credentials/dist-cert.p12",
            "password": P12_PASSWORD
        },
        "provisioningProfilePath": "credentials/profile.mobileprovision"
    }
}
creds_path = "/home/ubuntu/yafoot/credentials.json"
with open(creds_path, "w") as f:
    json.dump(credentials, f, indent=2)
print(f"  Written: {creds_path}")

print("\n=== DONE ===")
print(f"  p12: {p12_path}")
print(f"  profile: {mobileprovision_path}")
print(f"  credentials.json: {creds_path}")
print(f"  p12 password: {P12_PASSWORD}")
