import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '../theme/colors';
import { MOTION_ASSETS, SmartChairLogoMark } from './BrandAssets';

// Full-screen animated opening screen using SmartChair_Motion_Assets
// Plays on app launch while fonts & initial shop feed load, then smoothly fades out.
export const AnimatedSplashScreen = ({ isReady, onFinish }) => {
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(18);
  const wordmarkOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(15);

  useEffect(() => {
    // 1. Pop in the 2x2 SmartChair mark
    logoOpacity.value = withTiming(1, { duration: 350 });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 160 });

    // 2. Slide up the Fraunces outlined wordmark
    wordmarkOpacity.value = withDelay(220, withTiming(1, { duration: 400 }));
    wordmarkTranslateY.value = withDelay(220, withSpring(0, { damping: 14, stiffness: 140 }));

    // 3. Animate the gold progress bar
    progressWidth.value = withTiming(82, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  useEffect(() => {
    if (!isReady) return;
    progressWidth.value = withTiming(100, { duration: 250 });

    const timer = setTimeout(() => {
      containerScale.value = withTiming(1.06, { duration: 360 });
      containerOpacity.value = withTiming(0, { duration: 360 });
      setTimeout(() => {
        onFinish?.();
      }, 370);
    }, 650);

    return () => clearTimeout(timer);
  }, [isReady]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const markWrapStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkTranslateY.value }],
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  return (
    <Animated.View style={[styles.overlay, containerStyle]} pointerEvents="auto">
      <View style={styles.centerContent}>
        <Animated.View style={[styles.markBox, markWrapStyle]}>
          <SmartChairLogoMark size={74} pulse />
        </Animated.View>

        <Animated.View style={[styles.wordmarkBox, wordmarkStyle]}>
          <Image
            source={MOTION_ASSETS.logos.wordmarkOutlined}
            style={styles.wordmarkImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>BARBERSHOP · SALON · SPA</Text>
        </Animated.View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, barFillStyle]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  markBox: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  wordmarkBox: {
    alignItems: 'center',
    marginBottom: 36,
  },
  wordmarkImage: {
    width: 210,
    height: 38,
  },
  tagline: {
    marginTop: 10,
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 2.5,
  },
  progressTrack: {
    width: 160,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
});
