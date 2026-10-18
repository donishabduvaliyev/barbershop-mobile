import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { CatalogCard } from '../../src/components/CatalogCard';
import { LanguageActionSheet } from '../../src/components/LanguageActionSheet';
import { HomeFeedSkeleton } from '../../src/components/Skeletons';

// Standard categories matching categories.json in barbershop-main
const DEFAULT_CATEGORIES = [
  {
    id: '1',
    key: 'Barbershop',
    icon: '✂️',
    title: { en: 'Barbershop', uz: 'Sartaroshxona', ru: 'Барбершоп' },
  },
  {
    id: '2',
    key: 'Hair Salon',
    icon: '💇',
    title: { en: 'Hair Salon', uz: 'Soch Saloni', ru: 'Парикмахерская' },
  },
  {
    id: '3',
    key: 'Nail Salon',
    icon: '💅',
    title: { en: 'Nail Salon', uz: 'Tirnoq Saloni', ru: 'Ногтевой Салон' },
  },
  {
    id: '4',
    key: 'Beauty Spas',
    icon: '🧖',
    title: { en: 'Beauty Spas', uz: "Go'zallik Spasi", ru: 'СПА-салоны' },
  },
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
    feedData,
    isLoading,
    refreshShops,
    changeLanguage,
    userInfo,
    isSocketConnected,
  } = useAppContext();
  const { isTablet, horizontalPadding } = useResponsive();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const userName = userInfo?.name ? userInfo.name.split(' ')[0] : 'Guest';

  // Categories visible based on selection (matching Catalog.jsx)
  const visibleCategories = useMemo(() => {
    if (selectedCategory === 'All') return DEFAULT_CATEGORIES;
    return DEFAULT_CATEGORIES.filter(
      (cat) => cat.title.en.toLowerCase() === selectedCategory.toLowerCase() ||
               cat.key.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [selectedCategory]);

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      router.push({
        pathname: '/(tabs)/search',
        params: { query: searchTerm.trim() },
      });
    }
  };

  const handleCategorySelect = (catKey) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setSelectedCategory(catKey);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header (Faithfully replicating Home.jsx in barbershop-main) */}
      <View style={styles.header}>
        {/* Top row: Profile + Greeting + Language Selector */}
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.userIconCircle}>
              <Ionicons name="person-outline" size={18} color="#9C9CA6" />
            </View>
            <View style={styles.greetingCol}>
              <Text style={styles.welcomeText}>
                {t('welcome_message', 'Hello')}, {userName}
              </Text>
              <Text style={styles.greetingTitle}>
                {t('greeting', 'Welcome')}
              </Text>
            </View>
          </Pressable>

          <View style={styles.topActionsRow}>
            {/* Live Socket Dot */}
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isSocketConnected ? COLORS.success : COLORS.warning },
              ]}
            />
            {/* Language Action Sheet Modal (matching languageDropdown.jsx) */}
            <LanguageActionSheet />
          </View>
        </View>

        {/* Search Bar (matching searchbar.jsx in barbershop-main) */}
        <View style={styles.searchBarRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search"
              size={18}
              color="#64646D"
              style={styles.searchIcon}
            />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmitEditing={handleSearchSubmit}
              placeholder={t('searchbar', 'Search for barbershops, salons...')}
              placeholderTextColor="#64646D"
              style={styles.searchInput}
              returnKeyType="search"
            />
            <Pressable
              onPress={handleSearchSubmit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.searchSubmitBtn}
            >
              <Text style={styles.searchSubmitText}>{t('search', 'Search')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Category Carousel (matching Carusel.jsx in barbershop-main) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {/* "All" button */}
          <Pressable
            onPress={() => handleCategorySelect('All')}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={[
              styles.categoryPill,
              selectedCategory === 'All'
                ? styles.categoryPillActive
                : styles.categoryPillInactive,
            ]}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'All'
                  ? styles.categoryPillTextActive
                  : styles.categoryPillTextInactive,
              ]}
            >
              {t('FullCategories', 'All')}
            </Text>
          </Pressable>

          {/* Category Pills */}
          {DEFAULT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.title.en || selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.id}
                onPress={() => handleCategorySelect(cat.title.en)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={[
                  styles.categoryPill,
                  isSelected
                    ? styles.categoryPillActive
                    : styles.categoryPillInactive,
                ]}
              >
                <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected
                      ? styles.categoryPillTextActive
                      : styles.categoryPillTextInactive,
                  ]}
                >
                  {cat.title[currentLang] || cat.title.en}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Main Content (Catalog Sections matching Catalog.jsx) */}
      <ScrollView
        contentContainerStyle={[
          styles.mainScrollContent,
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
        {isLoading && shops.length === 0 ? (
          <HomeFeedSkeleton numColumns={isTablet ? 3 : 2} />
        ) : (
          visibleCategories.map((category) => {
            // Find shops for this category from feedData or fallback to filtered shops array
            const feedGroup = feedData.find(
              (f) => String(f.category || '').toLowerCase() === category.title.en.toLowerCase()
            );
            const categoryShops =
              feedGroup?.shops?.length > 0
                ? feedGroup.shops
                : shops.filter(
                    (s) =>
                      String(s.category || '').toLowerCase() ===
                      category.title.en.toLowerCase()
                  );

            return (
              <View key={category.id} style={styles.catalogSection}>
                {/* Category Header Row: Title + "See All" */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    {category.title[currentLang] || category.title.en}
                  </Text>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)/search',
                        params: { category: category.title.en },
                      })
                    }
                  >
                    <Text style={styles.seeAllText}>{t('SeeAll', 'See All')}</Text>
                  </Pressable>
                </View>

                {/* Horizontal Scrolling Shop Cards (matching Catalog.jsx) */}
                {categoryShops.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalCardRow}
                  >
                    {categoryShops.map((shop) => (
                      <CatalogCard key={shop._id} shop={shop} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.emptyCategoryText}>
                    {t('no_services_available', 'No services available in this category')}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C', // var(--color-bg)
  },
  header: {
    backgroundColor: 'rgba(10, 10, 12, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23', // var(--color-border-soft)
    paddingTop: 8,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#27272E',
    backgroundColor: '#131317',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingCol: {
    justifyContent: 'center',
  },
  welcomeText: {
    color: '#9C9CA6', // var(--color-text-muted)
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
  greetingTitle: {
    color: '#F4F4F5', // var(--color-text)
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    fontWeight: '700',
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: '#131317',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  langBtnActive: {
    backgroundColor: '#D4AF5A', // var(--color-accent)
  },
  langBtnText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyBold,
    fontSize: 11.5,
    fontWeight: '700',
  },
  langBtnTextActive: {
    color: '#0A0A0C',
  },
  searchBarRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  searchInputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1F', // var(--color-surface-2)
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272E',
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F4F4F5',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
    height: '100%',
    paddingRight: 6,
  },
  searchSubmitBtn: {
    backgroundColor: '#D4AF5A',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 6,
  },
  searchSubmitText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  carouselContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: '#D4AF5A',
  },
  categoryPillInactive: {
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  categoryEmoji: {
    fontSize: 13,
  },
  categoryPillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#0A0A0C',
  },
  categoryPillTextInactive: {
    color: '#9C9CA6',
  },
  mainScrollContent: {
    paddingTop: 16,
    paddingBottom: 105,
  },
  catalogSection: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    fontWeight: '700',
  },
  horizontalCardRow: {
    paddingVertical: 4,
  },
  emptyCategoryText: {
    color: '#64646D',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
