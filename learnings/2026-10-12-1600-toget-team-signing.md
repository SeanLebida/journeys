# Journeys signs with the ToGet Apple team

## What changed

- Registered bundle id `how.authentic.journeys` on the existing Apple team and created an App Store profile named `Journeys App Store`.
- `.github/workflows/ios-appstore.yml` now decodes secrets with macOS `base64 -D`, writes manual signing onto the App target only, and uses the certificate identity `iPhone Distribution`.
- The archive no longer passes `PROVISIONING_PROFILE_SPECIFIER` on the `xcodebuild` command line.

## Why it mattered

The ToGet distribution certificate and App Store Connect API key are the credentials on this machine. That profile is for `how.authentic.toget` and will not sign Journeys. ToGet's TestFlight run also showed that a command-line profile specifier is applied to every native target, and that this certificate's identity is `iPhone Distribution`, not `Apple Distribution`.

## Gotchas / pitfalls

- `POST /v1/apps` is forbidden for this key. The app record still has to be created in App Store Connect before `altool` will accept the IPA.
- Do not commit `~/.config/toget-apple` or `~/.config/journeys-apple`. The private key, `.p12`, and profiles stay there. GitHub secrets hold the copies the workflow uses.
- Pod targets must not receive the Journeys profile. Only the App target's build settings carry `CODE_SIGN_IDENTITY` and `PROVISIONING_PROFILE_SPECIFIER`.

## Verification

- The local distribution certificate serial matches the team's `IOS_DISTRIBUTION` certificate (expires 2027-10-12).
- App Store Connect created the bundle id and returned a profile. App creation returned 403 `CREATE` not allowed.
- The signed archive was not built here. Linux has no `xcodebuild`. The `testflight` workflow on `macos-26` is the build.
