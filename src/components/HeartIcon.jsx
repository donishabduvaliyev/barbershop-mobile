import React from 'react';
import { Image } from 'react-native';

const heartOutline = require('../../assets/png/icons/heart-outline.png');
const heartFilled = require('../../assets/png/icons/heart-filled.png');

/**
 * Bulletproof Heart Icon:
 * Uses pre-rendered bundled PNG assets with tintColor so it NEVER fails,
 * renders blank, or glitches in standalone APK builds.
 */
export const HeartIcon = ({ filled = false, size = 16, color }) => {
  return (
    <Image
      source={filled ? heartFilled : heartOutline}
      style={{
        width: size,
        height: size,
        tintColor: color || (filled ? '#F2685C' : '#FFFFFF'),
      }}
      resizeMode="contain"
    />
  );
};
