import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Prevent MangaDex hotlinking blockers from intercepting cover & chapter images */}
        <meta name="referrer" content="no-referrer" />

        <title>Yomite — Free Modern Manga Reader with Cloud Sync &amp; Offline Vault</title>
        <meta
          name="description"
          content="Read manga online for free on Yomite. Fast, clean, ad-free manga and webtoon reader with 60fps GPU acceleration, 30+ languages, offline downloads, and real-time cloud sync for Web and Android."
        />
        <meta
          name="keywords"
          content="yomite, manga reader, read manga online, ad free manga, free manga app, mangadex reader, webtoon reader, read manhwa online, offline manga reader, yomite app, yomite apk"
        />
        <meta name="author" content="Yomite" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href="https://yomite.vercel.app/" />

        {/* OpenGraph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://yomite.vercel.app/" />
        <meta property="og:site_name" content="Yomite" />
        <meta property="og:title" content="Yomite — Free Modern Manga Reader" />
        <meta
          property="og:description"
          content="Discover, track, and read manga online with zero ads. 60fps GPU reader, offline downloads, and seamless cloud sync across Web and Mobile."
        />
        <meta property="og:image" content="https://yomite.vercel.app/icon.png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://yomite.vercel.app/" />
        <meta name="twitter:title" content="Yomite — Free Modern Manga Reader" />
        <meta
          name="twitter:description"
          content="Discover, track, and read manga online with zero ads. 60fps GPU reader, offline downloads, and seamless cloud sync."
        />
        <meta name="twitter:image" content="https://yomite.vercel.app/icon.png" />

        {/* Web App & Theme Color */}
        <meta name="theme-color" content="#09090B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yomite" />
        <link rel="manifest" href="/manifest.json" />

        {/* Official Yomite Favicons & Touch Icons with Cache Buster */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=1.2" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=1.2" />
        <link rel="shortcut icon" href="/favicon.png?v=1.2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=1.2" />

        {/* Schema.org Structured Data (JSON-LD) for Rich Google Search Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebApplication',
                  '@id': 'https://yomite.vercel.app/#app',
                  'name': 'Yomite',
                  'url': 'https://yomite.vercel.app',
                  'description': 'Free, fast, and ad-free modern universal manga and comic reader with offline vault and realtime cloud sync.',
                  'applicationCategory': 'EntertainmentApplication',
                  'operatingSystem': 'Web, Android, iOS',
                  'inLanguage': 'en',
                  'offers': {
                    '@type': 'Offer',
                    'price': '0',
                    'priceCurrency': 'USD',
                  },
                  'featureList': [
                    '100% Ad-free manga and webtoon reading',
                    '60fps GPU-accelerated reading modes (Webtoon, RTL, Dual-Spread)',
                    'Offline chapter vault and downloads',
                    'Realtime cloud library synchronization',
                    'Community discussions and sharing',
                    '30+ translation languages supported',
                  ],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://yomite.vercel.app/#website',
                  'url': 'https://yomite.vercel.app',
                  'name': 'Yomite',
                  'description': 'Discover and read thousands of manga titles online with zero ads.',
                  'publisher': {
                    '@type': 'Organization',
                    'name': 'Yomite',
                    'url': 'https://yomite.vercel.app',
                    'logo': 'https://yomite.vercel.app/icon.png',
                  },
                  'potentialAction': {
                    '@type': 'SearchAction',
                    'target': 'https://yomite.vercel.app/?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
