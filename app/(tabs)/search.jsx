import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ShopCard } from '../../src/components/ShopCard';
import { MOTION_ASSETS } from '../../src/components/BrandAssets';
import { SearchSkeleton } from '../../src/components/Skeletons';

export default function SearchScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { backEndUrl } = useAppContext();
  const { isTablet, numColumns, horizontalPadding } = useResponsive();

  const [searchTerm, setSearchTerm] = useState('');
  const [discovery, setDiscovery] = useState({ advertisedShops: [], categories: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Instant "Available Right Now" search state
  const [serviceQuery, setServiceQuery] = useState('');
  const [selectedHourOffset, setSelectedHourOffset] = useState(1);
  const [availableNowResults, setAvailableNowResults] = useState(null);
  const [isSearchingNow, setIsSearchingNow] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${backEndUrl}/api/mobile/shops/discovery-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchTerm: searchTerm.trim() }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setDiscovery(data);
      } catch (err) {
        console.warn('Discovery search error:', err.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, backEndUrl]);

  const runAvailableNowSearch = async () => {
    if (!serviceQuery.trim()) return;
    try {
      setIsSearchingNow(true);
      const targetDate = new Date();
      targetDate.setHours(targetDate.getHours() + selectedHourOffset, 0, 0, 0);

      const res = await fetch(`${backEndUrl}/api/mobile/shops/available-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceQuery: serviceQuery.trim(),
          requestedTime: targetDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAvailableNowResults({
          requestedTime: data.requestedTime,
          hour: `${String(targetDate.getHours()).padStart(2, '0')}:00`,
          results: data.results || [],
        });
      }
    } catch (err) {
      console.warn('Available now error:', err.message);
    } finally {
      setIsSearchingNow(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{t('Search')}</Text>

        {/* Search Input styled after components/search-bar.svg */}
        <View style={styles.searchInputBox}>
          <Image
            source={MOTION_ASSETS.icons.search}
            style={{ width: 18, height: 18, tintColor: COLORS.accent }}
            resizeMode="contain"
          />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder={t('SearchPlaceholder')}
            placeholderTextColor={COLORS.textFaint}
            style={styles.searchInput}
          />
          {!!searchTerm && (
            <Pressable onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Cross-Shop "Available Right Now" Finder */}
        <View style={styles.availableNowBox}>
          <View style={styles.availableHeader}>
            <Image
              source={MOTION_ASSETS.icons.clock}
              style={{ width: 18, height: 18, tintColor: COLORS.accent }}
              resizeMode="contain"
            />
            <Text style={styles.availableTitle}>{t('FindAvailableNow')}</Text>
          </View>
          <View style={styles.availableInputRow}>
            <TextInput
              value={serviceQuery}
              onChangeText={setServiceQuery}
              placeholder={t('WhatServiceNeed')}
              placeholderTextColor={COLORS.textFaint}
              style={styles.availableInput}
              onSubmitEditing={runAvailableNowSearch}
            />
            <Pressable onPress={runAvailableNowSearch} style={styles.availableGoBtn}>
              {isSearchingNow ? (
                <ActivityIndicator size="small" color={COLORS.bg} />
              ) : (
                <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
              )}
            </Pressable>
          </View>

          <View style={styles.hourPillsRow}>
            {[1, 2, 3, 4].map((offset) => {
              const d = new Date();
              d.setHours(d.getHours() + offset, 0, 0, 0);
              const label = `${String(d.getHours()).padStart(2, '0')}:00`;
              const active = selectedHourOffset === offset;
              return (
                <Pressable
                  key={offset}
                  onPress={() => setSelectedHourOffset(offset)}
                  style={[styles.hourPill, active && styles.hourPillActive]}
                >
                  <Text style={[styles.hourPillText, active && styles.hourPillTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {availableNowResults && (
            <View style={styles.nowResultsList}>
              {availableNowResults.results.length === 0 ? (
                <Text style={styles.emptyText}>{t('NoSlotsAvailable')}</Text>
              ) : (
                availableNowResults.results.map((item) => {
                  const firstService = item.matchedServices?.[0];
                  const shopName =
                    item.name?.[lang] || item.name?.uz || item.name?.ru || item.name?.en;
                  return (
                    <Pressable
                      key={item.shopId}
                      onPress={() =>
                        router.push({
                          pathname: `/booking/${item.shopId}`,
                          params: {
                            presetHour: availableNowResults.hour,
                            presetServiceId: firstService?.serviceId,
                          },
                        })
                      }
                      style={styles.nowResultRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nowShopName}>{shopName}</Text>
                        {firstService && (
                          <Text style={styles.nowServiceMeta}>
                            {firstService.name?.[lang] || firstService.name?.en} ·{' '}
                            {firstService.price?.toLocaleString()} {t('UZS')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.nowSlotBadge}>
                        <Text style={styles.nowSlotText}>{availableNowResults.hour}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Discovery Shelves with SearchSkeleton while loading */}
        {isLoading ? (
          <SearchSkeleton numColumns={numColumns} />
        ) : (
          discovery.categories?.map((shelf) => {
            if (!shelf.shops?.length) return null;
            const shelfTitle =
              shelf.label?.[lang] || shelf.label?.uz || shelf.label?.en || shelf.key;
            return (
              <View key={shelf.key} style={styles.shelfSection}>
                <Text style={styles.shelfTitle}>
                  {shelf.icon ? `${shelf.icon} ` : ''}
                  {shelfTitle}
                </Text>
                <View style={[styles.gridContainer, isTablet && styles.gridContainerTablet]}>
                  {shelf.shops.map((shop, idx) => (
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
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  pageTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 14,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.bodyRegular,
    fontSize: 14.5,
  },
  availableNowBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  availableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  availableTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
  },
  availableInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  availableInput: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  availableGoBtn: {
    backgroundColor: COLORS.accent,
    width: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hourPill: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  hourPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  hourPillText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodySemiBold,
    fontWeight: '600',
    fontSize: 13,
  },
  hourPillTextActive: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
  },
  nowResultsList: {
    marginTop: 14,
    gap: 8,
  },
  nowResultRow: {
    backgroundColor: COLORS.surface2,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nowShopName: {
    color: COLORS.text,
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
  nowServiceMeta: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  nowSlotBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  nowSlotText: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  shelfSection: {
    marginBottom: 24,
  },
  shelfTitle: {
    color: COLORS.text,
    fontFamily: FONTS.displaySemiBold,
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 12,
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
