#!/usr/bin/env node
// App Store Connect full listing upload: metadata + screenshots + submit for review
import { readFileSync, statSync } from "fs";
import { createSign } from "crypto";
import { createReadStream } from "fs";

const KEY_ID    = "7N7T2FPQN2";
const ISSUER_ID = "b79da7bd-6f34-47ab-abd1-2a65ae9774a1";
const APP_ID    = "6782063727";
const KEY_PATH  = "/home/ubuntu/yafoot/asc-key.p8";
const SHOTS_DIR = "/tmp/screenshots";
const BASE      = "https://api.appstoreconnect.apple.com/v1";
const SUPPORT_URL = "https://dist-five-zeta-92i4a6g3xx.vercel.app/support";
const MARKETING_URL = "https://dist-five-zeta-92i4a6g3xx.vercel.app";
const SAFE_DESCRIPTION = "Create football prediction challenges with friends. Add your own match by entering two teams or countries and a start time, invite friends, pick exact scores, and follow private league leaderboards. YaFoot keeps setup fast with username-only play, shareable league codes, friend invites, chat, direct messages, and Party Mode for live friend-hosted prediction rounds. Free to play. No email required.";
const SAFE_KEYWORDS = "football,soccer,predictions,friends,league,leaderboard,scores,challenge,chat,party";
const SAFE_SUBTITLE = "Friend Score Predictions";

// ── JWT generation ────────────────────────────────────────────────────────────
function makeJwt() {
  const key = readFileSync(KEY_PATH, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200,
    aud: "appstoreconnect-v1",
  })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(unsigned);
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" }, "base64url");
  return `${unsigned}.${sig}`;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const jwt = makeJwt();
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ASC ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function uploadBytes(uploadOp, filePath) {
  // uploadOp has: url, method, requestHeaders, length, offset
  const { url, method, requestHeaders, length, offset } = uploadOp;
  const buf = readFileSync(filePath);
  const slice = buf.slice(offset, offset + length);
  const headers = {};
  for (const { name, value } of (requestHeaders || [])) headers[name] = value;
  headers["Content-Length"] = String(slice.length);
  const res = await fetch(url, { method, headers, body: slice });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload PUT → ${res.status}: ${t.slice(0, 300)}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("── Step a: find in-flight version ──");
  const states = [
    "PREPARE_FOR_SUBMISSION",
    "REJECTED",
    "DEVELOPER_REJECTED",
    "WAITING_FOR_REVIEW",
    "IN_REVIEW",
    "PENDING_DEVELOPER_RELEASE",
    "READY_FOR_REVIEW",
  ].join(",");
  const versionsResp = await api(
    "GET",
    `/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=${states}&limit=10`
  );
  console.log("Versions found:", versionsResp.data?.length);

  let versionId;
  if (versionsResp.data && versionsResp.data.length > 0) {
    versionId = versionsResp.data[0].id;
    console.log("Using version ID:", versionId, "state:", versionsResp.data[0].attributes?.appStoreState);
  } else {
    // Try getting any version
    console.log("No in-flight version found with those states — fetching all versions");
    const allVersions = await api("GET", `/apps/${APP_ID}/appStoreVersions?limit=5`);
    console.log("All versions:", JSON.stringify(allVersions.data?.map(v => ({ id: v.id, state: v.attributes?.appStoreState, ver: v.attributes?.versionString })), null, 2));
    if (!allVersions.data?.length) throw new Error("No versions found for app");
    // pick first editable one
    const editable = allVersions.data.find(v =>
      ["PREPARE_FOR_SUBMISSION","REJECTED","DEVELOPER_REJECTED","READY_FOR_REVIEW"].includes(v.attributes?.appStoreState)
    ) || allVersions.data[0];
    versionId = editable.id;
    console.log("Using version ID:", versionId, "state:", editable.attributes?.appStoreState);
  }

  console.log("\n── Step b: set copyright ──");
  await api("PATCH", `/appStoreVersions/${versionId}`, {
    data: {
      type: "appStoreVersions",
      id: versionId,
      attributes: { copyright: "2026 Axel Cassou" },
    },
  });
  console.log("Copyright set.");

  console.log("\n── Step c: find/create en-US localization ──");
  const locsResp = await api("GET", `/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  let locId = locsResp.data?.find(l => l.attributes?.locale === "en-US")?.id;
  if (!locId) {
    console.log("Creating en-US localization…");
    const created = await api("POST", "/appStoreVersionLocalizations", {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: {
          locale: "en-US",
          description: "",
          keywords: "",
          supportUrl: "",
        },
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
        },
      },
    });
    locId = created.data.id;
  }
  console.log("Localization ID:", locId);

  await api("PATCH", `/appStoreVersionLocalizations/${locId}`, {
    data: {
      type: "appStoreVersionLocalizations",
      id: locId,
      attributes: {
        description: SAFE_DESCRIPTION,
        keywords: SAFE_KEYWORDS,
        supportUrl: SUPPORT_URL,
        marketingUrl: MARKETING_URL,
      },
    },
  });
  console.log("Localization patched.");

  console.log("\n── Step d: set app categories ──");
  const appInfosResp = await api("GET", `/apps/${APP_ID}/appInfos?limit=5`);
  const appInfoId = appInfosResp.data?.[0]?.id;
  console.log("AppInfo ID:", appInfoId);
  if (appInfoId) {
    // First find the localization for appInfo
    try {
      await api("PATCH", `/appInfos/${appInfoId}`, {
        data: {
          type: "appInfos",
          id: appInfoId,
          relationships: {
            primaryCategory: { data: { type: "appCategories", id: "SPORTS" } },
            secondaryCategory: { data: { type: "appCategories", id: "SOCIAL_NETWORKING" } },
          },
        },
      });
      console.log("Categories set: SPORTS (primary), SOCIAL_NETWORKING (secondary)");
    } catch (e) {
      console.warn("Category set failed (may need appInfoLocalizations):", e.message);
      // Try via appInfoLocalizations
      try {
        const aiLocResp = await api("GET", `/appInfos/${appInfoId}/appInfoLocalizations?limit=5`);
        const aiLocId = aiLocResp.data?.find(l => l.attributes?.locale === "en-US")?.id || aiLocResp.data?.[0]?.id;
        if (aiLocId) {
          await api("PATCH", `/appInfoLocalizations/${aiLocId}`, {
            data: {
              type: "appInfoLocalizations",
              id: aiLocId,
              attributes: {
                name: "YaFoot",
                subtitle: SAFE_SUBTITLE,
              },
            },
          });
          console.log("AppInfo name/subtitle set.");
        }
      } catch (e2) {
        console.warn("AppInfoLocalization patch failed:", e2.message);
      }
    }

    // Set name + subtitle via appInfoLocalizations
    try {
      const aiLocResp = await api("GET", `/appInfos/${appInfoId}/appInfoLocalizations?limit=5`);
      const aiLocId = aiLocResp.data?.find(l => l.attributes?.locale === "en-US")?.id || aiLocResp.data?.[0]?.id;
      if (aiLocId) {
        await api("PATCH", `/appInfoLocalizations/${aiLocId}`, {
          data: {
            type: "appInfoLocalizations",
            id: aiLocId,
            attributes: {
              name: "YaFoot",
              subtitle: SAFE_SUBTITLE,
            },
          },
        });
        console.log("App name + subtitle set.");
      }
    } catch (e) {
      console.warn("Name/subtitle set failed:", e.message);
    }
  }

  // ── Screenshot upload helper ──
  async function uploadScreenshots(displayType, prefix) {
    console.log(`\n── Screenshots: ${displayType} ──`);

    // find or create screenshot set
    const setsResp = await api("GET", `/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=20`);
    let setId = setsResp.data?.find(s => s.attributes?.screenshotDisplayType === displayType)?.id;
    if (!setId) {
      console.log(`Creating screenshot set for ${displayType}…`);
      const created = await api("POST", "/appScreenshotSets", {
        data: {
          type: "appScreenshotSets",
          attributes: { screenshotDisplayType: displayType },
          relationships: {
            appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: locId } },
          },
        },
      });
      setId = created.data.id;
    }
    console.log(`Screenshot set ID (${displayType}):`, setId);

    // delete existing screenshots in the set to avoid duplicates
    try {
      const existingResp = await api("GET", `/appScreenshotSets/${setId}/appScreenshots?limit=20`);
      for (const shot of (existingResp.data || [])) {
        await api("DELETE", `/appScreenshots/${shot.id}`);
        console.log("Deleted existing screenshot:", shot.id);
      }
    } catch (e) {
      console.warn("Could not delete existing screenshots:", e.message);
    }

    const files = [
      `${SHOTS_DIR}/${prefix}_01.png`,
      `${SHOTS_DIR}/${prefix}_02.png`,
      `${SHOTS_DIR}/${prefix}_03.png`,
      `${SHOTS_DIR}/${prefix}_04.png`,
    ];

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      let fileSize;
      try { fileSize = statSync(filePath).size; } catch { console.warn("Missing:", filePath); continue; }

      // Compute MD5 checksum
      const { createHash } = await import("crypto");
      const fileBuf = readFileSync(filePath);
      const md5 = createHash("md5").update(fileBuf).digest("hex");

      console.log(`Uploading ${filePath} (${fileSize} bytes)…`);

      // Reserve slot
      const reserved = await api("POST", "/appScreenshots", {
        data: {
          type: "appScreenshots",
          attributes: {
            fileSize,
            fileName: `${prefix}_0${i+1}.png`,
          },
          relationships: {
            appScreenshotSet: { data: { type: "appScreenshotSets", id: setId } },
          },
        },
      });
      const screenshotId = reserved.data.id;
      const uploadOps = reserved.data.attributes.uploadOperations;

      // Upload bytes
      for (const op of uploadOps) {
        await uploadBytes(op, filePath);
      }

      // Commit
      await api("PATCH", `/appScreenshots/${screenshotId}`, {
        data: {
          type: "appScreenshots",
          id: screenshotId,
          attributes: {
            uploaded: true,
            sourceFileChecksum: md5,
          },
        },
      });
      console.log(`Screenshot ${i+1} committed (ID: ${screenshotId})`);

      // Poll until UPLOAD_COMPLETE
      let attempts = 0;
      while (attempts < 12) {
        await sleep(5000);
        const check = await api("GET", `/appScreenshots/${screenshotId}`);
        const state = check.data?.attributes?.assetDeliveryState?.state;
        console.log(`  state: ${state}`);
        if (state === "UPLOAD_COMPLETE") break;
        if (state === "FAILED") { console.error("Screenshot upload FAILED"); break; }
        attempts++;
      }
    }
    return setId;
  }

  await uploadScreenshots("APP_IPHONE_67", "iphone");
  await uploadScreenshots("APP_IPAD_PRO_3GEN_129", "ipad");

  console.log("\n── Step g: submit for review ──");
  try {
    // Check for existing review submission
    const existingResp = await api("GET", `/reviewSubmissions?filter[app]=${APP_ID}&limit=5`).catch(() => null);
    let reviewId = existingResp?.data?.find(s => s.attributes?.state === "READY_FOR_REVIEW" || s.attributes?.state === "WAITING_FOR_REVIEW")?.id;

    if (!reviewId) {
      console.log("Creating new review submission…");
      const sub = await api("POST", "/reviewSubmissions", {
        data: {
          type: "reviewSubmissions",
          attributes: { platform: "IOS" },
          relationships: {
            app: { data: { type: "apps", id: APP_ID } },
          },
        },
      });
      reviewId = sub.data.id;
      console.log("Review submission created:", reviewId);
    } else {
      console.log("Using existing review submission:", reviewId);
    }

    // Check if version item already exists
    const itemsResp = await api("GET", `/reviewSubmissions/${reviewId}/items?limit=10`).catch(() => null);
    const hasVersionItem = itemsResp?.data?.some(item =>
      item.relationships?.appStoreVersion?.data?.id === versionId
    );

    if (!hasVersionItem) {
      console.log("Adding version item to submission…");
      await api("POST", "/reviewSubmissionItems", {
        data: {
          type: "reviewSubmissionItems",
          relationships: {
            reviewSubmission: { data: { type: "reviewSubmissions", id: reviewId } },
            appStoreVersion: { data: { type: "appStoreVersions", id: versionId } },
          },
        },
      }).catch(e => console.warn("Add version item:", e.message));
    }

    // Confirm (submit) the review submission
    console.log("Submitting for review…");
    await api("PATCH", `/reviewSubmissions/${reviewId}`, {
      data: {
        type: "reviewSubmissions",
        id: reviewId,
        attributes: { submitted: true },
      },
    });
    console.log("Submitted for review!");
  } catch (e) {
    console.error("Submit failed:", e.message.slice(0, 500));
  }

  console.log("\nDONE.");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
