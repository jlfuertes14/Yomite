import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface GridColumnsIconProps {
  columns: 2 | 3;
  size?: number;
  color?: string;
}

/**
 * GridColumnsIcon — Vector grid indicator for catalog layout
 * - 2 columns: 4 outlined square boxes (2×2 grid)
 * - 3 columns: 9 outlined square boxes (3×3 grid, square boxes instead of circles)
 */
export function GridColumnsIcon({ columns, size = 22, color = '#FAFAFA' }: GridColumnsIconProps) {
  if (columns === 2) {
    return (
      <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
        <Rect x={2.4} y={2.4} width={7.2} height={7.2} rx={2} stroke={color} strokeWidth={1.8} />
        <Rect x={12.4} y={2.4} width={7.2} height={7.2} rx={2} stroke={color} strokeWidth={1.8} />
        <Rect x={2.4} y={12.4} width={7.2} height={7.2} rx={2} stroke={color} strokeWidth={1.8} />
        <Rect x={12.4} y={12.4} width={7.2} height={7.2} rx={2} stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      {/* Row 1 */}
      <Rect x={2.1} y={2.1} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={8.7} y={2.1} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={15.3} y={2.1} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      {/* Row 2 */}
      <Rect x={2.1} y={8.7} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={8.7} y={8.7} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={15.3} y={8.7} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      {/* Row 3 */}
      <Rect x={2.1} y={15.3} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={8.7} y={15.3} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={15.3} y={15.3} width={4.6} height={4.6} rx={1.2} stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}
