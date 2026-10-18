import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
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
  const { adminData, switchAdminShop, checkAdminStatus, mobileToken } = useAppContext();

  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSwitchingShop, setIsSwitchingShop] = useState(false);
  const [showShopPicker, setShowShopPicker] = useState(false);

  // Re-verify admin privileges if not loaded yet
  useEffect(() => {
    if (!adminData && mobileToken) {
      checkAdminStatus();
    }
  }, [adminData, mobileToken, checkAdminStatus]);

  const activeShop = adminData?.currentShop || adminData?.shops?.[0] || null;
  const isSuperAdmin = adminData?.role === 'superadmin';
  const hasMultipleShops = (adminData?.shops || []).length > 1;

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.back();
  };

  const handleReload = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setLoadError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  const handleSelectShop = async (shopId) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setShowShopPicker(false);
    setIsSwitchingShop(true);
    const newToken = await switchAdminShop(shopId);
    setIsSwitchingShop(false);
    if (newToken && webViewRef.current) {
      // Reload webview with the new shop token
      webViewRef.current.reload();
    }
  };

  // If user is not an admin, render unauthorized fallback
  if (!adminData?.isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('AdminPanel', 'Admin Portal')}</Text>
          <View style={{ width: 40 }} />
        </View>

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
          <Pressable onPress={handleClose} style={styles.returnBtn}>
            <Text style={styles.returnBtnText}>{t('ReturnToApp', 'Return to App')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const baseUrl = adminData.adminPanelUrl || 'https://admin-healthcare-namangan.netlify.app';
  const targetUrl = `${baseUrl}?adminToken=${encodeURIComponent(
    adminData.adminToken || ''
  )}&role=${adminData.role || 'owner'}`;

  // Injected JS to pre-seed localStorage in the webview context before page scripts run
  const injectedSessionScript = `
    (function() {
      try {
        var sess = {
          token: ${JSON.stringify(adminData.adminToken)},
          role: ${JSON.stringify(adminData.role)},
          shop: ${JSON.stringify(activeShop || null)}
        };
        localStorage.setItem('tezkor_admin_session', JSON.stringify(sess));
        window.postMessage(JSON.stringify({ type: 'SET_ADMIN_SESSION', token: ${JSON.stringify(
          adminData.adminToken
        )}, role: ${JSON.stringify(adminData.role)} }), '*');
      } catch(e) {}
    })();
    true;
  `;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Native App Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={handleClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.iconBtn}
        >
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>

        <Pressable
          onPress={() => hasMultipleShops && setShowShopPicker(true)}
          disabled={!hasMultipleShops}
          style={styles.titleContainer}
        >
          <View style={styles.titleRow}>
            <Ionicons
              name={isSuperAdmin ? 'shield-checkmark' : 'storefront-outline'}
              size={16}
              color={COLORS.accent}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSuperAdmin
                ? t('SuperAdminDashboard', 'Super Admin')
                : resolveText(activeShop?.name, lang) || t('ShopDashboard', 'Shop Dashboard')}
            </Text>
            {hasMultipleShops && (
              <Ionicons
                name="chevron-down"
                size={14}
                color={COLORS.accent}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
          <Text style={styles.headerSubTitle}>
            {isSuperAdmin ? t('PlatformControl', 'Platform Control') : t('OwnerMode', 'Owner Mode')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleReload}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.iconBtn}
        >
          <Ionicons name="reload" size={18} color={COLORS.text} />
        </Pressable>
      </View>

      {/* Main WebView Content */}
      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: targetUrl }}
          injectedJavaScriptBeforeContentLoaded={injectedSessionScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onLoadStart={() => {
            setIsLoading(true);
            setLoadError(null);
          }}
          onLoadEnd={() => {
            setIsLoading(false);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setIsLoading(false);
            setLoadError(nativeEvent.description || 'Failed to load Admin Panel');
          }}
          style={styles.webView}
        />

        {/* Loading Overlay */}
        {(isLoading || isSwitchingShop) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>
              {isSwitchingShop
                ? t('SwitchingShop', 'Switching shop...')
                : t('LoadingAdminPanel', 'Loading Dashboard...')}
            </Text>
          </View>
        )}

        {/* Error Fallback */}
        {loadError && !isLoading && (
          <View style={styles.errorOverlay}>
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.danger} />
            <Text style={styles.errorTitle}>{t('ConnectionFailed', 'Connection Failed')}</Text>
            <Text style={styles.errorSub}>{loadError}</Text>
            <Pressable onPress={handleReload} style={styles.retryBtn}>
              <Ionicons name="refresh" size={18} color="#0A0A0C" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>{t('Retry', 'Retry')}</Text>
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
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('SelectShop', 'Select Shop')}</Text>
              <Pressable onPress={() => setShowShopPicker(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {(adminData.shops || []).map((shop) => {
                const isSelected = String(shop.id) === String(activeShop?.id);
                return (
                  <Pressable
                    key={shop.id}
                    onPress={() => handleSelectShop(shop.id)}
                    style={[styles.shopItem, isSelected && styles.shopItemSelected]}
                  >
                    <Ionicons
                      name="storefront"
                      size={20}
                      color={isSelected ? COLORS.accent : COLORS.textMuted}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={[styles.shopItemName, isSelected && styles.shopItemNameSelected]}>
                      {resolveText(shop.name, lang)}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={COLORS.accent}
                        style={{ marginLeft: 'auto' }}
                      />
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
    backgroundColor: COLORS.bg,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.text,
  },
  headerSubTitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.accent,
    marginTop: 1,
  },
  webContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
    marginTop: 14,
  },
  errorSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0A0A0C',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  shieldIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 90, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  unauthTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.text,
    marginBottom: 8,
  },
  unauthSub: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  returnBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  returnBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0A0A0C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  shopItemSelected: {
    backgroundColor: 'rgba(212, 175, 90, 0.12)',
  },
  shopItemName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.text,
  },
  shopItemNameSelected: {
    color: COLORS.accent,
    fontFamily: FONTS.semiBold,
  },
});
