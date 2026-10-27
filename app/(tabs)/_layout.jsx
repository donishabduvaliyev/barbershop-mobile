import React, { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useAppContext } from '../../src/context/AppContext';
import { MOTION_ASSETS } from '../../src/components/BrandAssets';

// Fail-safe Tab Icon: renders crisp Ionicons when font is loaded,
// but automatically falls back to bundled PNG image with matching tint
// so the navbar can NEVER be blank in any APK build.
function NavTabIcon({ routeName, isFocused }) {
  const [fontLoaded, setFontLoaded] = useState(() => Font.isLoaded('ionicons'));

  useEffect(() => {
    if (!fontLoaded) {
      if (Font.isLoaded('ionicons')) {
        setFontLoaded(true);
      } else {
        Font.loadAsync(Ionicons.font)
          .then(() => setFontLoaded(true))
          .catch(() => {});
      }
    }
  }, [fontLoaded]);

  let iconName = 'home-outline';
  let fallbackImg = MOTION_ASSETS.icons.home;

  if (routeName === 'index') {
    iconName = isFocused ? 'home' : 'home-outline';
    fallbackImg = MOTION_ASSETS.icons.home;
  } else if (routeName === 'search') {
    iconName = isFocused ? 'search' : 'search-outline';
    fallbackImg = MOTION_ASSETS.icons.search;
  } else if (routeName === 'map') {
    iconName = isFocused ? 'map' : 'map-outline';
    fallbackImg = MOTION_ASSETS.icons.mapPin;
  } else if (routeName === 'profile') {
    iconName = isFocused ? 'person' : 'person-outline';
    fallbackImg = MOTION_ASSETS.icons.users;
  }

  const iconColor = isFocused ? '#D4AF5A' : '#9C9CA6';

  if (fontLoaded) {
    return <Ionicons name={iconName} size={24} color={iconColor} />;
  }

  return (
    <Image
      source={fallbackImg}
      style={{ width: 22, height: 22, tintColor: iconColor }}
      resizeMode="contain"
    />
  );
}

// Floating pill navigation bar mirroring barbershop-main/src/components/Navbar.jsx
function CustomBottomNav({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.floatingNavContainer,
        { bottom: Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? 8 : 4) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.floatingNavPill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={styles.tabButton}
              android_ripple={{ color: 'rgba(212, 175, 90, 0.15)', borderless: true, radius: 28 }}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <NavTabIcon routeName={route.name} isFocused={isFocused} />
              </View>
              {/* Active gold dot with glow matching web Navbar.jsx */}
              <View
                style={[
                  styles.activeDot,
                  { opacity: isFocused ? 1 : 0, transform: [{ scale: isFocused ? 1 : 0 }] },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { adminData, isCustomerPreview, setIsCustomerPreview } = useAppContext();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {adminData?.isAdmin && isCustomerPreview && (
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
            setIsCustomerPreview(false);
            router.replace('/admin');
          }}
          style={[styles.ownerReturnBanner, { top: Math.max(insets.top, 16) + 8 }]}
        >
          <Ionicons name="shield-checkmark" size={16} color="#0A0A0C" style={{ marginRight: 6 }} />
          <Text style={styles.ownerReturnBannerText}>{t('BackToAdmin', 'Back to Dashboard')}</Text>
          <Ionicons name="arrow-forward" size={14} color="#0A0A0C" style={{ marginLeft: 6 }} />
        </Pressable>
      )}

      <Tabs
        tabBar={(props) => <CustomBottomNav {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            height: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('Home') }} />
        <Tabs.Screen name="search" options={{ title: t('Search') }} />
        <Tabs.Screen name="map" options={{ title: t('Map') }} />
        <Tabs.Screen name="profile" options={{ title: t('Profile') }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingNavContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 90,
  },
  floatingNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 440,
    height: 60,
    backgroundColor: '#16161C', // Solid deep surface - never washes out or turns black
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: '#2E2E38',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  iconWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D4AF5A', // var(--color-accent)
    shadowColor: '#D4AF5A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.9,
    shadowRadius: 3,
    elevation: 2,
    marginTop: 3,
  },
  ownerReturnBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    alignSelf: 'center',
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  ownerReturnBannerText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#0A0A0C',
  },
});
