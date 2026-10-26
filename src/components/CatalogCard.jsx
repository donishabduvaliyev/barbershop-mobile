import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPRING_PRESETS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';
import { normalizeShopImageUrl } from '../utils/imageUtils';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Faithful React Native replication of Catalog.jsx shop cards from barbershop-main
export const CatalogCard = ({ shop, style }) => {
  const router = useRouter();
  const { i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { favoriteIds, toggleFavorite } = useAppContext();

  const scale = useSharedValue(1);
  const isFavorited = favoriteIds.has(String(shop._id));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    router.push(`/shop/${shop._id}`);
  };

  return (
    <AnimatedPressable
      delayPressIn={40}
      onPressIn={() => {
        scale.value = withSpring(0.975, SPRING_PRESETS.cardPress);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING_PRESETS.cardPress);
      }}
      onPress={handlePress}
      style={[styles.card, animStyle, style]}
    >
      {/* Cover Image + Floating Favorite Button */}
      <View style={styles.imageWrap}>
        <Image
          source={{
            uri: normalizeShopImageUrl(shop.image, shop.category),
          }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Favorite Button (matching FavoriteButton.jsx in barbershop-main) */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (Platform.OS !== 'web') {
              Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            toggleFavorite(shop._id);
          }}
          style={styles.favoriteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorited ? COLORS.danger : '#FFFFFF'}
          />
        </Pressable>
      </View>

      {/* Card Info Footer (matching Catalog.jsx) */}
      <View style={styles.footerRow}>
        <View style={styles.infoCol}>
          <Text style={styles.nameText} numberOfLines={1}>
            {shopName}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color={COLORS.warning} />
            <Text style={styles.ratingText}>
              {Number(shop.rating || 5.0).toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Arrow Circle Right Button (matching ArrowCircleRightIcon in Catalog.jsx) */}
        <View style={styles.arrowBtn}>
          <Ionicons name="arrow-forward-circle" size={24} color={COLORS.accent} />
        </View>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 155,
    backgroundColor: '#131317', // var(--color-surface)
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272E', // var(--color-border-soft)
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  imageWrap: {
    width: '100%',
    height: 104,
    backgroundColor: '#1A1A1F',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  infoCol: {
    flex: 1,
    marginRight: 6,
  },
  nameText: {
    color: '#F4F4F5', // var(--color-text)
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(240, 184, 76, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  ratingText: {
    color: '#F0B84C', // var(--color-warning)
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    fontWeight: '700',
  },
  arrowBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
