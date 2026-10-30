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
  '1.3.4': `## Yomite v1.3.4

### What's new
- Added detailed mobile-side diagnostics for permissions, project configuration, token generation, and parser responses.
- Fixed standalone Android builds being incorrectly treated as Expo Go environments.
- Fixed the release parser's Supabase subscription response handling.
- Added Render logs for release subscriptions and Anime News feed requests.
`,
  '1.3.5': `## Yomite v1.3.5

### What's new
- Rebuilt Webtoon page tracking for accurate restoration and smoother long-strip reading.
- History now resumes the exact page and scroll position, including appended next chapters.
- Added external-source downloads with authenticated image headers and safer file names.
- Improved Cloudflare detection and in-app verification across source, detail, and reader screens.
- Refined History selection, the Library category sheet, authentication toasts, and confirmation dialogs.
- Upgraded to Expo SDK 58 and React Native 0.88 with refreshed platform dependencies.
`,
};
