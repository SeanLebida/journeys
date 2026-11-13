#!/usr/bin/env node
/**
 * Inspect Google Play tracks, or promote an already-uploaded versionCode
 * to the production track. Does not build or upload an AAB.
 *
 * Env:
 *   PLAY_SERVICE_ACCOUNT_JSON  required service-account JSON (never logged)
 *   PLAY_PACKAGE_NAME          default how.authentic.journeys
 *   PLAY_VERSION_CODE          required for promote
 *   PLAY_RELEASE_NOTES         en-US notes, max 500 chars (or PLAY_NOTES_FILE)
 *   PLAY_NOTES_FILE            optional path to en-US notes
 *   PLAY_STATUS                completed | inProgress | draft (default completed)
 *   PLAY_USER_FRACTION         required when status is inProgress (e.g. 0.1)
 *
 * Usage:
 *   node scripts/promote-android-play.mjs inspect
 *   node scripts/promote-android-play.mjs promote
 */
import { readFile, appendFile } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import process from 'node:process';

const ANDROID_PUBLISHER = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const NOTES_MAX = 500;
const DEFAULT_PACKAGE = 'how.authentic.journeys';
const TRACKS = ['internal', 'alpha', 'beta', 'production'];

function fail(message, extra) {
  console.error(message);
  if (extra) console.error(extra);
  process.exit(1);
}

function loadServiceAccount() {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    fail('PLAY_SERVICE_ACCOUNT_JSON is missing.');
  }
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) {
      fail('PLAY_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
    }
    return sa;
  } catch {
    fail('PLAY_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri || TOKEN_URI,
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${signer.sign(sa.private_key, 'base64url')}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const res = await fetch(sa.token_uri || TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    fail(`Failed to obtain Play API access token (HTTP ${res.status}).`, redactTokenResponse(text));
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail('Play API token response was not JSON.');
  }
  if (!json.access_token) fail('Play API token response had no access_token.');
  return json.access_token;
}

function redactTokenResponse(text) {
  // Keep the error shape, never print assertion or tokens.
  return text.replace(/"(access_token|id_token|refresh_token|assertion)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"');
}

async function api(token, method, path, body) {
  const res = await fetch(`${ANDROID_PUBLISHER}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const message = formatApiError(json) || text || `(HTTP ${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json || {};
}

function formatApiError(json) {
  if (!json || typeof json !== 'object') return '';
  const err = json.error;
  if (!err) return '';
  const bits = [err.message, err.status ? `(${err.status})` : '', err.code ? `code ${err.code}` : '']
    .filter(Boolean)
    .join(' ');
  const details = Array.isArray(err.errors)
    ? err.errors
        .map((e) => [e.message, e.reason, e.domain].filter(Boolean).join(' / '))
        .filter(Boolean)
        .join('; ')
    : '';
  return details ? `${bits} — ${details}` : bits;
}

async function createEdit(token, pkg) {
  return api(token, 'POST', `/applications/${encodeURIComponent(pkg)}/edits`, {});
}

async function deleteEdit(token, pkg, editId) {
  try {
    await api(token, 'DELETE', `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}`);
  } catch (err) {
    console.error(`Warning: could not close Play edit ${editId}: ${err.message}`);
  }
}

async function commitEdit(token, pkg, editId) {
  return api(
    token,
    'POST',
    `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}:commit`,
    {}
  );
}

async function listTracks(token, pkg, editId) {
  const listed = await api(
    token,
    'GET',
    `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}/tracks`
  );
  const byName = new Map((listed.tracks || []).map((t) => [t.track, t]));
  const tracks = {};
  for (const name of TRACKS) {
    if (byName.has(name)) {
      tracks[name] = byName.get(name);
      continue;
    }
    try {
      tracks[name] = await api(
        token,
        'GET',
        `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(name)}`
      );
    } catch (err) {
      tracks[name] = { track: name, releases: [], error: err.message };
    }
  }
  return tracks;
}

async function listBundles(token, pkg, editId) {
  try {
    const result = await api(
      token,
      'GET',
      `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}/bundles`
    );
    return result.bundles || [];
  } catch (err) {
    console.error(`Warning: could not list bundles: ${err.message}`);
    return [];
  }
}

function summarizeRelease(release) {
  if (!release) return '(none)';
  const codes = (release.versionCodes || []).join(', ') || '(no versionCodes)';
  const status = release.status || '(no status)';
  const fraction =
    release.userFraction != null && release.status === 'inProgress'
      ? `, rollout ${Math.round(Number(release.userFraction) * 100)}%`
      : release.status === 'completed'
        ? ', rollout 100%'
        : '';
  const name = release.name ? `, name ${release.name}` : '';
  return `${codes} status=${status}${fraction}${name}`;
}

function formatTrack(track) {
  const releases = track.releases || [];
  if (track.error && releases.length === 0) return `  ${track.track}: unavailable (${track.error})`;
  if (releases.length === 0) return `  ${track.track}: empty`;
  const lines = releases.map((rel, i) => `  ${track.track}[${i}]: ${summarizeRelease(rel)}`);
  return lines.join('\n');
}

function findVersionOnTracks(tracks, versionCode) {
  const found = [];
  const wanted = String(versionCode);
  for (const name of TRACKS) {
    const releases = tracks[name]?.releases || [];
    for (const release of releases) {
      if ((release.versionCodes || []).map(String).includes(wanted)) {
        found.push({ track: name, status: release.status || '', userFraction: release.userFraction ?? null, name: release.name || '' });
      }
    }
  }
  return found;
}

function printSnapshot({ pkg, tracks, bundles, versionCode }) {
  const lines = [];
  lines.push(`Play tracks for ${pkg}`);
  for (const name of TRACKS) lines.push(formatTrack(tracks[name] || { track: name, releases: [] }));
  const codes = bundles.map((b) => String(b.versionCode)).filter(Boolean);
  lines.push(`Uploaded bundles: ${codes.length ? codes.join(', ') : '(none listed)'}`);
  if (versionCode) {
    const found = findVersionOnTracks(tracks, versionCode);
    const inBundles = codes.includes(String(versionCode));
    if (found.length) {
      lines.push(
        `versionCode ${versionCode} is on: ${found
          .map((f) => `${f.track} (${f.status || 'unknown'}${f.status === 'completed' ? ', rollout 100%' : f.userFraction != null ? `, rollout ${Math.round(Number(f.userFraction) * 100)}%` : ''})`)
          .join('; ')}`
      );
    } else {
      lines.push(`versionCode ${versionCode} is not on any track.`);
    }
    lines.push(
      inBundles
        ? `versionCode ${versionCode} is present as an uploaded bundle.`
        : `versionCode ${versionCode} was not listed among uploaded bundles.`
    );
    const alpha = found.find((f) => f.track === 'alpha');
    if (alpha?.status === 'completed') {
      lines.push(`Alpha review gate: ${versionCode} is completed on alpha, so testers already have it.`);
    } else if (alpha) {
      lines.push(`Alpha review gate: ${versionCode} is on alpha with status=${alpha.status}.`);
    } else if (found.length) {
      lines.push(`Alpha review gate: ${versionCode} is not on alpha (found on ${found.map((f) => f.track).join(', ')}).`);
    }
  }
  const text = lines.join('\n');
  console.log(text);
  return text;
}

async function maybeWriteSummary(text) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  await appendFile(path, `### Play production promote\n\n\`\`\`\n${text}\n\`\`\`\n`);
}

async function snapshot(token, pkg, versionCode) {
  const edit = await createEdit(token, pkg);
  const editId = edit.id;
  try {
    const [tracks, bundles] = await Promise.all([
      listTracks(token, pkg, editId),
      listBundles(token, pkg, editId),
    ]);
    return { tracks, bundles, snapshot: printSnapshot({ pkg, tracks, bundles, versionCode }) };
  } finally {
    await deleteEdit(token, pkg, editId);
  }
}

async function readNotes() {
  if (process.env.PLAY_NOTES_FILE) {
    const raw = await readFile(process.env.PLAY_NOTES_FILE, 'utf8');
    return raw.replace(/^\uFEFF/, '').trim();
  }
  return (process.env.PLAY_RELEASE_NOTES || '').trim();
}

function buildRelease({ versionCode, notes, status, userFraction }) {
  const release = {
    versionCodes: [String(versionCode)],
    status,
    releaseNotes: [{ language: 'en-US', text: notes }],
  };
  if (status === 'inProgress') {
    const fraction = Number(userFraction);
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction >= 1) {
      fail('PLAY_USER_FRACTION must be a number between 0 and 1 when status is inProgress.');
    }
    release.userFraction = fraction;
  }
  return release;
}

async function inspect(token, pkg, versionCode) {
  const { snapshot: text } = await snapshot(token, pkg, versionCode);
  await maybeWriteSummary(text);
}

async function promote(token, pkg) {
  const versionCode = String(process.env.PLAY_VERSION_CODE || '').trim();
  if (!/^\d+$/.test(versionCode)) fail('PLAY_VERSION_CODE must be a positive integer.');

  const status = (process.env.PLAY_STATUS || 'completed').trim();
  if (!['completed', 'inProgress', 'draft'].includes(status)) {
    fail(`Unsupported PLAY_STATUS: ${status}`);
  }

  const notes = await readNotes();
  if (!notes) fail('Release notes are required to promote (PLAY_RELEASE_NOTES or PLAY_NOTES_FILE).');
  if (notes.length > NOTES_MAX) {
    fail(`Release notes are ${notes.length} characters; Play allows at most ${NOTES_MAX}.`);
  }

  const before = await snapshot(token, pkg, versionCode);
  const bundles = before.bundles.map((b) => String(b.versionCode));
  const found = findVersionOnTracks(before.tracks, versionCode);
  if (!bundles.includes(versionCode) && found.length === 0) {
    fail(`versionCode ${versionCode} is not on any track and was not listed as an uploaded bundle. Refusing to promote.`);
  }

  const alreadyProd = found.find((f) => f.track === 'production' && f.status === 'completed');
  if (alreadyProd && status === 'completed') {
    const text = `versionCode ${versionCode} is already completed on production (rollout 100%). No promote needed.\n${before.snapshot}`;
    console.log(text);
    await maybeWriteSummary(text);
    return;
  }

  const edit = await createEdit(token, pkg);
  const editId = edit.id;
  try {
    await api(
      token,
      'PUT',
      `/applications/${encodeURIComponent(pkg)}/edits/${encodeURIComponent(editId)}/tracks/production`,
      { track: 'production', releases: [buildRelease({ versionCode, notes, status, userFraction: process.env.PLAY_USER_FRACTION })] }
    );
    const committed = await commitEdit(token, pkg, editId);
    console.log(`Committed Play edit ${committed.id || editId} for versionCode ${versionCode} on production (${status}${status === 'completed' ? ', full rollout' : ''}).`);
  } catch (err) {
    await deleteEdit(token, pkg, editId);
    fail(
      `Play refused the production promote of versionCode ${versionCode}: ${err.message}`,
      'This is often a first production release needing a Console step (store listing, declarations, managed publishing, or a closed-testing eligibility window).'
    );
  }

  const after = await snapshot(token, pkg, versionCode);
  await maybeWriteSummary(`Promote attempted for versionCode ${versionCode}.\n\nAfter:\n${after.snapshot}`);
}

async function main() {
  const mode = process.argv[2] || 'inspect';
  if (!['inspect', 'promote'].includes(mode)) fail(`Unknown mode: ${mode}`);
  const sa = loadServiceAccount();
  const token = await getAccessToken(sa);
  const pkg = (process.env.PLAY_PACKAGE_NAME || DEFAULT_PACKAGE).trim();
  const versionCode = String(process.env.PLAY_VERSION_CODE || '').trim() || undefined;
  if (mode === 'inspect') await inspect(token, pkg, versionCode);
  else await promote(token, pkg);
}

main().catch((err) => {
  fail(err.message || String(err));
});
