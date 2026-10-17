import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../theme/colors';
import { MOTION_ASSETS } from './BrandAssets';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Offscreen launch distances for the 4 squares (corners / edges of screen)
const OFF_X = SCREEN_WIDTH * 0.75;
const OFF_Y = SCREEN_HEIGHT * 0.55;

// Tile size for the 2x2 grid formation
const TILE_SIZE = 38;
const GAP = 9;
const RADIUS = 11;
const TARGET_OFFSET = (TILE_SIZE + GAP) / 2; // ~23.5px from center

export const AnimatedSplashScreen = ({ isReady, onFinish }) => {
  // Container master controls
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Background ambient gold radial glow
  const ambientGlowScale = useSharedValue(0.4);
  const ambientGlowOpacity = useSharedValue(0);

  // Shockwave ring that expands when tiles collide
  const shockwaveScale = useSharedValue(0.3);
  const shockwaveOpacity = useSharedValue(0);

  // Central logo bounce when tiles dock
  const logoMasterScale = useSharedValue(1);

  // High-res SmartChair Gold Mark cross-fade
  const goldMarkOpacity = useSharedValue(0);
  const goldMarkScale = useSharedValue(0.85);

  // 4 Squares coordinates & transformations
  // Tile 1: Top-Left
  const t1X = useSharedValue(-OFF_X);
  const t1Y = useSharedValue(-OFF_Y);
  const t1Rot = useSharedValue(-90);
  const t1Scale = useSharedValue(0.2);
  const t1Opacity = useSharedValue(0);

  // Tile 2: Top-Right
  const t2X = useSharedValue(OFF_X);
  const t2Y = useSharedValue(-OFF_Y);
  const t2Rot = useSharedValue(90);
  const t2Scale = useSharedValue(0.2);
  const t2Opacity = useSharedValue(0);

  // Tile 3: Bottom-Left
  const t3X = useSharedValue(-OFF_X);
  const t3Y = useSharedValue(OFF_Y);
  const t3Rot = useSharedValue(90);
  const t3Scale = useSharedValue(0.2);
  const t3Opacity = useSharedValue(0);

  // Tile 4: Bottom-Right (Signature Gold Accent Tile)
  const t4X = useSharedValue(OFF_X);
  const t4Y = useSharedValue(OFF_Y);
  const t4Rot = useSharedValue(-90);
  const t4Scale = useSharedValue(0.2);
  const t4Opacity = useSharedValue(0);

  // Wordmark and tagline reveal
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(28);

  // Shimmer / Shine sweeping beam
  const shineProgress = useSharedValue(-1.5);
  const glintScale = useSharedValue(0);
  const glintOpacity = useSharedValue(0);

  // Minimum display timer so users always experience the full cinematic reveal
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // 0. Ambient background glow warms up
    ambientGlowOpacity.value = withTiming(0.4, { duration: 600 });
    ambientGlowScale.value = withTiming(1.2, { duration: 1400 });

    // 1. The 4 squares appear at the screen edges and gather in the center
    const springPhysics = {
      damping: 13,
      stiffness: 85,
      mass: 0.9,
    };

    // Fade and scale in fast from edges
    t1Opacity.value = withTiming(1, { duration: 250 });
    t2Opacity.value = withDelay(40, withTiming(1, { duration: 250 }));
    t3Opacity.value = withDelay(80, withTiming(1, { duration: 250 }));
    t4Opacity.value = withDelay(120, withTiming(1, { duration: 250 }));

    t1Scale.value = withSpring(1, springPhysics);
    t2Scale.value = withDelay(40, withSpring(1, springPhysics));
    t3Scale.value = withDelay(80, withSpring(1, springPhysics));
    t4Scale.value = withDelay(120, withSpring(1, springPhysics));

    // Converge to 2x2 target offsets around center
    t1X.value = withSpring(-TARGET_OFFSET, springPhysics);
    t1Y.value = withSpring(-TARGET_OFFSET, springPhysics);
    t1Rot.value = withSpring(0, springPhysics);

    t2X.value = withDelay(40, withSpring(TARGET_OFFSET, springPhysics));
    t2Y.value = withDelay(40, withSpring(-TARGET_OFFSET, springPhysics));
    t2Rot.value = withDelay(40, withSpring(0, springPhysics));

    t3X.value = withDelay(80, withSpring(-TARGET_OFFSET, springPhysics));
    t3Y.value = withDelay(80, withSpring(TARGET_OFFSET, springPhysics));
    t3Rot.value = withDelay(80, withSpring(0, springPhysics));

    t4X.value = withDelay(120, withSpring(TARGET_OFFSET, springPhysics));
    t4Y.value = withDelay(120, withSpring(TARGET_OFFSET, springPhysics));
    t4Rot.value = withDelay(120, withSpring(0, springPhysics));

    // 2. The moment they collide & assemble (approx 680ms)
    const collideTime = 680;

    // Shockwave expands outward
    shockwaveScale.value = withDelay(
      collideTime,
      withTiming(2.4, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    shockwaveOpacity.value = withDelay(
      collideTime,
      withSequence(
        withTiming(0.85, { duration: 80 }),
        withTiming(0, { duration: 520 })
      )
    );

    // Center logo spring compression & snap
    logoMasterScale.value = withDelay(
      collideTime,
      withSequence(
        withTiming(1.12, { duration: 110 }),
        withSpring(1, { damping: 10, stiffness: 180 })
      )
    );

    // Cross-fade the unified high-res smartchair-mark-gold.png logo
    goldMarkOpacity.value = withDelay(collideTime + 60, withTiming(1, { duration: 320 }));
    goldMarkScale.value = withDelay(
      collideTime + 60,
      withSpring(1, { damping: 12, stiffness: 150 })
    );

    // 3. SmartChair text / wordmark appears beneath it (approx 900ms)
    textOpacity.value = withDelay(880, withTiming(1, { duration: 450 }));
    textTranslateY.value = withDelay(
      880,
      withSpring(0, { damping: 14, stiffness: 120 })
    );

    // 4. Brilliant diagonal gold shine / light sweep across the logo & text (approx 1350ms)
    shineProgress.value = withDelay(
      1320,
      withTiming(1.5, {
        duration: 900,
        easing: Easing.bezier(0.2, 0.8, 0.25, 1),
      })
    );

    // Sparkle / Glint star burst at the logo corner during the shine
    glintOpacity.value = withDelay(
      1550,
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 280 })
      )
    );
    glintScale.value = withDelay(
      1550,
      withSequence(
        withTiming(1.25, { duration: 140 }),
        withTiming(0.2, { duration: 260 })
      )
    );

    // Pulse ambient glow gently
    ambientGlowOpacity.value = withDelay(
      1400,
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 900 }),
          withTiming(0.3, { duration: 900 })
        ),
        -1,
        true
      )
    );

    // Minimum cinematic display duration of 2.2s so the full choreography plays
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2200);

    // Safety fallback: if network is slow/offline, transition anyway after 3.2s
    const maxSafetyTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3200);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxSafetyTimer);
    };
  }, []);

  // 5. When app data & fonts are ready (or minTime elapsed) -> graceful zoom-fade out
  useEffect(() => {
    if (!minTimeElapsed) return;

    containerScale.value = withTiming(1.06, {
      duration: 450,
      easing: Easing.inOut(Easing.cubic),
    });
    containerOpacity.value = withTiming(0, {
      duration: 450,
      easing: Easing.inOut(Easing.cubic),
    });

    const exitTimer = setTimeout(() => {
      onFinish?.();
    }, 470);

    return () => clearTimeout(exitTimer);
  }, [minTimeElapsed]);

  // Master container animated style
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  // Ambient gold halo background
  const ambientHaloStyle = useAnimatedStyle(() => ({
    opacity: ambientGlowOpacity.value,
    transform: [{ scale: ambientGlowScale.value }],
  }));

  // Shockwave ring
  const shockwaveStyle = useAnimatedStyle(() => ({
    opacity: shockwaveOpacity.value,
    transform: [{ scale: shockwaveScale.value }],
  }));

  // Center logo master scale
  const logoMasterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoMasterScale.value }],
  }));

  // High-res smartchair-mark-gold layer
  const goldMarkStyle = useAnimatedStyle(() => ({
    opacity: goldMarkOpacity.value,
    transform: [{ scale: goldMarkScale.value }],
  }));

  // Individual 4 square styles
  const t1Style = useAnimatedStyle(() => ({
    opacity: t1Opacity.value,
    transform: [
      { translateX: t1X.value },
      { translateY: t1Y.value },
      { rotate: `${t1Rot.value}deg` },
      { scale: t1Scale.value },
    ],
  }));

  const t2Style = useAnimatedStyle(() => ({
    opacity: t2Opacity.value,
    transform: [
      { translateX: t2X.value },
      { translateY: t2Y.value },
      { rotate: `${t2Rot.value}deg` },
      { scale: t2Scale.value },
    ],
  }));

  const t3Style = useAnimatedStyle(() => ({
    opacity: t3Opacity.value,
    transform: [
      { translateX: t3X.value },
      { translateY: t3Y.value },
      { rotate: `${t3Rot.value}deg` },
      { scale: t3Scale.value },
    ],
  }));

  const t4Style = useAnimatedStyle(() => ({
    opacity: t4Opacity.value,
    transform: [
      { translateX: t4X.value },
      { translateY: t4Y.value },
      { rotate: `${t4Rot.value}deg` },
      { scale: t4Scale.value },
    ],
  }));

  // Wordmark and tagline reveal
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  // Shine beam sweeping across the whole lockup
  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shineProgress.value,
          [-1.5, 1.5],
          [-SCREEN_WIDTH * 0.9, SCREEN_WIDTH * 0.9]
        ),
      },
      { rotate: '25deg' },
    ],
  }));

  // Sparkle / Glint star
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glintOpacity.value,
    transform: [{ scale: glintScale.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, containerStyle]} pointerEvents="auto">
      {/* Ambient background gold glow */}
      <Animated.View style={[styles.ambientHalo, ambientHaloStyle]}>
        <LinearGradient
          colors={['rgba(212, 175, 90, 0.32)', 'rgba(212, 175, 90, 0.08)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Center Logo & Animation Arena */}
      <View style={styles.centerStage}>
        {/* Shockwave Ring on Collision */}
        <Animated.View style={[styles.shockwaveRing, shockwaveStyle]} />

        {/* Master Logo Arena */}
        <Animated.View style={[styles.logoArena, logoMasterStyle]}>
          {/* Tile 1: Top-Left (Luxury Dark Surface with Gold Rim) */}
          <Animated.View style={[styles.tileBase, styles.darkTile, t1Style]}>
            <View style={styles.tileInnerRim} />
          </Animated.View>

          {/* Tile 2: Top-Right (Dark Charcoal Surface) */}
          <Animated.View style={[styles.tileBase, styles.darkTile, t2Style]}>
            <View style={styles.tileInnerRim} />
          </Animated.View>

          {/* Tile 3: Bottom-Left (Dark Charcoal Surface) */}
          <Animated.View style={[styles.tileBase, styles.darkTile, t3Style]}>
            <View style={styles.tileInnerRim} />
          </Animated.View>

          {/* Tile 4: Bottom-Right (Signature Luminous Solid Gold Tile) */}
          <Animated.View style={[styles.tileBase, styles.goldTile, t4Style]}>
            <LinearGradient
              colors={['#F6E099', '#D4AF5A', '#AA822A']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* High-Res Unified smartchair-mark-gold.png cross-faded over assembled tiles */}
          <Animated.View style={[styles.goldMarkContainer, goldMarkStyle]}>
            <Image
              source={MOTION_ASSETS.logos.markGold}
              style={styles.goldMarkImage}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Micro Starburst Glint on top corner */}
          <Animated.View style={[styles.glintWrap, glintStyle]}>
            <View style={styles.glintDot} />
            <View style={styles.glintRayH} />
            <View style={styles.glintRayV} />
          </Animated.View>
        </Animated.View>

        {/* Wordmark and Brand Descriptor Beneath the Logo */}
        <Animated.View style={[styles.textArena, textStyle]}>
          {/* SmartChair Wordmark Outlined Logo */}
          <Image
            source={MOTION_ASSETS.logos.wordmarkOutlined}
            style={styles.wordmarkImage}
            resizeMode="contain"
          />

          {/* Stylized Brand Typographic Tagline */}
          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.taglineText}>PREMIUM GROOMING & INSTANT BOOKING</Text>
            <View style={styles.taglineLine} />
          </View>
        </Animated.View>

        {/* Diagonal Specular Shine Beam that sweeps across the logo and text */}
        <Animated.View pointerEvents="none" style={[styles.shineBeam, shineStyle]}>
          <LinearGradient
            colors={[
              'rgba(212, 175, 90, 0)',
              'rgba(255, 255, 255, 0.15)',
              'rgba(255, 250, 220, 0.65)',
              'rgba(212, 175, 90, 0.35)',
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
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientHalo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
    paddingVertical: 40,
  },
  shockwaveRing: {
    position: 'absolute',
    top: 50,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#D4AF5A',
  },
  logoArena: {
    width: 96,
    height: 96,
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
  darkTile: {
    backgroundColor: '#16161B',
    borderWidth: 1.5,
    borderColor: '#2E2E38',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  tileInnerRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 90, 0.15)',
    borderRadius: RADIUS - 1,
  },
  goldTile: {
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 14,
    elevation: 8,
  },
  goldMarkContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  goldMarkImage: {
    width: 92,
    height: 92,
  },
  glintWrap: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    shadowColor: '#FFF',
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  glintRayH: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 1,
  },
  glintRayV: {
    position: 'absolute',
    height: 20,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 1,
  },
  textArena: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkImage: {
    width: 220,
    height: 44,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  taglineLine: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(212, 175, 90, 0.35)',
  },
  taglineText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 2.2,
  },
  shineBeam: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 110,
  },
});
