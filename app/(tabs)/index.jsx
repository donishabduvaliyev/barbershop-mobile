import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ShopCard } from '../../src/components/ShopCard';

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
            refreshing={isLoading}
            onRefresh={refreshShops}
            tintColor={COLORS.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar: Brand + Live Sync Indicator + Language Switcher */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Ionicons name="cut" size={18} color="#000" />
            </View>
            <View>
              <Text style={styles.brandName}>SmartChair</Text>
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

        {/* Hero Section */}
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
            <Ionicons name="search" size={18} color={COLORS.accent} />
            <Text style={styles.searchBarPlaceholder} numberOfLines={1}>
              {t('SearchPlaceholder')}
            </Text>
            <View style={styles.boltPill}>
              <Ionicons name="flash" size={13} color="#000" />
              <Text style={styles.boltText}>{t('FindAvailableNow')}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Category Filter Pills */}
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
                  size={16}
                  color={active ? '#000' : COLORS.textMuted}
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

        {/* Responsive Multi-Column Grid for Phones & Tablets */}
        {isLoading && shops.length === 0 ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
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
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncText: {
    color: COLORS.textMuted,
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
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
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
    fontSize: 12,
    fontWeight: '700',
  },
  langBtnTextActive: {
    color: '#000',
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  heroTextCol: {
    marginBottom: 14,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  searchBarTrigger: {
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchBarPlaceholder: {
    color: COLORS.textMuted,
    fontSize: 14,
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
    color: '#000',
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  categoryPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryPillText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  loaderBox: {
    paddingVertical: 64,
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
