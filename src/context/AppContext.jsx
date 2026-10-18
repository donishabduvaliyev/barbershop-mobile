import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import i18n from '../i18n';

const AppContext = createContext();

const STORAGE_KEYS = {
  TOKEN: '@smartchair_mobile_jwt',
  USER: '@smartchair_mobile_user',
  LANG: '@smartchair_mobile_lang',
};

// Automatically detect local host IP when running on physical Android via Expo Go
const getAutoHostIp = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

const DEFAULT_BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://barbershop-backend-1hf3.onrender.com';

export const AppProvider = ({ children }) => {
  const [backEndUrl] = useState(DEFAULT_BACKEND_URL);
  const [mobileToken, setMobileToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [shops, setShops] = useState([]);
  const [feedData, setFeedData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [adminData, setAdminData] = useState(null); // { isAdmin, role, adminToken, adminPanelUrl, shops }
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

  // Telegram Bot Deep-Link Auth state
  const [authSession, setAuthSession] = useState(null); // { sessionToken, tgDeepLink, webDeepLink }
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const socketRef = useRef(null);
  const authSocketRef = useRef(null);
  const availabilityListenersRef = useRef(new Map());

  const showToast = useCallback((message, type = 'success') => {
    setToast({ id: Date.now(), message, type });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        type === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  // Load persisted session and language on startup
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser, savedLang] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
          AsyncStorage.getItem(STORAGE_KEYS.LANG),
        ]);
        if (savedLang) {
          i18n.changeLanguage(savedLang);
        }
        if (savedToken && savedUser) {
          setMobileToken(savedToken);
          setUserInfo(JSON.parse(savedUser));
        }
      } catch (err) {
        console.warn('Error loading persisted session:', err);
      }
    })();
  }, []);

  const changeLanguage = useCallback(async (lang) => {
    i18n.changeLanguage(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANG, lang).catch(() => {});
    if (mobileToken) {
      fetch(`${backEndUrl}/api/mobile/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  }, [backEndUrl, mobileToken]);

  // Complete login & persist JWT + user
  const handleAuthSuccess = useCallback(async (token, user) => {
    setMobileToken(token);
    setUserInfo(user);
    setIsAuthenticating(false);
    setAuthSession(null);

    if (authSocketRef.current) {
      authSocketRef.current.disconnect();
      authSocketRef.current = null;
    }

    if (user?.language) {
      i18n.changeLanguage(user.language);
    }

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token),
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
    ]).catch(() => {});

    showToast(`Welcome, ${user?.name || 'Customer'}!`);
  }, [showToast]);

  // Fetch initial home feed & all shops
  const refreshShops = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allRes, feedRes] = await Promise.all([
        fetch(`${backEndUrl}/api/mobile/shops/allShops`)
          .then((r) => (r.ok ? r : fetch(`${backEndUrl}/api/shops/allShops`)))
          .catch(() => fetch(`${backEndUrl}/api/shops/allShops`)),
        fetch(`${backEndUrl}/api/mobile/shops/home-feed`)
          .then((r) => (r.ok ? r : fetch(`${backEndUrl}/api/shops/home-feed`)))
          .catch(() => fetch(`${backEndUrl}/api/shops/home-feed`)),
      ]);
      if (allRes && allRes.ok) {
        const allData = await allRes.json();
        setShops(Array.isArray(allData) ? allData : []);
      }
      if (feedRes && feedRes.ok) {
        const feed = await feedRes.json();
        setFeedData(Array.isArray(feed) ? feed : []);
      }
    } catch (err) {
      console.warn('Error fetching shops:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [backEndUrl]);

  useEffect(() => {
    refreshShops();
  }, [refreshShops]);

  // Fetch authenticated user's profile + bookings when mobileToken is set
  const refreshProfile = useCallback(async () => {
    if (!mobileToken) return;
    try {
      const res = await fetch(`${backEndUrl}/api/mobile/me`, {
        headers: { Authorization: `Bearer ${mobileToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        setUserInfo(data.user);
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)).catch(() => {});
      }
      if (Array.isArray(data.bookings)) {
        setBookings(data.bookings);
      }
    } catch (err) {
      console.warn('Failed to refresh mobile profile:', err.message);
    }
  }, [backEndUrl, mobileToken]);

  // Check if current authenticated user has shop owner or superadmin privileges
  const checkAdminStatus = useCallback(async () => {
    if (!mobileToken) {
      setAdminData(null);
      return;
    }
    try {
      setIsCheckingAdmin(true);
      const res = await fetch(`${backEndUrl}/api/mobile/admin/check`, {
        headers: { Authorization: `Bearer ${mobileToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
      } else {
        setAdminData(null);
      }
    } catch (err) {
      console.warn('Admin check error:', err.message);
      setAdminData(null);
    } finally {
      setIsCheckingAdmin(false);
    }
  }, [backEndUrl, mobileToken]);

  // Switch active shop for multi-shop owner
  const switchAdminShop = useCallback(async (shopId) => {
    if (!mobileToken || !shopId) return null;
    try {
      const res = await fetch(`${backEndUrl}/api/mobile/admin/switch-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({ shopId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminData((prev) => (prev ? {
          ...prev,
          adminToken: data.adminToken,
          currentShop: data.shop,
        } : prev));
        return data.adminToken;
      }
    } catch (err) {
      console.warn('Switch admin shop error:', err.message);
    }
    return null;
  }, [backEndUrl, mobileToken]);

  useEffect(() => {
    if (mobileToken) {
      refreshProfile();
      checkAdminStatus();
    } else {
      setBookings([]);
      setAdminData(null);
    }
  }, [mobileToken, refreshProfile, checkAdminStatus]);

  // Connect live Socket.io client for real-time Web <-> Mobile <-> Admin sync
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(backEndUrl, {
      transports: ['websocket'],
      auth: mobileToken ? { mobileToken } : { public: true },
    });

    socket.on('connect', () => {
      setIsSocketConnected(true);
      // Re-subscribe any active shop availability watchers
      for (const shopId of availabilityListenersRef.current.keys()) {
        socket.emit('watch:shop', shopId);
      }
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    // Live booking status updates from Shop Owner / Telegram Bot / Web Mini App
    socket.on('booking:updated', (updatedBooking) => {
      setBookings((prev) => {
        const exists = prev.some((b) => String(b._id) === String(updatedBooking._id));
        if (exists) {
          return prev.map((b) =>
            String(b._id) === String(updatedBooking._id) ? { ...b, ...updatedBooking } : b
          );
        }
        return [updatedBooking, ...prev];
      });
      showToast(
        `${updatedBooking.shopName}: ${String(updatedBooking.status).toUpperCase()}`
      );
    });

    // Live favorites sync between Web Mini App and Mobile App
    socket.on('favorites:updated', ({ favorites }) => {
      if (Array.isArray(favorites)) {
        setUserInfo((prev) => (prev ? { ...prev, favorites } : prev));
      }
    });

    // Live profile sync (e.g. when user shares phone contact in Telegram bot)
    socket.on('user:updated', (updatedUser) => {
      setUserInfo((prev) => {
        const merged = { ...(prev || {}), ...updatedUser };
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(merged)).catch(() => {});
        return merged;
      });
    });

    // Live rating sync
    socket.on('booking:rated', ({ bookingId, rating, staffRating }) => {
      setBookings((prev) =>
        prev.map((b) =>
          String(b._id) === String(bookingId) ? { ...b, rating, staffRating } : b
        )
      );
    });

    // Live time-slot availability updates for whichever shop screen is open
    socket.on('availability:updated', (payload) => {
      const callbacks = availabilityListenersRef.current.get(String(payload?.shopId));
      if (callbacks) {
        callbacks.forEach((cb) => cb(payload));
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [backEndUrl, mobileToken, showToast]);

  // Subscribe to real-time slot updates for a specific shop
  const subscribeShopAvailability = useCallback((shopId, callback) => {
    if (!shopId) return () => {};
    const key = String(shopId);
    if (!availabilityListenersRef.current.has(key)) {
      availabilityListenersRef.current.set(key, new Set());
      socketRef.current?.emit('watch:shop', key);
    }
    availabilityListenersRef.current.get(key).add(callback);

    return () => {
      const set = availabilityListenersRef.current.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          availabilityListenersRef.current.delete(key);
          socketRef.current?.emit('unwatch:shop', key);
        }
      }
    };
  }, []);

  // Start 1-Tap Telegram Bot Deep-Link Authentication
  const startTelegramLogin = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      const res = await fetch(`${backEndUrl}/api/mobile/auth/telegram/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: Platform.OS,
          deviceName: `${Platform.OS.toUpperCase()} App`,
        }),
      });
      if (!res.ok) throw new Error('Could not initialize Telegram login');
      const session = await res.json();
      setAuthSession(session);

      // Connect a dedicated watcher socket for instant login callback
      if (authSocketRef.current) {
        authSocketRef.current.disconnect();
      }
      const authSocket = io(backEndUrl, {
        transports: ['websocket'],
        auth: { authSessionToken: session.sessionToken },
      });
      authSocket.on('auth:approved', (data) => {
        if (data?.token && data?.user) {
          handleAuthSuccess(data.token, data.user);
        }
      });
      authSocketRef.current = authSocket;

      // Open Telegram app directly via tg:// scheme, falling back to https://t.me
      const canOpenTg = session.tgDeepLink
        ? await Linking.canOpenURL(session.tgDeepLink).catch(() => false)
        : false;
      const targetUrl = canOpenTg ? session.tgDeepLink : session.webDeepLink;
      if (targetUrl) {
        await Linking.openURL(targetUrl).catch(() => {
          if (session.webDeepLink && targetUrl !== session.webDeepLink) {
            Linking.openURL(session.webDeepLink).catch(() => {});
          }
        });
      }
    } catch (err) {
      setIsAuthenticating(false);
      showToast(err.message || 'Failed to start Telegram login', 'error');
    }
  }, [backEndUrl, handleAuthSuccess, showToast]);

  // Poll login session when returning from Telegram app to foreground
  useEffect(() => {
    if (!isAuthenticating || !authSession?.sessionToken) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `${backEndUrl}/api/mobile/auth/telegram/status/${authSession.sessionToken}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'authenticated' && data.token && data.user) {
          handleAuthSuccess(data.token, data.user);
        }
      } catch {
        // Ignore transient network errors while switching apps
      }
    };

    const interval = setInterval(checkStatus, 2500);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkStatus();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticating, authSession, backEndUrl, handleAuthSuccess]);

  const cancelTelegramLogin = useCallback(() => {
    setIsAuthenticating(false);
    setAuthSession(null);
    if (authSocketRef.current) {
      authSocketRef.current.disconnect();
      authSocketRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    setMobileToken(null);
    setUserInfo(null);
    setBookings([]);
    setAdminData(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER),
    ]).catch(() => {});
  }, []);

  // Favorites lookup Set & optimistic toggle
  const favoriteIds = useMemo(
    () => new Set((userInfo?.favorites || []).map((id) => String(id?._id || id))),
    [userInfo?.favorites]
  );

  const toggleFavorite = useCallback(async (shopId) => {
    if (!mobileToken || !userInfo) {
      showToast(i18n.t('SignInWithTelegram'), 'error');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    const strId = String(shopId);
    const wasFavorited = favoriteIds.has(strId);
    const prevFavorites = userInfo.favorites || [];
    const nextFavorites = wasFavorited
      ? prevFavorites.filter((id) => String(id?._id || id) !== strId)
      : [...prevFavorites, strId];

    setUserInfo((prev) => (prev ? { ...prev, favorites: nextFavorites } : prev));

    try {
      const res = await fetch(`${backEndUrl}/api/mobile/user/favorites/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mobileToken}`,
        },
        body: JSON.stringify({ shopId: strId }),
      });
      if (!res.ok) throw new Error('Failed to toggle favorite');
      const data = await res.json();
      setUserInfo((prev) => (prev ? { ...prev, favorites: data.favorites } : prev));
    } catch {
      setUserInfo((prev) => (prev ? { ...prev, favorites: prevFavorites } : prev));
    }
  }, [backEndUrl, favoriteIds, mobileToken, showToast, userInfo]);

  return (
    <AppContext.Provider
      value={{
        backEndUrl,
        mobileToken,
        userInfo,
        setUserInfo,
        bookings,
        setBookings,
        shops,
        feedData,
        isLoading,
        isSocketConnected,
        toast,
        showToast,
        clearToast,
        changeLanguage,
        refreshShops,
        refreshProfile,
        subscribeShopAvailability,
        startTelegramLogin,
        cancelTelegramLogin,
        isAuthenticating,
        authSession,
        logout,
        favoriteIds,
        toggleFavorite,
        adminData,
        isCheckingAdmin,
        checkAdminStatus,
        switchAdminShop,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
