import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { CatalogCard } from '../../src/components/CatalogCard';
import { SmartChairLogoMark } from '../../src/components/BrandAssets';

// Faithful React Native replication of Profile.jsx, UserInfo.jsx, BookingHistory.jsx from barbershop-main
export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const {
    backEndUrl,
    mobileToken,
    userInfo,
    bookings,
    shops,
    favoriteIds,
    startTelegramLogin,
    cancelTelegramLogin,
    isAuthenticating,
    authSession,
    logout,
    refreshProfile,
    showToast,
  } = useAppContext();

  // Active sub-page: null | 'userInfo' | 'bookingHistory' | 'favorites'
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  const favoriteShops = shops.filter((s) => favoriteIds.has(String(s._id)));

  const handleCancelBooking = (bookingId) => {
    Alert.alert(
      t('CancelBooking', 'Cancel Booking'),
      'Are you sure you want to cancel this booking?',
      [
        { text: t('Cancel', 'No'), style: 'cancel' },
        {
          text: t('OK', 'Yes, Cancel'),
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingBookingId(bookingId);
              const res = await fetch(`${backEndUrl}/api/user/bookings/${bookingId}/cancel`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...(mobileToken ? { Authorization: `Bearer ${mobileToken}` } : {}),
                },
              });
              if (!res.ok) throw new Error('Failed to cancel booking');
              showToast('Booking cancelled');
              await refreshProfile();
            } catch (err) {
              showToast(err.message || 'Error cancelling booking', 'error');
            } finally {
              setCancellingBookingId(null);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  // SUB-PAGE 1: UserInfoPage (matching UserInfo.jsx in barbershop-main)
  // -------------------------------------------------------------------------
  if (activeSubPage === 'userInfo') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubPage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#D4AF5A" />
            <Text style={styles.backText}>{t('Profile', 'Profile')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.subPageTitle}>{t('MyDetails', 'My Details')}</Text>

          <View style={styles.cardGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('Name', 'Name')}</Text>
              <Text style={styles.detailValue}>{userInfo?.name || 'Guest'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('Phone Number', 'Phone Number')}</Text>
              <Text style={styles.detailValue}>{userInfo?.phone || t('NoPhone', 'No phone')}</Text>
            </View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>{t('TelegramID', 'Telegram ID')}</Text>
              <Text style={styles.detailValue}>{userInfo?.telegramId || '—'}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // SUB-PAGE 2: BookingHistoryPage (matching BookingHistory.jsx in barbershop-main)
  // -------------------------------------------------------------------------
  if (activeSubPage === 'bookingHistory') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubPage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#D4AF5A" />
            <Text style={styles.backText}>{t('Profile', 'Profile')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.subPageTitle}>{t('BookingHistory', 'Booking History')}</Text>

          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t('NoBookings', 'No bookings found.')}</Text>
            </View>
          ) : (
            <View style={styles.cardGroup}>
              {bookings.map((booking, idx) => {
                const canCancel = ['pending', 'confirmed'].includes(booking.status);
                const isCancelling = cancellingBookingId === booking._id;

                return (
                  <View
                    key={booking._id}
                    style={[
                      styles.bookingItem,
                      idx < bookings.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingShopName}>{booking.shopName}</Text>
                      <Text style={styles.bookingDate}>
                        {new Date(booking.requestedTime).toLocaleString()}
                      </Text>
                      {booking.serviceName && (
                        <Text style={styles.bookingMeta}>
                          ✂️ {booking.serviceName}
                        </Text>
                      )}
                      {booking.staffName && (
                        <Text style={styles.bookingMeta}>
                          💈 {booking.staffName}
                        </Text>
                      )}
                    </View>

                    <View style={styles.bookingRightCol}>
                      <View style={[styles.statusBadge, styles[`status_${booking.status}`]]}>
                        <Text style={styles.statusBadgeText}>{booking.status}</Text>
                      </View>

                      {canCancel && (
                        <Pressable
                          onPress={() => handleCancelBooking(booking._id)}
                          disabled={isCancelling}
                          style={styles.cancelLinkBtn}
                        >
                          <Text style={styles.cancelLinkText}>
                            {isCancelling ? '...' : t('CancelBooking', 'Cancel')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // SUB-PAGE 3: FavoritesPage (matching Favorites.jsx in barbershop-main)
  // -------------------------------------------------------------------------
  if (activeSubPage === 'favorites') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={() => setActiveSubPage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color="#D4AF5A" />
            <Text style={styles.backText}>{t('Profile', 'Profile')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.subPageTitle}>{t('Favorites', 'Saved Places')}</Text>

          {favoriteShops.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t('NoFavoritesYet', 'No saved places yet.')}
              </Text>
            </View>
          ) : (
            <View style={styles.favoritesGrid}>
              {favoriteShops.map((shop) => (
                <CatalogCard key={shop._id} shop={shop} style={{ width: '48%', marginBottom: 12, marginRight: 0 }} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // UNAUTHENTICATED VIEW: 1-Tap Telegram Login
  // -------------------------------------------------------------------------
  if (!mobileToken || !userInfo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.authContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.authCard}>
            <View style={styles.markBadge}>
              <SmartChairLogoMark size={48} pulse />
            </View>
            <Text style={styles.authTitle}>
              Smart<Text style={{ color: COLORS.accent }}>Chair</Text>
            </Text>
            <Text style={styles.authSub}>{t('SignInSubtitle', 'Sign in with Telegram')}</Text>

            {isAuthenticating ? (
              <View style={styles.waitingWrap}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.waitingText}>
                  {t('WaitingForTelegram', 'Waiting for confirmation in Telegram...')}
                </Text>
                {authSession?.webDeepLink && (
                  <Pressable
                    onPress={() => Linking.openURL(authSession.webDeepLink)}
                    style={styles.reopenTelegramBtn}
                  >
                    <Text style={styles.reopenTelegramText}>
                      {t('OpenTelegramAgain', 'Open Telegram Bot')}
                    </Text>
                  </Pressable>
                )}
                <Pressable onPress={cancelTelegramLogin} style={styles.cancelLoginBtn}>
                  <Text style={styles.cancelLoginText}>{t('Cancel', 'Cancel')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startTelegramLogin} style={styles.telegramAuthBtn}>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                <Text style={styles.telegramAuthBtnText}>
                  {t('SignInWithTelegram', 'Continue with Telegram')}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // MAIN PROFILE VIEW (Faithfully replicating Profile.jsx in barbershop-main)
  // -------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Sticky Header matching Profile.jsx line 65 */}
      <View style={styles.profileHeader}>
        <Text style={styles.headerTitle}>{t('Profile', 'Profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* User Card matching Profile.jsx line 78 */}
        <View style={styles.userCard}>
          <Image
            source={{
              uri:
                userInfo.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  userInfo.name || 'U'
                )}&background=D4AF5A&color=0A0A0C`,
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userInfoTextCol}>
            <Text style={styles.userNameText}>{userInfo.name}</Text>
            <Text style={styles.userPhoneText}>
              {userInfo.phone || t('NoPhone', 'No phone number')}
            </Text>
          </View>
        </View>

        {/* Navigation List matching Profile.jsx line 86 */}
        <View style={styles.menuCard}>
          {/* 1. My Details */}
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setActiveSubPage('userInfo');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.menuItem, styles.rowBorder]}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-circle-outline" size={24} color="#9C9CA6" />
              <Text style={styles.menuItemLabel}>{t('MyDetails', 'My Details')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64646D" />
          </Pressable>

          {/* 2. Booking History */}
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setActiveSubPage('bookingHistory');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.menuItem, styles.rowBorder]}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="time-outline" size={24} color="#9C9CA6" />
              <Text style={styles.menuItemLabel}>{t('BookingHistory', 'Booking History')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64646D" />
          </Pressable>

          {/* 3. Favorites */}
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setActiveSubPage('favorites');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.menuItem}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="heart-outline" size={24} color="#9C9CA6" />
              <Text style={styles.menuItemLabel}>{t('Favorites', 'Saved Places')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64646D" />
          </Pressable>
        </View>

        {/* Log Out Button matching Profile.jsx line 95 */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            logout();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t('LogOut', 'Log Out')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C', // var(--color-bg)
  },
  profileHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(10, 10, 12, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  headerTitle: {
    color: '#D4AF5A', // var(--color-accent)
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    fontWeight: '700',
  },
  subHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    fontWeight: '600',
  },
  subPageTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  container: {
    padding: 16,
    paddingBottom: 110,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131317', // var(--color-surface)
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userInfoTextCol: {
    justifyContent: 'center',
  },
  userNameText: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  userPhoneText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
  },
  menuCard: {
    backgroundColor: '#131317', // var(--color-surface)
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272E',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131317',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  logoutText: {
    color: COLORS.danger,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    fontWeight: '600',
  },
  cardGroup: {
    backgroundColor: '#131317',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272E',
    overflow: 'hidden',
  },
  detailRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  detailLabel: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  bookingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  bookingShopName: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  bookingDate: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12.5,
    marginBottom: 4,
  },
  bookingMeta: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
  bookingRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1A1A1F',
  },
  statusBadgeText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  status_confirmed: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  status_completed: {
    backgroundColor: 'rgba(94, 92, 230, 0.15)',
  },
  status_cancelled: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  cancelLinkBtn: {
    paddingTop: 8,
  },
  cancelLinkText: {
    color: COLORS.danger,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#131317',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  emptyText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Auth Card
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  authCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#131317',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  markBadge: {
    marginBottom: 16,
  },
  authTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  authSub: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  telegramAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2AABEE', // Telegram brand blue
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
  },
  telegramAuthBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
  waitingWrap: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  waitingText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13.5,
    textAlign: 'center',
  },
  reopenTelegramBtn: {
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  reopenTelegramText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  cancelLoginBtn: {
    paddingVertical: 6,
  },
  cancelLoginText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
});
