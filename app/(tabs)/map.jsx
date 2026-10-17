import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';

// Default center: Namangan / Tashkent Uzbekistan
const DEFAULT_REGION = {
  latitude: 41.0011,
  longitude: 71.6683,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { shops, showToast } = useAppContext();
  const { isTablet } = useResponsive();
  const mapRef = useRef(null);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedShop, setSelectedShop] = useState(null);

  const shopsWithCoords = useMemo(() => {
    return shops.filter((shop) => {
      const coords = shop.location?.coordinates;
      const hasValidCoords =
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number';
      if (!hasValidCoords) return false;
      if (selectedCategory === 'All') return true;
      return String(shop.category || '').toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [shops, selectedCategory]);

  const locateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission denied', 'error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        },
        600
      );
    } catch {
      showToast('Unable to get current location', 'error');
    }
  };

  const focusShop = (shop) => {
    setSelectedShop(shop);
    const [lng, lat] = shop.location.coordinates;
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );
  };

  return (
    <View style={[styles.container, isTablet && styles.tabletSplitContainer]}>
      {/* On Tablet: Left Sidebar List of Shops */}
      {isTablet && (
        <View style={styles.tabletSidebar}>
          <Text style={styles.sidebarHeading}>{t('Map')}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {shopsWithCoords.map((shop) => {
              const isSelected = selectedShop?._id === shop._id;
              const name =
                shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en;
              const address =
                shop.address?.[lang] || shop.address?.uz || shop.address?.en || '';
              return (
                <Pressable
                  key={shop._id}
                  onPress={() => focusShop(shop)}
                  style={[styles.sidebarItem, isSelected && styles.sidebarItemActive]}
                >
                  <Image
                    source={{ uri: shop.image }}
                    style={styles.sidebarThumb}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarTitle} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.sidebarSub} numberOfLines={1}>
                      {address}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Interactive Map */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          userInterfaceStyle="dark"
        >
          {shopsWithCoords.map((shop) => {
            const [lng, lat] = shop.location.coordinates;
            const name =
              shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en;
            return (
              <Marker
                key={shop._id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={name}
                pinColor={
                  selectedShop?._id === shop._id ? COLORS.accent : COLORS.telegram
                }
                onPress={() => setSelectedShop(shop)}
              />
            );
          })}
        </MapView>

        {/* Floating Category Filters */}
        <View style={styles.topOverlay}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPills}
          >
            {['All', 'Barbershop', 'Beauty Salon', 'Spa', 'Dentist'].map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      active && styles.filterPillTextActive,
                    ]}
                  >
                    {t(cat.replace(' ', ''), cat)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Locate Me Floating Action Button */}
        <Pressable onPress={locateMe} style={styles.locateBtn}>
          <Ionicons name="navigate" size={20} color="#000" />
        </Pressable>

        {/* Animated Bottom Preview Card */}
        {selectedShop && (
          <Animated.View entering={FadeInDown.springify()} style={styles.previewCard}>
            <Image
              source={{ uri: selectedShop.image }}
              style={styles.previewImage}
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedShop.name?.[lang] ||
                  selectedShop.name?.uz ||
                  selectedShop.name?.en}
              </Text>
              <Text style={styles.previewAddress} numberOfLines={1}>
                {selectedShop.address?.[lang] || selectedShop.address?.uz || ''}
              </Text>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => router.push(`/shop/${selectedShop._id}`)}
                  style={styles.detailsBtn}
                >
                  <Text style={styles.detailsBtnText}>{t('Services')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/booking/${selectedShop._id}`)}
                  style={styles.bookNowBtn}
                >
                  <Text style={styles.bookNowBtnText}>{t('BookNow')}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => setSelectedShop(null)}
              style={styles.closePreviewBtn}
            >
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  tabletSplitContainer: {
    flexDirection: 'row',
  },
  tabletSidebar: {
    width: 320,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderSoft,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 14,
  },
  sidebarHeading: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.surface2,
  },
  sidebarItemActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  sidebarThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.surface3,
  },
  sidebarTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  sidebarSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 42,
    left: 0,
    right: 0,
  },
  filterPills: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    backgroundColor: 'rgba(20, 27, 38, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterPillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    maxWidth: 480,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 10,
  },
  previewImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  previewAddress: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  detailsBtn: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  detailsBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  bookNowBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
  },
  bookNowBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  closePreviewBtn: {
    padding: 4,
  },
});
