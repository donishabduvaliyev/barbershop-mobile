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
import { COLORS, FONTS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';
import { MOTION_ASSETS } from './BrandAssets';

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
              <Ionicons name="sparkles" size={11} color={COLORS.bg} />
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
            <Image
              source={MOTION_ASSETS.icons.star}
              style={{ width: 13, height: 13, tintColor: COLORS.accent }}
              resizeMode="contain"
            />
            <Text style={styles.ratingText}>
              {Number(shop.rating || 5.0).toFixed(1)}
            </Text>
            <Text style={styles.reviewsText}>· {shop.reviewsCount || 0} {t('Reviews')}</Text>
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
              <Image
                source={MOTION_ASSETS.icons.mapPin}
                style={{ width: 13, height: 13, tintColor: COLORS.textMuted }}
                resizeMode="contain"
              />
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
              <Ionicons name="arrow-forward" size={14} color={COLORS.bg} />
            </Pressable>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

// Styled after components/card-shop.svg (#131317 fill, #212127 1.5px stroke, #D4AF5A rating)
const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.surface3,
  },
  imageContainer: {
    height: 175,
    width: '100%',
    position: 'relative',
    backgroundColor: '#2A2416',
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
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
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
    backgroundColor: 'rgba(10, 10, 12, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(10, 10, 12, 0.86)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 12,
  },
  reviewsText: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyRegular,
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
    fontFamily: FONTS.bodyBold,
    fontSize: 16.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  priceTier: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  address: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
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
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodySemiBold,
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
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13,
  },
});
