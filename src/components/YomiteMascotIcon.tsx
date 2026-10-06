/**
 * YomiteMascotIcon — Pixel Robot Mascot Logo from Google Stitch Design
 * Colors: Vibrant Orange (#F97316), Deep Tangerine (#EA580C), Slate Charcoal (#1E293B), White (#FFFFFF)
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function YomiteMascotIcon({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h3v3H4zM17 7h3v3h-3zM7 10h10v2H7zM5 12h14v7H5z" fill="#F97316" />
      <Path d="M7 14h2v2H7zM15 14h2v2h-2z" fill="#EA580C" />
      <Path d="M8 14h1v1H8zM16 14h1v1h-1z" fill="#FFFFFF" />
      <Path d="M11 17h2v1h-2z" fill="#1E293B" />
    </Svg>
  );
}
