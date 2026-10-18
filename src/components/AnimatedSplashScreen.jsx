import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Square sizing matching the official 2x2 logo mark
const TILE_SIZE = 38;
const GAP = 8;
const RADIUS = 10;
const CENTER_OFFSET = (TILE_SIZE + GAP) / 2; // 23px from center

// Offscreen corner distances matching SmartChair Ad.gif
const START_X = SCREEN_WIDTH * 0.40;
const START_Y = SCREEN_HEIGHT * 0.24;

export const AnimatedSplashScreen = ({ isReady, onFinish }) => {
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Unified movement progress from 0 (edges) to 1 (center)
  const convergeProgress = useSharedValue(0);

  // Subtle settling cushion when tiles connect
  const centerScale = useSharedValue(1);

  // Text & tagline appearance
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(18);

  // Specular sheen sweep
  const shineProgress = useSharedValue(-1.2);

  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    // 1. The 4 squares start near the 4 corners of the screen and glide to the center
    // Easing matches the clean, linear-to-deceleration curve in SmartChair Ad.gif
    convergeProgress.value = withTiming(1, {
      duration: 1100,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });

    // 2. The moment they meet in the center (at 1100ms): subtle cushion bounce
    const dockTime = 1080;
    centerScale.value = withDelay(
      dockTime,
      withSequence(
        withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 200, easing: Easing.inOut(Easing.quad) })
      )
    );

    // 3. SmartChair text appears beneath the logo
    textOpacity.value = withDelay(
      dockTime + 100,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    textTranslateY.value = withDelay(
      dockTime + 100,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // 4. Soft specular light sweep across the logo and text
    shineProgress.value = withDelay(
      dockTime + 450,
      withTiming(1.2, {
        duration: 850,
        easing: Easing.bezier(0.2, 0.8, 0.25, 1),
      })
    );

    // 5. Total cinematic duration ~2.6s before dissolving into the app
    const timer = setTimeout(() => {
      setCanDismiss(true);
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  // When animation finishes, smoothly fade into the app
  useEffect(() => {
    if (!canDismiss) return;

    containerScale.value = withTiming(1.04, {
      duration: 480,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    containerOpacity.value = withTiming(0, {
      duration: 480,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });

    const exitTimer = setTimeout(() => {
      onFinish?.();
    }, 500);

    return () => clearTimeout(exitTimer);
  }, [canDismiss]);

  const masterContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const centerClusterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));

  // Tile 1: Top-Left (Outlined Square)
  const t1Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [-START_X, -CENTER_OFFSET]);
    const y = interpolate(p, [0, 1], [-START_Y, -CENTER_OFFSET]);
    const op = interpolate(p, [0, 0.2, 1], [0.4, 1, 1]);
    return {
      opacity: op,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  // Tile 2: Top-Right (SOLID GOLD SQUARE - matches SmartChair Ad.gif!)
  const t2Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [START_X, CENTER_OFFSET]);
    const y = interpolate(p, [0, 1], [-START_Y, -CENTER_OFFSET]);
    const op = interpolate(p, [0, 0.2, 1], [0.6, 1, 1]);
    return {
      opacity: op,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  // Tile 3: Bottom-Left (Outlined Square)
  const t3Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [-START_X, -CENTER_OFFSET]);
    const y = interpolate(p, [0, 1], [START_Y, CENTER_OFFSET]);
    const op = interpolate(p, [0, 0.2, 1], [0.4, 1, 1]);
    return {
      opacity: op,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  // Tile 4: Bottom-Right (Outlined Square)
  const t4Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [START_X, CENTER_OFFSET]);
    const y = interpolate(p, [0, 1], [START_Y, CENTER_OFFSET]);
    const op = interpolate(p, [0, 0.2, 1], [0.4, 1, 1]);
    return {
      opacity: op,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  // Typography animation style
  const typographyStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  // Specular shine sweep style
  const shineSweepStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shineProgress.value,
          [-1.2, 1.2],
          [-SCREEN_WIDTH * 0.75, SCREEN_WIDTH * 0.75]
        ),
      },
      { rotate: '25deg' },
    ],
  }));

  return (
    <Animated.View
      style={[styles.overlay, masterContainerStyle]}
      pointerEvents={canDismiss ? 'none' : 'auto'}
    >
      <View style={styles.stage}>
        {/* The 4 Squares Cluster that assembles into the SmartChair logo mark */}
        <Animated.View style={[styles.clusterWrap, centerClusterStyle]}>
          {/* Tile 1: Top-Left (Outlined dark square) */}
          <Animated.View style={[styles.tileBase, styles.outlineTile, t1Style]} />

          {/* Tile 2: Top-Right (Solid Gold Square - matches SmartChair Ad.gif!) */}
          <Animated.View style={[styles.tileBase, styles.goldTile, t2Style]} />

          {/* Tile 3: Bottom-Left (Outlined dark square) */}
          <Animated.View style={[styles.tileBase, styles.outlineTile, t3Style]} />

          {/* Tile 4: Bottom-Right (Outlined dark square) */}
          <Animated.View style={[styles.tileBase, styles.outlineTile, t4Style]} />
        </Animated.View>

        {/* Wordmark beneath the logo mark */}
        <Animated.View style={[styles.typographyBlock, typographyStyle]}>
          <Text style={styles.brandTitle}>
            Smart<Text style={styles.brandTitleGold}>Chair</Text>
          </Text>
          <Text style={styles.tagline}>PREMIUM GROOMING & BOOKING</Text>
        </Animated.View>

        {/* Diagonal specular light shine */}
        <Animated.View pointerEvents="none" style={[styles.specularBeam, shineSweepStyle]}>
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0)',
              'rgba(255, 255, 255, 0.15)',
              'rgba(255, 245, 210, 0.55)',
              'rgba(212, 175, 90, 0.25)',
              'rgba(212, 175, 90, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0C',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 50,
  },
  clusterWrap: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  tileBase: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: RADIUS,
  },
  outlineTile: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: '#4A4854', // Matches the outlined squares in SmartChair Ad.gif
  },
  goldTile: {
    backgroundColor: '#D4AF5A', // Matches the solid warm gold square in SmartChair Ad.gif
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  typographyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 32,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: -0.3,
  },
  brandTitleGold: {
    color: '#D4AF5A',
  },
  tagline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D4AF5A',
    letterSpacing: 2.2,
    marginTop: 8,
  },
  specularBeam: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 100,
  },
});
