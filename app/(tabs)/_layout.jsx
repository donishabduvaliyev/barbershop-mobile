import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/theme/colors';

// Floating pill navigation bar mirroring barbershop-main/src/components/Navbar.jsx
function CustomBottomNav({ state, descriptors, navigation }) {
  return (
    <View style={styles.floatingNavContainer} pointerEvents="box-none">
      <View style={styles.floatingNavPill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            if (Platform.OS !== 'web') {
              Haptics.selectionAsync().catch(() => {});
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

          let iconName = 'home-outline';
          if (route.name === 'index') {
            iconName = isFocused ? 'home' : 'home-outline';
          } else if (route.name === 'search') {
            iconName = isFocused ? 'search' : 'search-outline';
          } else if (route.name === 'map') {
            iconName = isFocused ? 'map' : 'map-outline';
          } else if (route.name === 'profile') {
            iconName = isFocused ? 'person' : 'person-outline';
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={styles.tabButton}
              android_ripple={{ color: 'rgba(212, 175, 90, 0.15)', borderless: true, radius: 28 }}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? COLORS.accent : '#71717A'}
                />
              </View>
              {/* Active gold dot matching web Navbar.jsx */}
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
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <CustomBottomNav {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('Home') }} />
      <Tabs.Screen name="search" options={{ title: t('Search') }} />
      <Tabs.Screen name="map" options={{ title: t('Map') }} />
      <Tabs.Screen name="profile" options={{ title: t('Profile') }} />
    </Tabs>
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
    backgroundColor: 'rgba(19, 19, 23, 0.94)', // var(--color-surface)/80 backdrop-blur-xl
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272F', // var(--color-border-soft)
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
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
    transitionDuration: '200ms',
  },
  iconWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D4AF5A', // var(--color-accent)
    marginTop: 3,
  },
});
