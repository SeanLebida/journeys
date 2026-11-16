#!/usr/bin/env python3
"""Read or update Journeys App Store Connect listing URLs.

Privacy policy lives on appInfoLocalizations (app-level, every locale).
Marketing and support live on appStoreVersionLocalizations and can only
be changed on an editable version (PREPARE_FOR_SUBMISSION,
DEVELOPER_REJECTED, and similar). A live version is reported, not patched;
new version URLs go out with the next release.

Run by .github/workflows/ios-update-listing-urls.yml. MODE=check only
reads and reports; MODE=update patches records that are not already
correct, then reads them back. Update mode refuses to write if a target
URL does not return HTTP 200, unless IGNORE_URL_CHECK=1.

Env: APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY (never
printed), MODE.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt

BUNDLE_ID = "how.authentic.journeys"
BASE = "https://api.appstoreconnect.apple.com"
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"}
PRIVACY_URL = "https://journeys.authentic.how/privacy/"
MARKETING_URL = "https://journeys.authentic.how/"
SUPPORT_URL = "https://journeys.authentic.how/privacy/"

MODE = os.environ.get("MODE", "check")
UPDATE = MODE == "update"
IGNORE_URL_CHECK = os.environ.get("IGNORE_URL_CHECK", "").strip() in {"1", "true", "yes"}


def token():
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["APPSTORE_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
        os.environ["APPSTORE_PRIVATE_KEY"],
        algorithm="ES256",
        headers={"kid": os.environ["APPSTORE_KEY_ID"], "typ": "JWT"},
    )


def api(method, path, body=None, params=None, ok_missing=False):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token())
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        if ok_missing and err.code == 404:
            return None
        detail = err.read().decode(errors="replace")
        try:
            errs = json.loads(detail).get("errors", [])
            detail = "; ".join(f"{e.get('code')}: {e.get('title')} - {e.get('detail')}" for e in errs)
        except ValueError:
            pass
        raise RuntimeError(f"{method} {path} failed with HTTP {err.code}: {detail}") from err


def say(msg):
    print(msg, flush=True)


def public_url_status(url):
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", "JourneysListingUrlCheck/1.0")
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.getcode(), res.geturl()
    except urllib.error.HTTPError as err:
        return err.code, url
    except urllib.error.URLError as err:
        reason = getattr(err, "reason", err)
        return 0, str(reason)


def require_public_urls():
    unique = [PRIVACY_URL, MARKETING_URL]
    if SUPPORT_URL not in unique:
        unique.append(SUPPORT_URL)
    bad = []
    for url in unique:
        code, final = public_url_status(url)
        say(f"Public URL {url} -> HTTP {code}" + (f" (final {final})" if final != url else ""))
        if code != 200:
            bad.append(f"{url} returned HTTP {code}")
    if bad and UPDATE and not IGNORE_URL_CHECK:
        sys.exit("Refusing to update App Store Connect until those URLs return HTTP 200. "
                 "Set IGNORE_URL_CHECK=1 only if you still want to write them. " + "; ".join(bad))
    if bad:
        say("WARNING: " + "; ".join(bad))


def state_of(record):
    attrs = record.get("attributes") or {}
    return attrs.get("appStoreState") or attrs.get("state") or "unknown"


def patch_field(kind, typ, ident, locale, field, current, desired):
    if current == desired:
        say(f"  {kind} {locale} {field}: already {desired}")
        return "unchanged"
    if not UPDATE:
        say(f"  {kind} {locale} {field}: {current!r} -> {desired!r} (check; not written)")
        return "planned"
    try:
        api("PATCH", f"/v1/{typ}/{ident}", {"data": {
            "type": typ, "id": ident, "attributes": {field: desired}}})
    except RuntimeError as err:
        say(f"  {kind} {locale} {field}: FAILED {current!r} -> {desired!r}: {err}")
        return "failed"
    say(f"  {kind} {locale} {field}: {current!r} -> {desired!r}")
    return "updated"


def report_app_infos(app_id):
    infos = api("GET", f"/v1/apps/{app_id}/appInfos")["data"]
    results = []
    say("App info (privacy policy URL):")
    if not infos:
        say("  No app infos returned.")
        return results
    for info in infos:
        state = state_of(info)
        say(f"  AppInfo {info['id']} state={state}")
        locs = api("GET", f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]
        if not locs:
            say("    No localizations.")
            continue
        for loc in locs:
            locale = (loc.get("attributes") or {}).get("locale")
            current = (loc.get("attributes") or {}).get("privacyPolicyUrl")
            say(f"    {locale} privacyPolicyUrl={current!r}")
            results.append({"kind": "appInfoLocalization", "info_id": info["id"], "state": state,
                            "id": loc["id"], "locale": locale, "current": current})
    return results


def report_versions(app_id):
    versions = api("GET", f"/v1/apps/{app_id}/appStoreVersions",
                   params={"filter[platform]": "IOS", "limit": "25"})["data"]
    results = []
    say("App Store versions (marketing and support URLs):")
    if not versions:
        say("  No iOS versions returned.")
        return results
    for ver in versions:
        attrs = ver["attributes"]
        version = attrs.get("versionString")
        state = state_of(ver)
        editable = state in EDITABLE
        say(f"  version {version}: {state} ({'editable' if editable else 'not editable'})")
        locs = api("GET", f"/v1/appStoreVersions/{ver['id']}/appStoreVersionLocalizations")["data"]
        if not locs:
            say("    No localizations.")
            results.append({"version": version, "version_id": ver["id"], "state": state,
                            "editable": editable, "id": None, "locale": None,
                            "marketing": None, "support": None})
            continue
        for loc in locs:
            a = loc.get("attributes") or {}
            locale = a.get("locale")
            marketing = a.get("marketingUrl")
            support = a.get("supportUrl")
            say(f"    {locale} marketingUrl={marketing!r} supportUrl={support!r}")
            results.append({"version": version, "version_id": ver["id"], "state": state,
                            "editable": editable, "id": loc["id"], "locale": locale,
                            "marketing": marketing, "support": support})
    return results


def main():
    if MODE not in {"check", "update"}:
        sys.exit(f"MODE must be check or update, not {MODE!r}.")
    require_public_urls()

    apps = api("GET", "/v1/apps", params={"filter[bundleId]": BUNDLE_ID})["data"]
    if not apps:
        sys.exit(f"No App Store Connect app for {BUNDLE_ID}.")
    app = apps[0]
    app_id = app["id"]
    say(f"App {app['attributes'].get('name')} ({app_id}), bundle {BUNDLE_ID}")

    infos = report_app_infos(app_id)
    versions = report_versions(app_id)

    counts = {"updated": 0, "unchanged": 0, "planned": 0, "failed": 0, "skipped": 0}

    say("Privacy policy URL plan:")
    if not infos:
        say("  Nothing to change; no app info localizations.")
    for row in infos:
        result = patch_field("appInfo", "appInfoLocalizations", row["id"], row["locale"],
                             "privacyPolicyUrl", row["current"], PRIVACY_URL)
        counts[result] += 1

    say("Marketing and support URL plan:")
    seen_version = set()
    if not versions:
        say("  Nothing to change; no iOS versions.")
    for row in versions:
        key = row["version"]
        if not row["id"]:
            if key not in seen_version:
                say(f"  version {key} ({row['state']}) has no localizations.")
                seen_version.add(key)
            continue
        if not row["editable"]:
            if key not in seen_version:
                say(f"  version {key} is {row['state']} (not editable). "
                    f"marketingUrl and supportUrl stay as they are and will carry "
                    f"over to the next version unless that version is updated.")
                seen_version.add(key)
            say(f"    {row['locale']} marketingUrl={row['marketing']!r} supportUrl={row['support']!r}")
            counts["skipped"] += 1
            continue
        counts[patch_field(f"version {row['version']}", "appStoreVersionLocalizations",
                           row["id"], row["locale"], "marketingUrl",
                           row["marketing"], MARKETING_URL)] += 1
        counts[patch_field(f"version {row['version']}", "appStoreVersionLocalizations",
                           row["id"], row["locale"], "supportUrl",
                           row["support"], SUPPORT_URL)] += 1

    if UPDATE:
        say("Read-back after update:")
        report_app_infos(app_id)
        report_versions(app_id)
    else:
        say("Check only; nothing was written.")

    say("Summary: " + ", ".join(f"{k}={v}" for k, v in counts.items() if v or k in {"updated", "failed"}))
    if counts["failed"]:
        sys.exit(f"{counts['failed']} App Store Connect update(s) failed.")
    if UPDATE:
        say("Update finished.")
    else:
        say("CHECK OK.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as err:
        sys.exit(str(err))
