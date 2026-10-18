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
  Switch,
  Image,
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

const currency = (n) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} UZS`;
const pad = (n) => String(n).padStart(2, '0');
const formatDate = (iso, lang = 'uz') => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const SOURCE_ICON = {
  'walk-in': '🚶',
  phone: '📞',
  bot: '🤖',
};

const STATUS_META = {
  pending: { label: 'Kutilmoqda', color: '#F0B84C', bg: 'rgba(240, 184, 76, 0.16)' },
  confirmed: { label: 'Tasdiqlangan', color: '#5B9DF9', bg: 'rgba(91, 157, 249, 0.16)' },
  completed: { label: 'Yakunlangan', color: '#3DDC97', bg: 'rgba(61, 220, 151, 0.16)' },
  rejected: { label: 'Rad etilgan', color: '#F2685C', bg: 'rgba(242, 104, 92, 0.16)' },
  cancelled: { label: 'Bekor qilingan', color: '#64646D', bg: 'rgba(100, 100, 109, 0.16)' },
  'no-show': { label: 'Kelmadi', color: '#F2685C', bg: 'rgba(242, 104, 92, 0.16)' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: status,
    color: '#64646D',
    bg: 'rgba(100, 100, 109, 0.16)',
  };

  return (
    <View style={[styles.statusBadgeWrap, { backgroundColor: meta.bg }]}>
      <View style={[styles.statusBadgeDot, { backgroundColor: meta.color }]} />
      <Text style={[styles.statusBadgeLabel, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function StatCard({ label, value, icon, accent = false }) {
  return (
    <View style={[styles.statCardContainer, accent && styles.statCardAccent]}>
      <View style={styles.statCardTop}>
        <Text style={[styles.statCardLabel, accent && { color: COLORS.accent }]}>{label}</Text>
        {icon ? <Text style={styles.statCardIcon}>{icon}</Text> : null}
      </View>
      <Text style={[styles.statCardValue, accent && { color: COLORS.accent }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

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
    changeLanguage,
  } = useAppContext();

  // Primary Bottom Nav Tab: 'today' | 'bookings' | 'clients' | 'manage'
  const [navTab, setNavTab] = useState('today');

  // Active Shop
  const activeShop = adminData?.currentShop || adminData?.shops?.[0] || null;
  const hasMultipleShops = (adminData?.shops || []).length > 1;

  // General Loading & Refresh
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [isSwitchingShop, setIsSwitchingShop] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. DASHBOARD / STATS DATA
  // ---------------------------------------------------------------------------
  const [statsToday, setStatsToday] = useState(null);
  const [statsMonth, setStatsMonth] = useState(null);
  const [statsOverview, setStatsOverview] = useState(null);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [shopDetails, setShopDetails] = useState(null);

  // ---------------------------------------------------------------------------
  // 2. APPOINTMENTS TAB DATA
  // ---------------------------------------------------------------------------
  const [appointmentFilter, setAppointmentFilter] = useState(''); // '' = all, 'pending', 'confirmed', etc.
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [appointmentSearch, setAppointmentSearch] = useState('');

  // ---------------------------------------------------------------------------
  // 3. CUSTOMERS TAB DATA
  // ---------------------------------------------------------------------------
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [customerNotesDraft, setCustomerNotesDraft] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // ---------------------------------------------------------------------------
  // 4. MANAGE SUB-PAGES / MODALS
  // ---------------------------------------------------------------------------
  const [manageSubPage, setManageSubPage] = useState(null); // null | 'services' | 'staff' | 'statistics' | 'settings'

  // Modals
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(() => new Date());
  const [rescheduleHour, setRescheduleHour] = useState(null);
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Cancel & Note Modals
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('');
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);

  // Service Create/Edit Modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({ nameEn: '', nameUz: '', nameRu: '', price: '', duration: '30' });
  const [isSavingService, setIsSavingService] = useState(false);

  // Staff Create/Edit Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffForm, setStaffForm] = useState({ name: '', title: '' });
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Settings Edit State
  const [settingsForm, setSettingsForm] = useState({ name: '', phone: '', capacity: '2', address: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Manual Booking Form State
  const [bookingSource, setBookingSource] = useState('walk-in');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => new Date());
  const [bookingHour, setBookingHour] = useState(null);
  const [bookingNote, setBookingNote] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const socketRef = useRef(null);

  // Re-verify admin privileges if not loaded yet
  useEffect(() => {
    if (!adminData && mobileToken) {
      checkAdminStatus();
    }
  }, [adminData, mobileToken, checkAdminStatus]);

  // Load all admin data
  const loadAdminData = useCallback(async (isSilent = false) => {
    if (!adminData?.adminToken) return;
    try {
      if (!isSilent) setIsLoading(true);

      const headers = { Authorization: `Bearer ${adminData.adminToken}` };

      const [todayRes, monthRes, overviewRes, shopRes, apptsRes, custRes] = await Promise.all([
        fetch(`${backEndUrl}/api/admin/stats/today`, { headers }).catch(() => null),
        fetch(`${backEndUrl}/api/admin/stats/month`, { headers }).catch(() => null),
        fetch(`${backEndUrl}/api/admin/stats/overview`, { headers }).catch(() => null),
        fetch(`${backEndUrl}/api/admin/shop`, { headers }).catch(() => null),
        fetch(`${backEndUrl}/api/admin/appointments?limit=60`, { headers }).catch(() => null),
        fetch(`${backEndUrl}/api/admin/customers`, { headers }).catch(() => null),
      ]);

      if (todayRes?.ok) setStatsToday(await todayRes.json());
      if (monthRes?.ok) setStatsMonth(await monthRes.json());
      if (overviewRes?.ok) setStatsOverview(await overviewRes.json());
      if (shopRes?.ok) {
        const sData = await shopRes.json();
        setShopDetails(sData);
        setSettingsForm({
          name: resolveText(sData.name, 'uz') || '',
          phone: sData.phone || '',
          capacity: String(sData.capacity || '2'),
          address: resolveText(sData.address, 'uz') || '',
        });
        if (!selectedServiceId && sData?.services?.length > 0) {
          const activeS = sData.services.find((s) => s.isActive !== false);
          if (activeS) setSelectedServiceId(activeS._id);
        }
      }
      if (apptsRes?.ok) {
        const aData = await apptsRes.json();
        const list = Array.isArray(aData.appointments) ? aData.appointments : [];
        setAppointmentsList(list);
        setRecentAppointments(list.slice(0, 6));
      }
      if (custRes?.ok) {
        const cData = await custRes.json();
        setCustomersList(Array.isArray(cData.customers) ? cData.customers : []);
      }
    } catch (err) {
      console.warn('Error loading admin data:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [adminData?.adminToken, backEndUrl, selectedServiceId]);

  useEffect(() => {
    if (adminData?.adminToken) {
      loadAdminData();
    }
  }, [adminData?.adminToken, loadAdminData]);

  // Real-time socket sync
  useEffect(() => {
    if (!adminData?.adminToken) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(backEndUrl, {
      transports: ['websocket'],
      auth: { token: adminData.adminToken },
    });

    socket.on('appointment:update', (updated) => {
      if (!updated?._id) return;

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      setAppointmentsList((prev) => {
        const idx = prev.findIndex((a) => String(a._id) === String(updated._id));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        }
        return [updated, ...prev];
      });

      setRecentAppointments((prev) => {
        const idx = prev.findIndex((a) => String(a._id) === String(updated._id));
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        }
        return [updated, ...prev.slice(0, 5)];
      });

      // Quietly refresh stats
      fetch(`${backEndUrl}/api/admin/stats/today`, {
        headers: { Authorization: `Bearer ${adminData.adminToken}` },
      })
        .then((r) => r.json())
        .then(setStatsToday)
        .catch(() => {});

      showToast?.(`${updated.userName || 'Client'}: ${String(updated.status).toUpperCase()}`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [adminData?.adminToken, backEndUrl, showToast]);

  const handleSelectShop = async (shopId) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setShowShopPicker(false);
    setIsSwitchingShop(true);
    await switchAdminShop(shopId);
    setIsSwitchingShop(false);
    loadAdminData();
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

  // Toggle Shop Operational Status
  const handleToggleOperational = async (val) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setShopDetails((prev) => (prev ? { ...prev, isOperational: val } : prev));
    try {
      const res = await fetch(`${backEndUrl}/api/admin/shop`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ isOperational: val }),
      });
      if (res.ok) {
        showToast?.(val ? 'Salon qabuli yoqildi (Open)' : 'Salon qabuli to\'xtatildi (Paused)');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    }
  };

  // Status Action Handlers
  const handleConfirmAppointment = async (id) => {
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
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentConfirmed', 'Appointment confirmed!'));
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleCompleteAppointment = async (id) => {
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
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentCompleted', 'Appointment marked completed!'));
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setActioningId(null);
    }
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
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(rejectTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentDeclined', 'Appointment declined'));
        setRejectTarget(null);
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingAction(false);
    }
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
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(rescheduleTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.(t('AppointmentRescheduled', 'Appointment rescheduled!'));
        setRescheduleTarget(null);
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Submit Manual Walk-in / Phone Booking
  const handleSubmitNewBooking = async () => {
    if (!clientName.trim() || !clientPhone.trim() || bookingHour === null) {
      Alert.alert(t('Error', 'Error'), 'Please fill in client name, phone and select time slot.');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const reqDate = new Date(bookingDate);
      reqDate.setHours(bookingHour, 0, 0, 0);

      const payload = {
        name: clientName.trim(),
        number: clientPhone.trim(),
        serviceId: selectedServiceId || undefined,
        staffId: selectedStaffId || undefined,
        requestedTime: reqDate.toISOString(),
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
        setAppointmentsList((prev) => [newBooking, ...prev]);
        showToast?.(t('AppointmentCreated', 'Appointment created successfully!'));
        setShowNewBookingModal(false);
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

  // Customer Notes Save
  const handleSaveCustomerNotes = async () => {
    if (!selectedCustomerDetail) return;
    setIsSavingNotes(true);
    try {
      const res = await fetch(
        `${backEndUrl}/api/admin/customers/${selectedCustomerDetail.telegramId}/notes`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminData.adminToken}`,
          },
          body: JSON.stringify({ note: customerNotesDraft.trim() }),
        }
      );
      if (res.ok) {
        showToast?.('Customer notes saved');
        setSelectedCustomerDetail((prev) => (prev ? { ...prev, notes: customerNotesDraft.trim() } : prev));
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Customer Block Toggle
  const handleToggleCustomerBlock = async (c) => {
    try {
      const res = await fetch(`${backEndUrl}/api/admin/customers/${c.telegramId}/block`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ isBlocked: !c.isBlocked }),
      });
      if (res.ok) {
        const nextState = !c.isBlocked;
        setCustomersList((prev) =>
          prev.map((item) => (item.telegramId === c.telegramId ? { ...item, isBlocked: nextState } : item))
        );
        setSelectedCustomerDetail((prev) => (prev ? { ...prev, isBlocked: nextState } : prev));
        showToast?.(nextState ? 'Customer blocked' : 'Customer unblocked');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    }
  };

  // Service Toggle Active
  const handleToggleServiceActive = async (s) => {
    try {
      const nextActive = !(s.isActive !== false);
      const res = await fetch(`${backEndUrl}/api/admin/shop/services/${s._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.ok) {
        const updatedServices = await res.json();
        setShopDetails((prev) => (prev ? { ...prev, services: updatedServices } : prev));
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    }
  };

  // Service CRUD
  const handleOpenCreateService = () => {
    setEditingService(null);
    setServiceForm({ nameUz: '', nameRu: '', nameEn: '', price: '', duration: '30' });
    setServiceModalOpen(true);
  };

  const handleOpenEditService = (serv) => {
    setEditingService(serv);
    setServiceForm({
      nameUz: typeof serv.name === 'object' ? serv.name.uz || '' : serv.name || '',
      nameRu: typeof serv.name === 'object' ? serv.name.ru || '' : serv.name || '',
      nameEn: typeof serv.name === 'object' ? serv.name.en || '' : serv.name || '',
      price: String(serv.price || ''),
      duration: String(serv.durationMinutes || '30'),
    });
    setServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.nameUz.trim() || !serviceForm.price.trim() || !serviceForm.duration.trim()) {
      Alert.alert(t('Error', 'Error'), 'Iltimos, xizmat nomi, narxi va davomiyligini kiriting.');
      return;
    }
    setIsSavingService(true);
    try {
      const payload = {
        name: {
          uz: serviceForm.nameUz.trim(),
          ru: serviceForm.nameRu.trim() || serviceForm.nameUz.trim(),
          en: serviceForm.nameEn.trim() || serviceForm.nameUz.trim(),
        },
        price: Number(serviceForm.price),
        durationMinutes: Number(serviceForm.duration),
      };

      const url = editingService
        ? `${backEndUrl}/api/admin/shop/services/${editingService._id}`
        : `${backEndUrl}/api/admin/shop/services`;
      const method = editingService ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedServices = await res.json();
        setShopDetails((prev) => (prev ? { ...prev, services: updatedServices } : prev));
        showToast?.(editingService ? 'Xizmat yangilandi' : 'Yangi xizmat qo\'shildi');
        setServiceModalOpen(false);
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Xizmatni saqlashda xatolik');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = (serv) => {
    Alert.alert(
      'Xizmatni o\'chirish',
      `"${resolveText(serv.name, lang)}" xizmatini o'chirmoqchimisiz?`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'O\'chirish',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${backEndUrl}/api/admin/shop/services/${serv._id}?force=true`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminData.adminToken}` },
              });
              if (res.ok) {
                const updatedServices = await res.json();
                setShopDetails((prev) => (prev ? { ...prev, services: updatedServices } : prev));
                showToast?.('Xizmat o\'chirildi');
              } else {
                const err = await res.json();
                Alert.alert(t('Error', 'Error'), err.message || 'Xizmatni o\'chirishda xatolik');
              }
            } catch (err) {
              Alert.alert(t('Error', 'Error'), err.message);
            }
          },
        },
      ]
    );
  };

  // Staff Toggle Available Now
  const handleToggleStaffAvailable = async (st) => {
    try {
      const nextAvailable = !(st.isAvailableNow !== false);
      const res = await fetch(`${backEndUrl}/api/admin/shop/staff/${st._id}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ isAvailableNow: nextAvailable }),
      });
      if (res.ok) {
        const updatedStaff = await res.json();
        setShopDetails((prev) => (prev ? { ...prev, staff: updatedStaff } : prev));
        showToast?.(nextAvailable ? `${st.name} is available now` : `${st.name} marked unavailable`);
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    }
  };

  // Staff CRUD
  const handleOpenCreateStaff = () => {
    setEditingStaff(null);
    setStaffForm({ name: '', title: '' });
    setStaffModalOpen(true);
  };

  const handleOpenEditStaff = (st) => {
    setEditingStaff(st);
    setStaffForm({ name: st.name || '', title: st.title || '' });
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name.trim()) {
      Alert.alert(t('Error', 'Error'), 'Iltimos, usta ismini kiriting.');
      return;
    }
    setIsSavingStaff(true);
    try {
      const payload = {
        name: staffForm.name.trim(),
        title: staffForm.title.trim(),
      };

      const url = editingStaff
        ? `${backEndUrl}/api/admin/shop/staff/${editingStaff._id}`
        : `${backEndUrl}/api/admin/shop/staff`;
      const method = editingStaff ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedStaff = await res.json();
        setShopDetails((prev) => (prev ? { ...prev, staff: updatedStaff } : prev));
        showToast?.(editingStaff ? 'Usta ma\'lumotlari yangilandi' : 'Yangi usta qo\'shildi');
        setStaffModalOpen(false);
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Usta ma\'lumotlarini saqlashda xatolik');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeleteStaff = (st) => {
    Alert.alert(
      'Ustani o\'chirish',
      `"${st.name}" ustani o'chirmoqchimisiz?`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'O\'chirish',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${backEndUrl}/api/admin/shop/staff/${st._id}?force=true`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminData.adminToken}` },
              });
              if (res.ok) {
                const updatedStaff = await res.json();
                setShopDetails((prev) => (prev ? { ...prev, staff: updatedStaff } : prev));
                showToast?.('Usta o\'chirildi');
              } else {
                const err = await res.json();
                Alert.alert(t('Error', 'Error'), err.message || 'Ustani o\'chirishda xatolik');
              }
            } catch (err) {
              Alert.alert(t('Error', 'Error'), err.message);
            }
          },
        },
      ]
    );
  };

  // Shop Settings Save
  const handleSaveShopSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = {
        name: typeof shopDetails?.name === 'object'
          ? { ...shopDetails.name, uz: settingsForm.name || shopDetails.name.uz }
          : settingsForm.name,
        phone: settingsForm.phone.trim(),
        capacity: Number(settingsForm.capacity) || 2,
        address: typeof shopDetails?.address === 'object'
          ? { ...shopDetails.address, uz: settingsForm.address || shopDetails.address.uz }
          : settingsForm.address,
      };

      const res = await fetch(`${backEndUrl}/api/admin/shop`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updatedShop = await res.json();
        setShopDetails(updatedShop);
        showToast?.('Salon sozlamalari muvaffaqiyatli saqlandi');
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Sozlamalarni saqlashda xatolik');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Cancel Appointment
  const submitCancel = async () => {
    if (!cancelTarget?._id) return;
    setIsSavingAction(true);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${cancelTarget._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ reason: cancelReason?.trim() || undefined }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(cancelTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.('Bandlov bekor qilindi.');
        setCancelTarget(null);
        setCancelReason('');
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Xatolik yuz berdi');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingAction(false);
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async (id) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setActioningId(id);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${id}/no-show`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(id) ? { ...a, ...updated } : a))
        );
        showToast?.('Kelmadi deb belgilandi');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setActioningId(null);
    }
  };

  // Booking Note Save
  const handleSaveBookingNote = async () => {
    if (!noteTarget?._id) return;
    setIsSavingNote(true);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/appointments/${noteTarget._id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminData.adminToken}`,
        },
        body: JSON.stringify({ note: noteDraft.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointmentsList((prev) =>
          prev.map((a) => (String(a._id) === String(noteTarget._id) ? { ...a, ...updated } : a))
        );
        showToast?.('Izoh saqlandi');
        setNoteTarget(null);
        setNoteDraft('');
      } else {
        const err = await res.json();
        Alert.alert(t('Error', 'Error'), err.message || 'Izohni saqlashda xatolik');
      }
    } catch (err) {
      Alert.alert(t('Error', 'Error'), err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Customer Detail Open with full data fetch
  const handleOpenCustomerDetail = async (c) => {
    setSelectedCustomerDetail(c);
    setCustomerNotesDraft(c.notes || '');
    setCustomerDetailLoading(true);
    try {
      const res = await fetch(`${backEndUrl}/api/admin/customers/${c.telegramId}`, {
        headers: { Authorization: `Bearer ${adminData.adminToken}` },
      });
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedCustomerDetail(fullDetail);
        setCustomerNotesDraft(fullDetail.notes || '');
      }
    } catch {
      // fallback to existing data
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    let list = appointmentsList;
    if (appointmentFilter) {
      list = list.filter((a) => a.status === appointmentFilter);
    }
    if (selectedStaffFilter) {
      list = list.filter((a) => String(a.staffId) === String(selectedStaffFilter));
    }
    if (appointmentSearch.trim()) {
      const q = appointmentSearch.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.userName || '').toLowerCase().includes(q) ||
          (a.userNumber || '').includes(q) ||
          (a.serviceName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointmentsList, appointmentFilter, selectedStaffFilter, appointmentSearch]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList;
    const q = customerSearch.trim().toLowerCase();
    return customersList.filter(
      (c) => (c.userName || '').toLowerCase().includes(q) || (c.userNumber || '').includes(q)
    );
  }, [customersList, customerSearch]);

  // Dates & hours for booking picker
  const availableDates = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

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

  useEffect(() => {
    if (!rescheduleTarget) return;
    const requested = new Date(rescheduleTarget.requestedTime);
    setRescheduleDate(!isNaN(requested.getTime()) ? requested : new Date());
    setRescheduleHour(!isNaN(requested.getTime()) ? requested.getHours() : null);
  }, [rescheduleTarget]);

  const rescheduleDates = useMemo(() => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const rescheduleHours = useMemo(() => {
    const now = new Date();
    const isToday = rescheduleDate?.toDateString() === now.toDateString();
    const startHour = isToday ? now.getHours() + 1 : 8;
    const hours = [];
    for (let h = Math.max(startHour, 8); h <= 22; h++) {
      hours.push(h);
    }
    return hours;
  }, [rescheduleDate]);

  const pendingAppointmentsCount = useMemo(() => {
    return appointmentsList.filter((a) => a.status === 'pending').length;
  }, [appointmentsList]);

  const revenueByService = useMemo(
    () => [...(statsOverview?.topServices || [])].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)),
    [statsOverview]
  );

  // If unauthorized fallback
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
            <Text style={styles.returnBtnText}>{t('ReturnToApp', 'Return to Login')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // TAB 1: TODAY / DASHBOARD VIEW
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // TAB 1: TODAY / DASHBOARD VIEW (Exact Web Dashboard.jsx Replica)
  // ---------------------------------------------------------------------------
  const renderDashboardTab = () => {
    const shopName = resolveText(activeShop?.name, lang) || 'Barbershop';
    const isOperational = shopDetails?.isOperational !== false;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadAdminData(true);
            }}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Shop Greeting Banner matching Dashboard.jsx */}
        <View style={styles.dashboardHeroHeader}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.greetingTitle}>Xush kelibsiz 👋</Text>
            <Text style={styles.greetingSub} numberOfLines={2}>
              <Text style={{ color: COLORS.text, fontFamily: FONTS.semiBold }}>{shopName}</Text> bu oyda qanday ishlayotgani.
            </Text>
          </View>

          {/* Quick Operational Toggle */}
          <View style={styles.operationalWrap}>
            <Text style={[styles.operationalLabel, { color: isOperational ? COLORS.success : COLORS.danger }]}>
              {isOperational ? 'Ochiq' : 'Yopiq'}
            </Text>
            <Switch
              value={isOperational}
              onValueChange={handleToggleOperational}
              trackColor={{ false: '#3F3F46', true: COLORS.accent }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* Section 1: TODAY STATS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Bugun</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard label="UCHRASHUVLAR" value={statsToday?.appointments ?? 0} icon="📅" />
          <StatCard
            label="KUTILMOQDA"
            value={pendingAppointmentsCount}
            icon="⏳"
            accent={pendingAppointmentsCount > 0}
          />
          <StatCard label="DAROMAD" value={currency(statsToday?.revenue ?? 0)} icon="💰" />
          <StatCard
            label="KELMADI"
            value={statsToday?.noShows ?? 0}
            icon="🚫"
            accent={(statsToday?.noShows || 0) > 0}
          />
        </View>

        {/* Section 2: THIS MONTH STATS */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Bu oy</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard label="DAROMAD" value={currency(statsMonth?.revenue ?? 0)} icon="💰" />
          <StatCard label="O'RTACHA CHEK" value={currency(statsMonth?.averageTicket ?? 0)} icon="🧾" />
          <StatCard label="YANGI MIJOZLAR" value={statsMonth?.newCustomers ?? 0} icon="✨" />
          <StatCard
            label="REYTING"
            value={Number(shopDetails?.rating || 0).toFixed(1)}
            icon="⭐"
            accent={true}
          />
        </View>

        {/* Section 3: REVENUE BY SERVICE (30d) - Exact match to Dashboard.jsx */}
        {revenueByService.length > 0 && (
          <View style={styles.webCard}>
            <View style={styles.webCardHeader}>
              <Text style={styles.webCardHeaderTitle}>Xizmatlar bo'yicha daromad (30k)</Text>
            </View>
            <View style={styles.webCardBody}>
              {revenueByService.map((s, i) => (
                <View
                  key={s.serviceId || s.serviceName || i}
                  style={[styles.revenueRow, i === revenueByService.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={styles.revenueRankText}>{i + 1}</Text>
                  <Text style={styles.revenueServiceName} numberOfLines={1}>
                    {s.serviceName || 'Xizmat'}
                  </Text>
                  <View style={styles.revenueCountPill}>
                    <Text style={styles.revenueCountPillText}>{s.count} ta bandlov</Text>
                  </View>
                  <Text style={styles.revenueAmountText}>{currency(s.revenue)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Section 4: RECENT ACTIVITY - Exact match to Dashboard.jsx */}
        <View style={[styles.webCard, { marginTop: 20 }]}>
          <View style={[styles.webCardHeader, { justifyContent: 'space-between' }]}>
            <Text style={styles.webCardHeaderTitle}>So'nggi faoliyat</Text>
            <Pressable onPress={() => setNavTab('bookings')} hitSlop={8}>
              <Text style={styles.viewAllLinkText}>Barchasi →</Text>
            </Pressable>
          </View>
          <View style={styles.webCardBody}>
            {recentAppointments.length === 0 ? (
              <View style={styles.emptyRecentBox}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
                <Text style={styles.emptyRecentTitle}>Hali uchrashuvlar yo'q</Text>
                <Text style={styles.emptyRecentSub}>
                  Telegram'dan kelgan yangi band qilishlar shu yerda real vaqtda ko'rinadi.
                </Text>
              </View>
            ) : (
              recentAppointments.map((appt, i) => (
                <View
                  key={appt._id}
                  style={[
                    styles.recentRowItem,
                    i === recentAppointments.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.userAvatarCircle}>
                    <Text style={styles.userAvatarInitial}>
                      {(appt.userName || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.recentRowName} numberOfLines={1}>
                      {appt.userName || 'Mijoz'}
                    </Text>
                    <Text style={styles.recentRowSub} numberOfLines={1}>
                      {appt.serviceName || 'Xizmat'}
                      {appt.staffName ? ` · ${appt.staffName}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.recentRowTime}>
                    {new Date(appt.requestedTime).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <StatusBadge status={appt.status} />
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // ---------------------------------------------------------------------------
  // TAB 2: APPOINTMENTS VIEW (Exact Web Appointments.jsx Replica)
  // ---------------------------------------------------------------------------
  const renderAppointmentsTab = () => {
    return (
      <View style={{ flex: 1 }}>
        {/* Header & New Booking Action */}
        <View style={styles.appointmentsTopBar}>
          <Text style={styles.screenMainTitle}>Uchrashuvlar</Text>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setClientName('');
              setClientPhone('');
              setBookingNote('');
              setBookingDate(new Date());
              const now = new Date();
              setBookingHour(Math.max(8, Math.min(22, now.getHours() + 1)));
              setShowNewBookingModal(true);
            }}
            style={styles.newBookingBtnPrimary}
            hitSlop={8}
          >
            <Ionicons name="add" size={16} color="#0A0A0C" style={{ marginRight: 4 }} />
            <Text style={styles.newBookingBtnPrimaryText}>Yangi bandlov</Text>
          </Pressable>
        </View>

        {/* Status Filter Tabs matching web */}
        <View style={styles.filterTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {[
              { key: '', label: 'Barchasi' },
              { key: 'pending', label: 'Kutilmoqda', count: pendingAppointmentsCount },
              { key: 'confirmed', label: 'Tasdiqlangan' },
              { key: 'completed', label: 'Yakunlangan' },
              { key: 'rejected', label: 'Rad etilgan' },
              { key: 'cancelled', label: 'Bekor qilingan' },
              { key: 'no-show', label: 'Kelmadi' },
            ].map((tab) => {
              const isSelected = appointmentFilter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    setAppointmentFilter(tab.key);
                  }}
                  style={[styles.filterTabPill, isSelected && styles.filterTabPillActive]}
                >
                  <Text
                    style={[
                      styles.filterTabPillText,
                      isSelected && styles.filterTabPillTextActive,
                      tab.key === 'pending' && pendingAppointmentsCount > 0 && !isSelected && { color: COLORS.warning },
                    ]}
                  >
                    {tab.label}
                    {tab.count > 0 ? ` (${tab.count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search & Staff Filter Bar */}
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchBarInner}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              value={appointmentSearch}
              onChangeText={setAppointmentSearch}
              placeholder="Ism yoki telefon bo'yicha qidirish..."
              placeholderTextColor={COLORS.textFaint}
              style={styles.searchInputField}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Barber filter chip */}
          {(shopDetails?.staff || []).length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <Pressable
                onPress={() => setSelectedStaffFilter('')}
                style={[styles.staffFilterChip, !selectedStaffFilter && styles.staffFilterChipActive]}
              >
                <Text style={[styles.staffFilterChipText, !selectedStaffFilter && styles.staffFilterChipTextActive]}>
                  Barcha xodimlar
                </Text>
              </Pressable>
              {(shopDetails?.staff || []).map((s) => {
                const isSelected = selectedStaffFilter === s._id;
                return (
                  <Pressable
                    key={s._id}
                    onPress={() => setSelectedStaffFilter(isSelected ? '' : s._id)}
                    style={[styles.staffFilterChip, isSelected && styles.staffFilterChipActive]}
                  >
                    <Text style={[styles.staffFilterChipText, isSelected && styles.staffFilterChipTextActive]}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Appointments List */}
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={[styles.listContent, filteredAppointments.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadAdminData(true);
              }}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📭</Text>
              <Text style={styles.emptyTitle}>Bu yerda uchrashuvlar yo'q</Text>
              <Text style={styles.emptySub}>Boshqa filtrni sinab ko'ring yoki yangi bandlov qo'shing.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isActioning = actioningId === item._id;
            const isPending = item.status === 'pending';
            const isConfirmed = item.status === 'confirmed';
            const isCompleted = item.status === 'completed';
            const reqDate = new Date(item.requestedTime);
            const sourceIcon = SOURCE_ICON[item.source] || '🤖';

            return (
              <View style={styles.webAppointmentCard}>
                {/* Top Row: User Avatar, Name, Phone & StatusBadge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.userAvatarCircle}>
                    <Text style={styles.userAvatarInitial}>{(item.userName || '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.cardUserName} numberOfLines={1}>
                        {item.userName || 'Mijoz'}
                      </Text>
                      {item.userNumber ? (
                        <Text style={styles.cardUserNumber}> · {item.userNumber}</Text>
                      ) : null}
                      <Text style={{ fontSize: 13, marginLeft: 4 }}>{sourceIcon}</Text>
                    </View>
                    <Text style={styles.cardServiceLine} numberOfLines={1}>
                      {item.serviceName || 'Xizmat'}
                      {item.staffName ? ` · ${item.staffName}` : ''}
                      {item.price ? ` · ${currency(item.price)}` : ''}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {/* Requested Time & Admin Notes */}
                <View style={styles.cardMetaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.cardTimeText}>
                      {reqDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}, {pad(reqDate.getHours())}:00 - {pad(reqDate.getHours() + 1)}:00
                    </Text>
                  </View>
                  {item.userNumber ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${item.userNumber}`)}
                      style={styles.cardPhoneCallBtn}
                      hitSlop={6}
                    >
                      <Ionicons name="call" size={12} color={COLORS.accent} style={{ marginRight: 4 }} />
                      <Text style={styles.cardPhoneCallText}>Qo'ng'iroq</Text>
                    </Pressable>
                  ) : null}
                </View>

                {item.adminNotes ? (
                  <View style={styles.cardNotesBadge}>
                    <Text style={styles.cardNotesText}>📝 {item.adminNotes}</Text>
                  </View>
                ) : null}

                {/* Action Buttons styled like web ui.jsx */}
                <View style={styles.cardActionButtonsRow}>
                  {isPending && (
                    <>
                      <Pressable
                        onPress={() => handleConfirmAppointment(item._id)}
                        disabled={isActioning}
                        style={[styles.webBtn, styles.webBtnPrimary]}
                      >
                        {isActioning ? (
                          <ActivityIndicator size="small" color="#0A0A0C" />
                        ) : (
                          <Text style={styles.webBtnPrimaryText}>Tasdiqlash</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRejectTarget(item);
                          setRejectReason('');
                        }}
                        disabled={isActioning}
                        style={[styles.webBtn, styles.webBtnDanger]}
                      >
                        <Text style={styles.webBtnDangerText}>Rad etish</Text>
                      </Pressable>
                    </>
                  )}

                  {isConfirmed && (
                    <>
                      <Pressable
                        onPress={() => handleCompleteAppointment(item._id)}
                        disabled={isActioning}
                        style={[styles.webBtn, styles.webBtnSubtle]}
                      >
                        {isActioning ? (
                          <ActivityIndicator size="small" color={COLORS.text} />
                        ) : (
                          <Text style={styles.webBtnSubtleText}>Yakunlash</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setCancelTarget(item);
                          setCancelReason('');
                        }}
                        disabled={isActioning}
                        style={[styles.webBtn, styles.webBtnGhost]}
                      >
                        <Text style={styles.webBtnGhostText}>Bekor qilish</Text>
                      </Pressable>
                    </>
                  )}

                  {(isPending || isConfirmed) && (
                    <Pressable
                      onPress={() => {
                        setRescheduleTarget(item);
                        const rDate = new Date(item.requestedTime);
                        setRescheduleDate(rDate);
                        setRescheduleHour(rDate.getHours());
                      }}
                      disabled={isActioning}
                      style={[styles.webBtn, styles.webBtnGhost]}
                    >
                      <Text style={styles.webBtnGhostText}>Vaqtni o'zgartirish</Text>
                    </Pressable>
                  )}

                  {(isConfirmed || isCompleted) && (
                    <Pressable
                      onPress={() => handleMarkNoShow(item._id)}
                      disabled={isActioning}
                      style={[styles.webBtn, styles.webBtnGhost]}
                    >
                      <Text style={styles.webBtnGhostText}>Kelmadi</Text>
                    </Pressable>
                  )}

                  {/* Note button */}
                  <Pressable
                    onPress={() => {
                      setNoteTarget(item);
                      setNoteDraft(item.adminNotes || '');
                    }}
                    style={styles.webBtnIconGhost}
                    hitSlop={6}
                  >
                    <Text style={{ fontSize: 13 }}>📝</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // TAB 3: CLIENTS / CUSTOMERS CRM VIEW (Exact Web Customers.jsx Replica)
  // ---------------------------------------------------------------------------
  const renderCustomersTab = () => {
    return (
      <View style={{ flex: 1 }}>
        {/* Top Header */}
        <View style={styles.appointmentsTopBar}>
          <View>
            <Text style={styles.screenMainTitle}>Mijozlar</Text>
            <Text style={styles.dashboardHeroSub}>Mijozlar bazasi va ularning tashriflar tarixi</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBarWrap, { marginHorizontal: 16, marginTop: 12 }]}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder="Mijozlar bo'yicha qidiruv..."
            placeholderTextColor={COLORS.textFaint}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {customerSearch.length > 0 && (
            <Pressable onPress={() => setCustomerSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>

        {/* CRM Stats Summary Bar */}
        <View style={[styles.crmStatsBar, { marginHorizontal: 16 }]}>
          <Text style={styles.crmStatsText}>
            Jami mijozlar: <Text style={{ color: COLORS.accent, fontFamily: FONTS.bold }}>{filteredCustomers.length}</Text>
          </Text>
        </View>

        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => String(item.telegramId || item._id)}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: 16, paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyRecentBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
              <Text style={styles.emptyRecentTitle}>Mijozlar topilmadi</Text>
              <Text style={styles.emptyRecentSub}>Qidiruv bo'yicha hech qanday mijoz chiqmadi</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isVip = (item.visitCount || 0) >= 3;
            const favServices = Array.isArray(item.favoriteServices) && item.favoriteServices.length > 0
              ? item.favoriteServices.join(', ')
              : null;

            return (
              <Pressable
                onPress={() => handleOpenCustomerDetail(item)}
                style={styles.customerCard}
              >
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>{(item.userName || '?').slice(0, 1).toUpperCase()}</Text>
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.clientName}>{item.userName || 'Mijoz'}</Text>
                    {isVip && (
                      <View style={styles.vipBadge}>
                        <Text style={styles.vipBadgeText}>VIP</Text>
                      </View>
                    )}
                    {item.isBlocked && (
                      <View style={[styles.vipBadge, { backgroundColor: 'rgba(242, 104, 92, 0.15)' }]}>
                        <Text style={[styles.vipBadgeText, { color: COLORS.danger }]}>Bloklangan</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.clientPhone}>{item.userNumber || 'Raqam kiritilmagan'}</Text>

                  {favServices ? (
                    <Text style={[styles.customerMetaText, { color: COLORS.textMuted }]} numberOfLines={1}>
                      ⭐ {favServices}
                    </Text>
                  ) : null}

                  <Text style={styles.customerMetaText}>
                    {item.visitCount || 0} ta tashrif • Jami: <Text style={{ color: COLORS.accent, fontFamily: FONTS.semiBold }}>{currency(item.totalSpent || 0)}</Text>
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {item.userNumber ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Linking.openURL(`tel:${item.userNumber}`);
                      }}
                      style={styles.cardPhoneCallBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="call" size={13} color={COLORS.accent} />
                    </Pressable>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // TAB 4: MANAGE HUB VIEW
  // ---------------------------------------------------------------------------
  const renderManageTab = () => {
    const shopName = resolveText(activeShop?.name, lang) || 'Barbershop';
    const isOperational = shopDetails?.isOperational !== false;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Shop Card */}
        <View style={styles.manageShopCard}>
          <View style={styles.shopAvatarCircle}>
            <Text style={styles.shopAvatarInitial}>{shopName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.manageShopTitle}>{shopName}</Text>
            <Text style={styles.manageShopSub}>
              {shopDetails?.address ? resolveText(shopDetails.address, lang) : 'Manzil belgilanmagan'}
            </Text>
          </View>
          {hasMultipleShops && (
            <Pressable onPress={() => setShowShopPicker(true)} style={styles.switchShopPill}>
              <Text style={styles.switchShopPillText}>Almashtirish</Text>
            </Pressable>
          )}
        </View>

        {/* Operational Setting Switch */}
        <View style={styles.manageMenuRow}>
          <View style={styles.manageMenuLeft}>
            <Ionicons name="power" size={22} color={isOperational ? COLORS.success : COLORS.danger} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.manageMenuTitle}>Qabul holati</Text>
              <Text style={styles.manageMenuDesc}>
                {isOperational ? 'Mijozlar bandlov qilishi mumkin' : 'Qabul vaqtincha to\'xtatilgan'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOperational}
            onValueChange={handleToggleOperational}
            trackColor={{ false: '#3F3F46', true: COLORS.accent }}
          />
        </View>

        {/* Core Management Items */}
        <Text style={[styles.sectionHeading, { marginTop: 20 }]}>SOZLAMALAR VA NAZORAT</Text>
        <View style={styles.manageMenuCard}>
          {/* Services */}
          <Pressable
            onPress={() => setManageSubPage('services')}
            style={[styles.manageMenuItem, styles.rowBorder]}
          >
            <View style={styles.manageMenuLeft}>
              <Ionicons name="cut-outline" size={22} color={COLORS.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Xizmatlar katalogi</Text>
                <Text style={styles.manageMenuDesc}>{(shopDetails?.services || []).length} ta xizmat mavjud</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
          </Pressable>

          {/* Staff */}
          <Pressable
            onPress={() => setManageSubPage('staff')}
            style={[styles.manageMenuItem, styles.rowBorder]}
          >
            <View style={styles.manageMenuLeft}>
              <Ionicons name="people-outline" size={22} color={COLORS.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Sartaroshlar & Ustalar</Text>
                <Text style={styles.manageMenuDesc}>{(shopDetails?.staff || []).length} ta xodim biriktirilgan</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
          </Pressable>

          {/* Statistics */}
          <Pressable
            onPress={() => setManageSubPage('statistics')}
            style={[styles.manageMenuItem, styles.rowBorder]}
          >
            <View style={styles.manageMenuLeft}>
              <Ionicons name="bar-chart-outline" size={22} color={COLORS.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Statistika & Tahlil</Text>
                <Text style={styles.manageMenuDesc}>Oylik va umumiy daromadlar tahlili</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
          </Pressable>

          {/* Settings */}
          <Pressable
            onPress={() => setManageSubPage('settings')}
            style={styles.manageMenuItem}
          >
            <View style={styles.manageMenuLeft}>
              <Ionicons name="settings-outline" size={22} color={COLORS.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Salon profili va ma'lumotlari</Text>
                <Text style={styles.manageMenuDesc}>Telefon, ish vaqti va sig'im</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
          </Pressable>
        </View>

        {/* System & Switchers */}
        <Text style={[styles.sectionHeading, { marginTop: 20 }]}>TIZIM</Text>
        <View style={styles.manageMenuCard}>
          {/* Customer Preview Mode */}
          <Pressable onPress={handleCustomerPreview} style={[styles.manageMenuItem, styles.rowBorder]}>
            <View style={styles.manageMenuLeft}>
              <Ionicons name="eye-outline" size={22} color={COLORS.info} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Mijoz ko'rinishi (Preview)</Text>
                <Text style={styles.manageMenuDesc}>Ilovani oddiy mijoz sifatida ko'rish</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
          </Pressable>

          {/* Language Switch */}
          <View style={[styles.manageMenuItem, styles.rowBorder]}>
            <View style={styles.manageMenuLeft}>
              <Ionicons name="globe-outline" size={22} color={COLORS.textMuted} />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.manageMenuTitle}>Til / Язык</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['uz', 'ru', 'en'].map((l) => (
                <Pressable
                  key={l}
                  onPress={() => changeLanguage(l)}
                  style={[styles.langPill, lang === l && styles.langPillActive]}
                >
                  <Text style={[styles.langPillText, lang === l && styles.langPillTextActive]}>
                    {l.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Log Out */}
          <Pressable onPress={handleLogout} style={styles.manageMenuItem}>
            <View style={styles.manageMenuLeft}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.manageMenuTitle, { color: COLORS.danger }]}>Tizimdan chiqish</Text>
                <Text style={styles.manageMenuDesc}>Boshqaruv seansini yakunlash</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top App Bar */}
      <View style={styles.header}>
        {/* Left: Active Shop & Switcher */}
        <Pressable
          onPress={() => hasMultipleShops && setShowShopPicker(true)}
          disabled={!hasMultipleShops}
          style={styles.headerShopWrap}
        >
          <View style={styles.headerShopAvatar}>
            <Text style={styles.headerShopAvatarText}>
              {(activeShop?.name || 'S').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {resolveText(activeShop?.name, lang) || 'Barbershop'}
              </Text>
              {hasMultipleShops && (
                <Ionicons name="chevron-down" size={13} color={COLORS.accent} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.headerSubTitle}>
              {navTab === 'today' ? 'Bugun' : navTab === 'bookings' ? 'Bandlovlar' : navTab === 'clients' ? 'Mijozlar' : 'Boshqaruv'}
            </Text>
          </View>
        </Pressable>

        {/* Right Action: Quick New Booking Button */}
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setClientName('');
            setClientPhone('');
            setBookingNote('');
            setBookingDate(new Date());
            const now = new Date();
            setBookingHour(Math.max(8, Math.min(22, now.getHours() + 1)));
            setShowNewBookingModal(true);
          }}
          style={styles.quickNewHeaderBtn}
          hitSlop={8}
        >
          <Ionicons name="add" size={18} color="#0A0A0C" style={{ marginRight: 2 }} />
          <Text style={styles.quickNewHeaderText}>+ Yangi</Text>
        </Pressable>
      </View>

      {/* Main Tab Screen Content */}
      <View style={styles.mainContainer}>
        {isLoading && !isRefreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        ) : (
          <>
            {navTab === 'today' && renderDashboardTab()}
            {navTab === 'bookings' && renderAppointmentsTab()}
            {navTab === 'clients' && renderCustomersTab()}
            {navTab === 'manage' && renderManageTab()}
          </>
        )}
      </View>

      {/* 4-Tab Bottom Navigation Bar matching Layout.jsx */}
      <View style={styles.bottomNavContainer}>
        {[
          { key: 'today', label: 'Bugun', icon: 'grid-outline', activeIcon: 'grid' },
          { key: 'bookings', label: 'Bandlovlar', icon: 'calendar-outline', activeIcon: 'calendar' },
          { key: 'clients', label: 'Mijozlar', icon: 'people-outline', activeIcon: 'people' },
          { key: 'manage', label: 'Boshqaruv', icon: 'menu-outline', activeIcon: 'menu' },
        ].map((tab) => {
          const isFocused = navTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                setNavTab(tab.key);
              }}
              style={styles.bottomNavTab}
            >
              <Ionicons
                name={isFocused ? tab.activeIcon : tab.icon}
                size={22}
                color={isFocused ? COLORS.accent : COLORS.textMuted}
              />
              <Text style={[styles.bottomNavLabel, isFocused && styles.bottomNavLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* NEW APPOINTMENT MODAL (Walk-in / Phone) */}
      <Modal
        visible={showNewBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNewBookingModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Yangi bandlov</Text>
                <Text style={styles.sheetSubTitle}>{resolveText(activeShop?.name, lang)}</Text>
              </View>
              <Pressable onPress={() => setShowNewBookingModal(false)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScrollBody}>
              {/* Source Toggle */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Manba</Text>
                <View style={styles.sourceToggleRow}>
                  <Pressable
                    onPress={() => setBookingSource('walk-in')}
                    style={[styles.sourceOption, bookingSource === 'walk-in' && styles.sourceOptionActive]}
                  >
                    <Text style={[styles.sourceOptionText, bookingSource === 'walk-in' && styles.sourceOptionTextActive]}>
                      🚶 Jonli navbat (Walk-in)
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setBookingSource('phone')}
                    style={[styles.sourceOption, bookingSource === 'phone' && styles.sourceOptionActive]}
                  >
                    <Text style={[styles.sourceOptionText, bookingSource === 'phone' && styles.sourceOptionTextActive]}>
                      📞 Qo'ng'iroq (Phone)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Client Info */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mijoz ismi *</Text>
                <TextInput
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Mijoz to'liq ismi"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Telefon raqami *</Text>
                <TextInput
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  placeholder="+998 90 123 45 67"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="phone-pad"
                  style={styles.modalInput}
                />
              </View>

              {/* Services Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Xizmat turi</Text>
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
                              {currency(serv.price)}
                            </Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </View>

              {/* Staff Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Usta / Sartarosh</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  <Pressable
                    onPress={() => setSelectedStaffId(null)}
                    style={[styles.chipPill, selectedStaffId === null && styles.chipPillActive]}
                  >
                    <Text style={[styles.chipPillTitle, selectedStaffId === null && styles.chipPillTitleActive]}>
                      Har qanday usta
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
                          {st.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Dates */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sana</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {availableDates.map((d, index) => {
                    const isSelected = d.toDateString() === bookingDate.toDateString();
                    return (
                      <Pressable
                        key={d.toISOString()}
                        onPress={() => {
                          setBookingDate(d);
                          setBookingHour(null);
                        }}
                        style={[styles.dateChip, isSelected && styles.dateChipActive]}
                      >
                        <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                          {index === 0 ? 'Bugun' : index === 1 ? 'Ertaga' : d.toLocaleDateString(lang, { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.dateChipNum, isSelected && styles.dateChipNumActive]}>
                          {d.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Hourly Slots */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vaqt *</Text>
                <View style={styles.hoursGrid}>
                  {availableHours.map((h) => {
                    const isSelected = bookingHour === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => setBookingHour(h)}
                        style={[styles.hourSlotChip, isSelected && styles.hourSlotChipActive]}
                      >
                        <Text style={[styles.hourSlotChipText, isSelected && styles.hourSlotChipTextActive]}>
                          {pad(h)}:00
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmitNewBooking}
                disabled={isSubmittingBooking}
                style={[styles.submitBookingBtn, isSubmittingBooking && { opacity: 0.7 }]}
              >
                {isSubmittingBooking ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <Text style={styles.submitBookingBtnText}>Bandlovni saqlash</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 1. REJECT MODAL */}
      <Modal
        visible={!!rejectTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Bandlovni rad etish</Text>
                <Text style={styles.sheetSubTitle}>{rejectTarget?.userName || 'Mijoz'}</Text>
              </View>
              <Pressable onPress={() => setRejectTarget(null)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.modalInstructionText}>
                Rad etish sababini yozing. Mijozga bu sabab ko'rsatiladi.
              </Text>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Masalan: Usta ushbu vaqtda band yoki salon yopiq..."
                placeholderTextColor={COLORS.textFaint}
                style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />

              <View style={styles.modalActionButtonsRow}>
                <Pressable
                  onPress={() => setRejectTarget(null)}
                  style={[styles.webBtn, styles.webBtnGhost, { flex: 1 }]}
                >
                  <Text style={styles.webBtnGhostText}>Bekor qilish</Text>
                </Pressable>
                <Pressable
                  onPress={submitReject}
                  disabled={!rejectReason.trim() || isSavingAction}
                  style={[
                    styles.webBtn,
                    styles.webBtnDanger,
                    { flex: 1.3 },
                    (!rejectReason.trim() || isSavingAction) && { opacity: 0.5 },
                  ]}
                >
                  {isSavingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.webBtnDangerText}>Rad etishni yuborish</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 2. CANCEL MODAL */}
      <Modal
        visible={!!cancelTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Bandlovni bekor qilish</Text>
                <Text style={styles.sheetSubTitle}>{cancelTarget?.userName || 'Mijoz'}</Text>
              </View>
              <Pressable onPress={() => setCancelTarget(null)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={styles.modalInstructionText}>
                {`"${cancelTarget?.userName || 'Mijoz'}" bandlovini bekor qilishni tasdiqlaysizmi?`}
              </Text>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Bekor qilish sababi (ixtiyoriy)..."
                placeholderTextColor={COLORS.textFaint}
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top', marginTop: 12 }]}
                multiline
              />

              <View style={styles.modalActionButtonsRow}>
                <Pressable
                  onPress={() => setCancelTarget(null)}
                  style={[styles.webBtn, styles.webBtnGhost, { flex: 1 }]}
                >
                  <Text style={styles.webBtnGhostText}>Orqaga</Text>
                </Pressable>
                <Pressable
                  onPress={submitCancel}
                  disabled={isSavingAction}
                  style={[styles.webBtn, styles.webBtnDanger, { flex: 1.2 }]}
                >
                  {isSavingAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.webBtnDangerText}>Bekor qilish</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 3. RESCHEDULE MODAL */}
      <Modal
        visible={!!rescheduleTarget}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRescheduleTarget(null)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Vaqtni o'zgartirish</Text>
                <Text style={styles.sheetSubTitle}>{rescheduleTarget?.userName || 'Mijoz'}</Text>
              </View>
              <Pressable onPress={() => setRescheduleTarget(null)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.modalSectionLabel}>Kunni tanlang</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {rescheduleDates.map((d) => {
                  const isSelected = d.toDateString() === rescheduleDate?.toDateString();
                  return (
                    <Pressable
                      key={d.toISOString()}
                      onPress={() => setRescheduleDate(d)}
                      style={[styles.rescheduleDateChip, isSelected && styles.rescheduleDateChipActive]}
                    >
                      <Text style={[styles.rescheduleDateDayName, isSelected && styles.rescheduleDateTextActive]}>
                        {d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ', { weekday: 'short' })}
                      </Text>
                      <Text style={[styles.rescheduleDateDayNum, isSelected && styles.rescheduleDateTextActive]}>
                        {d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ', { month: 'short', day: 'numeric' })}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.modalSectionLabel, { marginTop: 12 }]}>Soatni tanlang</Text>
              <View style={styles.rescheduleHoursGrid}>
                {rescheduleHours.map((h) => {
                  const isSelected = rescheduleHour === h;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => setRescheduleHour(h)}
                      style={[styles.rescheduleHourChip, isSelected && styles.rescheduleHourChipActive]}
                    >
                      <Text style={[styles.rescheduleHourText, isSelected && styles.rescheduleHourTextActive]}>
                        {pad(h)}:00
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.modalActionButtonsRow, { marginTop: 20 }]}>
                <Pressable
                  onPress={() => setRescheduleTarget(null)}
                  style={[styles.webBtn, styles.webBtnGhost, { flex: 1 }]}
                >
                  <Text style={styles.webBtnGhostText}>Bekor qilish</Text>
                </Pressable>
                <Pressable
                  onPress={submitReschedule}
                  disabled={rescheduleHour === null || isSavingAction}
                  style={[
                    styles.webBtn,
                    styles.webBtnPrimary,
                    { flex: 1.3 },
                    (rescheduleHour === null || isSavingAction) && { opacity: 0.5 },
                  ]}
                >
                  {isSavingAction ? (
                    <ActivityIndicator size="small" color="#0A0A0C" />
                  ) : (
                    <Text style={styles.webBtnPrimaryText}>Vaqtni saqlash</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 4. NOTE MODAL */}
      <Modal
        visible={!!noteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNoteTarget(null)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Admin eslatmasi</Text>
                <Text style={styles.sheetSubTitle}>{noteTarget?.userName || 'Mijoz'}</Text>
              </View>
              <Pressable onPress={() => setNoteTarget(null)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <View style={{ padding: 16 }}>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Bandlov bo'yicha maxsus eslatma yoki mijoz talabi..."
                placeholderTextColor={COLORS.textFaint}
                style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                multiline
                autoFocus
              />

              <View style={styles.modalActionButtonsRow}>
                <Pressable
                  onPress={() => setNoteTarget(null)}
                  style={[styles.webBtn, styles.webBtnGhost, { flex: 1 }]}
                >
                  <Text style={styles.webBtnGhostText}>Bekor qilish</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveBookingNote}
                  disabled={isSavingNote}
                  style={[styles.webBtn, styles.webBtnPrimary, { flex: 1.3 }]}
                >
                  {isSavingNote ? (
                    <ActivityIndicator size="small" color="#0A0A0C" />
                  ) : (
                    <Text style={styles.webBtnPrimaryText}>Saqlash</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* 5. CUSTOMER DETAIL & CRM MODAL (Exact Web Customers.jsx Modal) */}
      <Modal
        visible={!!selectedCustomerDetail}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedCustomerDetail(null)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {selectedCustomerDetail?.userName || 'Mijoz'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={styles.sheetSubTitle}>{selectedCustomerDetail?.userNumber || '—'}</Text>
                  {selectedCustomerDetail?.userNumber ? (
                    <Pressable
                      onPress={() => Linking.openURL(`tel:${selectedCustomerDetail.userNumber}`)}
                      hitSlop={8}
                      style={{ padding: 2 }}
                    >
                      <Ionicons name="call" size={14} color={COLORS.accent} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={() => setSelectedCustomerDetail(null)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            {customerDetailLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.accent} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.sheetScrollBody} showsVerticalScrollIndicator={false}>
                {/* 4 Top Metric Tiles in 2x2 Grid */}
                <View style={styles.customerStatsGrid}>
                  <View style={styles.customerGridStatBox}>
                    <Text style={styles.custStatNum}>{selectedCustomerDetail?.visitCount || 0}</Text>
                    <Text style={styles.custStatLabel}>Tashriflar</Text>
                  </View>
                  <View style={styles.customerGridStatBox}>
                    <Text style={[styles.custStatNum, { color: COLORS.accent }]}>
                      {currency(selectedCustomerDetail?.totalSpent || 0)}
                    </Text>
                    <Text style={styles.custStatLabel}>Jami sarflangan</Text>
                  </View>
                  <View style={styles.customerGridStatBox}>
                    <Text style={styles.custStatNum} numberOfLines={1}>
                      {selectedCustomerDetail?.lastVisit ? formatDate(selectedCustomerDetail.lastVisit, lang) : '—'}
                    </Text>
                    <Text style={styles.custStatLabel}>Oxirgi tashrif</Text>
                  </View>
                  <View style={styles.customerGridStatBox}>
                    <Text
                      style={[
                        styles.custStatNum,
                        (selectedCustomerDetail?.noShowCount || 0) > 0 && { color: COLORS.danger },
                      ]}
                    >
                      {selectedCustomerDetail?.noShowCount || 0}
                    </Text>
                    <Text style={styles.custStatLabel}>Kelmadi</Text>
                  </View>
                </View>

                {/* Block / Unblock Toggle Button */}
                <Pressable
                  onPress={() => handleToggleCustomerBlock(selectedCustomerDetail)}
                  style={[
                    styles.blockToggleBtn,
                    selectedCustomerDetail?.isBlocked ? styles.blockToggleBtnUnblock : styles.blockToggleBtnBlock,
                  ]}
                >
                  <Ionicons
                    name={selectedCustomerDetail?.isBlocked ? 'shield-checkmark-outline' : 'ban-outline'}
                    size={16}
                    color={selectedCustomerDetail?.isBlocked ? COLORS.success : COLORS.danger}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.blockToggleText,
                      { color: selectedCustomerDetail?.isBlocked ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    {selectedCustomerDetail?.isBlocked ? 'Blokdan chiqarish' : 'Mijozni bloklash'}
                  </Text>
                </Pressable>

                {/* Preferences & Specialist info */}
                <View style={styles.customerInfoSectionsRow}>
                  <View style={styles.customerInfoCol}>
                    <Text style={styles.customerSectionSmallLabel}>Sevimli xizmatlar</Text>
                    {Array.isArray(selectedCustomerDetail?.favoriteServices) &&
                    selectedCustomerDetail.favoriteServices.length > 0 ? (
                      selectedCustomerDetail.favoriteServices.map((s, idx) => (
                        <Text key={idx} style={styles.customerBulletItem} numberOfLines={1}>
                          • {s}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.customerMutedText}>Mavjud emas</Text>
                    )}
                  </View>

                  <View style={styles.customerInfoCol}>
                    <Text style={styles.customerSectionSmallLabel}>Afzal ko'rilgan usta</Text>
                    <Text style={styles.customerInfoValue}>
                      {selectedCustomerDetail?.preferredStaff || 'Mavjud emas'}
                    </Text>
                  </View>
                </View>

                {/* CRM Notes */}
                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                  <Text style={styles.inputLabel}>Mijoz bo'yicha eslatmalar (CRM Notes)</Text>
                  <TextInput
                    value={customerNotesDraft}
                    onChangeText={setCustomerNotesDraft}
                    placeholder="Mijoz istaklari, qiziqishlari yoki eslatmalar..."
                    placeholderTextColor={COLORS.textFaint}
                    style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                    multiline
                  />
                  <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                    <Pressable
                      onPress={handleSaveCustomerNotes}
                      disabled={isSavingNotes}
                      style={styles.saveNotesBtn}
                    >
                      {isSavingNotes ? (
                        <ActivityIndicator size="small" color="#0A0A0C" />
                      ) : (
                        <Text style={styles.saveNotesBtnText}>Eslatmani saqlash</Text>
                      )}
                    </Pressable>
                  </View>
                </View>

                {/* Timeline of Visits */}
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.inputLabel}>Tashriflar tarixi (Timeline)</Text>
                  {Array.isArray(selectedCustomerDetail?.timeline) &&
                  selectedCustomerDetail.timeline.length > 0 ? (
                    <View style={styles.timelineListContainer}>
                      {selectedCustomerDetail.timeline.map((visit, index) => (
                        <View key={visit.id || visit._id || index} style={styles.timelineItemCard}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.timelineServiceText} numberOfLines={1}>
                              {visit.serviceName || 'Xizmat'}
                              {visit.staffName ? ` · ${visit.staffName}` : ''}
                            </Text>
                            <Text style={styles.timelineTimeText}>
                              {formatDate(visit.requestedTime, lang)}
                            </Text>
                          </View>
                          {visit.price != null ? (
                            <Text style={styles.timelinePriceText}>{currency(visit.price)}</Text>
                          ) : null}
                          <StatusBadge status={visit.status} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.timelineEmptyBox}>
                      <Text style={styles.customerMutedText}>Hozircha tashriflar tarixi mavjud emas</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* MANAGE SUB-PAGES MODAL (Services / Staff / Statistics / Settings) */}
      <Modal
        visible={!!manageSubPage}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setManageSubPage(null)}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.subPageHeader}>
            <Pressable onPress={() => setManageSubPage(null)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </Pressable>
            <Text style={styles.subPageTitle}>
              {manageSubPage === 'services'
                ? 'Xizmatlar'
                : manageSubPage === 'staff'
                ? 'Sartaroshlar & Ustalar'
                : manageSubPage === 'statistics'
                ? 'Statistika'
                : 'Salon Sozlamalari'}
            </Text>
            {manageSubPage === 'services' ? (
              <Pressable
                onPress={handleOpenCreateService}
                style={styles.subPageHeaderBtn}
                hitSlop={8}
              >
                <Ionicons name="add" size={16} color="#0A0A0C" style={{ marginRight: 2 }} />
                <Text style={styles.subPageHeaderBtnText}>Qo'shish</Text>
              </Pressable>
            ) : manageSubPage === 'staff' ? (
              <Pressable
                onPress={handleOpenCreateStaff}
                style={styles.subPageHeaderBtn}
                hitSlop={8}
              >
                <Ionicons name="add" size={16} color="#0A0A0C" style={{ marginRight: 2 }} />
                <Text style={styles.subPageHeaderBtnText}>Qo'shish</Text>
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Sub-page 1: SERVICES MANAGER */}
          {manageSubPage === 'services' && (
            <FlatList
              data={shopDetails?.services || []}
              keyExtractor={(s) => String(s._id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Ionicons name="cut-outline" size={48} color={COLORS.textFaint} />
                  <Text style={styles.emptyTitle}>Xizmatlar mavjud emas</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = item.isActive !== false;
                return (
                  <View style={styles.manageItemCard}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.manageItemTitle}>{resolveText(item.name, lang)}</Text>
                      <Text style={styles.manageItemSub}>
                        {currency(item.price)} • {item.durationMinutes} daqiqa
                      </Text>
                    </View>
                    <View style={styles.manageCardActions}>
                      <Pressable
                        onPress={() => handleOpenEditService(item)}
                        style={styles.manageIconActionBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil" size={18} color={COLORS.accent} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteService(item)}
                        style={styles.manageIconActionBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </Pressable>
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleServiceActive(item)}
                        trackColor={{ false: '#3F3F46', true: COLORS.accent }}
                      />
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Sub-page 2: STAFF MANAGER */}
          {manageSubPage === 'staff' && (
            <FlatList
              data={shopDetails?.staff || []}
              keyExtractor={(st) => String(st._id)}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerContainer}>
                  <Ionicons name="people-outline" size={48} color={COLORS.textFaint} />
                  <Text style={styles.emptyTitle}>Xodimlar kiritilmagan</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isAvailable = item.isAvailableNow !== false;
                return (
                  <View style={styles.manageItemCard}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarText}>{(item.name || 'U').slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.manageItemTitle}>{item.name}</Text>
                      <Text style={styles.manageItemSub}>
                        {item.title ? `${item.title} • ` : ''}
                        {isAvailable ? '🟢 Hozir ishda' : '🔴 Ishda emas'}
                      </Text>
                    </View>
                    <View style={styles.manageCardActions}>
                      <Pressable
                        onPress={() => handleOpenEditStaff(item)}
                        style={styles.manageIconActionBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="pencil" size={18} color={COLORS.accent} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteStaff(item)}
                        style={styles.manageIconActionBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </Pressable>
                      <Switch
                        value={isAvailable}
                        onValueChange={() => handleToggleStaffAvailable(item)}
                        trackColor={{ false: '#3F3F46', true: COLORS.accent }}
                      />
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Sub-page 3: STATISTICS */}
          {manageSubPage === 'statistics' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={styles.sectionHeading}>OXIRGI 30 KUNLIK KO'RSATKICHLAR</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Jami bandlovlar</Text>
                  <Text style={styles.statBoxValue}>{statsOverview?.totalAppointments || 0}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Jami tushum</Text>
                  <Text style={[styles.statBoxValue, { fontSize: 16 }]} numberOfLines={1}>
                    {currency(statsOverview?.totalRevenue || 0)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 24 }]}>ENG KO'P ISHLATILGAN XIZMATLAR</Text>
              {(statsOverview?.topServices || []).map((ts, idx) => (
                <View key={idx} style={styles.rankingRow}>
                  <Text style={styles.rankingRank}>{idx + 1}.</Text>
                  <Text style={styles.rankingName} numberOfLines={1}>{ts.name}</Text>
                  <Text style={styles.rankingValue}>{currency(ts.revenue)}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Sub-page 4: SETTINGS */}
          {manageSubPage === 'settings' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={[styles.manageMenuCard, { padding: 16 }]}>
                <View style={styles.settingsInputGroup}>
                  <Text style={styles.inputLabel}>Salon nomi</Text>
                  <TextInput
                    value={settingsForm.name}
                    onChangeText={(val) => setSettingsForm((prev) => ({ ...prev, name: val }))}
                    placeholder="Barbershop"
                    placeholderTextColor={COLORS.textFaint}
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.settingsInputGroup}>
                  <Text style={styles.inputLabel}>Telefon raqami</Text>
                  <TextInput
                    value={settingsForm.phone}
                    onChangeText={(val) => setSettingsForm((prev) => ({ ...prev, phone: val }))}
                    placeholder="+998 90 123 45 67"
                    placeholderTextColor={COLORS.textFaint}
                    keyboardType="phone-pad"
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.settingsInputGroup}>
                  <Text style={styles.inputLabel}>Sig'im (O'rindiqlar soni / Chairs)</Text>
                  <TextInput
                    value={settingsForm.capacity}
                    onChangeText={(val) => setSettingsForm((prev) => ({ ...prev, capacity: val }))}
                    placeholder="2"
                    placeholderTextColor={COLORS.textFaint}
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.settingsInputGroup}>
                  <Text style={styles.inputLabel}>Manzil</Text>
                  <TextInput
                    value={settingsForm.address}
                    onChangeText={(val) => setSettingsForm((prev) => ({ ...prev, address: val }))}
                    placeholder="Toshkent sh., Amir Temur ko'chasi"
                    placeholderTextColor={COLORS.textFaint}
                    style={styles.modalInput}
                  />
                </View>

                <Pressable
                  onPress={handleSaveShopSettings}
                  disabled={isSavingSettings}
                  style={[styles.saveSettingsBtn, isSavingSettings && { opacity: 0.7 }]}
                >
                  {isSavingSettings ? (
                    <ActivityIndicator size="small" color="#0A0A0C" />
                  ) : (
                    <Text style={styles.saveSettingsBtnText}>O'zgarishlarni saqlash</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* SERVICE CREATE/EDIT MODAL */}
      <Modal
        visible={serviceModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setServiceModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingService ? 'Xizmatni tahrirlash' : 'Yangi xizmat qo\'shish'}
              </Text>
              <Pressable onPress={() => setServiceModalOpen(false)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetScrollBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Xizmat nomi (O'zbekcha) *</Text>
                <TextInput
                  value={serviceForm.nameUz}
                  onChangeText={(val) => setServiceForm((prev) => ({ ...prev, nameUz: val }))}
                  placeholder="Masalan: Soch kesish"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Xizmat nomi (Ruscha)</Text>
                <TextInput
                  value={serviceForm.nameRu}
                  onChangeText={(val) => setServiceForm((prev) => ({ ...prev, nameRu: val }))}
                  placeholder="Стрижка волос"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Narxi (UZS) *</Text>
                <TextInput
                  value={serviceForm.price}
                  onChangeText={(val) => setServiceForm((prev) => ({ ...prev, price: val }))}
                  placeholder="50000"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="numeric"
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Davomiyligi (daqiqa) *</Text>
                <TextInput
                  value={serviceForm.duration}
                  onChangeText={(val) => setServiceForm((prev) => ({ ...prev, duration: val }))}
                  placeholder="30"
                  placeholderTextColor={COLORS.textFaint}
                  keyboardType="numeric"
                  style={styles.modalInput}
                />
              </View>

              <Pressable
                onPress={handleSaveService}
                disabled={isSavingService}
                style={[styles.submitBookingBtn, isSavingService && { opacity: 0.7 }]}
              >
                {isSavingService ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <Text style={styles.submitBookingBtnText}>
                    {editingService ? 'Yangilash' : 'Saqlash'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* STAFF CREATE/EDIT MODAL */}
      <Modal
        visible={staffModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStaffModalOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['bottom']}>
          <View style={styles.modalSheetContainer}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingStaff ? 'Usta ma\'lumotlarini tahrirlash' : 'Yangi usta qo\'shish'}
              </Text>
              <Pressable onPress={() => setStaffModalOpen(false)} hitSlop={10} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetScrollBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Usta ismi *</Text>
                <TextInput
                  value={staffForm.name}
                  onChangeText={(val) => setStaffForm((prev) => ({ ...prev, name: val }))}
                  placeholder="Alisher"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Lavozimi / Mutaxassisligi</Text>
                <TextInput
                  value={staffForm.title}
                  onChangeText={(val) => setStaffForm((prev) => ({ ...prev, title: val }))}
                  placeholder="Top Barber"
                  placeholderTextColor={COLORS.textFaint}
                  style={styles.modalInput}
                />
              </View>

              <Pressable
                onPress={handleSaveStaff}
                disabled={isSavingStaff}
                style={[styles.submitBookingBtn, isSavingStaff && { opacity: 0.7 }]}
              >
                {isSavingStaff ? (
                  <ActivityIndicator size="small" color="#0A0A0C" />
                ) : (
                  <Text style={styles.submitBookingBtnText}>
                    {editingStaff ? 'Yangilash' : 'Saqlash'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MULTI-SHOP SWITCHER MODAL */}
      <Modal
        visible={showShopPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowShopPicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowShopPicker(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Salonni tanlang</Text>
              <Pressable onPress={() => setShowShopPicker(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {(adminData?.shops || []).map((s) => {
                const isSelected = String(s.id) === String(activeShop?.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => handleSelectShop(s.id)}
                    style={[styles.shopItem, isSelected && styles.shopItemSelected]}
                  >
                    <Ionicons
                      name="storefront"
                      size={20}
                      color={isSelected ? COLORS.accent : COLORS.textMuted}
                      style={{ marginRight: 12 }}
                    />
                    <Text style={[styles.shopItemName, isSelected && styles.shopItemNameSelected]}>
                      {resolveText(s.name, lang)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={COLORS.accent} style={{ marginLeft: 'auto' }} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Switching shop indicator */}
      {isSwitchingShop && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Salon almashtirilmoqda...</Text>
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
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerShopWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  headerShopAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerShopAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.accent,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.text,
  },
  headerSubTitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.accent,
    marginTop: 1,
  },
  quickNewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  quickNewHeaderText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bottomNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161C',
    borderTopWidth: 1,
    borderTopColor: '#27272E',
    height: 60,
    paddingBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  bottomNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  bottomNavLabelActive: {
    color: COLORS.accent,
    fontFamily: FONTS.bold,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  greetingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  greetingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
  },
  greetingSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  operationalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  operationalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  sectionHeading: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  statBoxAlert: {
    borderColor: 'rgba(240, 184, 76, 0.4)',
    backgroundColor: 'rgba(240, 184, 76, 0.08)',
  },
  statBoxTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statBoxLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  statBoxIcon: {
    fontSize: 14,
  },
  statBoxValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.text,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  viewAllLink: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.accent,
  },
  miniAppointmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  miniClientName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.text,
  },
  miniTimeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  miniStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.surface2,
  },
  miniStatusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  emptyCardInline: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyCardInlineText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginTop: 10,
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
    paddingBottom: 80,
  },
  appointmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
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
    fontSize: 12,
    color: COLORS.accent,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: COLORS.surface2,
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  detailsBox: {
    backgroundColor: COLORS.surface2,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 3,
  },
  detailTimeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.accent,
  },
  detailText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cardNoteText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textFaint,
    marginTop: 3,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
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
    bottom: 20,
    right: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
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
    fontSize: 13,
    color: '#0A0A0C',
    marginLeft: 6,
  },
  crmStatsBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  crmStatsText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  vipBadge: {
    backgroundColor: 'rgba(212, 175, 90, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vipBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.accent,
  },
  customerMetaText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  manageShopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  shopAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shopAvatarInitial: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.accent,
  },
  manageShopTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
  },
  manageShopSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  switchShopPill: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  switchShopPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.accent,
  },
  manageMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  manageMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  manageMenuTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.text,
  },
  manageMenuDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  manageMenuCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  manageMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.surface2,
  },
  langPillActive: {
    backgroundColor: COLORS.accent,
  },
  langPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  langPillTextActive: {
    color: '#0A0A0C',
    fontFamily: FONTS.bold,
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
    fontSize: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBookingBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0A0A0C',
  },
  customerDetailStatsBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  custStatNum: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.text,
  },
  custStatLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  blockToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 104, 92, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  blockToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.danger,
  },
  saveNotesBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveNotesBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
  subPageHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  subPageTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.text,
  },
  manageItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  manageItemTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.text,
  },
  manageItemSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  rankingRank: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.accent,
    width: 24,
  },
  rankingName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
  },
  rankingValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.text,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 12, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPageHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  subPageHeaderBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#0A0A0C',
  },
  manageCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageIconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsInputGroup: {
    marginBottom: 16,
  },
  saveSettingsBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveSettingsBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#0A0A0C',
  },

  // --- WEB-MATCHING DESIGN STYLES ---
  dashboardHeroHeader: {
    marginBottom: 20,
  },
  dashboardHeroSub: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statCardContainer: {
    backgroundColor: '#131317',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272E',
    padding: 14,
    minHeight: 80,
    justifyContent: 'space-between',
  },
  statCardAccent: {
    borderColor: 'rgba(212, 175, 90, 0.4)',
    backgroundColor: 'rgba(212, 175, 90, 0.05)',
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statCardLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statCardIcon: {
    fontSize: 14,
  },
  statCardValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  statusBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 5,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  webCard: {
    backgroundColor: '#131317',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272E',
    overflow: 'hidden',
    marginTop: 14,
  },
  webCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  webCardHeaderTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  webCardBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  revenueRankText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textFaint,
    width: 24,
  },
  revenueServiceName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  revenueCountPill: {
    backgroundColor: '#212127',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  revenueCountPillText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  revenueAmountText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.accent,
  },
  viewAllLinkText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.accent,
  },
  emptyRecentBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emptyRecentSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  recentRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
    gap: 12,
  },
  userAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#212127',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitial: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  recentRowName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  recentRowSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recentRowTime: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textFaint,
    marginBottom: 4,
  },
  appointmentsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  screenMainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  newBookingBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  newBookingBtnPrimaryText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#0A0A0C',
  },
  searchAndFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#212127',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272E',
    paddingHorizontal: 10,
    height: 38,
  },
  searchInputField: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  staffFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1A1A1F',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  staffFilterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  staffFilterChipText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  staffFilterChipTextActive: {
    color: '#0A0A0C',
    fontFamily: FONTS.bold,
  },
  webAppointmentCard: {
    backgroundColor: '#131317',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272E',
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardUserName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardUserNumber: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cardServiceLine: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#E4E4E7',
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  cardTimeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cardPhoneCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 90, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  cardPhoneCallText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.accent,
  },
  cardNotesBadge: {
    backgroundColor: '#212127',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  cardNotesText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1D1D23',
  },
  webBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnPrimary: {
    backgroundColor: COLORS.accent,
  },
  webBtnPrimaryText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#0A0A0C',
  },
  webBtnDanger: {
    backgroundColor: 'rgba(242, 104, 92, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242, 104, 92, 0.3)',
  },
  webBtnDangerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.danger,
  },
  webBtnSubtle: {
    backgroundColor: '#212127',
  },
  webBtnSubtleText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#FFFFFF',
  },
  webBtnGhost: {
    backgroundColor: 'transparent',
  },
  webBtnGhostText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  webBtnIconGhost: {
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Specific Styles
  modalInstructionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  modalSectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  rescheduleDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#212127',
    borderWidth: 1,
    borderColor: '#27272E',
    alignItems: 'center',
    minWidth: 64,
  },
  rescheduleDateChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rescheduleDateDayName: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  rescheduleDateDayNum: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
  },
  rescheduleDateTextActive: {
    color: '#0A0A0C',
    fontFamily: FONTS.bold,
  },
  rescheduleHoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rescheduleHourChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#212127',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  rescheduleHourChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  rescheduleHourText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rescheduleHourTextActive: {
    color: '#0A0A0C',
    fontFamily: FONTS.bold,
  },

  // Customer Detail Modal specific styles
  customerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  customerGridStatBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#212127',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  blockToggleBtnBlock: {
    backgroundColor: 'rgba(242, 104, 92, 0.1)',
    borderColor: 'rgba(242, 104, 92, 0.25)',
  },
  blockToggleBtnUnblock: {
    backgroundColor: 'rgba(61, 220, 151, 0.1)',
    borderColor: 'rgba(61, 220, 151, 0.25)',
  },
  customerInfoSectionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    backgroundColor: '#1A1A1F',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  customerInfoCol: {
    flex: 1,
  },
  customerSectionSmallLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  customerBulletItem: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  customerMutedText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textFaint,
  },
  customerInfoValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  timelineListContainer: {
    gap: 8,
    marginTop: 8,
  },
  timelineItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#212127',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  timelineServiceText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#FFFFFF',
  },
  timelineTimeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  timelinePriceText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.accent,
  },
  timelineEmptyBox: {
    padding: 16,
    backgroundColor: '#1A1A1F',
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
});
