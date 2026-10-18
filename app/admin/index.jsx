import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';

const resolveText = (val, lang = 'uz') => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val[lang] || val.uz || val.ru || val.en || '';
  }
  return String(val);
};

export default function AdminScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n?.language || 'uz';
  const {
    adminData,
    switchAdminShop,
    checkAdminStatus,
    mobileToken,
    setIsCustomerPreview,
  } = useAppContext();

  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [isSwitchingShop, setIsSwitchingShop] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);

  // Re-verify admin privileges if token exists but adminData is pending
  useEffect(() => {
    if (!adminData && mobileToken) {
      checkAdminStatus();
    }
  }, [adminData, mobileToken, checkAdminStatus]);

  const activeShop = adminData?.currentShop || adminData?.shops?.[0] || null;
  const isSuperAdmin = adminData?.role === 'superadmin';
  const hasMultipleShops = (adminData?.shops || []).length > 1;

  // The base admin panel URL (Netlify deployment of barbershop-admin-panel)
  const baseAdminUrl = useMemo(() => {
    return (
      adminData?.adminPanelUrl ||
      process.env.EXPO_PUBLIC_ADMIN_PANEL_URL ||
      'https://admin-healthcare-namangan.netlify.app'
    );
  }, [adminData?.adminPanelUrl]);

  // Target URL passing adminToken and role for instant authentication
  const targetUrl = useMemo(() => {
    const token = adminData?.adminToken || '';
    const role = adminData?.role || 'owner';
    const separator = baseAdminUrl.includes('?') ? '&' : '?';
    return `${baseAdminUrl}${separator}adminToken=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`;
  }, [baseAdminUrl, adminData?.adminToken, adminData?.role]);

  // Inject session directly into localStorage before any web scripts execute
  const injectedSessionScript = useMemo(() => {
    const session = {
      token: adminData?.adminToken || '',
      role: adminData?.role || 'owner',
      shop: activeShop || null,
    };

    return `
      (function() {
        try {
          var payload = ${JSON.stringify(session)};
          if (payload.token) {
            window.localStorage.setItem('tezkor_admin_session', JSON.stringify(payload));
          }
          // Notify any listeners on the page
          window.postMessage({ type: 'SET_ADMIN_SESSION', token: payload.token, role: payload.role, shop: payload.shop }, '*');
        } catch (e) {}
      })();
      true;
    `;
  }, [adminData?.adminToken, adminData?.role, activeShop]);

  const handleReload = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setLoadError(null);
    setLoadProgress(0.1);
    webViewRef.current?.reload();
  };

  const handleExitToCustomerView = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setIsCustomerPreview(true);
    router.replace('/(tabs)');
  };

  const handleSelectShop = async (shopId) => {
    setShowShopPicker(false);
    setIsSwitchingShop(true);
    try {
      const newToken = await switchAdminShop(shopId);
      if (newToken) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        // Reload WebView with updated session
        webViewRef.current?.reload();
      }
    } finally {
      setIsSwitchingShop(false);
    }
  };

  // If user is not an admin, show restricted access notice
  if (!adminData?.isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <View style={styles.shieldIconWrap}>
            <Ionicons name="shield-outline" size={48} color={COLORS.accent} />
          </View>
          <Text style={styles.unauthTitle}>{t('AccessRestricted', 'Access Restricted')}</Text>
          <Text style={styles.unauthSub}>
            {t(
              'AdminOnlyDesc',
              'This section is reserved for verified barbershop owners and administrators.'
            )}
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)/profile')} style={styles.returnBtn}>
            <Text style={styles.returnBtnText}>{t('ReturnToApp', 'Return to Profile')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const shopName = resolveText(activeShop?.name, lang) || 'Barbershop';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Controls Bar */}
      <View style={styles.headerBar}>
        {/* Switch to customer view button */}
        <Pressable
          onPress={handleExitToCustomerView}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          <Text style={styles.headerBtnText}>Mijoz rejimi</Text>
        </Pressable>

        {/* Center Shop Selector / Title */}
        <Pressable
          onPress={() => hasMultipleShops && setShowShopPicker(true)}
          disabled={!hasMultipleShops}
          style={styles.shopSelectorPill}
        >
          <Ionicons
            name={isSuperAdmin ? 'shield-checkmark' : 'storefront-outline'}
            size={15}
            color={COLORS.accent}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.shopSelectorTitle} numberOfLines={1}>
            {isSuperAdmin ? 'Super Admin' : shopName}
          </Text>
          {hasMultipleShops && (
            <Ionicons name="chevron-down" size={14} color={COLORS.accent} style={{ marginLeft: 4 }} />
          )}
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Quick New Appointment Button */}
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              }
              webViewRef.current?.postMessage(JSON.stringify({ type: 'OPEN_NEW_BOOKING' }));
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.quickAddBookingHeaderBtn}
          >
            <Ionicons name="add" size={16} color="#0A0A0C" />
            <Text style={styles.quickAddBookingHeaderBtnText}>Bandlov</Text>
          </Pressable>

          {/* Reload button */}
          <Pressable
            onPress={handleReload}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.iconBtn}
          >
            <Ionicons name="reload" size={18} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      {/* Sleek Progress Bar (Only visible while loading) */}
      {loadProgress > 0 && loadProgress < 1 && (
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(12, Math.round(loadProgress * 100))}%` },
            ]}
          />
        </View>
      )}

      {/* Main WebView Container */}
      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: targetUrl }}
          injectedJavaScriptBeforeContentLoaded={injectedSessionScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
          androidLayerType="hardware"
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsInlineMediaPlayback={true}
          allowsBackForwardNavigationGestures={true}
          pullToRefreshEnabled={true}
          onLoadProgress={({ nativeEvent }) => {
            setLoadProgress(nativeEvent.progress);
            if (nativeEvent.progress >= 0.6) {
              setIsLoading(false);
            }
          }}
          onLoad={() => {
            setIsLoading(false);
            setLoadProgress(1);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
            setLoadProgress(1);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setIsLoading(false);
            setLoadError(nativeEvent.description || 'Internet bilan aloqa uzildi');
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data?.type === 'LOGOUT') {
                handleExitToCustomerView();
              }
            } catch {}
          }}
          style={styles.webView}
        />

        {/* Loading Indicator for switching shop */}
        {isSwitchingShop && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Salon almashtirilmoqda...</Text>
          </View>
        )}

        {/* Offline / Connection Error Fallback */}
        {loadError && !isLoading && (
          <View style={styles.errorOverlay}>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
            <Text style={styles.errorTitle}>Boshqaruv panelini yuklab bo'lmadi</Text>
            <Text style={styles.errorSub}>{loadError}</Text>
            <Pressable onPress={handleReload} style={styles.retryBtn}>
              <Ionicons name="refresh" size={18} color="#0A0A0C" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Qayta urinish</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Multi-Shop Picker Modal */}
      <Modal
        visible={showShopPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShopPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowShopPicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Salonni tanlang</Text>
              <Pressable onPress={() => setShowShopPicker(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {(adminData?.shops || []).map((shop) => {
                const isSelected = String(shop._id || shop.id) === String(activeShop?._id || activeShop?.id);
                const sName = resolveText(shop.name, lang);
                return (
                  <Pressable
                    key={shop._id || shop.id}
                    onPress={() => handleSelectShop(shop._id || shop.id)}
                    style={[styles.shopItem, isSelected && styles.shopItemSelected]}
                  >
                    {shop.image ? (
                      <Image source={{ uri: shop.image }} style={styles.shopItemImg} />
                    ) : (
                      <View style={styles.shopItemPlaceholder}>
                        <Ionicons name="storefront" size={18} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.shopItemName, isSelected && styles.shopItemNameSelected]}>
                        {sName}
                      </Text>
                      {shop.address ? (
                        <Text style={styles.shopItemAddr} numberOfLines={1}>
                          {resolveText(shop.address, lang)}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.accent} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
    backgroundColor: '#0A0A0C',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#131317',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  headerBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  shopSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131317',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272E',
    maxWidth: '50%',
  },
  shopSelectorTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  quickAddBookingHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  quickAddBookingHeaderBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#0A0A0C',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#131317',
    borderWidth: 1,
    borderColor: '#27272E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 2.5,
    backgroundColor: '#1D1D23',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 10,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 15,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  shieldIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 90, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unauthTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  unauthSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  returnBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  returnBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#131317',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272E',
    width: '100%',
    maxWidth: 380,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  modalTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  shopItemSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(212, 175, 90, 0.08)',
  },
  shopItemImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#27272E',
  },
  shopItemPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#27272E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopItemName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  shopItemNameSelected: {
    color: COLORS.accent,
    fontFamily: FONTS.bold,
  },
  shopItemAddr: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
