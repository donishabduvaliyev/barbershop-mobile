import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ShopDetailSkeleton } from '../../src/components/Skeletons';
import { normalizeShopImageUrl } from '../../src/utils/imageUtils';
import { HeartIcon } from '../../src/components/HeartIcon';

const normParam = (v) => (Array.isArray(v) ? v[0] : v);

export default function ShopDetailScreen() {
  const params = useLocalSearchParams();
  const id = normParam(params.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { backEndUrl, favoriteIds, toggleFavorite } = useAppContext();
  const { isTablet, horizontalPadding } = useResponsive();

  const [shop, setShop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${backEndUrl}/api/mobile/shops/shops/${id}`)
          .then((r) => (r.ok ? r : fetch(`${backEndUrl}/api/shops/shops/${id}`)))
          .catch(() => fetch(`${backEndUrl}/api/shops/shops/${id}`));
        if (res && res.ok && isMounted) {
          const data = await res.json();
          setShop(data);
        }
      } catch (err) {
        console.warn('Error loading shop details:', err.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id, backEndUrl]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ShopDetailSkeleton horizontalPadding={horizontalPadding} />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={14}
          style={styles.circleBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <Text style={styles.notFoundText}>{t('not_found', 'Shop not found')}</Text>
      </SafeAreaView>
    );
  }

  const isFavorited = favoriteIds.has(String(shop._id));
  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';
  const shopAddress =
    shop.address?.[lang] || shop.address?.uz || shop.address?.ru || shop.address?.en || '';
  const shopDesc =
    shop.description?.[lang] || shop.description?.uz || shop.description?.ru || shop.description?.en || '';

  const lat = shop.location?.coordinates?.[1] || 41.311081;
  const lng = shop.location?.coordinates?.[0] || 69.240562;

  const handleOpenMap = () => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleCall = () => {
    if (shop.phone) {
      Linking.openURL(`tel:${shop.phone}`).catch(() => {});
    }
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Image with Gradient Overlay & Back / Favorite Buttons */}
        <View style={[styles.heroBox, isTablet && { height: 320 }]}>
          <Image
            source={{
              uri: normalizeShopImageUrl(shop.image, shop.category),
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />

          <View style={[styles.heroTopActions, { top: Math.max(insets.top, 16) + 8 }]}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                router.back();
              }}
              hitSlop={12}
              style={styles.circleBtn}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                toggleFavorite(shop._id);
              }}
              hitSlop={12}
              style={styles.circleBtn}
            >
              <HeartIcon
                filled={isFavorited}
                size={18}
                color={isFavorited ? COLORS.danger : '#FFFFFF'}
              />
            </Pressable>
          </View>
        </View>

        {/* Floating Main Info Card (-mt-6 relative z-10) */}
        <View
          style={[
            styles.bodyContainer,
            { paddingHorizontal: horizontalPadding },
            isTablet && styles.tabletColumns,
          ]}
        >
          <View style={isTablet ? styles.tabletLeftCol : undefined}>
            <Animated.View entering={FadeInDown.duration(350)} style={styles.infoCard}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.shopTitle}>{shopName}</Text>
                  {!!shopDesc && (
                    <Text style={styles.shopDescription}>{shopDesc}</Text>
                  )}
                </View>

                {/* Rating Badge */}
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={13} color="#F0B84C" />
                  <Text style={styles.ratingValue}>
                    {Number(shop.rating || 5.0).toFixed(1)}
                  </Text>
                  <Text style={styles.reviewsCount}>({shop.reviewsCount || 0})</Text>
                </View>
              </View>

              {/* Meta Rows: Address, Working Hours, Phone */}
              <View style={styles.metaDivider}>
                {!!shopAddress && (
                  <Pressable onPress={handleOpenMap} style={styles.metaRow}>
                    <Ionicons name="location-sharp" size={15} color="#D4AF5A" />
                    <Text style={[styles.metaText, styles.underlineText]} numberOfLines={1}>
                      {shopAddress}
                    </Text>
                  </Pressable>
                )}

                <View style={styles.metaRowBetween}>
                  <View style={styles.metaRowInner}>
                    <Ionicons name="time-outline" size={15} color="#D4AF5A" />
                    <Text style={styles.metaText}>
                      {shop.workingHours?.from || '09:00'} – {shop.workingHours?.to || '21:00'}
                    </Text>
                  </View>

                  {shop.phone && (
                    <Pressable onPress={handleCall} style={styles.metaRowInner}>
                      <Ionicons name="call-outline" size={15} color="#D4AF5A" />
                      <Text style={[styles.metaText, styles.phoneText]}>{shop.phone}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* Services Section */}
            {shop.services?.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(80).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('Services', 'Services')}</Text>
                <View style={styles.servicesList}>
                  {shop.services.map((item, idx) => {
                    const serviceName =
                      item.name?.[lang] ||
                      item.name?.uz ||
                      item.name?.ru ||
                      item.name?.en ||
                      t('Service');
                    const priceFormatted =
                      item.price != null
                        ? `${(item.price / 1000).toFixed(0)} 000 UZS`
                        : '0 UZS';

                    return (
                      <Pressable
                        key={item._id || idx}
                        onPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.selectionAsync().catch(() => {});
                          }
                          router.push({
                            pathname: `/booking/${shop._id}`,
                            params: { presetServiceId: item._id },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.serviceCard,
                          pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                        ]}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.serviceName}>{serviceName}</Text>
                          <Text style={styles.serviceDuration}>
                            {t('Duration', 'Duration')}: {item.durationMinutes || 30} {t('minutes', 'min')}
                          </Text>
                        </View>
                        <View style={styles.pricePill}>
                          <Text style={styles.pricePillText}>{priceFormatted}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* Gallery Section (Only shows if extra shop images exist) */}
            {Array.isArray(shop.images) && shop.images.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(120).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('Gallery', 'Gallery')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryList}
                >
                  {shop.images.map((imgUrl, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: imgUrl }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* Meet the Team Section (Specialists / Barbers) */}
            {Array.isArray(shop.staff) && shop.staff.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(160).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('MeetTheTeam', 'Meet the Team')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.teamList}
                >
                  {shop.staff.map((member) => (
                    <Pressable
                      key={member._id}
                      onPress={() => {
                        if (Platform.OS !== 'web') {
                          Haptics.selectionAsync().catch(() => {});
                        }
                        router.push({
                          pathname: `/booking/${shop._id}`,
                          params: { presetStaffId: member._id },
                        });
                      }}
                      style={styles.teamMember}
                    >
                      <View style={styles.avatarWrap}>
                        <Image
                          source={{
                            uri:
                              member.photo ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                member.name || 'Barber'
                              )}&background=1A1A1F&color=D4AF5A`,
                          }}
                          style={styles.avatar}
                        />
                        {member.rating && (
                          <View style={styles.avatarRatingBadge}>
                            <Text style={styles.avatarRatingText}>
                              ⭐ {Number(member.rating).toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {member.title && (
                        <Text style={styles.memberRole} numberOfLines={1}>
                          {member.title}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Booking Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) + 4 },
        ]}
      >
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            router.push(`/booking/${shop._id}`);
          }}
          style={({ pressed }) => [
            styles.bookCtaBtn,
            pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
          ]}
        >
          <Text style={styles.bookCtaText}>✂️  {t('BookNow', 'Book Now')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C', // var(--color-bg)
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    marginTop: 16,
  },
  heroBox: {
    height: 288, // matching h-72 from web
    width: '100%',
    position: 'relative',
    backgroundColor: '#1A1A1F',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.45)',
  },
  heroTopActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyContainer: {
    marginTop: -24, // -mt-6 from web
    position: 'relative',
    zIndex: 10,
  },
  tabletColumns: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  tabletLeftCol: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#131317', // var(--color-surface)
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#27272E', // var(--color-border-soft)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  shopTitle: {
    color: '#F4F4F5', // var(--color-text)
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  shopDescription: {
    color: '#9C9CA6', // var(--color-text-muted)
    fontFamily: FONTS.bodyRegular,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(240, 184, 76, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 184, 76, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ratingValue: {
    color: '#F0B84C', // warning gold
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 12.5,
  },
  reviewsCount: {
    color: '#64646D',
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
  },
  metaDivider: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272E',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12.5,
  },
  underlineText: {
    textDecorationLine: 'underline',
    flex: 1,
  },
  phoneText: {
    fontFamily: FONTS.bodySemiBold,
    color: '#D4AF5A',
  },
  sectionCard: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  servicesList: {
    gap: 10,
  },
  serviceCard: {
    backgroundColor: '#131317',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  serviceName: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
  serviceDuration: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 11.5,
    marginTop: 3,
  },
  pricePill: {
    backgroundColor: 'rgba(212, 175, 90, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 90, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pricePillText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
  },
  galleryList: {
    gap: 10,
    paddingBottom: 4,
  },
  galleryImage: {
    width: 112,
    height: 112,
    borderRadius: 12,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  teamList: {
    gap: 16,
    paddingBottom: 4,
  },
  teamMember: {
    width: 80,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#27272E',
    backgroundColor: '#1A1A1F',
  },
  avatarRatingBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
  },
  avatarRatingText: {
    color: '#F0B84C',
    fontSize: 9.5,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
  },
  memberName: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  memberRole: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 10.5,
    marginTop: 1,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 12, 0.92)',
    borderTopWidth: 1,
    borderTopColor: '#27272E',
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 30,
  },
  bookCtaBtn: {
    backgroundColor: '#D4AF5A',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  bookCtaText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
