#!/usr/bin/env python3
"""Attach a processed TestFlight build to an App Store version and submit it
to App Review through the App Store Connect API.

Run by .github/workflows/ios-submit-review.yml. MODE=check only reads and
reports; MODE=submit makes the changes. The release type is always MANUAL,
so an approved version waits for a person to release it.

Env: APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY (never printed),
VERSION, BUILD_NUMBER, MODE.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt

BUNDLE_ID = "how.authentic.journeys"
BASE = "https://api.appstoreconnect.apple.com"
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"}
RELEASED = {"READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "REPLACED_WITH_NEW_VERSION", "REMOVED_FROM_SALE", "DEVELOPER_REMOVED_FROM_SALE"}
CONTACT_FIELDS = ("contactFirstName", "contactLastName", "contactPhone", "contactEmail")

VERSION = os.environ["VERSION"].strip()
BUILD_NUMBER = os.environ["BUILD_NUMBER"].strip()
SUBMIT = os.environ.get("MODE", "check") == "submit"


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
        sys.exit(f"{method} {path} failed with HTTP {err.code}: {detail}")


def say(msg):
    print(msg, flush=True)


def changelog_note():
    text = open("CHANGELOG.md", encoding="utf8").read()
    m = re.search(r"##\s+\[([^\]]+)\][^\n]*\n([\s\S]*?)(?=\n##\s+\[|$)", text)
    if not m or m.group(1) != VERSION:
        sys.exit(f"The newest CHANGELOG.md entry is not {VERSION}.")
    return m.group(2).strip()


def main():
    notes = open("docs/app-review-notes.txt", encoding="utf8").read().strip()
    whats_new = changelog_note()
    missing = []

    apps = api("GET", "/v1/apps", params={"filter[bundleId]": BUNDLE_ID})["data"]
    if not apps:
        sys.exit(f"No App Store Connect app for {BUNDLE_ID}.")
    app = apps[0]
    app_id = app["id"]
    say(f"App {app['attributes'].get('name')} ({app_id})")
    content_rights = app["attributes"].get("contentRightsDeclaration")
    say(f"Content rights declaration: {content_rights}")
    if not content_rights:
        missing.append("contentRightsDeclaration on the app is not set")

    versions = api("GET", f"/v1/apps/{app_id}/appStoreVersions",
                   params={"filter[platform]": "IOS", "limit": "20"})["data"]
    for v in versions:
        a = v["attributes"]
        say(f"  version {a['versionString']}: {a.get('appStoreState')} release={a.get('releaseType')}")
    ever_released = any(v["attributes"].get("appStoreState") in RELEASED for v in versions)

    open_subs = api("GET", "/v1/reviewSubmissions", params={
        "filter[app]": app_id, "filter[platform]": "IOS",
        "filter[state]": "WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES,CANCELING"})["data"]
    if open_subs:
        states = ", ".join(s["attributes"]["state"] for s in open_subs)
        sys.exit(f"Another review submission is already open ({states}). Not submitting.")

    # Build: wait for processing.
    build = None
    for attempt in range(40):
        found = api("GET", "/v1/builds", params={
            "filter[app]": app_id, "filter[version]": BUILD_NUMBER,
            "filter[preReleaseVersion.version]": VERSION, "limit": "1"})["data"]
        if found and found[0]["attributes"].get("processingState") == "VALID":
            build = found[0]
            break
        state = found[0]["attributes"].get("processingState") if found else "not found"
        say(f"Build {VERSION} ({BUILD_NUMBER}) is {state}; waiting (attempt {attempt + 1}/40)")
        time.sleep(30)
    if not build:
        sys.exit(f"Build {VERSION} ({BUILD_NUMBER}) never became VALID.")
    battrs = build["attributes"]
    say(f"Build {build['id']}: VALID, usesNonExemptEncryption={battrs.get('usesNonExemptEncryption')}, expired={battrs.get('expired')}")
    if battrs.get("expired"):
        sys.exit("That build has expired.")
    if battrs.get("usesNonExemptEncryption") is None:
        missing.append("export compliance (usesNonExemptEncryption) is unset on the build")

    target = next((v for v in versions if v["attributes"]["versionString"] == VERSION), None)
    editable = next((v for v in versions if v["attributes"].get("appStoreState") in EDITABLE), None)
    if target and target["attributes"].get("appStoreState") not in EDITABLE:
        sys.exit(f"Version {VERSION} exists in state {target['attributes'].get('appStoreState')} and can't be edited.")
    plan_version = target or editable

    # Review contact details: this version's, or the newest earlier version that has them.
    contact = None
    for v in ([plan_version] if plan_version else []) + versions:
        rd = api("GET", f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail", ok_missing=True)
        rd = (rd or {}).get("data")
        if rd and all(rd["attributes"].get(f) for f in CONTACT_FIELDS):
            contact = {f: rd["attributes"][f] for f in CONTACT_FIELDS}
            say(f"Review contact found on version {v['attributes']['versionString']}")
            break
    if not contact:
        missing.append("App Review contact name, phone and email (no earlier version has them)")

    if missing:
        for m in missing:
            say(f"MISSING: {m}")
        sys.exit("Stopping before any change. Fill the fields above, then rerun.")

    if not SUBMIT:
        action = "edit" if plan_version else "create"
        wn = "set What's New" if ever_released else "skip What's New (first release)"
        say(f"CHECK OK. Submit mode would {action} version {VERSION}, attach build {BUILD_NUMBER}, "
            f"set release type MANUAL, set review notes ({len(notes)} chars), {wn}, and submit.")
        return

    # 1. The version.
    if plan_version:
        vid = plan_version["id"]
        api("PATCH", f"/v1/appStoreVersions/{vid}", {"data": {"type": "appStoreVersions", "id": vid,
            "attributes": {"versionString": VERSION, "releaseType": "MANUAL"}}})
        say(f"Using version {vid}, now {VERSION}, release MANUAL")
    else:
        created = api("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions",
            "attributes": {"platform": "IOS", "versionString": VERSION, "releaseType": "MANUAL"},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
        vid = created["data"]["id"]
        say(f"Created version {VERSION} ({vid}), release MANUAL")

    # 2. The build.
    api("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
    say(f"Attached build {BUILD_NUMBER}")

    # 3. Review details: notes, no demo account.
    attrs = dict(contact, notes=notes, demoAccountRequired=False)
    rd = api("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail", ok_missing=True)
    rd = (rd or {}).get("data")
    if rd:
        api("PATCH", f"/v1/appStoreReviewDetails/{rd['id']}", {"data": {"type": "appStoreReviewDetails",
            "id": rd["id"], "attributes": attrs}})
    else:
        api("POST", "/v1/appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": attrs,
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    say("Review notes set, no sign-in required")

    # 4. What's New (not allowed on a first release).
    if ever_released:
        locs = api("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]
        for loc in locs:
            api("PATCH", f"/v1/appStoreVersionLocalizations/{loc['id']}", {"data": {
                "type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"whatsNew": whats_new}}})
            say(f"What's New set for {loc['attributes'].get('locale')}")

    # 5. Submit.
    drafts = api("GET", "/v1/reviewSubmissions", params={
        "filter[app]": app_id, "filter[platform]": "IOS", "filter[state]": "READY_FOR_REVIEW"})["data"]
    if drafts:
        sid = drafts[0]["id"]
    else:
        sid = api("POST", "/v1/reviewSubmissions", {"data": {"type": "reviewSubmissions",
            "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]["id"]
    items = api("GET", f"/v1/reviewSubmissions/{sid}/items", params={"include": "appStoreVersion"})["data"]
    has_version = any(((i.get("relationships") or {}).get("appStoreVersion") or {}).get("data", {}) and
                      i["relationships"]["appStoreVersion"]["data"].get("id") == vid for i in items)
    if not has_version:
        api("POST", "/v1/reviewSubmissionItems", {"data": {"type": "reviewSubmissionItems",
            "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sid}},
                              "appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    res = api("PATCH", f"/v1/reviewSubmissions/{sid}", {"data": {"type": "reviewSubmissions", "id": sid,
        "attributes": {"submitted": True}}})
    say(f"Submitted for App Review: submission {sid}, state {res['data']['attributes'].get('state')}")


if __name__ == "__main__":
    main()
