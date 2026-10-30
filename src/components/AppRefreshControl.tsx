import React from 'react';
import { Platform, RefreshControl, RefreshControlProps } from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme';

/**
 * Returns standardized RefreshControl color props.
 * Strictly adheres to theme mode (not color scheme / character preset aware):
 * - Dark mode: circle is white (#FFFFFF), spinner is black (#000000)
 * - Light mode: circle is black (#000000), spinner is white (#FFFFFF)
 */
export function useRefreshControlProps(props?: Partial<RefreshControlProps>): RefreshControlProps {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const spinnerColor = isDark ? '#000000' : '#FFFFFF';
  const circleBgColor = isDark ? '#FFFFFF' : '#000000';
  // On iOS, there is no circular card, so tintColor draws directly against the screen background
  const iosTintColor = Platform.OS === 'ios' ? (isDark ? '#FFFFFF' : '#000000') : spinnerColor;

  return {
    colors: [spinnerColor],
    progressBackgroundColor: circleBgColor,
    tintColor: iosTintColor,
    ...props,
  } as RefreshControlProps;
}

export function AppRefreshControl(props: RefreshControlProps) {
  const defaultColorProps = useRefreshControlProps();

  return (
    <RefreshControl
      {...defaultColorProps}
      {...props}
      colors={props.colors ?? defaultColorProps.colors}
      progressBackgroundColor={props.progressBackgroundColor ?? defaultColorProps.progressBackgroundColor}
      tintColor={props.tintColor ?? defaultColorProps.tintColor}
    />
  );
}

export default AppRefreshControl;
