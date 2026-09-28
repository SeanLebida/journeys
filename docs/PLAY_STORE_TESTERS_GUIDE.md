# Moving Journeys to Google Play Store Testers

This guide walks you through distributing **Journeys: Biblical Atlas** to testers on Android devices via Google Play. The title, short description, and full description to paste for the next closed test are in [`STORE_LISTING.md`](STORE_LISTING.md).

---

## 1. Overview & Architecture

- **Application ID**: `how.authentic.journeys`
- **Current Version**: `0.3.12` (versionCode `100+`)
- **Package Format**: Android App Bundle (`.aab`) signed with RSA 4096-bit upload key.
- **Recommended Distribution Track**: **Internal Testing**
  - **Zero-Wait Approval**: Internal testing releases do not go through Google's standard multi-day review queue. Updates become available to testers within minutes.
  - **Capacity**: Up to 100 testers per email list.
  - **Instant Distribution**: Testers join with an opt-in URL and install directly from Google Play.

---

## 2. Upload Keystore & Credentials

An upload keystore has been generated on your machine:

- **Keystore File**: `~/.android/journeys-upload.keystore`
- **Credentials File**: `~/.android/journeys-keystore-credentials.txt` (chmod 600)
- **Key Alias**: `journeys-upload`
- **Key Algorithm**: RSA 4096-bit (SHA256withRSA)

> [!WARNING]
> Keep this keystore safe and backed up. Google Play App Signing relies on your upload key to accept updates. Never commit the keystore or password file to git.

---

## 3. Google Play Console Setup (One-Time)

### Step 3.1: Create App in Google Play Console

1. Navigate to [Google Play Console](https://play.google.com/console).
2. Click **Create app** (top right).
3. Fill in basic details:
   - **App name**: `Journeys: Biblical Atlas` (see `STORE_LISTING.md` for the short and full descriptions)
   - **Default language**: `English (United States) - en-US`
   - **App or game**: `App`
   - **Free or paid**: `Free`
4. Accept Declarations and click **Create app**.

### Step 3.2: Complete Required Store Declarations

Before publishing to any track (even internal testing), Google Play requires basic app declarations:

1. In the left navigation, go to **Policy > App content**.
2. Complete each checklist item:
   - **Privacy Policy**: Provide URL to your privacy policy (e.g. your hosted `PRIVACY.md` or GitHub raw link: `https://raw.githubusercontent.com/SeanLebida/journeys/development/PRIVACY.md`).
   - **App access**: Select *All functionality is available without special access* (no user login required).
   - **Ads**: Select *No, my app does not contain ads*.
   - **Content ratings**: Start questionnaire:
     - Category: Reference / Education
     - Violence / Sexual content / Profanity: No
     - Result: Rated for Everyone / 4+.
   - **Target audience and content**: Target age: 13 and older, or All ages. Not designed specifically for children under 13.
   - **Data safety**:
     - *Does your app collect or share any of the required user data types?* -> **No** (Journeys is 100% offline; all maps, SQLite databases, and content are bundled locally).
   - **Government apps / Financial features**: Select No / Not applicable.

---

## 4. Setting Up Internal Testing & Uploading AAB

### Step 4.1: Create Tester Email List

1. In Play Console left sidebar, go to **Testing > Internal testing**.
2. Click on the **Testers** tab.
3. Under **Email lists**, click **Create email list**.
4. Name the list (e.g. `Journeys Alpha Testers`).
5. Add the Gmail / Google account email addresses of your testers.
6. Click **Save changes**.

### Step 4.2: Upload the Signed AAB

1. On the **Internal testing** page, click **Create new release** (top right).
2. Under **App bundles**, click **Upload** and select:
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```
3. Enter release name (e.g. `0.3.12 (100)`).
4. Enter release notes for testers (or copy from `android/release-notes/whatsnew-en-US`).
5. Click **Next** / **Save**, review the release details, and click **Start rollout to Internal testing**.

### Step 4.3: Share the Join Link with Testers

1. Return to **Testing > Internal testing > Testers** tab.
2. Scroll down to **How testers join your test**.
3. Select **Copy link** under *Web link* (e.g. `https://play.google.com/apps/internaltest/...`) or *Android link*.
4. Send this link to your invited testers.

### How Testers Install:
1. Tester opens the link on their Android phone or browser.
2. They click **Accept Invite**.
3. Click **Download it on Google Play**.
4. The Play Store opens directly to the Journeys listing where they tap **Install**.
5. All future internal releases automatically update via the Play Store!

---

## 5. Automated Releases via GitHub Actions

A workflow `.github/workflows/android-aab.yml` is configured to build, sign, and optionally publish directly to Google Play on demand.

### Step 5.1: Add GitHub Secrets

In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and add:

| Secret Name | Description / Value |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | Base64 string from `~/.android/journeys-keystore-credentials.txt` |
| `RELEASE_STORE_PASSWORD` | Store password from `~/.android/journeys-keystore-credentials.txt` |
| `RELEASE_KEY_ALIAS` | `journeys-upload` |
| `RELEASE_KEY_PASSWORD` | Key password from `~/.android/journeys-keystore-credentials.txt` |
| `PLAY_SERVICE_ACCOUNT_JSON` | *(Optional for 100% automated publishing)* Google Cloud Service Account JSON key |

### Step 5.2: Trigger a Release

1. Go to **Actions > Android Release AAB (Signed & Play Store)**.
2. Click **Run workflow** and select the `production` branch. That is the line this repo ships.
3. Set:
   - **Google Play track**: `internal`
   - **Rollout status**: `completed`
4. Click **Run workflow**.
5. GitHub Actions builds the bundle, signs it, and either drafts a GitHub release with the attached `.aab` or automatically uploads it directly to Google Play Internal Testing.

---

## 6. Local Build Commands

To produce a signed release `.aab` bundle locally at any time:

```bash
# Load credentials and set environment variables
source ~/.android/journeys-keystore-credentials.txt
export RELEASE_STORE_FILE="$KEYSTORE_PATH"
export RELEASE_STORE_PASSWORD="$STORE_PASSWORD"
export RELEASE_KEY_ALIAS="$ALIAS"
export RELEASE_KEY_PASSWORD="$KEY_PASSWORD"

# Build content, web bundle, capacitor sync, bump version, and bundle signed AAB:
npm run android:build:release
```

The signed bundle will be output at:
`android/app/build/outputs/bundle/release/app-release.aab`
