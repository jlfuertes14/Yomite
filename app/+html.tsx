import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Prevent MangaDex hotlinking blockers from intercepting cover & chapter images */}
        <meta name="referrer" content="no-referrer" />

        <title>Yomite — Modern Manga Reader</title>
        <meta
          name="description"
          content="Discover, track, and read manga with Yomite. Fast, clean, and modern universal manga reader for Web, Android and iOS."
        />
        <meta name="theme-color" content="#09090B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yomite" />

        {/* Official Yomite Favicons & Touch Icons with Cache Buster */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=1.2" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=1.2" />
        <link rel="shortcut icon" href="/favicon.png?v=1.2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=1.2" />

        {/* Disable body scrolling on web for native-like ScrollViews */}
        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body, #root {
            background-color: #09090B;
            min-height: 100%;
            display: flex;
            flex-direction: column;
          }
          ::selection {
            background: rgba(244, 63, 94, 0.35);
            color: #FFFFFF;
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
