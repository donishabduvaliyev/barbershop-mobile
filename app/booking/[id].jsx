import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { useResponsive } from '../../src/hooks/useResponsive';

const pad = (num) => String(num).padStart(2, '0');

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Exact staff-aware slot availability logic ported from the Web Mini App
// (barbershop-main/src/pages/Booking.jsx) so Web and Mobile never disagree
// on which slots are open.
const isHourTaken = (bookedSlots, date, hour, staffId, staffCount, capacity, isStaffOff) => {
  if (staffId && isStaffOff) return true;

  const target = new Date(date);
  target.setHours(hour, 0, 0, 0);
  const targetTime = target.getTime();
  const atHour = bookedSlots.filter((b) => new Date(b.requestedTime).getTime() === targetTime);

  if (staffId) {
    return atHour.some((b) => String(b.staffId) === String(staffId));
  }
  if (!staffCount) {
    return atHour.length >= (capacity || 1);
  }
  const distinctStaffBooked = new Set(
    atHour.filter((b) => b.staffId).map((b) => String(b.staffId))
  ).size;
  return distinctStaffBooked >= staffCount;
};

const normParam = (v) => (Array.isArray(v) ? v[0] : v) || null;

export default function BookingScreen() {
  const rawParams = useLocalSearchParams();
  const id = normParam(rawParams.id);
  const presetHour = normParam(rawParams.presetHour);
  const presetServiceId = normParam(rawParams.presetServiceId);
  const presetStaffId = normParam(rawParams.presetStaffId);

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'uz';
  const {
    backEndUrl,
    mobileToken,
    userInfo,
    showToast,
    subscribeShopAvailability,
    startTelegramLogin,
    refreshProfile,
  } = useAppContext();
  const { isTablet, horizontalPadding } = useResponsive();

  const [shop, setShop] = useState(null);
  const [availability, setAvailability] = useState({ workingHours: [], bookedSlots: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState(userInfo?.name || '');
  const [phone, setPhone] = useState(userInfo?.phone || '');

  const dates = useMemo(
    () =>
      [...Array(5)].map((_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + i);
        return d;
      }),
    []
  );

  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedHour, setSelectedHour] = useState(presetHour);
  const [selectedStaffId, setSelectedStaffId] = useState(presetStaffId);
  const [selectedServiceId, setSelectedServiceId] = useState(presetServiceId);

  useEffect(() => {
    if (userInfo?.name && !name) setName(userInfo.name);
    if (userInfo?.phone && !phone) setPhone(userInfo.phone);
  }, [userInfo]);

  const fetchAvailability = useCallback(async () => {
    if (!id) return;
    try {
      const [shopRes, availRes] = await Promise.all([
        fetch(`${backEndUrl}/api/mobile/shops/shops/${id}`),
        fetch(`${backEndUrl}/api/mobile/shops/service/${id}/availability`),
      ]);
      if (shopRes.ok && availRes.ok) {
        const [shopData, availData] = await Promise.all([shopRes.json(), availRes.json()]);
        setShop(shopData);
        setAvailability(availData);
        if (!selectedServiceId && shopData.services?.length) {
          setSelectedServiceId(presetServiceId || String(shopData.services[0]._id));
        }
      }
    } catch (err) {
      console.warn('Error fetching booking data:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id, backEndUrl, presetServiceId, selectedServiceId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Subscribe to real-time Socket.io availability updates for this shop
  // so slots booked or cancelled on Web or Mobile update live on screen!
  useEffect(() => {
    if (!id) return;
    return subscribeShopAvailability(id, () => {
      fetchAvailability();
    });
  }, [id, subscribeShopAvailability, fetchAvailability]);

  const bookedSlots = useMemo(() => availability.bookedSlots || [], [availability.bookedSlots]);
  const staffCount = availability.staffCount || 0;
  const capacity = availability.capacity || 1;

  const availableStaffForService = useMemo(() => {
    if (!shop?.staff) return [];
    if (!selectedServiceId) return shop.staff;
    return shop.staff.filter(
      (m) =>
        !m.serviceIds?.length ||
        m.serviceIds.some((sid) => String(sid) === String(selectedServiceId))
    );
  }, [shop, selectedServiceId]);

  useEffect(() => {
    if (!shop) return;
    if (
      selectedStaffId &&
      !availableStaffForService.some((m) => String(m._id) === String(selectedStaffId))
    ) {
      setSelectedStaffId(null);
    }
  }, [shop, availableStaffForService, selectedStaffId]);

  const effectiveWorkingHours = useMemo(() => {
    if (selectedStaffId) {
      const member = shop?.staff?.find((m) => String(m._id) === String(selectedStaffId));
      if (member?.workingHours?.length) return member.workingHours;
    }
    return shop?.workingHours || [];
  }, [shop, selectedStaffId]);

  const selectedStaffOffThatDay = useMemo(() => {
    if (!selectedDate || !selectedStaffId || !shop) return null;
    const member = shop.staff?.find((m) => String(m._id) === String(selectedStaffId));
    return member?.daysOff?.includes(toDateKey(selectedDate)) ? member.name : null;
  }, [selectedDate, selectedStaffId, shop]);

  const availableHours = useMemo(() => {
    if (!selectedDate || !effectiveWorkingHours.length) return [];

    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const schedules = effectiveWorkingHours.filter((wh) => wh.days?.includes(dayName));
    if (!schedules.length) return [];

    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const dateKey = toDateKey(selectedDate);
    const selectedMember = selectedStaffId
      ? shop?.staff?.find((m) => String(m._id) === String(selectedStaffId))
      : null;
    const isStaffOff = !!selectedMember?.daysOff?.includes(dateKey);

    const workingStaffCount = staffCount
      ? (shop.staff || []).filter(
          (m) =>
            !m.daysOff?.includes(dateKey) &&
            (!m.serviceIds?.length ||
              !selectedServiceId ||
              m.serviceIds.some((sid) => String(sid) === String(selectedServiceId)))
        ).length
      : staffCount;

    const hours = new Set();
    for (const schedule of schedules) {
      const [fromHour] = schedule.from.split(':').map(Number);
      const [toHour] = schedule.to.split(':').map(Number);
      const startHour = isToday ? Math.max(fromHour, now.getHours() + 1) : fromHour;
      for (let h = startHour; h < toHour; h++) {
        if (
          !isHourTaken(
            bookedSlots,
            selectedDate,
            h,
            selectedStaffId,
            workingStaffCount,
            capacity,
            isStaffOff
          )
        ) {
          hours.add(h);
        }
      }
    }

    return [...hours].sort((a, b) => a - b).map((h) => `${pad(h)}:00`);
  }, [
    selectedDate,
    shop,
    effectiveWorkingHours,
    bookedSlots,
    staffCount,
    capacity,
    selectedStaffId,
    selectedServiceId,
  ]);

  useEffect(() => {
    if (!shop || !selectedDate) return;
    if (selectedHour && availableHours.includes(selectedHour)) return;
    setSelectedHour(availableHours.length > 0 ? availableHours[0] : null);
  }, [shop, selectedDate, availableHours]);

  const handleSubmitBooking = async () => {
    if (!mobileToken) {
      showToast(t('SignInWithTelegram'), 'error');
      startTelegramLogin();
      return;
    }
    if (!selectedDate || !selectedHour || !selectedServiceId) {
      showToast('Please select a service, date, and time slot', 'error');
      return;
    }
    if (!phone.trim()) {
      showToast('Please enter your phone number', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(parseInt(selectedHour, 10), 0, 0, 0);

      const shopName =
        shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en;

      const res = await fetch(`${backEndUrl}/api/mobile/shops/booking-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({
          shopId: shop._id,
          shopName,
          userNumber: phone.trim(),
          userTelegramNumber: userInfo?.phone || phone.trim(),
          userName: name.trim() || userInfo?.name || 'Customer',
          requestedTime: bookingDate.toISOString(),
          staffId: selectedStaffId || undefined,
          serviceId: selectedServiceId,
          lang,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Booking request failed');
      }

      showToast(t('BookingSent'));
      await refreshProfile();
      router.replace('/(tabs)/profile');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loaderBox}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView style={styles.loaderBox}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
      </SafeAreaView>
    );
  }

  const workingDays = effectiveWorkingHours.flatMap((wh) => wh.days || []);
  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={[styles.topHeader, { paddingHorizontal: horizontalPadding }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{t('BookNow')}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {shopName}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
          isTablet && styles.tabletSplit,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={isTablet ? styles.tabletCol : undefined}>
          {/* 1. Choose Service */}
          {shop.services?.length > 0 && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.cardSection}>
              <Text style={styles.stepTitle}>{t('ChooseService')}</Text>
              <View style={styles.chipsWrap}>
                {shop.services.map((service) => {
                  const active = String(selectedServiceId) === String(service._id);
                  const sName =
                    service.name?.[lang] ||
                    service.name?.uz ||
                    service.name?.ru ||
                    service.name?.en;
                  return (
                    <Pressable
                      key={service._id}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedServiceId(service._id);
                      }}
                      style={[styles.serviceChip, active && styles.serviceChipActive]}
                    >
                      <Text
                        style={[
                          styles.serviceChipTitle,
                          active && styles.serviceChipTitleActive,
                        ]}
                      >
                        {sName}
                      </Text>
                      <Text
                        style={[
                          styles.serviceChipSub,
                          active && styles.serviceChipSubActive,
                        ]}
                      >
                        {service.price?.toLocaleString()} {t('UZS')} · {service.durationMinutes}{' '}
                        {t('min')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* 2. Choose Specialist / Barber */}
          {availableStaffForService.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(60).duration(300)}
              style={styles.cardSection}
            >
              <Text style={styles.stepTitle}>{t('ChooseBarber')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.barberRow}
              >
                <Pressable
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    setSelectedStaffId(null);
                  }}
                  style={[
                    styles.barberChip,
                    selectedStaffId === null && styles.barberChipActive,
                  ]}
                >
                  <View style={styles.anyAvatar}>
                    <Text style={{ fontSize: 18 }}>✨</Text>
                  </View>
                  <Text
                    style={[
                      styles.barberName,
                      selectedStaffId === null && styles.barberNameActive,
                    ]}
                  >
                    {t('AnyAvailable')}
                  </Text>
                </Pressable>

                {availableStaffForService.map((member) => {
                  const active = String(selectedStaffId) === String(member._id);
                  return (
                    <Pressable
                      key={member._id}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedStaffId(member._id);
                      }}
                      style={[styles.barberChip, active && styles.barberChipActive]}
                    >
                      <Image
                        source={{
                          uri:
                            member.photo ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              member.name
                            )}`,
                        }}
                        style={styles.barberAvatar}
                      />
                      <Text
                        style={[styles.barberName, active && styles.barberNameActive]}
                        numberOfLines={1}
                      >
                        {member.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        <View style={isTablet ? styles.tabletCol : undefined}>
          {/* 3. Choose Date */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(300)}
            style={styles.cardSection}
          >
            <Text style={styles.stepTitle}>{t('ChooseDate')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateRow}
            >
              {dates.map((date) => {
                const engDay = date.toLocaleDateString('en-US', { weekday: 'long' });
                const isAvailableDay = workingDays.includes(engDay);
                const active = selectedDate?.toDateString() === date.toDateString();

                return (
                  <Pressable
                    key={date.toISOString()}
                    disabled={!isAvailableDay}
                    onPress={() => {
                      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                      setSelectedDate(date);
                    }}
                    style={[
                      styles.datePill,
                      active && styles.datePillActive,
                      !isAvailableDay && styles.datePillDisabled,
                    ]}
                  >
                    <Text style={[styles.dateDayName, active && styles.dateTextActive]}>
                      {t(`days.${engDay}`, engDay)}
                    </Text>
                    <Text style={[styles.dateNumber, active && styles.dateTextActive]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* 4. Choose Live Time Slot */}
          <Animated.View
            entering={FadeInDown.delay(180).duration(300)}
            style={styles.cardSection}
          >
            <Text style={styles.stepTitle}>{t('ChooseTime')}</Text>
            {availableHours.length === 0 ? (
              <Text style={styles.noSlotsText}>
                {selectedStaffOffThatDay
                  ? t('StaffOffThatDay', { name: selectedStaffOffThatDay })
                  : t('NoSlotsAvailable')}
              </Text>
            ) : (
              <View style={styles.slotsGrid}>
                {availableHours.map((hour) => {
                  const active = selectedHour === hour;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedHour(hour);
                      }}
                      style={[styles.slotPill, active && styles.slotPillActive]}
                    >
                      <Text style={[styles.slotText, active && styles.slotTextActive]}>
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* 5. Customer Contact Details */}
          <Animated.View
            entering={FadeInDown.delay(240).duration(300)}
            style={styles.cardSection}
          >
            <Text style={styles.stepTitle}>{t('YourDetails')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('EnterName')}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+998 90 123 45 67"
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, { marginTop: 10 }]}
            />

            <Pressable
              onPress={handleSubmitBooking}
              disabled={isSubmitting || !selectedHour}
              style={[
                styles.confirmBtn,
                (isSubmitting || !selectedHour) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.confirmBtnText}>
                {isSubmitting ? t('SendingRequest') : t('RequestBooking')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderBox: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 48,
  },
  tabletSplit: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  tabletCol: {
    flex: 1,
  },
  cardSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  chipsWrap: {
    gap: 8,
  },
  serviceChip: {
    backgroundColor: COLORS.surface2,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  serviceChipTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  serviceChipTitleActive: {
    color: '#000',
  },
  serviceChipSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  serviceChipSubActive: {
    color: '#1E293B',
    fontWeight: '600',
  },
  barberRow: {
    gap: 10,
  },
  barberChip: {
    width: 96,
    backgroundColor: COLORS.surface2,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  barberChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  anyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  barberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  barberName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  barberNameActive: {
    color: '#000',
    fontWeight: '700',
  },
  dateRow: {
    gap: 10,
  },
  datePill: {
    minWidth: 72,
    backgroundColor: COLORS.surface2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  datePillDisabled: {
    opacity: 0.35,
  },
  dateDayName: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  dateNumber: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  dateTextActive: {
    color: '#000',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotPill: {
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  slotText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  slotTextActive: {
    color: '#000',
  },
  noSlotsText: {
    color: COLORS.textMuted,
    fontSize: 13,
    paddingVertical: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
