import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ShopCard } from '../../src/components/ShopCard';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const {
    backEndUrl,
    mobileToken,
    userInfo,
    setUserInfo,
    bookings,
    setBookings,
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
  const { isTablet, numColumns, horizontalPadding } = useResponsive();

  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'favorites' | 'details'
  const [editName, setEditName] = useState(userInfo?.name || '');
  const [editPhone, setEditPhone] = useState(userInfo?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // In-app 5-star rating modal state
  const [ratingModalBooking, setRatingModalBooking] = useState(null);
  const [shopStars, setShopStars] = useState(5);
  const [staffStars, setStaffStars] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const favoriteShops = shops.filter((s) => favoriteIds.has(String(s._id)));

  const handleSaveProfile = async () => {
    if (!mobileToken) return;
    try {
      setIsSavingProfile(true);
      const res = await fetch(`${backEndUrl}/api/mobile/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      const data = await res.json();
      setUserInfo(data.user);
      showToast(t('ProfileSaved'));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const res = await fetch(`${backEndUrl}/api/mobile/user/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Could not cancel booking');
      }
      const updated = await res.json();
      setBookings((prev) =>
        prev.map((b) => (String(b._id) === String(bookingId) ? { ...b, ...updated } : b))
      );
      showToast(t('StatusCancelled'));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSubmitReview = async () => {
    if (!ratingModalBooking) return;
    try {
      setIsSubmittingReview(true);
      const res = await fetch(`${backEndUrl}/api/mobile/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({
          bookingId: ratingModalBooking._id,
          rating: shopStars,
          staffRating: ratingModalBooking.staffId ? staffStars : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit rating');

      setBookings((prev) =>
        prev.map((b) =>
          String(b._id) === String(ratingModalBooking._id)
            ? { ...b, rating: shopStars, staffRating: staffStars }
            : b
        )
      );
      setRatingModalBooking(null);
      showToast('Thank you for your rating!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Unauthenticated View -> 1-Tap Telegram Bot Deep-Link Auth
  if (!mobileToken || !userInfo) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.authCenterBox}>
          <Animated.View entering={FadeInDown.springify()} style={styles.authCard}>
            <View style={styles.tgIconCircle}>
              <Ionicons name="paper-plane" size={34} color={COLORS.telegram} />
            </View>
            <Text style={styles.authTitle}>SmartChair</Text>
            <Text style={styles.authSubtitle}>{t('SignInSubtitle')}</Text>

            {isAuthenticating ? (
              <View style={styles.waitingBox}>
                <ActivityIndicator size="large" color={COLORS.telegram} />
                <Text style={styles.waitingText}>{t('WaitingForTelegram')}</Text>

                {authSession?.webDeepLink && (
                  <Pressable
                    onPress={() => Linking.openURL(authSession.webDeepLink)}
                    style={styles.reopenBtn}
                  >
                    <Text style={styles.reopenBtnText}>{t('OpenTelegramAgain')}</Text>
                  </Pressable>
                )}

                <Pressable onPress={cancelTelegramLogin} style={styles.cancelAuthBtn}>
                  <Text style={styles.cancelAuthText}>{t('CancelLogin')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startTelegramLogin} style={styles.telegramLoginBtn}>
                <Ionicons name="paper-plane" size={20} color="#FFF" />
                <Text style={styles.telegramLoginText}>{t('SignInWithTelegram')}</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'confirmed':
        return { bg: COLORS.successSoft, color: COLORS.success, label: t('StatusConfirmed') };
      case 'completed':
        return { bg: COLORS.accentSoft, color: COLORS.accent, label: t('StatusCompleted') };
      case 'rejected':
        return { bg: COLORS.dangerSoft, color: COLORS.danger, label: t('StatusRejected') };
      case 'cancelled':
        return { bg: COLORS.dangerSoft, color: COLORS.danger, label: t('StatusCancelled') };
      default:
        return { bg: COLORS.telegramSoft, color: COLORS.telegram, label: t('StatusPending') };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User Header Card */}
        <View style={styles.profileHeaderCard}>
          <Image
            source={{
              uri:
                userInfo.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  userInfo.name || 'U'
                )}&background=F59E0B&color=000`,
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{userInfo.name}</Text>
            <Text style={styles.userMeta}>
              {userInfo.phone || (userInfo.username ? `@${userInfo.username}` : `ID: ${userInfo.telegramId}`)}
            </Text>
          </View>
          <Pressable onPress={refreshProfile} style={styles.iconActionBtn}>
            <Ionicons name="refresh" size={18} color={COLORS.text} />
          </Pressable>
          <Pressable onPress={logout} style={styles.iconActionBtn}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>

        {/* Sub-navigation Tabs */}
        <View style={styles.segmentedTabs}>
          {[
            { key: 'bookings', label: t('BookingHistory'), icon: 'calendar-outline' },
            { key: 'favorites', label: t('Favorites'), icon: 'heart-outline' },
            { key: 'details', label: t('MyDetails'), icon: 'person-outline' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  setEditName(userInfo?.name || '');
                  setEditPhone(userInfo?.phone || '');
                }}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={active ? '#000' : COLORS.textMuted}
                />
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* TAB 1: Live Bookings History */}
        {activeTab === 'bookings' && (
          <View style={styles.sectionBox}>
            {bookings.length === 0 ? (
              <Text style={styles.emptyText}>{t('NoBookingsYet')}</Text>
            ) : (
              bookings.map((booking, idx) => {
                const statusInfo = getStatusStyle(booking.status);
                const canCancel = ['pending', 'confirmed'].includes(booking.status);
                const canRate = booking.status === 'completed' && !booking.rating;

                return (
                  <Animated.View
                    key={booking._id}
                    entering={FadeInDown.delay(idx * 50)}
                    style={styles.bookingCard}
                  >
                    <View style={styles.bookingTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookingShopName}>{booking.shopName}</Text>
                        <Text style={styles.bookingTimeText}>
                          🗓 {new Date(booking.requestedTime).toLocaleString()}
                        </Text>
                      </View>
                      <View
                        style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}
                      >
                        <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    {(booking.serviceName || booking.staffName) && (
                      <View style={styles.bookingMetaRow}>
                        {booking.serviceName && (
                          <Text style={styles.bookingSubText}>
                            ✂️ {booking.serviceName}{' '}
                            {booking.servicePrice
                              ? `(${booking.servicePrice.toLocaleString()} ${t('UZS')})`
                              : ''}
                          </Text>
                        )}
                        {booking.staffName && (
                          <Text style={styles.bookingSubText}>💈 {booking.staffName}</Text>
                        )}
                      </View>
                    )}

                    {booking.rating && (
                      <Text style={styles.ratedStars}>
                        {'⭐'.repeat(booking.rating)}
                      </Text>
                    )}

                    <View style={styles.bookingActionsRow}>
                      {canCancel && (
                        <Pressable
                          onPress={() => handleCancelBooking(booking._id)}
                          style={styles.cancelBookingBtn}
                        >
                          <Text style={styles.cancelBookingText}>{t('CancelBooking')}</Text>
                        </Pressable>
                      )}
                      {canRate && (
                        <Pressable
                          onPress={() => {
                            setShopStars(5);
                            setStaffStars(5);
                            setRatingModalBooking(booking);
                          }}
                          style={styles.rateBookingBtn}
                        >
                          <Ionicons name="star" size={14} color="#000" />
                          <Text style={styles.rateBookingText}>{t('RateVisit')}</Text>
                        </Pressable>
                      )}
                    </View>
                  </Animated.View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: Saved Favorites */}
        {activeTab === 'favorites' && (
          <View style={[styles.gridContainer, isTablet && styles.gridContainerTablet]}>
            {favoriteShops.length === 0 ? (
              <Text style={styles.emptyText}>{t('NoFavoritesYet')}</Text>
            ) : (
              favoriteShops.map((shop, idx) => (
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
              ))
            )}
          </View>
        )}

        {/* TAB 3: Profile Details Editor */}
        {activeTab === 'details' && (
          <View style={styles.detailsFormCard}>
            <Text style={styles.inputLabel}>{t('Name')}</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={styles.textInput}
              placeholder={t('EnterName')}
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.inputLabel}>{t('PhoneNumber')}</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              style={styles.textInput}
              placeholder="+998 90 123 45 67"
              placeholderTextColor={COLORS.textMuted}
            />

            <Pressable
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              style={styles.saveProfileBtn}
            >
              <Text style={styles.saveProfileText}>
                {isSavingProfile ? '...' : t('SaveProfile')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* In-App 5-Star Rating Modal */}
      <Modal
        visible={!!ratingModalBooking}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModalBooking(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('HowWasVisit')}</Text>
            <Text style={styles.modalSubtitle}>{ratingModalBooking?.shopName}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setShopStars(n)}>
                  <Ionicons
                    name={n <= shopStars ? 'star' : 'star-outline'}
                    size={34}
                    color={COLORS.accent}
                  />
                </Pressable>
              ))}
            </View>

            {ratingModalBooking?.staffId && (
              <>
                <Text style={styles.modalSubtitle}>
                  {t('RateBarber')}: {ratingModalBooking.staffName}
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setStaffStars(n)}>
                      <Ionicons
                        name={n <= staffStars ? 'star' : 'star-outline'}
                        size={30}
                        color={COLORS.accent}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Pressable
              onPress={handleSubmitReview}
              disabled={isSubmittingReview}
              style={styles.submitReviewBtn}
            >
              <Text style={styles.submitReviewText}>{t('SubmitReview')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 36,
  },
  authCenterBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  tgIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.telegramSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  authSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  telegramLoginBtn: {
    backgroundColor: COLORS.telegram,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  telegramLoginText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingBox: {
    alignItems: 'center',
    width: '100%',
    gap: 14,
  },
  waitingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  reopenBtn: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reopenBtnText: {
    color: COLORS.telegram,
    fontWeight: '700',
    fontSize: 13,
  },
  cancelAuthBtn: {
    paddingVertical: 6,
  },
  cancelAuthText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  profileHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface2,
  },
  userName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  userMeta: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.accent,
  },
  segmentText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  sectionBox: {
    gap: 12,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 42,
    fontSize: 14,
  },
  bookingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  bookingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  bookingShopName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  bookingTimeText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bookingMetaRow: {
    marginTop: 10,
    gap: 4,
  },
  bookingSubText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  ratedStars: {
    marginTop: 8,
    fontSize: 14,
  },
  bookingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  cancelBookingBtn: {
    backgroundColor: COLORS.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cancelBookingText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  rateBookingBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rateBookingText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  detailsFormCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveProfileBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveProfileText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  submitReviewBtn: {
    backgroundColor: COLORS.accent,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  submitReviewText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
