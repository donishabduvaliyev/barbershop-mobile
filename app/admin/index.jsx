import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  FlatList,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { io } from 'socket.io-client';
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

const formatPrice = (price) => {
  if (!price && price !== 0) return '';
  return `${Number(price).toLocaleString('ru-RU')} UZS`;
};

const pad = (n) => String(n).padStart(2, '0');

export default function AdminScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n?.language || 'uz';
  const {
    adminData,
    switchAdminShop,
    checkAdminStatus,
    mobileToken,
    backEndUrl,
    showToast,
    logout,
    setIsCustomerPreview,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState(''); // '' = all, 'pending', 'confirmed', 'completed', 'cancelled'
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shopDetails, setShopDetails] = useState(null);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [isSwitchingShop, setIsSwitchingShop] = useState(false);
  const [actioningId, setActioningId] = useState(null);

  // Modals
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(() => new Date());
  const [rescheduleHour, setRescheduleHour] = useState(null);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // New Booking Form State
  const [bookingSource, setBookingSource] = useState('walk-in'); // 'walk-in' | 'phone'
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => new Date());
  const [bookingHour, setBookingHour] = useState(null);
  const [bookingNote, setBookingNote] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const socketRef = useRef(null);

  const activeShop = adminData?.currentShop || adminData?.shops?.[0] || null;
  const hasMultipleShops = (adminData?.shops || []).length > 1;

  // Re-verify admin privileges if not loaded yet
  useEffect(() => {
    if (!adminData && mobileToken) {
      checkAdminStatus();
    }
  }, [adminData, mobileToken, checkAdminStatus]);

  // Fetch shop services & staff for manual booking
  const fetchShopDetails = useCallback(async () => {
    if (!adminData?.adminToken) return;
    try {
      const res = await fetch(`${backEndUrl}/api/admin/shop`, {
        headers: {
          Authorization: `Bearer ${adminData.adminToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setShopDetails(data);
        if (!selectedServiceId && data?.services?.length > 0) {
          const firstActive = data.services.find((s) => s.isActive !== false);
          if (firstActive) setSelectedServiceId(firstActive._id);
        }
      }
    } catch (err) {
      console.warn('Error fetching shop details:', err.message);
    }
  }, [adminData?.adminToken, backEndUrl, selectedServiceId]);

  // Fetch appointments list
  const fetchAppointments = useCallback(async (isRefresh = false) => {
    if (!adminData?.adminToken) return;
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const queryParams = new URLSearchParams({
        page: '1',
        limit: '60',
      });
      if (activeTab) {
        queryParams.append('status', activeTab);
      }

      const res = await fetch(`${backEndUrl}/api/admin/appointments?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${adminData.adminToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (err) {
      console.warn('Error fetching appointments:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, adminData?.adminToken, backEndUrl]);

  useEffect(() => {
    if (adminData?.adminToken) {
      fetchShopDetails();
      fetchAppointments();
    }
  }, [adminData?.adminToken, fetchShopDetails, fetchAppointments]);

  // Real-time socket sync for instant appointment updates
  useEffect(() => {
    if (!adminData?.adminToken) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(backEndUrl, {
      transports: ['websocket'],
      auth: { token: adminData.adminToken },
    });

    socket.on('connect', () => {
      // Connected to shop room
    });

    socket.on('appointment:update', (updated) => {
      if (!updated?._id) return;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setAppointments((prev) => {
        const index = prev.findIndex((a) => String(a._id) === String(updated._id));
        if (index >= 0) {
          const next = [...prev];
          next[index] = { ...next[index], ...updated };
          return next;
        }
        // If it's a new appointment, place it at the top
        return [updated, ...prev];
      });

      showToast?.(`${updated.userName || 'Client'}: ${String(updated.status).toUpperCase()}`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [adminData?.adminToken, backEndUrl, showToast]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      setIsCustomerPreview(true);
      router.replace('/(tabs)');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('LogOut', 'Log Out'),
      t('ConfirmLogoutAdmin', 'Do you want to log out from the Owner Portal?'),
      [
        { text: t('Cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('LogOut', 'Log Out'),
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            }
            await logout();
            router.replace('/(tabs)/profile');
          },
        },
      ]
    );
  };

  const handleCustomerPreview = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsCustomerPreview(true);
    router.push('/(tabs)');
  };

  const handleSelectShop = async (shopId) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setShowShopPicker(false);
    setIsSwitchingShop(true);
    await switchAdminShop(shopId);
    setIsSwitchingShop(false);
  };

  // Status Action Handlers
  const handleConfirm = async (id) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActioningId(id);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${id}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (String(a._id) === String(id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentConfirmed', 'Appointment confirmed!'));
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Failed to confirm');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleComplete = async (id) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setActioningId(id);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (String(a._id) === String(id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentCompleted', 'Appointment marked completed!'));
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Failed to complete');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleOpenReject = (item) => {
    setRejectTarget(item);
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectTarget?._id || !rejectReason.trim()) return;
    setIsSavingAction(true);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${rejectTarget._id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (String(a._id) === String(rejectTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentDeclined', 'Appointment declined'));
        setRejectTarget(null);
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Failed to decline');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleOpenReschedule = (item) => {
    setRescheduleTarget(item);
    const reqDate = new Date(item.requestedTime);
    setRescheduleDate(reqDate);
    setRescheduleHour(reqDate.getHours());
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget?._id || rescheduleHour === null) return;
    setIsSavingAction(true);
    try {
      const targetDate = new Date(rescheduleDate);
      targetDate.setHours(rescheduleHour, 0, 0, 0);

      const res = await fetch(
        `${backEndUrl}/api/admin/appointments/${rescheduleTarget._id}/reschedule`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminData.adminToken}`,
          },
          body: JSON.stringify({ requestedTime: targetDate.toISOString() }),
        }
      );

      if (res.ok) {
        const updated = await res.json();
        setAppointments((prev) =>
          prev.map((a) => (String(a._id) === String(rescheduleTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentRescheduled', 'Appointment rescheduled!'));
        setRescheduleTarget(null);
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Failed to reschedule');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleCallClient = (phoneNumber) => {
    if (!phoneNumber) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(t('Error', 'Error'), 'Unable to start phone call');
    });
  };

  // Open New Booking Modal
  const handleOpenNewBooking = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setClientName('');
    setClientPhone('');
    setBookingSource('walk-in');
    setBookingNote('');
    setBookingDate(new Date());

    // Auto-select next available valid hour
    const now = new Date();
    const nextHour = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
    setBookingHour(Math.max(8, Math.min(22, nextHour)));

    const activeServices = shopDetails?.services?.filter((s) => s.isActive !== false) || [];
    if (activeServices.length > 0 && !selectedServiceId) {
      setSelectedServiceId(activeServices[0]._id);
    }

    setShowNewBookingModal(true);
  };

  // Submit Manual Walk-in / Phone Booking
  const handleSubmitNewBooking = async () => {
    if (!clientName.trim()) {
      Alert.alert(t('Error', 'Error'), t('EnterClientName', 'Please enter client name'));
      return;
    }
    if (!clientPhone.trim()) {
      Alert.alert(t('Error', 'Error'), t('ClientPhone', 'Please enter client phone number'));
      return;
    }
    if (bookingHour === null) {
      Alert.alert(t('Error', 'Error'), t('SelectTime', 'Please select a time slot'));
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const requestedDate = new Date(bookingDate);
      requestedDate.setHours(bookingHour, 0, 0, 0);

      const payload = {
        name: clientName.trim(),
        number: clientPhone.trim(),
        serviceId: selectedServiceId || undefined,
        staffId: selectedStaffId || undefined,
        requestedTime: requestedDate.toISOString(),
        source: bookingSource,
        note: bookingNote.trim() || undefined,
      };

      const res = await fetch(`${backEndUrl}/api/admin/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const newBooking = await res.json();
        setAppointments((prev) => [newBooking, ...prev]);
        showToast?.(t('AppointmentCreated', 'Appointment created successfully!'));
        setShowNewBookingModal(false);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Failed to create appointment');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Metric counts
  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;

    appointments.forEach((a) => {
      const isToday = new Date(a.requestedTime).toDateString() === todayStr;
      if (isToday) todayCount++;
      if (a.status === 'pending') pendingCount++;
      if (a.status === 'confirmed') confirmedCount++;
      if (a.status === 'completed') completedCount++;
    });

    return { todayCount, pendingCount, confirmedCount, completedCount };
  }, [appointments]);

  // Filtered appointments list
  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.userName || '').toLowerCase().includes(q) ||
          (a.userNumber || '').includes(q) ||
          (a.serviceName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointments, searchQuery]);

  // Available dates for booking picker (Today + next 6 days)
  const availableDates = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  // Available hours for selected date
  const availableHours = useMemo(() => {
    const now = new Date();
    const isToday = bookingDate.toDateString() === now.toDateString();
    const startHour = isToday ? now.getHours() + 1 : 8;
    const hours = [];
    for (let h = Math.max(startHour, 8); h <= 21; h++) {
      hours.push(h);
    }
    return hours;
  }, [bookingDate]);

  // Available hours for reschedule date
  const rescheduleHours = useMemo(() => {
    const now = new Date();
    const isToday = rescheduleDate.toDateString() === now.toDateString();
    const startHour = isToday ? now.getHours() + 1 : 8;
    const hours = [];
    for (let h = Math.max(startHour, 8); h <= 21; h++) {
      hours.push(h);
    }
    return hours;
  }, [rescheduleDate]);

  // If unauthorized fallback
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

  const renderStatusBadge = (status) => {
    let bg = COLORS.surface3;
    let color = COLORS.textMuted;
    let label = status;

    switch (status) {
      case 'pending':
        bg = COLORS.warningSoft;
        color = COLORS.warning;
        label = t('StatusPending', 'Pending');
        break;
      case 'confirmed':
        bg = COLORS.infoSoft;
        color = COLORS.info;
        label = t('StatusConfirmed', 'Confirmed');
        break;
      case 'completed':
        bg = COLORS.successSoft;
        color = COLORS.success;
        label = t('StatusCompleted', 'Completed');
        break;
      case 'rejected':
      case 'cancelled':
        bg = COLORS.dangerSoft;
        color = COLORS.danger;
        label = status === 'rejected' ? t('StatusRejected', 'Declined') : t('StatusCancelled', 'Cancelled');
        break;
      case 'no-show':
        bg = COLORS.dangerSoft;
        color = COLORS.danger;
        label = t('NoShowAppointments', 'No Show');
        break;
      default:
        break;
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderAppointmentItem = ({ item }) => {
    const isActioning = actioningId === item._id;
    const reqDate = new Date(item.requestedTime);
    const dateFormatted = reqDate.toLocaleDateString(lang, {
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = `${pad(reqDate.getHours())}:00 - ${pad(reqDate.getHours() + 1)}:00`;
    const clientInitial = (item.userName || '?').slice(0, 1).toUpperCase();

    const isPending = item.status === 'pending';
    const isConfirmed = item.status === 'confirmed';

    return (
      <View style={styles.appointmentCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.clientInfoRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{clientInitial}</Text>
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.clientName} numberOfLines={1}>
                {item.userName || t('Customer', 'Client')}
              </Text>
              <Pressable
                onPress={() => handleCallClient(item.userNumber)}
                style={styles.phoneClickableRow}
                hitSlop={6}
              >
                <Ionicons name="call" size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
                <Text style={styles.clientPhone}>{item.userNumber || '—'}</Text>
              </Pressable>
            </View>
          </View>
          {renderStatusBadge(item.status)}
        </View>

        {/* Details Row */}
        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={styles.detailTimeText}>{dateFormatted}, {timeFormatted}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="cut-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.serviceName || t('Services', 'Service')}
              {item.price ? ` • ${formatPrice(item.price)}` : ''}
            </Text>
          </View>

          {item.staffName ? (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.detailText} numberOfLines={1}>
                {t('Barbers', 'Specialist')}: {item.staffName}
              </Text>
            </View>
          ) : null}

          {/* Source Badge */}
          <View style={styles.sourcePillRow}>
            <View style={styles.sourcePill}>
              <Text style={styles.sourcePillText}>
                {item.source === 'walk-in'
                  ? `🚶 ${t('WalkIn', 'Walk-in')}`
                  : item.source === 'phone'
                  ? `📞 ${t('PhoneCall', 'Phone')}`
                  : `🤖 ${t('OnlineBot', 'Telegram')}`}
              </Text>
            </View>
            {item.adminNotes ? (
              <Text style={styles.cardNoteText} numberOfLines={1}>
                📝 {item.adminNotes}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.cardActionsRow}>
            <Pressable
              onPress={() => handleConfirm(item._id)}
              disabled={isActioning}
              style={[styles.actionBtn, styles.confirmBtn]}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color="#0A0A0C" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#0A0A0C" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>{t('ConfirmBooking', 'Confirm')}</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleOpenReject(item)}
              disabled={isActioning}
              style={[styles.actionBtn, styles.declineBtn]}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.declineBtnText}>{t('DeclineBooking', 'Decline')}</Text>
            </Pressable>
          </View>
        )}

        {isConfirmed && (
          <View style={styles.cardActionsRow}>
            <Pressable
              onPress={() => handleComplete(item._id)}
              disabled={isActioning}
              style={[styles.actionBtn, styles.completeBtn]}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color="#0A0A0C" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color="#0A0A0C" style={{ marginRight: 6 }} />
                  <Text style={styles.completeBtnText}>{t('CompleteBooking', 'Complete')}</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => handleOpenReschedule(item)}
              disabled={isActioning}
              style={[styles.actionBtn, styles.secondaryActionBtn]}
            >
              <Ionicons name="calendar-outline" size={15} color={COLORS.text} style={{ marginRight: 4 }} />
              <Text style={styles.secondaryActionText}>{t('RescheduleBooking', 'Reschedule')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Native App Bar */}
      <View style={styles.header}>
        <Pressable onPress={handleCustomerPreview} hitSlop={8} style={styles.customerPreviewBtn}>
          <Ionicons name="eye-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 4 }} />
          <Text style={styles.customerPreviewText}>{t('CustomerView', 'Preview')}</Text>
        </Pressable>

        <Pressable
          onPress={() => hasMultipleShops && setShowShopPicker(true)}
          disabled={!hasMultipleShops}
          style={styles.titleContainer}
        >
          <View style={styles.titleRow}>
            <Ionicons name="storefront" size={15} color={COLORS.accent} style={{ marginRight: 5 }} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {resolveText(activeShop?.name, lang) || t('ShopDashboard', 'Shop Dashboard')}
            </Text>
            {hasMultipleShops && (
              <Ionicons name="chevron-down" size={13} color={COLORS.accent} style={{ marginLeft: 3 }} />
            )}
          </View>
          <Text style={styles.headerSubTitle}>
            {t('OwnerMode', 'Owner Mode')} • {appointments.length} {t('Appointments', 'Bookings')}
          </Text>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable onPress={handleOpenNewBooking} style={styles.quickNewHeaderBtn} hitSlop={8}>
            <Ionicons name="add" size={18} color="#0A0A0C" style={{ marginRight: 2 }} />
            <Text style={styles.quickNewHeaderText}>{t('QuickAppointment', '+ New')}</Text>
          </Pressable>

          <Pressable onPress={handleLogout} style={styles.logoutHeaderBtn} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t('TotalToday', 'Today')}</Text>
          <Text style={styles.metricValue}>{metrics.todayCount}</Text>
        </View>

        <View style={[styles.metricCard, metrics.pendingCount > 0 && styles.metricCardPending]}>
          <Text
            style={[styles.metricLabel, metrics.pendingCount > 0 && { color: COLORS.warning }]}
          >
            {t('PendingCount', 'Pending')}
          </Text>
          <Text
            style={[styles.metricValue, metrics.pendingCount > 0 && { color: COLORS.warning }]}
          >
            {metrics.pendingCount}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t('ConfirmedCount', 'Confirmed')}</Text>
          <Text style={[styles.metricValue, { color: COLORS.info }]}>{metrics.confirmedCount}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t('CompletedCount', 'Completed')}</Text>
          <Text style={[styles.metricValue, { color: COLORS.success }]}>{metrics.completedCount}</Text>
        </View>
      </View>

      {/* Quick Search */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('SearchClients', 'Search by name or phone...')}
          placeholderTextColor={COLORS.textFaint}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {[
            { key: '', label: t('AllAppointments', 'All') },
            {
              key: 'pending',
              label: `${t('PendingAppointments', 'Pending')} ${metrics.pendingCount > 0 ? `(${metrics.pendingCount})` : ''}`,
            },
            { key: 'confirmed', label: t('ConfirmedAppointments', 'Confirmed') },
            { key: 'completed', label: t('CompletedAppointments', 'Completed') },
            { key: 'cancelled', label: t('CancelledAppointments', 'Cancelled') },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setActiveTab(tab.key);
                }}
                style={[styles.filterTabPill, isSelected && styles.filterTabPillActive]}
              >
                <Text
                  style={[
                    styles.filterTabPillText,
                    isSelected && styles.filterTabPillTextActive,
                    tab.key === 'pending' && metrics.pendingCount > 0 && !isSelected && { color: COLORS.warning },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Appointments List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>{t('LoadingAdminPanel', 'Loading bookings...')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderAppointmentItem}
          contentContainerStyle={[styles.listContent, filteredAppointments.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchAppointments(true)}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textFaint} />
              <Text style={styles.emptyTitle}>{t('NoAppointmentsFound', 'No appointments found')}</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'pending'
                  ? 'All pending booking requests have been answered.'
                  : 'Tap "+ New" to add a walk-in or phone booking.'}
              </Text>
              <Pressable onPress={handleOpenNewBooking} style={styles.emptyCtaBtn}>
                <Ionicons name="add" size={18} color="#0A0A0C" style={{ marginRight: 6 }} />
                <Text style={styles.emptyCtaBtnText}>{t('NewAppointment', 'New Booking')}</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Floating Action Button for Quick Walk-In Booking */}
      <Pressable onPress={handleOpenNewBooking} style={styles.fabBtn}>
        <Ionicons name="add" size={26} color="#0A0A0C" />
        <Text style={styles.fabBtnText}>{t('NewAppointment', 'New Booking')}</Text>
      </Pressable>

      {/* NEW APPOINTMENT MODAL (Walk-in / Phone) */}
      <Modal
        visible={showNewBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewBookingModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{t('NewAppointment', 'New Booking')}</Text>
                <Text style={styles.sheetSubTitle}>
                  {resolveText(activeShop?.name, lang)}
                </Text>
              </View>
              <Pressable onPress={() => setShowNewBookingModal(false)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollBody}>
              {/* Source Toggle */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('BookingSource', 'Source')}</Text>
                <View style={styles.sourceToggleRow}>
                  <Pressable
                    onPress={() => setBookingSource('walk-in')}
                    style={[styles.sourceOption, bookingSource === 'walk-in' && styles.sourceOptionActive]}
                  >
                    <Text style={[styles.sourceOptionText, bookingSource === 'walk-in' && styles.sourceOptionTextActive]}>
                      🚶 {t('WalkIn', 'Walk-in')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setBookingSource('phone')}
                    style={[styles.sourceOption, bookingSource === 'phone' && styles.sourceOptionActive]}
                  >
                    <Text style={[styles.sourceOptionText, bookingSource === 'phone' && styles.sourceOptionTextActive]}>
                      📞 {t('PhoneCall', 'Phone')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Client Info Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('ClientName', 'Client Name')} *</Text>
                <TextInput
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder={t('EnterClientName', 'Client full name')}
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('ClientPhone', 'Phone Number')} *</Text>
                <TextInput
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  placeholder="+998 90 123 45 67"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="phone-pad"
                  style={styles.modalInput}
                />
              </View>

              {/* Service Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('SelectService', 'Service')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {(shopDetails?.services || [])
                    .filter((s) => s.isActive !== false)
                    .map((serv) => {
                      const isSelected = String(serv._id) === String(selectedServiceId);
                      return (
                        <Pressable
                          key={serv._id}
                          onPress={() => setSelectedServiceId(serv._id)}
                          style={[styles.chipPill, isSelected && styles.chipPillActive]}
                        >
                          <Text style={[styles.chipPillTitle, isSelected && styles.chipPillTitleActive]}>
                            {resolveText(serv.name, lang)}
                          </Text>
                          {serv.price ? (
                            <Text style={[styles.chipPillSub, isSelected && styles.chipPillSubActive]}>
                              {formatPrice(serv.price)}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>

              {/* Specialist Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('SelectBarber', 'Specialist')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  <Pressable
                    onPress={() => setSelectedStaffId(null)}
                    style={[styles.chipPill, selectedStaffId === null && styles.chipPillActive]}
                  >
                    <Text
                      style={[styles.chipPillTitle, selectedStaffId === null && styles.chipPillTitleActive]}
                    >
                      {t('AnyAvailable', 'Any Available')}
                    </Text>
                  </Pressable>

                  {(shopDetails?.staff || []).map((st) => {
                    const isSelected = String(st._id) === String(selectedStaffId);
                    return (
                      <Pressable
                        key={st._id}
                        onPress={() => setSelectedStaffId(st._id)}
                        style={[styles.chipPill, isSelected && styles.chipPillActive]}
                      >
                        <Text style={[styles.chipPillTitle, isSelected && styles.chipPillTitleActive]}>
                          {resolveText(st.name, lang)}
                        </Text>
                        {st.specialty ? (
                          <Text style={[styles.chipPillSub, isSelected && styles.chipPillSubActive]}>
                            {resolveText(st.specialty, lang)}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Date Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('SelectDate', 'Date')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {availableDates.map((d, index) => {
                    const isSelected = d.toDateString() === bookingDate.toDateString();
                    const dayLabel =
                      index === 0
                        ? t('Today', 'Today')
                        : index === 1
                        ? t('Tomorrow', 'Tomorrow')
                        : d.toLocaleDateString(lang, { weekday: 'short' });
                    const dateNum = d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });

                    return (
                      <Pressable
                        key={d.toISOString()}
                        onPress={() => {
                          setBookingDate(d);
                          // Reset hour if previously selected hour is no longer available
                          setBookingHour(null);
                        }}
                        style={[styles.dateChip, isSelected && styles.dateChipActive]}
                      >
                        <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                          {dayLabel}
                        </Text>
                        <Text style={[styles.dateChipNum, isSelected && styles.dateChipNumActive]}>
                          {dateNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Hourly Time Slots */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('SelectTime', 'Time Slot')} *</Text>
                <View style={styles.hoursGrid}>
                  {availableHours.map((h) => {
                    const isSelected = bookingHour === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => setBookingHour(h)}
                        style={[styles.hourSlotChip, isSelected && styles.hourSlotChipActive]}
                      >
                        <Text
                          style={[styles.hourSlotChipText, isSelected && styles.hourSlotChipTextActive]}
                        >
                          {pad(h)}:00
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Note Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('QuickNote', 'Note (optional)')}</Text>
                <TextInput
                  value={bookingNote}
                  onChangeText={setBookingNote}
                  placeholder={t('EnterNotePlaceholder', 'Notes or client preferences...')}
                  placeholderTextColor={COLORS.textFaint}
                  style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                  multiline
                />
              </View>

              {/* Submit CTA */}
              <Pressable
                onPress={handleSubmitNewBooking}
                disabled={isSubmittingBooking}
                style={[styles.submitBookingBtn, isSubmittingBooking && { opacity: 0.7 }]}
              >
                {isSubmittingBooking ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#0A0A0C" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBookingBtnText}>
                      {t('SaveBooking', 'Save Appointment')}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        visible={!!rejectTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRejectTarget(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('RejectionReason', 'Reason for declining')}</Text>
            <Text style={styles.modalSub}>
              {rejectTarget?.userName || 'Client'} • {rejectTarget?.userNumber}
            </Text>

            {/* Quick Reason Chips */}
            <View style={styles.quickReasonsWrap}>
              {['Vaqt band (Slot full)', 'Usta band (Barber unavailable)', 'Ish vaqti tugagan', 'Salon yopiq'].map(
                (reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => setRejectReason(reason)}
                    style={[
                      styles.quickReasonChip,
                      rejectReason === reason && styles.quickReasonChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickReasonText,
                        rejectReason === reason && styles.quickReasonTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('EnterRejectionReason', 'Enter reason...')}
              placeholderTextColor={COLORS.textFaint}
              style={[styles.modalInput, { marginTop: 12, height: 70, textAlignVertical: 'top' }]}
              multiline
            />

            <View style={styles.modalBtnRow}>
              <Pressable onPress={() => setRejectTarget(null)} style={styles.cancelModalBtn}>
                <Text style={styles.cancelModalBtnText}>{t('Cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submitReject}
                disabled={!rejectReason.trim() || isSavingAction}
                style={[
                  styles.confirmDeclineBtn,
                  (!rejectReason.trim() || isSavingAction) && { opacity: 0.5 },
                ]}
              >
                {isSavingAction ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmDeclineBtnText}>{t('DeclineBooking', 'Decline')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* RESCHEDULE MODAL */}
      <Modal
        visible={!!rescheduleTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRescheduleTarget(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('RescheduleBooking', 'Reschedule')}</Text>
            <Text style={styles.modalSub}>
              {rescheduleTarget?.userName} • {rescheduleTarget?.serviceName}
            </Text>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t('SelectDate', 'Date')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {availableDates.map((d, index) => {
                const isSelected = d.toDateString() === rescheduleDate.toDateString();
                const dayLabel =
                  index === 0
                    ? t('Today', 'Today')
                    : index === 1
                    ? t('Tomorrow', 'Tomorrow')
                    : d.toLocaleDateString(lang, { weekday: 'short' });
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      setRescheduleDate(d);
                      setRescheduleHour(null);
                    }}
                    style={[styles.dateChip, isSelected && styles.dateChipActive, { minWidth: 64 }]}
                  >
                    <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                      {dayLabel}
                    </Text>
                    <Text style={[styles.dateChipNum, isSelected && styles.dateChipNumActive]}>
                      {d.toLocaleDateString(lang, { month: 'numeric', day: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>{t('SelectTime', 'Time Slot')}</Text>
            <View style={styles.hoursGrid}>
              {rescheduleHours.map((h) => {
                const isSelected = rescheduleHour === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setRescheduleHour(h)}
                    style={[styles.hourSlotChip, isSelected && styles.hourSlotChipActive]}
                  >
                    <Text
                      style={[styles.hourSlotChipText, isSelected && styles.hourSlotChipTextActive]}
                    >
                      {pad(h)}:00
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable onPress={() => setRescheduleTarget(null)} style={styles.cancelModalBtn}>
                <Text style={styles.cancelModalBtnText}>{t('Cancel', 'Cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={submitReschedule}
                disabled={rescheduleHour === null || isSavingAction}
                style={[
                  styles.saveRescheduleBtn,
                  (rescheduleHour === null || isSavingAction) && { opacity: 0.5 },
                ]}
              >
                {isSavingAction ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <Text style={styles.saveRescheduleBtnText}>{t('SaveProfile', 'Save')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* MULTI-SHOP PICKER MODAL */}
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
              {(adminData?.shops || []).map((shop) => {
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

      {/* Switching shop overlay */}
      {isSwitchingShop && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>{t('SwitchingShop', 'Switching shop...')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    height: 56,
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
  customerPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  customerPreviewText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoutHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 104, 92, 0.12)',
  },
  quickNewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
  },
  quickNewHeaderText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.bg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  metricCardPending: {
    borderColor: 'rgba(240, 184, 76, 0.4)',
    backgroundColor: 'rgba(240, 184, 76, 0.08)',
  },
  metricLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  metricValue: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
    marginTop: 2,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
  },
  filterTabsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
  },
  filterTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  filterTabPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterTabPillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  filterTabPillTextActive: {
    color: '#0A0A0C',
    fontFamily: FONTS.bold,
  },
  listContent: {
    padding: 12,
    paddingBottom: 90,
  },
  appointmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(212, 175, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.accent,
  },
  clientName: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.text,
  },
  phoneClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  clientPhone: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.accent,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  detailsBox: {
    backgroundColor: COLORS.surface2,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTimeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.accent,
  },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
  },
  sourcePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  sourcePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourcePillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardNoteText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    backgroundColor: COLORS.success,
  },
  confirmBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  declineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(242, 104, 92, 0.4)',
  },
  declineBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.danger,
  },
  completeBtn: {
    backgroundColor: COLORS.accent,
  },
  completeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  secondaryActionBtn: {
    backgroundColor: COLORS.surface3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryActionText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
  },
  fabBtn: {
    position: 'absolute',
    bottom: 24,
    right: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#0A0A0C',
    marginLeft: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
    marginTop: 14,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCtaBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
  },
  sheetSubTitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 1,
  },
  sheetScrollBody: {
    padding: 16,
    paddingBottom: 36,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  sourceToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceOption: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  sourceOptionActive: {
    backgroundColor: 'rgba(212, 175, 90, 0.15)',
    borderColor: COLORS.accent,
  },
  sourceOptionText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  sourceOptionTextActive: {
    fontFamily: FONTS.bold,
    color: COLORS.accent,
  },
  modalInput: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.text,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chipPill: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipPillActive: {
    backgroundColor: 'rgba(212, 175, 90, 0.16)',
    borderColor: COLORS.accent,
  },
  chipPillTitle: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
  },
  chipPillTitleActive: {
    fontFamily: FONTS.bold,
    color: COLORS.accent,
  },
  chipPillSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chipPillSubActive: {
    color: COLORS.accent,
  },
  dateChip: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  dateChipActive: {
    backgroundColor: 'rgba(212, 175, 90, 0.16)',
    borderColor: COLORS.accent,
  },
  dateChipDay: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  dateChipDayActive: {
    fontFamily: FONTS.bold,
    color: COLORS.accent,
  },
  dateChipNum: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
  },
  dateChipNumActive: {
    color: COLORS.accent,
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourSlotChip: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hourSlotChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  hourSlotChipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  hourSlotChipTextActive: {
    fontFamily: FONTS.bold,
    color: '#0A0A0C',
  },
  submitBookingBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBookingBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0A0A0C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
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
  modalSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  quickReasonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  quickReasonChip: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickReasonChipActive: {
    backgroundColor: 'rgba(242, 104, 92, 0.15)',
    borderColor: COLORS.danger,
  },
  quickReasonText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  quickReasonTextActive: {
    color: COLORS.danger,
    fontFamily: FONTS.bold,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelModalBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  confirmDeclineBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeclineBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  saveRescheduleBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRescheduleBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
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
