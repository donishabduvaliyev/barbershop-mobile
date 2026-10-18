import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Modal,
  StyleSheet,
  Platform,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { BookingSheetSkeleton } from '../../src/components/Skeletons';

const ITEM_HEIGHT = 44;

// iPhone wheel carousel time picker matching ScrollPickerColumn in barbershop-main Booking.jsx
const ScrollPickerColumn = ({ items, selectedValue, onSelect }) => {
  const scrollRef = useRef(null);
  const isUserInteracting = useRef(false);

  useEffect(() => {
    if (!isUserInteracting.current && scrollRef.current && selectedValue) {
      const idx = items.indexOf(selectedValue);
      if (idx !== -1) {
        scrollRef.current.scrollToOffset({
          offset: idx * ITEM_HEIGHT,
          animated: false,
        });
      }
    }
  }, [selectedValue, items]);

  const handleMomentumEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    const item = items[clampedIndex];
    if (item && item !== selectedValue) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      onSelect(item);
    }
    isUserInteracting.current = false;
  };

  const handleScrollBegin = () => {
    isUserInteracting.current = true;
  };

  return (
    <View style={pickerStyles.container}>
      {/* Selection Lens matching web bg-surface-3/70 rounded-lg */}
      <View style={pickerStyles.lens} pointerEvents="none" />

      <FlatList
        ref={scrollRef}
        data={items}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled={true}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumEnd}
        ListHeaderComponent={<View style={{ height: ITEM_HEIGHT * 1.5 }} />}
        ListFooterComponent={<View style={{ height: ITEM_HEIGHT * 1.5 }} />}
        renderItem={({ item, index }) => {
          const isSelected = item === selectedValue;
          return (
            <Pressable
              onPress={() => {
                isUserInteracting.current = true;
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                onSelect(item);
                scrollRef.current?.scrollToOffset({
                  offset: index * ITEM_HEIGHT,
                  animated: true,
                });
                setTimeout(() => {
                  isUserInteracting.current = false;
                }, 150);
              }}
              style={pickerStyles.item}
              hitSlop={{ top: 6, bottom: 6, left: 14, right: 14 }}
            >
              <Text
                style={[
                  pickerStyles.itemText,
                  isSelected && pickerStyles.itemTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
};

const pad = (num) => String(num).padStart(2, '0');
const normParam = (v) => (Array.isArray(v) ? v[0] : v);

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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

// Validates whether a name looks like a legitimate person name
const checkAppropriateName = (text) => {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return { ok: false, reason: 'Name is very short' };
  }
  // Check if name has symbols or numbers like 123, @#$%, etc.
  const hasSuspiciousChars = /[0-9!@#$%^&*()_+=\[\]{};:"\\|,.<>\/?`~]/.test(trimmed);
  if (hasSuspiciousChars) {
    return { ok: false, reason: 'Please use a real or appropriate name' };
  }
  return { ok: true };
};

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
  } = useAppContext();

  const [shop, setShop] = useState(null);
  const [availability, setAvailability] = useState({ workingHours: [], bookedSlots: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Inputs matching Booking.jsx in barbershop-main
  const [name, setName] = useState(userInfo?.name || '');
  const [phone, setPhone] = useState(userInfo?.phone || '');
  const [nameAlert, setNameAlert] = useState(null); // Non-blocking alert

  // Time & Date picker bottom sheet modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 4 Booking Days matching Booking.jsx
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

  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedHour, setSelectedHour] = useState(presetHour || null);
  const [selectedStaffId, setSelectedStaffId] = useState(presetStaffId || null);
  const [selectedServiceId, setSelectedServiceId] = useState(presetServiceId || null);

  // Fetch shop details and availability
  const fetchAvailability = useCallback(async () => {
    if (!id) return;
    try {
      const [shopRes, availRes] = await Promise.all([
        fetch(`${backEndUrl}/api/mobile/shops/shops/${id}`)
          .then((r) => (r.ok ? r : fetch(`${backEndUrl}/api/shops/shops/${id}`)))
          .catch(() => fetch(`${backEndUrl}/api/shops/shops/${id}`)),
        fetch(`${backEndUrl}/api/mobile/shops/service/${id}/availability`)
          .then((r) => (r.ok ? r : fetch(`${backEndUrl}/api/shops/service/${id}/availability`)))
          .catch(() => fetch(`${backEndUrl}/api/shops/service/${id}/availability`)),
      ]);
      if (shopRes && shopRes.ok && availRes && availRes.ok) {
        const [shopData, availData] = await Promise.all([shopRes.json(), availRes.json()]);
        setShop(shopData);
        setAvailability(availData);
        setSelectedServiceId((curr) => curr || presetServiceId || shopData.services?.[0]?._id || null);
      }
    } catch (err) {
      console.warn('Error fetching booking data:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id, backEndUrl, presetServiceId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Subscribe to real-time availability updates
  useEffect(() => {
    if (!id) return;
    return subscribeShopAvailability(id, () => {
      fetchAvailability();
    });
  }, [id]);

  const bookedSlots = useMemo(() => availability.bookedSlots || [], [availability.bookedSlots]);
  const staffCount = availability.staffCount || 0;
  const capacity = availability.capacity || 1;

  // Filter staff who perform selected service
  const availableStaffForService = useMemo(() => {
    if (!shop?.staff?.length) return [];
    if (!selectedServiceId) return shop.staff;
    return shop.staff.filter(
      (m) =>
        !m.serviceIds?.length ||
        m.serviceIds.some((sid) => String(sid) === String(selectedServiceId))
    );
  }, [shop, selectedServiceId]);

  useEffect(() => {
    if (
      selectedStaffId &&
      !availableStaffForService.some((m) => String(m._id) === String(selectedStaffId))
    ) {
      setSelectedStaffId(null);
    }
  }, [availableStaffForService, selectedStaffId]);

  const effectiveWorkingHours = useMemo(() => {
    if (selectedStaffId) {
      const member = shop?.staff?.find((m) => String(m._id) === String(selectedStaffId));
      if (member?.workingHours?.length) return member.workingHours;
    }
    return shop?.workingHours || [];
  }, [shop, selectedStaffId]);

  const workingDays = useMemo(
    () => effectiveWorkingHours.flatMap((wh) => wh.days || []),
    [effectiveWorkingHours]
  );

  const availableHours = useMemo(() => {
    if (!selectedDate || !effectiveWorkingHours?.length) return [];
    const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const schedules = effectiveWorkingHours.filter((wh) => wh.days?.includes(dayName));
    if (schedules.length === 0) return [];

    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const dateKey = toDateKey(selectedDate);
    const selectedMember = selectedStaffId
      ? shop.staff?.find((m) => String(m._id) === String(selectedStaffId))
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
    if (!selectedDate) return;
    if (selectedHour !== null && availableHours.includes(selectedHour)) return;
    setSelectedHour(availableHours.length > 0 ? availableHours[0] : null);
  }, [selectedDate, availableHours]);

  // FEATURE: "Use my name and number" button from profile
  const handleAutofillFromProfile = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const profileName = userInfo?.name || '';
    const profilePhone = userInfo?.phone || '';

    if (!profileName && !profilePhone) {
      showToast('No saved profile info found. Please sign in or enter manually.', 'info');
      return;
    }

    setName(profileName);
    setPhone(profilePhone);

    // Name check: give non-blocking alert if symbols or inappropriate name
    if (profileName) {
      const check = checkAppropriateName(profileName);
      if (!check.ok) {
        setNameAlert('⚠️ Please consider using your real name so the specialist can identify you.');
      } else {
        setNameAlert(null);
      }
    }
    showToast('Name and phone filled from profile!');
  };

  const handleNameChange = (val) => {
    setName(val);
    if (val.trim()) {
      const check = checkAppropriateName(val);
      if (!check.ok) {
        setNameAlert('⚠️ Please consider using your real name so the specialist can identify you.');
      } else {
        setNameAlert(null);
      }
    } else {
      setNameAlert(null);
    }
  };

  // Submit Booking Request (matching Booking.jsx in barbershop-main)
  const handleRequestBooking = async () => {
    if (!selectedDate || selectedHour === null) {
      Alert.alert('Required', t('Please select a valid date and time', 'Please select a valid date and time'));
      return;
    }
    if (!selectedServiceId) {
      Alert.alert('Required', t('PleaseSelectService', 'Please choose a service'));
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(parseInt(selectedHour, 10), 0, 0, 0);

      const shopName =
        shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';

      const bookingPayload = JSON.stringify({
        shopId: shop._id,
        shopName,
        userNumber: phone.trim(),
        userTelegramNumber: userInfo?.phone || phone.trim(),
        userName: name.trim() || userInfo?.name || 'Customer',
        requestedTime: bookingDate.toISOString(),
        staffId: selectedStaffId || undefined,
        serviceId: selectedServiceId,
        lang,
      });

      const postBooking = (prefix) =>
        fetch(`${backEndUrl}${prefix}/booking-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(mobileToken ? { Authorization: `Bearer ${mobileToken}` } : {}),
          },
          body: bookingPayload,
        });

      const res = await postBooking('/api/mobile/shops')
        .then((r) => (r.ok ? r : postBooking('/api/shops')))
        .catch(() => postBooking('/api/shops'));

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Booking request failed');
      }

      setIsModalOpen(false);
      showToast(
        `${t('YouRequestFor', 'Your request for')} ${shopName} ${t('has been sent.', 'has been sent.')} ${t('ConfirmationSoon', 'You will receive confirmation shortly.')}`
      );
      router.back();
    } catch (err) {
      Alert.alert('Booking Error', err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !shop) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <BookingSheetSkeleton />
      </SafeAreaView>
    );
  }

  const shopName =
    shop.name?.[lang] || shop.name?.uz || shop.name?.ru || shop.name?.en || 'Barbershop';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#F4F4F5" />
          <Text style={styles.backText}>{t('Back', 'Back')}</Text>
        </Pressable>

        {/* Shop Cover Image & Header (matching Booking.jsx in barbershop-main) */}
        <View style={styles.shopHeaderCard}>
          <Image
            source={{
              uri:
                shop.image ||
                'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&q=80',
            }}
            style={styles.shopImage}
            resizeMode="cover"
          />
          <Text style={styles.pageTitle}>{t('Book Your Visit', 'Book Your Visit')}</Text>
          <Text style={styles.shopSub}>{shopName}</Text>
        </View>

        {/* Autofill from Profile Button */}
        <View style={styles.autofillRow}>
          <Pressable onPress={handleAutofillFromProfile} style={styles.autofillBtn}>
            <Ionicons name="sparkles" size={15} color="#0A0A0C" />
            <Text style={styles.autofillBtnText}>Use my name and number from profile</Text>
          </Pressable>
        </View>

        {/* Form Inputs (matching Booking.jsx in barbershop-main) */}
        <View style={styles.formCard}>
          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('Name', 'Name')}</Text>
            <TextInput
              value={name}
              onChangeText={handleNameChange}
              placeholder={t('Enter your name', 'Enter your name')}
              placeholderTextColor="#64646D"
              style={styles.textInput}
            />
            {/* Non-blocking Name Warning Alert */}
            {!!nameAlert && (
              <View style={styles.nameAlertBanner}>
                <Ionicons name="alert-circle" size={14} color="#F0B84C" />
                <Text style={styles.nameAlertText}>{nameAlert}</Text>
              </View>
            )}
          </View>

          {/* Phone Number Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('Phone Number', 'Phone Number')}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+998 (33) 3333333"
              placeholderTextColor="#64646D"
              keyboardType="phone-pad"
              style={styles.textInput}
            />
          </View>
        </View>

        {/* Main CTA: Select Date and Time button (matching Booking.jsx in barbershop-main) */}
        <View style={styles.ctaWrap}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              setIsModalOpen(true);
            }}
            style={styles.selectDateTimeBtn}
          >
            <Text style={styles.selectDateTimeText}>
              {t('Select Date and Time', 'Select Date and Time')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Date & Time Picker Bottom Modal Sheet (matching Booking.jsx in barbershop-main) */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {t('Choose a Time', 'Choose a Time')}
              </Text>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color="#9C9CA6" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* 1. Choose Service */}
              {shop.services?.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionSubtitle}>
                    {t('ChooseService', 'Choose a Service')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.serviceRow}
                  >
                    {shop.services.map((service) => {
                      const isSelected = selectedServiceId === service._id;
                      return (
                        <Pressable
                          key={service._id}
                          onPress={() => setSelectedServiceId(service._id)}
                          style={[
                            styles.serviceChip,
                            isSelected && styles.serviceChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.serviceChipTitle,
                              isSelected && styles.serviceChipTitleActive,
                            ]}
                            numberOfLines={1}
                          >
                            {service.name?.[lang] || service.name?.en}
                          </Text>
                          <Text
                            style={[
                              styles.serviceChipSub,
                              isSelected && styles.serviceChipSubActive,
                            ]}
                          >
                            {service.price?.toLocaleString()} · {service.durationMinutes} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 2. Choose Specialist / Barber */}
              {availableStaffForService.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionSubtitle}>
                    {t('ChooseBarber', 'Choose a Specialist')}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.barberRow}
                  >
                    {/* Any Available */}
                    <Pressable
                      onPress={() => setSelectedStaffId(null)}
                      style={[
                        styles.barberChip,
                        selectedStaffId === null && styles.barberChipActive,
                      ]}
                    >
                      <View style={styles.anyAvatarCircle}>
                        <Text style={{ fontSize: 16 }}>✨</Text>
                      </View>
                      <Text
                        style={[
                          styles.barberChipText,
                          selectedStaffId === null && styles.barberChipTextActive,
                        ]}
                      >
                        {t('AnyAvailable', 'Any Available')}
                      </Text>
                    </Pressable>

                    {/* Staff members */}
                    {availableStaffForService.map((member) => {
                      const isSelected = selectedStaffId === member._id;
                      return (
                        <Pressable
                          key={member._id}
                          onPress={() => setSelectedStaffId(member._id)}
                          style={[
                            styles.barberChip,
                            isSelected && styles.barberChipActive,
                          ]}
                        >
                          <Image
                            source={{
                              uri:
                                member.photo ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  member.name
                                )}&background=212127&color=F4F4F5`,
                            }}
                            style={styles.barberAvatar}
                          />
                          <Text
                            style={[
                              styles.barberChipText,
                              isSelected && styles.barberChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {member.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 3. Choose Date */}
              <View style={styles.modalSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dateRow}
                >
                  {dates.map((date) => {
                    const engDay = date.toLocaleDateString('en-US', { weekday: 'long' });
                    const isAvailable = workingDays.includes(engDay);
                    const isSelected = selectedDate?.toDateString() === date.toDateString();

                    return (
                      <Pressable
                        key={date.toISOString()}
                        disabled={!isAvailable}
                        onPress={() => setSelectedDate(date)}
                        style={[
                          styles.dateChip,
                          isSelected && styles.dateChipActive,
                          !isAvailable && styles.dateChipDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateDayText,
                            isSelected && styles.dateDayTextActive,
                          ]}
                        >
                          {date.toLocaleDateString(lang, { weekday: 'short' })}
                        </Text>
                        <Text
                          style={[
                            styles.dateNumText,
                            isSelected && styles.dateNumTextActive,
                          ]}
                        >
                          {date.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 4. Choose Time - iPhone Wheel Carousel matching Booking.jsx */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionSubtitle}>
                  {t('ChooseTime', 'Choose a Time')}
                </Text>
                {availableHours.length > 0 ? (
                  <View style={styles.wheelWrapper}>
                    <ScrollPickerColumn
                      items={availableHours}
                      selectedValue={selectedHour}
                      onSelect={setSelectedHour}
                    />
                  </View>
                ) : (
                  <View style={styles.noHoursBox}>
                    <Text style={styles.noHoursText}>
                      {t('NoSlotsAvailable', 'No available time slots for this day.')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm Booking Button in Bottom Sheet */}
              <View style={{ padding: 16 }}>
                <Pressable
                  onPress={handleRequestBooking}
                  disabled={selectedHour === null || !selectedServiceId || isSubmitting}
                  style={[
                    styles.confirmBookingBtn,
                    (selectedHour === null || !selectedServiceId || isSubmitting) &&
                      styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.confirmBookingText}>
                    {isSubmitting
                      ? t('SendingRequest', 'Sending Request...')
                      : t('Request Booking', 'Request Booking')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C', // var(--color-bg)
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  shopHeaderCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shopImage: {
    width: '100%',
    height: 190, // h-48 in web app
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: '#131317',
  },
  pageTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displayBold,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  shopSub: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
  },
  autofillRow: {
    marginBottom: 14,
  },
  autofillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4AF5A', // gold accent
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#D4AF5A',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  autofillBtnText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
  },
  formCard: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#9C9CA6', // var(--color-text-muted)
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13.5,
  },
  textInput: {
    backgroundColor: '#1A1A1F', // var(--color-surface-2)
    borderWidth: 1,
    borderColor: '#27272E', // var(--color-border)
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F4F4F5',
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
  },
  nameAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(240, 184, 76, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    marginTop: 4,
  },
  nameAlertText: {
    color: '#F0B84C', // warning gold
    fontFamily: FONTS.bodyRegular,
    fontSize: 11.5,
    flex: 1,
  },
  ctaWrap: {
    marginTop: 8,
  },
  selectDateTimeBtn: {
    backgroundColor: '#D4AF5A', // var(--color-accent)
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF5A',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  selectDateTimeText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 16.5,
    fontWeight: '700',
  },

  // Modal Sheet (matching Booking.jsx in barbershop-main)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#131317', // var(--color-surface)
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272E',
  },
  modalHeaderTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.displaySemiBold,
    fontSize: 17,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingBottom: 24,
  },
  modalSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E24',
  },
  sectionSubtitle: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceRow: {
    gap: 8,
  },
  serviceChip: {
    minWidth: 125,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    borderRadius: 12,
    padding: 10,
  },
  serviceChipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  serviceChipTitle: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceChipTitleActive: {
    color: '#0A0A0C',
  },
  serviceChipSub: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
  },
  serviceChipSubActive: {
    color: '#0A0A0C',
    opacity: 0.85,
  },
  barberRow: {
    gap: 10,
  },
  barberChip: {
    minWidth: 70,
    alignItems: 'center',
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    borderRadius: 12,
    padding: 8,
  },
  barberChipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  anyAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  barberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
    backgroundColor: '#27272E',
  },
  barberChipText: {
    color: '#F4F4F5',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
  },
  barberChipTextActive: {
    color: '#0A0A0C',
    fontWeight: '700',
  },
  dateRow: {
    gap: 8,
  },
  dateChip: {
    minWidth: 85,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: '#D4AF5A',
    borderColor: '#D4AF5A',
  },
  dateChipDisabled: {
    opacity: 0.4,
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
  wheelWrapper: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noHoursBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noHoursText: {
    color: '#9C9CA6',
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
  confirmBookingBtn: {
    backgroundColor: '#D4AF5A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF5A',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  confirmBookingText: {
    color: '#0A0A0C',
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    fontWeight: '700',
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    height: 190, // h-48 in web
    width: '100%',
    maxWidth: 160,
    alignSelf: 'center',
    position: 'relative',
    justifyContent: 'center',
  },
  lens: {
    position: 'absolute',
    top: (190 - ITEM_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: '#27272F', // var(--color-surface-3)
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4AF5A',
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  itemText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    color: '#9C9CA6',
    opacity: 0.45,
  },
  itemTextSelected: {
    fontFamily: FONTS.displayBold,
    fontSize: 21,
    fontWeight: '700',
    color: '#D4AF5A',
    opacity: 1,
  },
});
