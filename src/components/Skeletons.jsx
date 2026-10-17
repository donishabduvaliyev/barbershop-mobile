import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '../theme/colors';

// Reusable pulsing shimmer block matching SmartChair surface-2 / surface-3 tokens
export const SkeletonBox = ({ width = '100%', height = 16, borderRadius = 10, style }) => {
  const opacity = useSharedValue(0.38);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.38, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: COLORS.surface3,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

// Shop Card Skeleton matching components/card-shop.svg geometry
export const ShopCardSkeleton = () => (
  <View style={styles.shopCard}>
    <SkeletonBox width="100%" height={175} borderRadius={0} />
    <View style={styles.shopCardContent}>
      <View style={styles.rowBetween}>
        <SkeletonBox width="62%" height={18} borderRadius={6} />
        <SkeletonBox width={36} height={16} borderRadius={6} />
      </View>
      <SkeletonBox width="45%" height={13} borderRadius={5} style={{ marginTop: 10 }} />
      <View style={[styles.rowBetween, { marginTop: 16 }]}>
        <SkeletonBox width={80} height={26} borderRadius={8} />
        <SkeletonBox width={104} height={32} borderRadius={10} />
      </View>
    </View>
  </View>
);

// Home Screen Skeleton Grid (adapts to 1, 2, or 3 columns on phone/tablet)
export const HomeFeedSkeleton = ({ numColumns = 1 }) => {
  const items = Array.from({ length: numColumns === 1 ? 3 : 6 }, (_, i) => i);
  return (
    <View style={[styles.gridContainer, numColumns > 1 && styles.gridContainerTablet]}>
      {items.map((item) => (
        <View
          key={item}
          style={[
            styles.gridItem,
            numColumns === 2 && styles.gridItemTwoCol,
            numColumns === 3 && styles.gridItemThreeCol,
          ]}
        >
          <ShopCardSkeleton />
        </View>
      ))}
    </View>
  );
};

// Search Discovery Shelves Skeleton
export const SearchSkeleton = ({ numColumns = 1 }) => (
  <View style={{ marginTop: 8 }}>
    <SkeletonBox width={150} height={22} borderRadius={7} style={{ marginBottom: 14 }} />
    <HomeFeedSkeleton numColumns={numColumns} />
  </View>
);

// Shop Detail Screen Skeleton
export const ShopDetailSkeleton = ({ horizontalPadding = 16 }) => (
  <View style={styles.fullScreen}>
    <SkeletonBox width="100%" height={240} borderRadius={0} />
    <View style={{ paddingHorizontal: horizontalPadding, marginTop: -20 }}>
      <View style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <SkeletonBox width="65%" height={24} borderRadius={8} />
          <SkeletonBox width={70} height={26} borderRadius={13} />
        </View>
        <SkeletonBox width="50%" height={14} borderRadius={6} style={{ marginTop: 12 }} />
        <SkeletonBox width="38%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
      </View>

      <View style={styles.sectionCard}>
        <SkeletonBox width={120} height={20} borderRadius={6} style={{ marginBottom: 14 }} />
        {[1, 2, 3].map((k) => (
          <View key={k} style={[styles.rowBetween, { paddingVertical: 12 }]}>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="55%" height={16} borderRadius={6} />
              <SkeletonBox width="28%" height={12} borderRadius={5} style={{ marginTop: 6 }} />
            </View>
            <SkeletonBox width={80} height={18} borderRadius={6} />
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <SkeletonBox width={140} height={20} borderRadius={6} style={{ marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[1, 2, 3].map((k) => (
            <SkeletonBox key={k} width={108} height={126} borderRadius={16} />
          ))}
        </View>
      </View>
    </View>
  </View>
);

// Booking Screen Skeleton matching components/panel-booking-sheet.svg
export const BookingSheetSkeleton = ({ horizontalPadding = 16 }) => (
  <View style={[styles.fullScreen, { paddingHorizontal: horizontalPadding, paddingTop: 16 }]}>
    <View style={styles.sectionCard}>
      <SkeletonBox width={150} height={18} borderRadius={6} style={{ marginBottom: 14 }} />
      <SkeletonBox width="100%" height={54} borderRadius={14} style={{ marginBottom: 10 }} />
      <SkeletonBox width="100%" height={54} borderRadius={14} />
    </View>

    <View style={styles.sectionCard}>
      <SkeletonBox width={160} height={18} borderRadius={6} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[1, 2, 3].map((k) => (
          <SkeletonBox key={k} width={92} height={92} borderRadius={14} />
        ))}
      </View>
    </View>

    <View style={styles.sectionCard}>
      <SkeletonBox width={130} height={18} borderRadius={6} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[1, 2, 3, 4].map((k) => (
          <SkeletonBox key={k} width={72} height={68} borderRadius={14} />
        ))}
      </View>
    </View>

    <View style={styles.sectionCard}>
      <SkeletonBox width={170} height={18} borderRadius={6} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <SkeletonBox key={k} width={86} height={46} borderRadius={10} />
        ))}
      </View>
    </View>
  </View>
);

// Profile Bookings List Skeleton
export const ProfileBookingsSkeleton = () => (
  <View style={{ gap: 12 }}>
    {[1, 2, 3].map((k) => (
      <View key={k} style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <SkeletonBox width="58%" height={18} borderRadius={6} />
            <SkeletonBox width="42%" height={13} borderRadius={5} style={{ marginTop: 8 }} />
          </View>
          <SkeletonBox width={116} height={26} borderRadius={13} />
        </View>
        <SkeletonBox width="48%" height={13} borderRadius={5} style={{ marginTop: 14 }} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  shopCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    marginBottom: 16,
  },
  shopCardContent: {
    padding: 14,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridContainer: {
    flexDirection: 'column',
  },
  gridContainerTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridItem: {
    width: '100%',
  },
  gridItemTwoCol: {
    width: '50%',
    paddingHorizontal: 8,
  },
  gridItemThreeCol: {
    width: '33.333%',
    paddingHorizontal: 8,
  },
});
