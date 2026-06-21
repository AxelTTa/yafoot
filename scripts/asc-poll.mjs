#!/usr/bin/env node
// Polls Apple App Store Connect for review status changes.
// Exits when status reaches READY_FOR_SALE or REJECTED, or after MAX_CHECKS.

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const KEY_ID = '7N7T2FPQN2';
const ISSUER = 'b79da7bd-6f34-47ab-abd1-2a65ae9774a1';
const APP_ID = '6782063727';
const KEY_PATH = '/home/ubuntu/yafoot/asc-key.p8';
const POLL_INTERVAL_MS = 300_000; // 5 minutes
const MAX_CHECKS = 200;
const TERMINAL_STATES = new Set(['READY_FOR_SALE', 'REJECTED']);

function makeJWT() {
  const privateKey = readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: ISSUER,
    iat: now,
    exp: now + 1200, // 20 min
    aud: 'appstoreconnect-v1',
  })).toString('base64url');
  const data = `${header}.${payload}`;
  const sign = createSign('SHA256');
  sign.update(data);
  const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${data}.${sig}`;
}

async function fetchStatus() {
  const jwt = makeJWT();
  const url = `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ASC API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const versions = json.data;
  if (!versions || versions.length === 0) return null;
  return versions[0].attributes?.appVersionState ?? versions[0].attributes?.appStoreState ?? null;
}

function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!token || !chatId) { console.log('[telegram] env vars missing, skipping'); return; }
  try {
    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage"` +
      ` --data-urlencode chat_id=${chatId}` +
      ` --data-urlencode "text=${text.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    console.error('[telegram] send failed:', e.message);
  }
}

async function main() {
  console.log(`[asc-poll] Starting. App ${APP_ID}, max ${MAX_CHECKS} checks, interval ${POLL_INTERVAL_MS / 1000}s`);
  let lastStatus = null;
  let checks = 0;

  while (checks < MAX_CHECKS) {
    checks++;
    const ts = new Date().toISOString();
    let status;
    try {
      status = await fetchStatus();
    } catch (e) {
      console.error(`[asc-poll] ${ts} check #${checks} ERROR: ${e.message}`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    console.log(`[asc-poll] ${ts} check #${checks} status=${status}`);

    if (status && lastStatus !== null && status !== lastStatus) {
      const msg = `🍎 Apple review status changed: ${lastStatus} → ${status}. Check App Store Connect.`;
      console.log(`[asc-poll] STATUS CHANGE: ${lastStatus} -> ${status}`);
      sendTelegram(msg);
    }

    if (status) lastStatus = status;

    if (status && TERMINAL_STATES.has(status)) {
      console.log(`[asc-poll] Terminal state reached: ${status}. Exiting.`);
      break;
    }

    if (checks < MAX_CHECKS) await sleep(POLL_INTERVAL_MS);
  }

  if (checks >= MAX_CHECKS) {
    console.log(`[asc-poll] Reached max checks (${MAX_CHECKS}). Exiting.`);
    sendTelegram(`🍎 ASC poll ended after ${MAX_CHECKS} checks (~16h). Final status: ${lastStatus}. Check App Store Connect manually.`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(e => { console.error('[asc-poll] Fatal:', e); process.exit(1); });
