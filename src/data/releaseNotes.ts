export const LOCAL_RELEASE_NOTES: Record<string, string> = {
  '1.3.0': `## Yomite v1.3.0

### What's new
- Improved app update detection when opening an existing installation.
- Added a clearer update download progress experience.
- Improved Discover navigation and reader layout detection behavior.
- Added bundled release notes for installations whose GitHub release has no body.
`,
  '1.3.1': `## Yomite v1.3.1

### What's new
- Added server-backed Android release detection and Expo push subscriptions.
- Added detailed release notes and universal APK delivery.
- Improved update modal progress, notification startup permissions, Discover navigation, and reader layout analysis.
`,
  '1.3.3': `## Yomite v1.3.3

### What's new
- Added in-app release notification diagnostics in Settings.
- Added retry registration for Expo push subscriptions.
- Added detailed mobile-side diagnostics for permissions, project configuration, token generation, and parser responses.
- Fixed standalone Android builds being incorrectly treated as Expo Go environments.
- Fixed the release parser's Supabase subscription response handling.
- Added Render logs for release subscriptions and Anime News feed requests.
`,
};
