import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../theme/colors';
import { MOTION_ASSETS } from './BrandAssets';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Offscreen origin offsets - smoothly outside viewport
const OFF_X = SCREEN_WIDTH * 0.58;
const OFF_Y = SCREEN_HEIGHT * 0.42;

// High-DPI Dimensions for the 2x2 grid
const TILE_SIZE = 42;
const GAP = 10;
const RADIUS = 12;
const OFFSET = (TILE_SIZE + GAP) / 2; // 26px

export const AnimatedSplashScreen = ({ isReady, onFinish }) => {
  // Master container transition controls
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Deep ambient gold background aura
  const auraScale = useSharedValue(0.7);
  const auraOpacity = useSharedValue(0);

  // Subtle radial shockwave burst when tiles dock
  const pulseRingScale = useSharedValue(0.5);
  const pulseRingOpacity = useSharedValue(0);

  // Master logo cluster cushioning
  const clusterScale = useSharedValue(1);

  // Seamless high-res gold mark cross-fade
  const goldMarkOpacity = useSharedValue(0);

  // Continuous Apple-eased movement for the 4 squares
  // Unified progress from 0 (edges) to 1 (center)
  const convergeProgress = useSharedValue(0);

  // Typography reveal
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(22);

  // Specular sheen / shine sweep across logo and text
  const shineProgress = useSharedValue(-1.2);

  // Soft sparkle glint
  const glintOpacity = useSharedValue(0);
  const glintScale = useSharedValue(0.3);

  // State to ensure user sees the complete, unhurried animation before dismiss
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // 1. Ambient luxury gold aura softly breathes in
    auraOpacity.value = withTiming(0.42, {
      duration: 1200,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    auraScale.value = withTiming(1.35, {
      duration: 2200,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    // 2. The 4 squares glide from the screen edges toward the center
    // Using Apple signature decelerating curve for buttery liquid motion
    convergeProgress.value = withTiming(1, {
      duration: 1100,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    // 3. Collision / Docking Moment (at ~1050ms)
    // Soft cushion bounce + radial pulse ring
    const dockTime = 1050;

    pulseRingOpacity.value = withDelay(
      dockTime,
      withSequence(
        withTiming(0.75, { duration: 100 }),
        withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) })
      )
    );
    pulseRingScale.value = withDelay(
      dockTime,
      withTiming(2.1, { duration: 750, easing: Easing.out(Easing.cubic) })
    );

    // Tactile settling cushion
    clusterScale.value = withDelay(
      dockTime,
      withSequence(
        withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1.0, { damping: 14, stiffness: 140, mass: 1.0 })
      )
    );

    // Cross-fade the unified high-res smartchair-mark-gold.png
    goldMarkOpacity.value = withDelay(
      dockTime + 50,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    );

    // 4. Elegant typography emerges beneath the logo (at ~1250ms)
    textOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 600, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    );
    textTranslateY.value = withDelay(
      1200,
      withSpring(0, { damping: 18, stiffness: 110, mass: 1.0 })
    );

    // 5. Specular Golden Shine sweeps across the lockup (at ~1650ms)
    shineProgress.value = withDelay(
      1600,
      withTiming(1.2, {
        duration: 900,
        easing: Easing.bezier(0.2, 0.8, 0.25, 1),
      })
    );

    // Subtle glint on the gold tile during the shine
    glintOpacity.value = withDelay(
      1820,
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: 320 })
      )
    );
    glintScale.value = withDelay(
      1820,
      withSequence(
        withTiming(1.3, { duration: 160 }),
        withTiming(0.5, { duration: 300 })
      )
    );

    // Let the complete animation breathe comfortably (~2.7s total)
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  // 6. Seamless dissolution into the live app
  useEffect(() => {
    if (!animationComplete) return;

    containerScale.value = withTiming(1.04, {
      duration: 520,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    containerOpacity.value = withTiming(0, {
      duration: 520,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });

    const exitTimer = setTimeout(() => {
      onFinish?.();
    }, 540);

    return () => clearTimeout(exitTimer);
  }, [animationComplete]);

  // Master styles
  const masterContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: auraOpacity.value,
    transform: [{ scale: auraScale.value }],
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    opacity: pulseRingOpacity.value,
    transform: [{ scale: pulseRingScale.value }],
  }));

  const clusterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: clusterScale.value }],
  }));

  const goldMarkFadeStyle = useAnimatedStyle(() => ({
    opacity: goldMarkOpacity.value,
  }));

  // Buttery interpolated coordinates for the 4 squares
  // Top-Left (Tile 1)
  const t1Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [-OFF_X, -OFFSET]);
    const y = interpolate(p, [0, 1], [-OFF_Y, -OFFSET]);
    const rot = interpolate(p, [0, 1], [-30, 0]);
    const s = interpolate(p, [0, 1], [0.4, 1]);
    const op = interpolate(p, [0, 0.3, 1], [0, 0.9, 1]);
    return {
      opacity: op,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale: s },
      ],
    };
  });

  // Top-Right (Tile 2)
  const t2Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [OFF_X, OFFSET]);
    const y = interpolate(p, [0, 1], [-OFF_Y, -OFFSET]);
    const rot = interpolate(p, [0, 1], [30, 0]);
    const s = interpolate(p, [0, 1], [0.4, 1]);
    const op = interpolate(p, [0, 0.3, 1], [0, 0.9, 1]);
    return {
      opacity: op,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale: s },
      ],
    };
  });

  // Bottom-Left (Tile 3)
  const t3Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [-OFF_X, -OFFSET]);
    const y = interpolate(p, [0, 1], [OFF_Y, OFFSET]);
    const rot = interpolate(p, [0, 1], [30, 0]);
    const s = interpolate(p, [0, 1], [0.4, 1]);
    const op = interpolate(p, [0, 0.3, 1], [0, 0.9, 1]);
    return {
      opacity: op,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale: s },
      ],
    };
  });

  // Bottom-Right (Tile 4 - Solid Gold)
  const t4Style = useAnimatedStyle(() => {
    const p = convergeProgress.value;
    const x = interpolate(p, [0, 1], [OFF_X, OFFSET]);
    const y = interpolate(p, [0, 1], [OFF_Y, OFFSET]);
    const rot = interpolate(p, [0, 1], [-30, 0]);
    const s = interpolate(p, [0, 1], [0.4, 1]);
    const op = interpolate(p, [0, 0.3, 1], [0, 0.9, 1]);
    return {
      opacity: op,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale: s },
      ],
    };
  });

  // Typography reveal style
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
          [-SCREEN_WIDTH * 0.8, SCREEN_WIDTH * 0.8]
        ),
      },
      { rotate: '25deg' },
    ],
  }));

  // Sparkle glint style
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glintOpacity.value,
    transform: [{ scale: glintScale.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, masterContainerStyle]} pointerEvents="auto">
      {/* 1. Deep Atmospheric Gold Background Glow */}
      <Animated.View style={[styles.ambientAura, auraStyle]}>
        <LinearGradient
          colors={['rgba(212, 175, 90, 0.28)', 'rgba(212, 175, 90, 0.06)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* 2. Main Stage */}
      <View style={styles.stage}>
        {/* Docking Pulse Ring */}
        <Animated.View style={[styles.pulseRing, pulseRingStyle]} />

        {/* 2x2 Logo Formation Cluster */}
        <Animated.View style={[styles.clusterWrap, clusterAnimatedStyle]}>
          {/* Tile 1: Top-Left (Obsidian Surface with Hairline Rim) */}
          <Animated.View style={[styles.tileBase, styles.obsidianTile, t1Style]}>
            <View style={styles.tileInnerGleam} />
          </Animated.View>

          {/* Tile 2: Top-Right (Obsidian Surface) */}
          <Animated.View style={[styles.tileBase, styles.obsidianTile, t2Style]}>
            <View style={styles.tileInnerGleam} />
          </Animated.View>

          {/* Tile 3: Bottom-Left (Obsidian Surface) */}
          <Animated.View style={[styles.tileBase, styles.obsidianTile, t3Style]}>
            <View style={styles.tileInnerGleam} />
          </Animated.View>

          {/* Tile 4: Bottom-Right (Solid Brushed Gold Accent) */}
          <Animated.View style={[styles.tileBase, styles.goldAccentTile, t4Style]}>
            <LinearGradient
              colors={['#F6E099', '#D4AF5A', '#A37926']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* High-Resolution Unified smartchair-mark-gold.png cross-fades for ultimate crispness */}
          <Animated.View style={[styles.unifiedGoldMark, goldMarkFadeStyle]}>
            <Image
              source={MOTION_ASSETS.logos.markGold}
              style={styles.markImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Soft Optical Glint on gold tile corner */}
          <Animated.View style={[styles.glintContainer, glintStyle]}>
            <View style={styles.glintCore} />
            <View style={styles.glintBeamH} />
            <View style={styles.glintBeamV} />
          </Animated.View>
        </Animated.View>

        {/* 3. Pure Vector Typography (Retina Sharp - Zero Blur) */}
        <Animated.View style={[styles.typographyBlock, typographyStyle]}>
          <Text style={styles.brandTitle}>
            Smart<Text style={styles.brandTitleGold}>Chair</Text>
          </Text>

          <View style={styles.descriptorRow}>
            <View style={styles.hairline} />
            <Text style={styles.descriptorText}>LUXURY GROOMING · INSTANT BOOKING</Text>
            <View style={styles.hairline} />
          </View>
        </Animated.View>

        {/* 4. Soft Specular Sheen Beam Sweeping Across */}
        <Animated.View pointerEvents="none" style={[styles.specularBeam, shineSweepStyle]}>
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0)',
              'rgba(255, 255, 255, 0.18)',
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
  ambientAura: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    overflow: 'hidden',
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 50,
  },
  pulseRing: {
    position: 'absolute',
    top: 55,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1.5,
    borderColor: '#D4AF5A',
  },
  clusterWrap: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 28,
  },
  tileBase: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  obsidianTile: {
    backgroundColor: '#141418',
    borderWidth: 1.5,
    borderColor: '#26262D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  tileInnerGleam: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 90, 0.16)',
    borderRadius: RADIUS - 1,
  },
  goldAccentTile: {
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 10,
  },
  unifiedGoldMark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  markImage: {
    width: 98,
    height: 98,
  },
  glintContainer: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glintCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  glintBeamH: {
    position: 'absolute',
    width: 16,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 1,
  },
  glintBeamV: {
    position: 'absolute',
    height: 16,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 1,
  },
  typographyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 34,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: 0.5,
  },
  brandTitleGold: {
    color: '#D4AF5A',
  },
  descriptorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  hairline: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(212, 175, 90, 0.35)',
  },
  descriptorText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D4AF5A',
    letterSpacing: 2.4,
  },
  specularBeam: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    width: 120,
  },
});
