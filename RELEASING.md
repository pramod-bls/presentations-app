# Releasing

Procedure for cutting a signed, notarized release that ships to users. Maintainer-only document.

## One-time setup

### macOS signing + notarization

1. **Apple Developer Program account** — $99/year. Sign up at [developer.apple.com](https://developer.apple.com).
2. **Developer ID Application certificate** — generate via Xcode or Apple Developer portal. Export as `.p12` with a password.
3. **App-specific password for notarization** — create one at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords.
4. **Team ID** — find at [developer.apple.com](https://developer.apple.com) → Membership.

Add these as GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
|---|---|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password from step 3 |
| `APPLE_TEAM_ID` | 10-char Team ID (e.g. `A1BCDEFG23`) |
| `APPLE_SIGNING_IDENTITY` | Certificate CN (e.g. `Developer ID Application: Your Name (A1BCDEFG23)`) — optional; auto-detected if omitted |
| `APPLE_CERT_P12_BASE64` | Base64 of the .p12 file: `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERT_PASSWORD` | Password you set when exporting the .p12 |
| `APPLE_KEYCHAIN_PASSWORD` | Any string — used only inside CI to unlock the temporary keychain |

### Windows signing

1. **Authenticode certificate** — buy from DigiCert, Sectigo, or SSL.com. OV costs ~$200/yr; EV (skips SmartScreen reputation building) ~$500/yr.
2. Install the certificate into the keystore on the Windows CI machine, or provide the `.pfx` path + password directly.

| Secret | What it is |
|---|---|
| `WINDOWS_CERT_FILE_PATH` | Path to the `.pfx` on the runner (baked into a custom runner or downloaded at build time) |
| `WINDOWS_CERT_PASSWORD` | `.pfx` password |

### GitHub publisher

The repo's built-in `GITHUB_TOKEN` is sufficient — it's passed automatically by Actions. No extra setup beyond the workflow's `permissions: write` default.

## Cutting a release

1. **Bump the version** in `package.json` (`"version": "1.1.0"`).
2. **Update `CHANGELOG.md`** — move items under `[Unreleased]` to a new version section with today's date.
3. **Update bundled Reveal.js** if you want (optional): `npm run update-reveal`.
4. **Smoke-test locally**:

   ```bash
   npm run make
   open out/make/...               # macOS
   # or launch the generated installer
   ```

5. **Commit and tag**:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: Release 1.1.0"
   git tag v1.1.0
   git push origin main v1.1.0
   ```

6. **Wait for CI** to build + sign + publish a draft release on GitHub Releases (~5-10 minutes across all platforms).
7. **Open the draft release** on GitHub, smoke-test one installer from each platform.
8. **Publish the draft** — users with the app installed will auto-update within 24 hours; new users download the installer directly.

## Local release build (without CI)

For one-off releases when CI isn't set up:

```bash
# macOS (need Xcode + signing creds set as env vars)
export APPLE_ID=you@example.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=A1BCDEFG23
npm run publish

# Windows
$env:WINDOWS_CERT_FILE="C:\path\to\cert.pfx"
$env:WINDOWS_CERT_PASSWORD="..."
npm run publish

# Linux (no signing)
npm run publish
```

Drop `publish` for a build-only run: `npm run make`.

## Auto-update flow

Packaged builds ship with `electron-updater`. On startup the app checks the configured feed (GitHub Releases by default), downloads updates in the background, and prompts the user to restart when ready.

In development (`npm start`) the updater is a no-op (`app.isPackaged` is false).

## Skipping signing

If you don't have certs yet and just want to produce unsigned builds for testing:

```bash
npm run make
```

The installers work but:
- **macOS Gatekeeper** will refuse to open them. Users can right-click → Open to bypass, but for public distribution you need signing.
- **Windows SmartScreen** will warn; users can "Run anyway" but most won't.
- **Linux** has no gate.

Don't ship unsigned builds to end users if avoidable.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `The specified item could not be found in the keychain` (macOS) | Signing identity name mismatch — check `security find-identity -v -p codesigning` |
| Notarization fails with "unauthorized" | `APPLE_APP_SPECIFIC_PASSWORD` wrong, or 2FA interfering — regenerate the app-specific password |
| Notarization hangs >10 min | Normal for first submission; Apple's queue can be slow. Check Xcode → Products → Archive → Notary Log |
| Windows cert "not usable for code-signing" | Certificate doesn't have the code-signing EKU — buy an Authenticode cert specifically |
| GitHub draft release shows wrong files | Forge publishes all maker outputs; delete extras from the draft before publishing |
| Users see "can't check for updates" | App wasn't built with `GITHUB_REPOSITORY` set, or the published repo is private. Set the env var at build time |
