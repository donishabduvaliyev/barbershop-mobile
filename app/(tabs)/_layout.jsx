import React from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../src/theme/colors';
import { useResponsive } from '../../src/hooks/useResponsive';
import { MOTION_ASSETS } from '../../src/components/BrandAssets';

const NavIcon = ({ source, color }) => (
  <Image
    source={source}
    style={{ width: 22, height: 22, tintColor: color }}
    resizeMode="contain"
  />
);

export default function TabsLayout() {
  const { t } = useTranslation();
  const { isTablet } = useResponsive();

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== 'web') {
            Haptics.selectionAsync().catch(() => {});
          }
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textFaint,
        tabBarStyle: [
          styles.tabBar,
          isTablet && styles.tabBarTablet,
        ],
        tabBarLabelStyle: [
          styles.tabLabel,
          isTablet && styles.tabLabelTablet,
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home'),
          tabBarIcon: ({ color }) => (
            <NavIcon source={MOTION_ASSETS.icons.home} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('Search'),
          tabBarIcon: ({ color }) => (
            <NavIcon source={MOTION_ASSETS.icons.search} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('Map'),
          tabBarIcon: ({ color }) => (
            <NavIcon source={MOTION_ASSETS.icons.mapPin} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Profile'),
          tabBarIcon: ({ color }) => (
            <NavIcon source={MOTION_ASSETS.icons.users} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

// Styled after components/bottom-nav.svg (#1A1A1F surface-2 pill + #27272E border)
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface2,
    borderTopColor: COLORS.border,
    borderTopWidth: 1.5,
    height: Platform.OS === 'ios' ? 84 : 66,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
  },
  tabBarTablet: {
    height: 72,
    paddingHorizontal: 120,
  },
  tabLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelTablet: {
    fontSize: 13,
  },
});
