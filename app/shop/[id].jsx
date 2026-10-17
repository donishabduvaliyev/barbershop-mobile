import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { MOTION_ASSETS } from '../../src/components/BrandAssets';
import { ShopDetailSkeleton } from '../../src/components/Skeletons';

const normParam = (v) => (Array.isArray(v) ? v[0] : v);

export default function ShopDetailScreen() {
  const params = useLocalSearchParams();
  const id = normParam(params.id);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { backEndUrl, favoriteIds, toggleFavorite } = useAppContext();
  const { isTablet, horizontalPadding } = useResponsive();

  const [shop, setShop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${backEndUrl}/api/mobile/shops/shops/${id}`);
        if (res.ok) {
          const data = await res.json();
          setShop(data);
        }
      } catch (err) {
        console.warn('Error loading shop details:', err.message);
      } finally {
        setIsLoading(false);
      }
    })();
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
        <Pressable onPress={() => router.back()} style={styles.circleBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
      </SafeAreaView>
    );
  }

  const isFavorited = favoriteIds.has(String(shop._id));
  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';
  const shopAddress =
    shop.address?.[lang] || shop.address?.uz || shop.address?.ru || shop.address?.en || '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Cover */}
        <View style={[styles.heroBox, isTablet && { height: 320 }]}>
          <Image
            source={{
              uri:
                shop.image ||
                'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1000&q=80',
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroTopActions}>
            <Pressable onPress={() => router.back()} style={styles.circleBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <Pressable
              onPress={() => toggleFavorite(shop._id)}
              style={styles.circleBtn}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorited ? COLORS.danger : '#FFF'}
              />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.bodyContainer,
            { paddingHorizontal: horizontalPadding },
            isTablet && styles.tabletColumns,
          ]}
        >
          {/* Left / Main Column */}
          <View style={isTablet ? styles.tabletLeftCol : undefined}>
            <Animated.View entering={FadeInDown.duration(350)} style={styles.infoCard}>
              <View style={styles.titleRow}>
                <Text style={styles.shopTitle}>{shopName}</Text>
                <View style={styles.ratingPill}>
                  <Image
                    source={MOTION_ASSETS.icons.star}
                    style={{ width: 14, height: 14, tintColor: COLORS.accent }}
                    resizeMode="contain"
                  />
                  <Text style={styles.ratingValue}>
                    {Number(shop.rating || 5.0).toFixed(1)}
                  </Text>
                  <Text style={styles.reviewsCount}>({shop.reviewsCount || 0})</Text>
                </View>
              </View>

              {!!shopAddress && (
                <View style={styles.metaRow}>
                  <Image
                    source={MOTION_ASSETS.icons.mapPin}
                    style={{ width: 16, height: 16, tintColor: COLORS.accent }}
                    resizeMode="contain"
                  />
                  <Text style={styles.metaText}>{shopAddress}</Text>
                </View>
              )}

              {shop.phone && (
                <View style={styles.metaRow}>
                  <Image
                    source={MOTION_ASSETS.icons.phone}
                    style={{ width: 16, height: 16, tintColor: COLORS.accent }}
                    resizeMode="contain"
                  />
                  <Text style={styles.metaText}>{shop.phone}</Text>
                </View>
              )}
            </Animated.View>

            {/* Services Section */}
            {shop.services?.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(80).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('Services')}</Text>
                {shop.services.map((service) => {
                  const serviceName =
                    service.name?.[lang] ||
                    service.name?.uz ||
                    service.name?.ru ||
                    service.name?.en;
                  return (
                    <Pressable
                      key={service._id}
                      onPress={() =>
                        router.push({
                          pathname: `/booking/${shop._id}`,
                          params: { presetServiceId: service._id },
                        })
                      }
                      style={styles.serviceRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{serviceName}</Text>
                        <Text style={styles.serviceDuration}>
                          ⏱ {service.durationMinutes || 60} {t('min')}
                        </Text>
                      </View>
                      <View style={styles.servicePriceRight}>
                        <Text style={styles.servicePrice}>
                          {service.price?.toLocaleString()} {t('UZS')}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={COLORS.accent}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </View>

          {/* Right Column on Tablet (or Stacked on Phone): Barbers & Working Hours */}
          <View style={isTablet ? styles.tabletRightCol : undefined}>
            {shop.staff?.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(140).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('Barbers')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.staffList}
                >
                  {shop.staff.map((member) => (
                    <Pressable
                      key={member._id}
                      onPress={() =>
                        router.push({
                          pathname: `/booking/${shop._id}`,
                          params: { presetStaffId: member._id },
                        })
                      }
                      style={styles.staffCard}
                    >
                      <Image
                        source={{
                          uri:
                            member.photo ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              member.name
                            )}&background=212127&color=F4F4F5`,
                        }}
                        style={styles.staffAvatar}
                      />
                      <Text style={styles.staffName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text style={styles.staffRole} numberOfLines={1}>
                        {member.role || 'Master'}
                      </Text>
                      <View style={styles.staffRatingRow}>
                        <Image
                          source={MOTION_ASSETS.icons.star}
                          style={{ width: 12, height: 12, tintColor: COLORS.accent }}
                          resizeMode="contain"
                        />
                        <Text style={styles.staffRatingText}>
                          {Number(member.rating || 5.0).toFixed(1)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {shop.workingHours?.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(200).duration(350)}
                style={styles.sectionCard}
              >
                <Text style={styles.sectionTitle}>{t('WorkingHours')}</Text>
                {shop.workingHours.map((wh, idx) => (
                  <View key={idx} style={styles.hoursRow}>
                    <Text style={styles.hoursDays}>
                      {(wh.days || []).map((d) => t(`days.${d}`, d)).join(', ')}
                    </Text>
                    <Text style={styles.hoursTime}>
                      {wh.from} – {wh.to}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Book CTA styled after button-primary.svg */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => router.push(`/booking/${shop._id}`)}
          style={styles.bookCtaBtn}
        >
          <Text style={styles.bookCtaText}>{t('BookNow')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBox: {
    height: 240,
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroTopActions: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 10, 12, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyContainer: {
    marginTop: -20,
  },
  tabletColumns: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  tabletLeftCol: {
    flex: 3,
  },
  tabletRightCol: {
    flex: 2,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  shopTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 22,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ratingValue: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13,
  },
  reviewsCount: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  serviceName: {
    color: COLORS.text,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  serviceDuration: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  servicePriceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  servicePrice: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 14,
  },
  staffList: {
    gap: 12,
  },
  staffCard: {
    width: 112,
    backgroundColor: COLORS.surface2,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  staffAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginBottom: 8,
    backgroundColor: COLORS.surface3,
  },
  staffName: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13.5,
  },
  staffRole: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },
  staffRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  staffRatingText: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hoursDays: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    flex: 1,
  },
  hoursTime: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
  },
  bookCtaBtn: {
    backgroundColor: COLORS.accent,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCtaText: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
});
