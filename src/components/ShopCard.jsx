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
import { COLORS, FONTS, SPRING_PRESETS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';
import { normalizeShopImageUrl, DEFAULT_SHOP_IMAGES } from '../utils/imageUtils';
import { HeartIcon } from './HeartIcon';

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
      entering={FadeInDown.delay(Math.min(index * 50, 300)).springify().damping(18)}
      style={[styles.wrapper, style]}
    >
      <AnimatedPressable
        delayPressIn={40}
        onPressIn={() => {
          scale.value = withSpring(0.975, SPRING_PRESETS.cardPress);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, SPRING_PRESETS.cardPress);
        }}
        onPress={handlePress}
        style={[styles.card, animatedCardStyle]}
      >
        {/* Cover Image with Glass Floating Badges */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: normalizeShopImageUrl(shop.image, shop.category),
            }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Promoted Luxury Pill */}
          {shop.isPromoted && (
            <View style={styles.promotedBadge}>
              <Ionicons name="sparkles" size={11} color="#D4AF5A" />
              <Text style={styles.promotedText}>{t('Promoted')}</Text>
            </View>
          )}

          {/* Frosted Glass Floating Heart Button */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              if (Platform.OS !== 'web') Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggleFavorite(shop._id);
            }}
            style={styles.favoriteBtn}
            hitSlop={8}
          >
            <HeartIcon
              filled={isFavorited}
              size={18}
              color={isFavorited ? COLORS.danger : '#FFFFFF'}
            />
          </Pressable>

          {/* Rating Pill */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#D4AF5A" />
            <Text style={styles.ratingText}>
              {Number(shop.rating || 5.0).toFixed(1)}
            </Text>
            <Text style={styles.reviewsText}>({shop.reviewsCount || 0})</Text>
          </View>
        </View>

        {/* Content Body */}
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
              <Ionicons name="location-sharp" size={13} color="#D4AF5A" />
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
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                router.push(`/booking/${shop._id}`);
              }}
              style={styles.bookBtn}
            >
              <Text style={styles.bookBtnText}>{t('BookNow')}</Text>
              <Ionicons name="arrow-forward" size={13} color="#0A0A0C" />
            </Pressable>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#131317',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#1A1A1F',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  promotedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 90, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promotedText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  favoriteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(10, 10, 12, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsText: {
    color: COLORS.textMuted,
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
    flex: 1,
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginRight: 8,
  },
  priceTier: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  address: {
    flex: 1,
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 12.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryChip: {
    backgroundColor: '#1A1A1F',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D4AF5A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  bookBtnText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
});
