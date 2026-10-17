import { useWindowDimensions } from 'react-native';

// Responsive layout hook for Android phones, foldables, tablets, and iPads.
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;

  // Number of columns for shop grids
  let numColumns = 1;
  if (isLargeTablet) {
    numColumns = 3;
  } else if (isTablet) {
    numColumns = 2;
  }

  // Horizontal padding and max content container width
  const horizontalPadding = isLargeTablet ? 32 : isTablet ? 24 : 16;
  const maxContentWidth = isLargeTablet ? 1280 : isTablet ? 960 : width;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isLargeTablet,
    numColumns,
    horizontalPadding,
    maxContentWidth,
  };
}
