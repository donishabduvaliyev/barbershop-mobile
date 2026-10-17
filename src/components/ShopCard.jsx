import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ShopCard = ({ shop, index = 0, style }) => {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const lang = i18n.language || 'uz';
  const { favoriteIds, toggleFavorite } = useAppContext();

  const scale = useSharedValue(1);
  const isFavorited = favoriteIds.has(String(shop._id));

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';
  const shopAddress =
    shop.address?.[lang] || shop.address?.uz || shop.address?.ru || shop.address?.en || '';

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(`/shop/${shop._id}`);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 60, 360)).springify().damping(18)}
      style={[styles.wrapper, style]}
    >
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 250 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 250 });
        }}
        onPress={handlePress}
        style={[styles.card, animatedCardStyle]}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                shop.image ||
                'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
            }}
            style={styles.image}
            resizeMode="cover"
          />
          {shop.isPromoted && (
            <View style={styles.promotedBadge}>
              <Ionicons name="sparkles" size={11} color="#000" />
              <Text style={styles.promotedText}>{t('Promoted')}</Text>
            </View>
          )}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              toggleFavorite(shop._id);
            }}
            style={styles.favoriteBtn}
            hitSlop={10}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorited ? COLORS.danger : '#FFF'}
            />
          </Pressable>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={13} color={COLORS.accent} />
            <Text style={styles.ratingText}>
              {Number(shop.rating || 5.0).toFixed(1)}
            </Text>
            <Text style={styles.reviewsText}>({shop.reviewsCount || 0})</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {shopName}
            </Text>
            {shop.priceTier && (
              <Text style={styles.priceTier}>{'$'.repeat(shop.priceTier)}</Text>
            )}
          </View>

          {!!shopAddress && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.address} numberOfLines={1}>
                {shopAddress}
              </Text>
            </View>
          )}

          <View style={styles.footerRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{shop.category || 'Barbershop'}</Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                router.push(`/booking/${shop._id}`);
              }}
              style={styles.bookBtn}
            >
              <Text style={styles.bookBtnText}>{t('BookNow')}</Text>
              <Ionicons name="arrow-forward" size={14} color="#000" />
            </Pressable>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  imageContainer: {
    height: 175,
    width: '100%',
    position: 'relative',
    backgroundColor: COLORS.surface2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  promotedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promotedText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 15, 23, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(11, 15, 23, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 12,
  },
  reviewsText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  content: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  priceTier: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  address: {
    color: COLORS.textMuted,
    fontSize: 13,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  bookBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
});
