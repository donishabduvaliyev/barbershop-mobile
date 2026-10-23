import React, { useState, useRef, useMemo, useEffect, useCallback, Component } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';

// Error Boundary to ensure map screen NEVER crashes the entire app
class MapErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('Map Screen Caught Error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallbackContainer}>
          <Ionicons name="map-outline" size={48} color={COLORS.accent} />
          <Text style={styles.errorFallbackTitle}>Map unavailable</Text>
          <Text style={styles.errorFallbackSub}>Please switch to List View below.</Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={styles.errorRetryBtn}
          >
            <Text style={styles.errorRetryText}>Reload</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// Default center: Uzbekistan (Tashkent / Namangan)
const DEFAULT_CENTER = {
  lat: 41.0011,
  lng: 71.6683,
  zoom: 13,
};

const FALLBACK_SHOP_IMAGE =
  'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80';

const CATEGORY_EMOJIS = {
  barbershop: '💈',
  'hair salon': '💇‍♀️',
  'beauty salon': '💅',
  spa: '🧖',
  dentist: '🦷',
  default: '✂️',
};

function getCategoryEmoji(cat) {
  const key = String(cat || '').toLowerCase();
  return CATEGORY_EMOJIS[key] || CATEGORY_EMOJIS.default;
}

function MapScreenContent() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const { shops, showToast } = useAppContext();
  const { isTablet } = useResponsive();
  const webViewRef = useRef(null);

  const [viewMode, setViewMode] = useState('map'); // 'map' | 'list'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedShop, setSelectedShop] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  // Filter valid shops with coordinates
  const shopsWithCoords = useMemo(() => {
    return (shops || []).filter((shop) => {
      const coords = shop.location?.coordinates;
      const hasValidCoords =
        Array.isArray(coords) &&
        coords.length === 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number' &&
        Number.isFinite(coords[0]) &&
        Number.isFinite(coords[1]) &&
        !(coords[0] === 0 && coords[1] === 0);
      if (!hasValidCoords) return false;
      if (selectedCategory === 'All') return true;
      return String(shop.category || '').toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [shops, selectedCategory]);

  // Request location permission safely
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (pos?.coords) {
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        }
      } catch (err) {
        // Non-blocking location check
      }
    })();
  }, []);

  // Update markers whenever shops or selectedShop changes
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;
    const markersData = shopsWithCoords.map((s) => {
      const [lng, lat] = s.location.coordinates;
      return {
        id: String(s._id),
        lat,
        lng,
        name: s.name?.[lang] || s.name?.uz || s.name?.ru || s.name?.en || 'Shop',
        emoji: getCategoryEmoji(s.category),
        isSelected: selectedShop?._id === s._id,
      };
    });
    const js = `window.__renderMarkers(${JSON.stringify(markersData)});`;
    webViewRef.current.injectJavaScript(js);
  }, [shopsWithCoords, selectedShop, isMapReady, lang]);

  // Push user location if found
  useEffect(() => {
    if (!isMapReady || !webViewRef.current || !userCoords) return;
    const js = `window.__setUserLocation(${userCoords.lat}, ${userCoords.lng});`;
    webViewRef.current.injectJavaScript(js);
  }, [userCoords, isMapReady]);

  const locateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission denied', 'error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (pos?.coords) {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `window.__focusLocation(${pos.coords.latitude}, ${pos.coords.longitude}, 15);`
          );
        }
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }
    } catch {
      showToast('Unable to get current location', 'error');
    }
  };

  const focusShop = useCallback((shop) => {
    if (!shop?.location?.coordinates) return;
    setSelectedShop(shop);
    const [lng, lat] = shop.location.coordinates;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.__focusLocation(${lat}, ${lng}, 16, '${shop._id}');`);
    }
  }, []);

  const openDirections = (shop) => {
    if (!shop?.location?.coordinates) return;
    const [lng, lat] = shop.location.coordinates;
    const label = encodeURIComponent(
      shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Shop'
    );
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const handleMessage = useCallback((event) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'MAP_READY') {
        setIsMapReady(true);
      } else if (payload.type === 'SELECT_SHOP') {
        const found = shops.find((s) => String(s._id) === String(payload.shopId));
        if (found) {
          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
          setSelectedShop(found);
        }
      }
    } catch (e) {
      // Ignore invalid payload
    }
  }, [shops]);

  // Self-contained Dark-Mode Leaflet Map HTML
  const mapHtml = useMemo(() => {
    const cartoKey = process.env.EXPO_PUBLIC_CARTO_API_KEY || 'cb1_4svh_1_148b6eef82b39fbd2cd85f4b';
    const tileUrl = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`;
    const tileFilter = '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; background: #0A0A0C; overflow: hidden; }
    ${tileFilter}
    .shop-pin {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #141419;
      border: 2px solid #D4AF5A;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .shop-pin:active { transform: scale(0.92); }
    .shop-pin.active {
      border: 3px solid #F0C96D;
      background: #D4AF5A;
      transform: scale(1.22);
      box-shadow: 0 0 18px rgba(212, 175, 90, 0.85);
    }
    .user-radar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #2AABEE;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 10px #2AABEE;
    }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}],
      zoom: ${DEFAULT_CENTER.zoom},
      zoomControl: false,
      attributionControl: false
    });

    // Dark tiles without API key requirements (or CARTO when key is provided)
    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      subdomains: '${cartoKey ? "abcd" : "abc"}'
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);
    var userMarker = null;

    window.__renderMarkers = function(markers) {
      markersLayer.clearLayers();
      markers.forEach(function(m) {
        var iconHtml = '<div class="shop-pin ' + (m.isSelected ? 'active' : '') + '">' + m.emoji + '</div>';
        var customIcon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        var marker = L.marker([m.lat, m.lng], { icon: customIcon });
        marker.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_SHOP', shopId: m.id }));
          }
        });
        markersLayer.addLayer(marker);
      });
    };

    window.__focusLocation = function(lat, lng, zoom, shopId) {
      map.flyTo([lat, lng], zoom || 15, { animate: true, duration: 0.8 });
    };

    window.__setUserLocation = function(lat, lng) {
      if (!userMarker) {
        var userIcon = L.divIcon({
          html: '<div class="user-radar"></div>',
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
      } else {
        userMarker.setLatLng([lat, lng]);
      }
    };

    // Notify React Native that Leaflet map is fully initialized
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    }, 200);
  </script>
</body>
</html>`;
  }, []);

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
                shop.name?.[lang] ||
                shop.name?.uz ||
                shop.name?.ru ||
                shop.name?.en ||
                'Barbershop';
              const address =
                shop.address?.[lang] || shop.address?.uz || shop.address?.en || '';
              return (
                <Pressable
                  key={shop._id}
                  onPress={() => focusShop(shop)}
                  style={[styles.sidebarItem, isSelected && styles.sidebarItemActive]}
                >
                  <Image
                    source={{ uri: shop.image || FALLBACK_SHOP_IMAGE }}
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

      {/* Main View: Interactive WebView Map or Native Scrollable List */}
      <View style={styles.mapArea}>
        {viewMode === 'map' ? (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={StyleSheet.absoluteFillObject}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            originWhitelist={['*']}
            containerStyle={{ backgroundColor: COLORS.bg }}
          />
        ) : (
          <ScrollView
            style={styles.listViewContainer}
            contentContainerStyle={styles.listViewContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.listHeading}>
              {t('NearbyShops', 'Nearby Shops')} ({shopsWithCoords.length})
            </Text>
            {shopsWithCoords.map((shop) => {
              const name =
                shop.name?.[lang] ||
                shop.name?.uz ||
                shop.name?.ru ||
                shop.name?.en ||
                'Barbershop';
              const address =
                shop.address?.[lang] || shop.address?.uz || shop.address?.en || '';
              return (
                <View key={shop._id} style={styles.listCard}>
                  <Image
                    source={{ uri: shop.image || FALLBACK_SHOP_IMAGE }}
                    style={styles.listCardImg}
                  />
                  <View style={styles.listCardBody}>
                    <View style={styles.listCardHeader}>
                      <Text style={styles.listCardTitle} numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={styles.listRatingBadge}>
                        <Ionicons name="star" size={13} color="#FBBF24" />
                        <Text style={styles.listRatingText}>
                          {Number(shop.rating || 5.0).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.listCardSub} numberOfLines={1}>
                      {address}
                    </Text>
                    <View style={styles.listCardActions}>
                      <Pressable
                        onPress={() => openDirections(shop)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.directionsBtn}
                      >
                        <Ionicons name="navigate-outline" size={14} color={COLORS.accent} />
                        <Text style={styles.directionsBtnText}>{t('Directions', 'Directions')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                          router.push(`/shop/${shop._id}`);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.detailsBtn}
                      >
                        <Text style={styles.detailsBtnText}>{t('Services')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                          router.push(`/booking/${shop._id}`);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.bookNowBtn}
                      >
                        <Text style={styles.bookNowBtnText}>{t('BookNow')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Floating Top Header: Category Filters & Mode Toggle */}
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
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
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      setSelectedCategory(cat);
                    }}
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

            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                setViewMode((m) => (m === 'map' ? 'list' : 'map'));
              }}
              style={styles.modeToggleBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={viewMode === 'map' ? 'list-outline' : 'map-outline'}
                size={18}
                color="#0A0A0C"
              />
              <Text style={styles.modeToggleText}>
                {viewMode === 'map' ? t('List', 'List') : t('Map', 'Map')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Locate Me Floating Action Button (only in map mode) */}
        {viewMode === 'map' && (
          <Pressable onPress={locateMe} style={styles.locateBtn}>
            <Ionicons name="navigate" size={20} color="#0A0A0C" />
          </Pressable>
        )}

        {/* Animated Bottom Preview Card */}
        {viewMode === 'map' && selectedShop && (
          <Animated.View entering={FadeInDown.springify()} style={styles.previewCard}>
            <Image
              source={{ uri: selectedShop.image || FALLBACK_SHOP_IMAGE }}
              style={styles.previewImage}
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedShop.name?.[lang] ||
                  selectedShop.name?.uz ||
                  selectedShop.name?.ru ||
                  selectedShop.name?.en ||
                  'Barbershop'}
              </Text>
              <Text style={styles.previewAddress} numberOfLines={1}>
                {selectedShop.address?.[lang] || selectedShop.address?.uz || ''}
              </Text>
              <View style={styles.previewActions}>
                <Pressable
                  onPress={() => openDirections(selectedShop)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.directionsIconBtn}
                >
                  <Ionicons name="navigate-outline" size={16} color={COLORS.accent} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    router.push(`/shop/${selectedShop._id}`);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.detailsBtn}
                >
                  <Text style={styles.detailsBtnText}>{t('Services')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    router.push(`/booking/${selectedShop._id}`);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.bookNowBtn}
                >
                  <Text style={styles.bookNowBtnText}>{t('BookNow')}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => setSelectedShop(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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

export default function MapScreen() {
  return (
    <MapErrorBoundary>
      <MapScreenContent />
    </MapErrorBoundary>
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
    backgroundColor: '#0A0A0C',
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 42,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 14,
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  modeToggleText: {
    color: '#0A0A0C',
    fontSize: 12,
    fontWeight: '700',
  },
  listViewContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'ios' ? 110 : 96,
  },
  listViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  listHeading: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listCardImg: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.surface2,
  },
  listCardBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listCardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  listRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  listRatingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  listCardSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  listCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 90, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  directionsBtnText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  directionsIconBtn: {
    backgroundColor: 'rgba(212, 175, 90, 0.14)',
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#0A0A0C',
    fontWeight: '700',
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 86,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 84,
    maxWidth: 480,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
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
    color: '#0A0A0C',
    fontSize: 12,
    fontWeight: '700',
  },
  closePreviewBtn: {
    padding: 4,
  },
  errorFallbackContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorFallbackTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  errorFallbackSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  errorRetryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorRetryText: {
    color: '#0A0A0C',
    fontWeight: '700',
    fontSize: 14,
  },
});
