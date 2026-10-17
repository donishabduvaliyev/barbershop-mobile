import React, { useEffect } from 'react';
import { View, Text, Image, Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '../theme/colors';

// Bundled PNG & Font assets from SmartChair_Motion_Assets & SmartChair_Motion_Assets_PNG
export const MOTION_ASSETS = {
  logos: {
    mark: require('../../assets/png/logos/smartchair-mark.png'),
    markGold: require('../../assets/png/logos/smartchair-mark-gold.png'),
    markWhite: require('../../assets/png/logos/smartchair-mark-white.png'),
    wordmarkOutlined: require('../../assets/png/logos/smartchair-wordmark-outlined.png'),
    lockup: require('../../assets/png/logos/smartchair-lockup.png'),
  },
  icons: {
    bell: require('../../assets/png/icons/bell.png'),
    check: require('../../assets/png/icons/check.png'),
    chevronDown: require('../../assets/png/icons/chevron-down.png'),
    clock: require('../../assets/png/icons/clock.png'),
    home: require('../../assets/png/icons/home.png'),
    mapPin: require('../../assets/png/icons/map-pin.png'),
    phone: require('../../assets/png/icons/phone.png'),
    refresh: require('../../assets/png/icons/refresh.png'),
    search: require('../../assets/png/icons/search.png'),
    star: require('../../assets/png/icons/star.png'),
    telegram: require('../../assets/png/icons/telegram.png'),
    users: require('../../assets/png/icons/users.png'),
    wallet: require('../../assets/png/icons/wallet.png'),
  },
  components: {
    cardSuccess: require('../../assets/png/components/card-success.png'),
    cardNotificationTelegram: require('../../assets/png/components/card-notification-telegram.png'),
    benefit247: require('../../assets/png/components/card-benefit-24-7.png'),
    benefitFewerNoShows: require('../../assets/png/components/card-benefit-fewer-noshows.png'),
    benefitRepeatVisits: require('../../assets/png/components/card-benefit-repeat-visits.png'),
    badgePending: require('../../assets/png/components/badge-pending.png'),
    badgeConfirmed: require('../../assets/png/components/badge-confirmed.png'),
    badgeDone: require('../../assets/png/components/badge-done.png'),
  },
  fonts: {
    'Fraunces-500': require('../../assets/fonts/Fraunces-500.ttf'),
    'Fraunces-600': require('../../assets/fonts/Fraunces-600.ttf'),
    'Fraunces-700': require('../../assets/fonts/Fraunces-700.ttf'),
    'Inter-400': require('../../assets/fonts/Inter-400.ttf'),
    'Inter-500': require('../../assets/fonts/Inter-500.ttf'),
    'Inter-600': require('../../assets/fonts/Inter-600.ttf'),
    'Inter-700': require('../../assets/fonts/Inter-700.ttf'),
    'Inter-800': require('../../assets/fonts/Inter-800.ttf'),
  },
};

// Interactive / Animated 2x2 "Booked Slot" SmartChair Mark
// Matches logos/smartchair-mark.svg: 3 outlined squares (#46414C) + 1 solid gold square (#D4AF5A)
export const SmartChairLogoMark = ({ size = 36, pulse = false }) => {
  const goldScale = useSharedValue(0.6);
  const goldOpacity = useSharedValue(0.85);

  useEffect(() => {
    goldScale.value = withSpring(1, { damping: 10, stiffness: 180 });
    if (pulse) {
      goldScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 750 }),
          withTiming(0.96, { duration: 750 })
        ),
        -1,
        true
      );
      goldOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750 }),
          withTiming(0.75, { duration: 750 })
        ),
        -1,
        true
      );
    }
  }, [pulse, goldScale, goldOpacity]);

  const goldAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: goldScale.value }],
    opacity: goldOpacity.value,
  }));

  const cellSize = Math.round(size * 0.38);
  const gap = Math.max(Math.round(size * 0.08), 3);
  const radius = Math.max(Math.round(cellSize * 0.22), 3);
  const strokeWidth = Math.max(size * 0.07, 1.8);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap, marginBottom: gap }}>
        <View
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: COLORS.markStroke,
          }}
        />
        <Animated.View
          style={[
            {
              width: cellSize,
              height: cellSize,
              borderRadius: radius,
              backgroundColor: COLORS.accent,
            },
            goldAnimStyle,
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', gap }}>
        <View
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: COLORS.markStroke,
          }}
        />
        <View
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: COLORS.markStroke,
          }}
        />
      </View>
    </View>
  );
};

// Official Status Badge matching badge-pending.svg, badge-confirmed.svg, badge-done.svg
// Convention from README.txt: 16% opacity pill background + solid 6px dot + bold 11px label
export const StatusBadge = ({ status, label }) => {
  const dotPulse = useSharedValue(1);

  useEffect(() => {
    if (status === 'pending') {
      dotPulse.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true
      );
    } else {
      dotPulse.value = 1;
    }
  }, [status, dotPulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotPulse.value,
  }));

  let bg = COLORS.warningSoft;
  let fg = COLORS.warning;

  if (status === 'confirmed') {
    bg = COLORS.infoSoft;
    fg = COLORS.info;
  } else if (status === 'completed' || status === 'done') {
    bg = COLORS.successSoft;
    fg = COLORS.success;
  } else if (status === 'cancelled' || status === 'rejected' || status === 'no-show') {
    bg = COLORS.dangerSoft;
    fg = COLORS.danger;
  }

  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <Animated.View style={[styles.badgeDot, { backgroundColor: fg }, dotStyle]} />
      <Text style={[styles.badgeLabel, { color: fg }]}>{label}</Text>
    </View>
  );
};

// Animated Booking Confirmation Modal modeled directly on components/card-success.svg
// and components/card-notification-telegram.png
export const BookingSuccessModal = ({ visible, title, subtitle, onClose }) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Animated.View entering={ZoomIn.springify().damping(15)} style={styles.successCard}>
          <View style={styles.successCircle}>
            <Image
              source={MOTION_ASSETS.icons.check}
              style={styles.checkIcon}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.successTitle}>{title || "So'rov yuborildi!"}</Text>
          <Text style={styles.successSubtitle}>
            {subtitle || 'Tez orada Telegramda tasdiqlash xabarini olasiz.'}
          </Text>

          <Animated.View entering={FadeIn.delay(220).duration(400)} style={styles.tgPreviewWrap}>
            <Image
              source={MOTION_ASSETS.components.cardNotificationTelegram}
              style={styles.tgPreviewImg}
              resizeMode="contain"
            />
          </Animated.View>

          <Pressable onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>OK</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    gap: 7,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeLabel: {
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 12, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
  },
  successCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.success,
  },
  successTitle: {
    fontFamily: FONTS.displaySemiBold,
    fontWeight: '600',
    fontSize: 19,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  tgPreviewWrap: {
    width: '100%',
    height: 68,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tgPreviewImg: {
    width: '100%',
    height: '100%',
  },
  doneBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.bg,
  },
});
