const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// Read signing credentials from environment variables. They're only
// required when actually signing (CI or local release builds); regular
// `npm run package` / `npm start` work without them.
const APPLE_ID = process.env.APPLE_ID;
const APPLE_PASSWORD = process.env.APPLE_APP_SPECIFIC_PASSWORD;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const WINDOWS_CERT_FILE = process.env.WINDOWS_CERT_FILE;
const WINDOWS_CERT_PASSWORD = process.env.WINDOWS_CERT_PASSWORD;

// GitHub Releases is the recommended auto-update channel for Forge.
// Credentials come from GITHUB_TOKEN in CI; leave repository as null
// until a concrete org/repo is set.
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY
  ? { owner: process.env.GITHUB_REPOSITORY.split('/')[0], name: process.env.GITHUB_REPOSITORY.split('/')[1] }
  : null;

const packagerConfig = {
  asar: true,
  extraResource: ['reveal'],
  // Uncomment and set once you have an icon:
  // icon: 'assets/app-icon',  // Forge picks .icns on macOS, .ico on Win, .png on Linux
};

// macOS code signing + notarization — only activates when env vars are present.
if (APPLE_ID && APPLE_PASSWORD && APPLE_TEAM_ID) {
  packagerConfig.osxSign = {
    identity: process.env.APPLE_SIGNING_IDENTITY, // optional; auto-detects if unset
    optionsForFile: () => ({
      entitlements: 'build/entitlements.mac.plist',
      hardenedRuntime: true,
      'gatekeeper-assess': false,
    }),
  };
  packagerConfig.osxNotarize = {
    appleId: APPLE_ID,
    appleIdPassword: APPLE_PASSWORD,
    teamId: APPLE_TEAM_ID,
  };
}

const makers = [
  // Windows installer (auto-update-capable). certificateFile /
  // certificatePassword activate Authenticode signing when provided.
  {
    name: '@electron-forge/maker-squirrel',
    config: {
      ...(WINDOWS_CERT_FILE && WINDOWS_CERT_PASSWORD
        ? {
            certificateFile: WINDOWS_CERT_FILE,
            certificatePassword: WINDOWS_CERT_PASSWORD,
          }
        : {}),
    },
  },
  // macOS: ship both a .zip (for auto-update feeds) and a .dmg (for manual downloads).
  { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
  { name: '@electron-forge/maker-dmg', platforms: ['darwin'], config: {} },
  // Linux
  { name: '@electron-forge/maker-deb', config: {} },
  { name: '@electron-forge/maker-rpm', config: {} },
];

const publishers = GITHUB_REPOSITORY
  ? [
      {
        name: '@electron-forge/publisher-github',
        config: {
          repository: GITHUB_REPOSITORY,
          prerelease: false,
          draft: true,  // drafts start hidden; you publish manually after smoke-test
        },
      },
    ]
  : [];

module.exports = {
  packagerConfig,
  rebuildConfig: {},
  makers,
  publishers,
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          { entry: 'src/main.js',    config: 'vite.main.config.mjs',    target: 'main' },
          { entry: 'src/preload.js', config: 'vite.preload.config.mjs', target: 'preload' },
        ],
        renderer: [
          { name: 'main_window', config: 'vite.renderer.config.mjs' },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
