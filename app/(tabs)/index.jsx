import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ShopCard } from '../../src/components/ShopCard';
import { MOTION_ASSETS, SmartChairLogoMark } from '../../src/components/BrandAssets';
import { HomeFeedSkeleton } from '../../src/components/Skeletons';

const CATEGORIES = [
  { key: 'All', icon: 'grid-outline' },
  { key: 'Barbershop', icon: 'cut-outline' },
  { key: 'Beauty Salon', icon: 'sparkles-outline' },
  { key: 'Spa', icon: 'leaf-outline' },
  { key: 'Dentist', icon: 'medkit-outline' },
];

const LANGUAGES = [
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'uz';
  const {
    shops,
    isLoading,
    refreshShops,
    isSocketConnected,
    changeLanguage,
    userInfo,
  } = useAppContext();
  const { isTablet, numColumns, horizontalPadding } = useResponsive();

  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredShops = useMemo(() => {
    if (selectedCategory === 'All') return shops;
    return shops.filter(
      (s) => String(s.category || '').toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [shops, selectedCategory]);

  const handleCategorySelect = (cat) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedCategory(cat);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && shops.length > 0}
            onRefresh={refreshShops}
            tintColor={COLORS.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar: Official 2x2 Mark + Fraunces Wordmark + Live Sync + Language Switcher */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <SmartChairLogoMark size={28} />
            </View>
            <View>
              <Text style={styles.brandTitleText}>
                Smart<Text style={{ color: COLORS.accent }}>Chair</Text>
              </Text>
              <View style={styles.syncRow}>
                <View
                  style={[
                    styles.syncDot,
                    { backgroundColor: isSocketConnected ? COLORS.success : COLORS.warning },
                  ]}
                />
                <Text style={styles.syncText}>{t('LiveSyncActive')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.langPill}>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.code}
                  onPress={() => changeLanguage(l.code)}
                  style={[
                    styles.langBtn,
                    currentLang === l.code && styles.langBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langBtnText,
                      currentLang === l.code && styles.langBtnTextActive,
                    ]}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Hero Section with Search Field styled after components/search-bar.svg */}
        <Animated.View entering={FadeInDown.delay(70).duration(400)} style={styles.heroCard}>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroTitle}>
              {userInfo?.name ? `${userInfo.name.split(' ')[0]}, ` : ''}
              {t('DiscoverTitle')}
            </Text>
            <Text style={styles.heroSubtitle}>{t('DiscoverSubtitle')}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/search')}
            style={styles.searchBarTrigger}
          >
            <Image
              source={MOTION_ASSETS.icons.search}
              style={{ width: 18, height: 18, tintColor: COLORS.accent }}
              resizeMode="contain"
            />
            <Text style={styles.searchBarPlaceholder} numberOfLines={1}>
              {t('SearchPlaceholder')}
            </Text>
            <View style={styles.boltPill}>
              <Ionicons name="flash" size={12} color={COLORS.bg} />
              <Text style={styles.boltText}>{t('FindAvailableNow')}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Category Filter Chips styled after components/chip-pill-on.svg & chip-pill-off.svg */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => handleCategorySelect(cat.key)}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
              >
                <Ionicons
                  name={cat.icon}
                  size={15}
                  color={active ? COLORS.bg : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    active && styles.categoryPillTextActive,
                  ]}
                >
                  {t(cat.key.replace(' ', ''), cat.key)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Shimmering Skeleton Grid while loading from server, then Animated Shop Grid */}
        {isLoading && shops.length === 0 ? (
          <HomeFeedSkeleton numColumns={numColumns} />
        ) : (
          <View style={[styles.gridContainer, isTablet && styles.gridContainerTablet]}>
            {filteredShops.map((shop, idx) => (
              <View
                key={shop._id}
                style={[
                  styles.gridItem,
                  numColumns === 2 && styles.gridItemTwoCol,
                  numColumns === 3 && styles.gridItemThreeCol,
                ]}
              >
                <ShopCard shop={shop} index={idx} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleText: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: -0.3,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  langBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  langBtnActive: {
    backgroundColor: COLORS.accent,
  },
  langBtnText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  langBtnTextActive: {
    color: COLORS.bg,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  heroTextCol: {
    marginBottom: 14,
  },
  heroTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 23,
    fontWeight: '600',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
  },
  searchBarTrigger: {
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  searchBarPlaceholder: {
    color: COLORS.textFaint,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
    flex: 1,
  },
  boltPill: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boltText: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    fontWeight: '700',
  },
  categoriesRow: {
    gap: 10,
    paddingBottom: 18,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  categoryPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryPillText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
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
