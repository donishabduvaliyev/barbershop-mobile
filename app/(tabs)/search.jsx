import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { SearchSkeleton } from '../../src/components/Skeletons';
import { normalizeShopImageUrl } from '../../src/utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SHOP_CATEGORIES = [
  'Barbershop',
  'Nail Salon',
  'Hair Salon',
  'Massage Therapy',
  'Beauty Spas',
];

const SERVICE_SUGGESTIONS = {
  'Barbershop': {
    en: ['Haircut', 'Beard Trim', 'Shave', 'Hair Wash'],
    ru: ['Стрижка', 'Оформление бороды', 'Бритьё', 'Мытьё головы'],
    uz: ['Soch olish', 'Soqol olish', 'Soqol qirish', 'Soch yuvish'],
  },
  'Nail Salon': {
    en: ['Manicure', 'Pedicure', 'Nail Polish', 'Gel Nails'],
    ru: ['Маникюр', 'Педикюр', 'Покрытие лаком', 'Гель-лак'],
    uz: ['Manikyur', 'Pedikyur', 'Lak qoplash', 'Gel lak'],
  },
  'Hair Salon': {
    en: ['Haircut', 'Hair Coloring', 'Blowout', 'Hair Treatment'],
    ru: ['Стрижка', 'Окрашивание', 'Укладка', 'Уход за волосами'],
    uz: ['Soch olish', "Soch bo'yash", 'Fen bilan turmaklash', 'Soch parvarishi'],
  },
  'Massage Therapy': {
    en: ['Relaxation Massage', 'Deep Tissue Massage', 'Sports Massage'],
    ru: ['Расслабляющий массаж', 'Глубокий массаж', 'Спортивный массаж'],
    uz: ['Dam olish massaji', 'Chuqur massaj', 'Sport massaji'],
  },
  'Beauty Spas': {
    en: ['Facial', 'Spa Treatment', 'Skin Care'],
    ru: ['Уход за лицом', 'Спа-процедура', 'Уход за кожей'],
    uz: ['Yuz parvarishi', 'Spa protsedura', 'Teri parvarishi'],
  },
};

// Bottom Sheet for "Find Available Now" matching AvailableNowSheet in SearchPege.jsx
const AvailableNowSheet = ({ open, onClose, onSearch, isSearching, t, lang }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);

  const dates = useMemo(
    () =>
      [...Array(4)].map((_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );

  useEffect(() => {
    if (!open) return;
    setSelectedCategory(null);
    setSelectedService(null);
    setSelectedDate(dates[0]);
    setSelectedHour(null);
  }, [open, dates]);

  useEffect(() => {
    setSelectedService(null);
  }, [selectedCategory]);

  const suggestedServices = selectedCategory
    ? SERVICE_SUGGESTIONS[selectedCategory]?.[lang] ||
      SERVICE_SUGGESTIONS[selectedCategory]?.en ||
      []
    : [];

  const hours = useMemo(() => {
    if (!selectedDate) return [];
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const startHour = isToday ? now.getHours() + 1 : 8;
    const list = [];
    for (let h = Math.max(startHour, 8); h <= 23; h++) list.push(h);
    return list;
  }, [selectedDate]);

  useEffect(() => {
    if (hours.length > 0 && (selectedHour === null || !hours.includes(selectedHour))) {
      setSelectedHour(hours[0]);
    }
  }, [hours, selectedHour]);

  const canSearch = !!selectedService && selectedDate && selectedHour !== null && !isSearching;

  const submit = () => {
    if (!canSearch) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const requestedDate = new Date(selectedDate);
    requestedDate.setHours(selectedHour, 0, 0, 0);
    onSearch(selectedService, requestedDate);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={sheetStyles.sheet}>
          {/* Header */}
          <View style={sheetStyles.header}>
            <View style={sheetStyles.headerTitleRow}>
              <Ionicons name="flash" size={18} color="#D4AF5A" />
              <Text style={sheetStyles.headerTitle}>{t('FindAvailableNow', 'Find available now')}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={sheetStyles.closeBtn}
            >
              <Ionicons name="close" size={22} color="#9C9CA6" />
            </Pressable>
          </View>

          <ScrollView style={sheetStyles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Step 1: Pick a category */}
            <View style={sheetStyles.section}>
              <Text style={sheetStyles.sectionLabel}>{t('PickACategory', 'Pick a Category')}</Text>
              <View style={sheetStyles.chipsWrap}>
                {SHOP_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedCategory(cat);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={[sheetStyles.chip, isSelected && sheetStyles.chipActive]}
                    >
                      <Text style={[sheetStyles.chipText, isSelected && sheetStyles.chipTextActive]}>
                        {t(cat, cat)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Suggested service pills */}
            {!!selectedCategory && (
              <View style={sheetStyles.section}>
                <Text style={sheetStyles.sectionLabel}>
                  {t('WhatServiceNeeded', 'What service is needed?')}
                </Text>
                <View style={sheetStyles.chipsWrap}>
                  {suggestedServices.map((service) => {
                    const isSelected = selectedService === service;
                    return (
                      <Pressable
                        key={service}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                          setSelectedService(service);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={[sheetStyles.chip, isSelected && sheetStyles.chipActive]}
                      >
                        <Text
                          style={[
                            sheetStyles.chipText,
                            isSelected && sheetStyles.chipTextActive,
                          ]}
                        >
                          {service}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 3: Pick a date */}
            <View style={sheetStyles.section}>
              <Text style={sheetStyles.sectionLabel}>{t('PickADate', 'Pick a Date')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheetStyles.dateRow}>
                {dates.map((date) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  return (
                    <Pressable
                      key={date.toISOString()}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedDate(date);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      style={[sheetStyles.dateChip, isSelected && sheetStyles.dateChipActive]}
                    >
                      <Text
                        style={[
                          sheetStyles.dateDayText,
                          isSelected && sheetStyles.dateDayTextActive,
                        ]}
                      >
                        {date.toLocaleDateString(lang, { weekday: 'short' })}
                      </Text>
                      <Text
                        style={[
                          sheetStyles.dateNumText,
                          isSelected && sheetStyles.dateNumTextActive,
                        ]}
                      >
                        {date.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Step 4: Pick a time */}
            <View style={sheetStyles.section}>
              <Text style={sheetStyles.sectionLabel}>{t('PickATime', 'Pick a Time')}</Text>
              {hours.length > 0 ? (
                <View style={sheetStyles.chipsWrap}>
                  {hours.map((h) => {
                    const isSelected = selectedHour === h;
                    const label = `${String(h).padStart(2, '0')}:00`;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                          setSelectedHour(h);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={[sheetStyles.hourChip, isSelected && sheetStyles.hourChipActive]}
                      >
                        <Text
                          style={[
                            sheetStyles.hourChipText,
                            isSelected && sheetStyles.hourChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={sheetStyles.emptyText}>
                  {t('No available time slots for this day.', 'No available time slots for this day.')}
                </Text>
              )}
            </View>

            {/* Search Availability CTA */}
            <View style={sheetStyles.ctaWrap}>
              <Pressable
                onPress={submit}
                disabled={!canSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[sheetStyles.submitBtn, !canSearch && sheetStyles.submitBtnDisabled]}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <Text style={sheetStyles.submitBtnText}>
                    {t('SearchAvailability', 'Search Availability')}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Available Shop Result Card matching AvailableShopResultCard in SearchPege.jsx
const AvailableShopResultCard = ({ shop, lang, router, presetDate, presetHour }) => {
  const shopName = shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Shop';
  const shopCategory = shop.category || 'Barbershop';
  const shopAddress = shop.address || 'Tashkent';

  return (
    <View style={resultCardStyles.card}>
      <Pressable
        onPress={() => router.push(`/shop/${shop.shopId}`)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Image
          source={{
            uri: normalizeShopImageUrl(shop.image, shop.category),
          }}
          style={resultCardStyles.image}
        />
      </Pressable>

      <View style={resultCardStyles.infoCol}>
        <View style={resultCardStyles.topRow}>
          <Pressable
            onPress={() => router.push(`/shop/${shop.shopId}`)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ flex: 1 }}
          >
            <Text style={resultCardStyles.shopName} numberOfLines={1}>
              {shopName}
            </Text>
          </Pressable>
          <View style={resultCardStyles.ratingBadge}>
            <Ionicons name="star" size={13} color="#FBBF24" />
            <Text style={resultCardStyles.ratingText}>{Number(shop.rating || 5.0).toFixed(1)}</Text>
          </View>
        </View>

        <Text style={resultCardStyles.subText} numberOfLines={1}>
          {shopCategory} · {shopAddress}
        </Text>

        {/* Matched Services Pills */}
        <View style={resultCardStyles.servicesRow}>
          {(shop.matchedServices || []).map((service) => {
            const serviceName =
              service.name?.[lang] || service.name?.uz || service.name?.ru || service.name?.en;
            return (
              <Pressable
                key={service.serviceId}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  router.push({
                    pathname: `/booking/${shop.shopId}`,
                    params: {
                      presetDate,
                      presetHour,
                      presetServiceId: service.serviceId,
                    },
                  });
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={resultCardStyles.servicePill}
              >
                <Text style={resultCardStyles.servicePillText} numberOfLines={1}>
                  {serviceName} · {service.price?.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

// AdCarousel matching AdCarousel in SearchPege.jsx with smooth horizontal paging
const CARD_WIDTH = SCREEN_WIDTH - 32;

const AdCarousel = ({ services, lang, router }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);
  const isInteracting = useRef(false);

  useEffect(() => {
    if (!services || services.length <= 1) return;
    const timer = setInterval(() => {
      if (isInteracting.current) return;
      setCurrentIndex((prev) => {
        const next = prev === services.length - 1 ? 0 : prev + 1;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [services]);

  if (!services || services.length === 0) return null;

  return (
    <View style={adStyles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          isInteracting.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            isInteracting.current = false;
          }, 2000);
        }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
          if (idx >= 0 && idx < services.length) {
            setCurrentIndex(idx);
          }
          isInteracting.current = false;
        }}
        contentContainerStyle={adStyles.scrollContent}
      >
        {services.map((service, idx) => {
          const name =
            service.name?.[lang] ||
            service.name?.uz ||
            service.name?.ru ||
            service.name?.en ||
            'Featured';
          return (
            <Pressable
              key={service._id || service.id || idx}
              onPress={() => router.push(`/shop/${service.id || service._id}`)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={adStyles.slide}
            >
              <Image
                source={{
                  uri: normalizeShopImageUrl(service.image, service.category),
                }}
                style={adStyles.image}
              />
              <View style={adStyles.gradientOverlay} />
              <View style={adStyles.adBadge}>
                <Text style={adStyles.adBadgeText}>Ad</Text>
              </View>
              <View style={adStyles.infoBox}>
                <Text style={adStyles.serviceTitle}>{name}</Text>
                <Text style={adStyles.serviceCategory}>{service.category}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Indicator Dots */}
      <View style={adStyles.dotsRow} pointerEvents="none">
        {services.map((_, idx) => (
          <View
            key={idx}
            style={[adStyles.dot, currentIndex === idx && adStyles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
};

// HorizontalCarousel matching HorizontalCarousel in SearchPege.jsx
const HorizontalCarousel = ({ title, services, lang, router, badge }) => {
  const { favoriteIds, toggleFavorite } = useAppContext();

  if (!services || services.length === 0) return null;

  return (
    <View style={shelfStyles.shelfWrap}>
      <Text style={shelfStyles.shelfTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={shelfStyles.scrollList}
      >
        {services.map((service) => {
          const serviceName =
            service.name?.[lang] ||
            service.name?.uz ||
            service.name?.ru ||
            service.name?.en ||
            'Shop';
          const isFavorited = favoriteIds.has(String(service._id));

          return (
            <Pressable
              key={service._id}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                router.push(`/shop/${service._id}`);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={shelfStyles.card}
            >
              <View style={shelfStyles.imageWrap}>
                <Image
                  source={{
                    uri: normalizeShopImageUrl(service.image, service.category),
                  }}
                  style={shelfStyles.cardImage}
                />
                {badge && (
                  <View style={shelfStyles.badgePill}>
                    <Text style={shelfStyles.badgeText}>{badge}</Text>
                  </View>
                )}
                {/* Floating Heart Button */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }
                    toggleFavorite(service._id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={shelfStyles.favBtn}
                >
                  <Ionicons
                    name={isFavorited ? 'heart' : 'heart-outline'}
                    size={16}
                    color={isFavorited ? COLORS.danger : '#FFFFFF'}
                  />
                </Pressable>
              </View>

              <View style={shelfStyles.cardFooter}>
                <Text style={shelfStyles.cardName} numberOfLines={1}>
                  {serviceName}
                </Text>
                <View style={shelfStyles.metaRow}>
                  <Text style={shelfStyles.catText} numberOfLines={1}>
                    {service.category}
                  </Text>
                  <View style={shelfStyles.ratingWrap}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={shelfStyles.ratingNumber}>
                      {Number(service.rating || 5.0).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Main Search Screen matching SearchPege.jsx in barbershop-main
export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { backEndUrl, showToast } = useAppContext();

  const [searchTerm, setSearchTerm] = useState(params?.query ? String(params.query) : '');
  const [activeCategory, setActiveCategory] = useState(params?.category ? String(params.category) : 'All');
  const [shopLists, setShopLists] = useState({ advertisedShops: [], categories: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Sync params if updated while already mounted
  useEffect(() => {
    if (params?.query !== undefined && params?.query !== searchTerm) {
      setSearchTerm(String(params.query));
    }
    if (params?.category !== undefined && params?.category !== activeCategory) {
      setActiveCategory(String(params.category));
    }
  }, [params?.query, params?.category]);

  // "Find available now" state matching SearchPege.jsx
  const [isAvailableSheetOpen, setIsAvailableSheetOpen] = useState(false);
  const [isAvailableNowLoading, setIsAvailableNowLoading] = useState(false);
  const [availableNowResults, setAvailableNowResults] = useState(null);
  const [availableNowMeta, setAvailableNowMeta] = useState(null);

  const categories = ['All', ...SHOP_CATEGORIES];

  // Debounced discovery search matching SearchPege.jsx
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const requestBody = {
          searchTerm: searchTerm.trim(),
          category: activeCategory === 'All' ? null : activeCategory,
        };

        const fetchSearch = (prefix) =>
          fetch(`${backEndUrl}${prefix}/discovery-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

        const res = await fetchSearch('/api/shops')
          .then((r) => (r.ok ? r : fetchSearch('/api/mobile/shops')))
          .catch(() => fetchSearch('/api/mobile/shops'));

        if (!res || !res.ok) return;
        const data = await res.json();
        if (active) setShopLists(data);
      } catch (err) {
        console.warn('Failed to fetch discovery search:', err.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, activeCategory, backEndUrl]);

  const handleAvailableNowSearch = async (serviceQuery, requestedDate) => {
    setIsAvailableNowLoading(true);
    try {
      const fetchNow = (prefix) =>
        fetch(`${backEndUrl}${prefix}/available-now`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceQuery,
            requestedTime: requestedDate.toISOString(),
          }),
        });

      const response = await fetchNow('/api/shops')
        .then((r) => (r.ok ? r : fetchNow('/api/mobile/shops')))
        .catch(() => fetchNow('/api/mobile/shops'));

      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setAvailableNowResults(data.results || []);
      setAvailableNowMeta({
        query: serviceQuery,
        presetDate: requestedDate.toISOString(),
        presetHour: `${String(requestedDate.getHours()).padStart(2, '0')}:00`,
        timeLabel: requestedDate.toLocaleString(lang, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      setIsAvailableSheetOpen(false);
    } catch (error) {
      console.warn('Failed to search availability:', error);
      showToast?.(t('AvailableNowFetchError', 'Failed to search available slots'), 'error');
    } finally {
      setIsAvailableNowLoading(false);
    }
  };

  const clearAvailableNow = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setAvailableNowResults(null);
    setAvailableNowMeta(null);
  };

  const hasResults =
    (shopLists.advertisedShops && shopLists.advertisedShops.length > 0) ||
    (shopLists.categories && shopLists.categories.some((cat) => cat.shops?.length > 0));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky Header matching SearchPege.jsx */}
      <View style={styles.stickyHeader}>
        {/* Search Input */}
        <View style={styles.searchInputRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={19} color="#D4AF5A" style={{ marginRight: 8 }} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder={t('Search for salons, spas, etc.', 'Search for salons, spas, etc.')}
              placeholderTextColor="#9C9CA6"
              style={styles.textInput}
              returnKeyType="search"
            />
            {!!searchTerm && (
              <Pressable
                onPress={() => setSearchTerm('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color="#9C9CA6" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Categories Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsRow}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                  setActiveCategory(cat);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              >
                <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                  {t(cat, cat)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Find Available Now Trigger Button */}
        <View style={styles.availableTriggerWrap}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setIsAvailableSheetOpen(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.availableTriggerBtn}
          >
            <Ionicons name="flash" size={16} color="#D4AF5A" />
            <Text style={styles.availableTriggerText}>
              {t('FindAvailableNow', 'Find available now')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Body */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {availableNowMeta ? (
          /* Available Now Results View */
          <View style={styles.resultsContainer}>
            <View style={styles.resultsMetaRow}>
              <Text style={styles.resultsTitleText}>
                {t('AvailableNowResultsTitle', {
                  count: availableNowResults?.length || 0,
                  query: availableNowMeta.query,
                  defaultValue: `${availableNowResults?.length || 0} available for "${availableNowMeta.query}"`,
                })}{' '}
                · {availableNowMeta.timeLabel}
              </Text>
              <Pressable
                onPress={clearAvailableNow}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.clearSearchText}>{t('ClearSearch', 'Clear search')}</Text>
              </Pressable>
            </View>

            {availableNowResults?.length > 0 ? (
              <View style={styles.resultsList}>
                {availableNowResults.map((shop) => (
                  <AvailableShopResultCard
                    key={shop.shopId}
                    shop={shop}
                    lang={lang}
                    router={router}
                    presetDate={availableNowMeta.presetDate}
                    presetHour={availableNowMeta.presetHour}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {t('NoAvailableShopsFound', 'No available specialists found at this time.')}
                </Text>
              </View>
            )}
          </View>
        ) : isLoading ? (
          /* Loading Skeleton */
          <SearchSkeleton numColumns={1} />
        ) : (
          /* Default Discovery Feed matching SearchPege.jsx */
          <>
            {/* Promotional Banner Carousel */}
            <AdCarousel
              services={shopLists.advertisedShops || []}
              lang={lang}
              router={router}
            />

            {hasResults ? (
              shopLists.categories?.map((cat) => (
                <HorizontalCarousel
                  key={cat.key}
                  title={`${cat.icon ? `${cat.icon} ` : ''}${
                    cat.label?.[lang] || cat.label?.en || cat.key
                  }`}
                  services={cat.shops}
                  lang={lang}
                  router={router}
                  badge={
                    cat.key === 'editors-choice'
                      ? cat.label?.[lang] || cat.label?.en || "Editor's Choice"
                      : null
                  }
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {t('NoResults', 'No results found for')} "{activeCategory}"
                  {searchTerm ? ` ${t('with', 'with')} "${searchTerm}"` : ''}.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Available Now Bottom Sheet Modal */}
      <AvailableNowSheet
        open={isAvailableSheetOpen}
        onClose={() => setIsAvailableSheetOpen(false)}
        onSearch={handleAvailableNowSearch}
        isSearching={isAvailableNowLoading}
        t={t}
        lang={lang}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C', // var(--color-bg)
  },
  stickyHeader: {
    backgroundColor: 'rgba(10, 10, 12, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#27272F', // var(--color-border-soft)
    zIndex: 10,
  },
  searchInputRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1F', // var(--color-surface-2)
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272F',
    paddingHorizontal: 12,
    height: 48,
  },
  textInput: {
    flex: 1,
    color: '#F4F4F5',
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    height: '100%',
  },
  categoryPillsRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#131317', // var(--color-surface)
    borderWidth: 1,
    borderColor: '#27272E',
  },
  categoryPillActive: {
    backgroundColor: '#D4AF5A', // var(--color-accent)
    borderColor: '#D4AF5A',
  },
  categoryPillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#9C9CA6',
  },
  categoryPillTextActive: {
    color: '#0A0A0C',
  },
  availableTriggerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  availableTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 90, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 90, 0.4)',
  },
  availableTriggerText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 110, // Generous clearance for floating pill navbar!
  },
  resultsContainer: {
    paddingHorizontal: 16,
  },
  resultsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultsTitleText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    flex: 1,
  },
  clearSearchText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
    marginLeft: 8,
  },
  resultsList: {
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#131317', // var(--color-surface)
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#27272F',
    maxHeight: '82%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272F',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1A1A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  chipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  chipText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  chipTextActive: {
    color: '#0A0A0C',
    fontWeight: '700',
  },
  dateRow: {
    gap: 8,
  },
  dateChip: {
    minWidth: 88,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  dateChipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  dateDayText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    fontWeight: '700',
  },
  dateDayTextActive: {
    color: '#0A0A0C',
  },
  dateNumText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },
  dateNumTextActive: {
    color: '#0A0A0C',
  },
  hourChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  hourChipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  hourChipText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  hourChipTextActive: {
    color: '#0A0A0C',
    fontWeight: '700',
  },
  ctaWrap: {
    marginTop: 8,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#D4AF5A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 15.5,
    fontWeight: '700',
  },
});

const resultCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#131317', // var(--color-surface)
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#1A1A1F',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  shopName: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 14.5,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontWeight: '700',
  },
  subText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  servicePill: {
    backgroundColor: 'rgba(212, 175, 90, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  servicePillText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11.5,
    fontWeight: '600',
  },
});

const adStyles = StyleSheet.create({
  wrapper: {
    height: 190,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#131317',
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH - 32,
    height: 190,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  adBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  adBadgeText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    fontWeight: '700',
  },
  infoBox: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  serviceTitle: {
    color: '#FFFFFF',
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    fontWeight: '700',
  },
  serviceCategory: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12.5,
    marginTop: 2,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 14,
  },
});

const shelfStyles = StyleSheet.create({
  shelfWrap: {
    marginBottom: 22,
  },
  shelfTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  scrollList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 176, // w-44 in web
    backgroundColor: '#131317',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272F',
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    height: 112, // h-28 in web
    position: 'relative',
    backgroundColor: '#1A1A1F',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  badgePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#D4AF5A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    fontWeight: '700',
  },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    padding: 10,
  },
  cardName: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 13.5,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  catText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    flex: 1,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingNumber: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
});
