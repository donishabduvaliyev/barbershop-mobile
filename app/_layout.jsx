import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/i18n';
import { AppProvider, useAppContext } from '../src/context/AppContext';
import { ToastBanner } from '../src/components/ToastBanner';
import { AnimatedSplashScreen } from '../src/components/AnimatedSplashScreen';
import { MOTION_ASSETS } from '../src/components/BrandAssets';
import { COLORS } from '../src/theme/colors';

function AppShell({ fontsLoaded }) {
  const router = useRouter();
  const segments = useSegments();
  const { isLoading, adminData, isCustomerPreview } = useAppContext();
  const [splashDone, setSplashDone] = useState(false);

  // Once splash screen finishes: if user is a shop owner, directly open the Admin Panel!
  useEffect(() => {
    if (!splashDone) return;
    const inAdminGroup = segments[0] === 'admin';
    if (adminData?.isAdmin && !inAdminGroup && !isCustomerPreview) {
      router.replace('/admin');
    }
  }, [splashDone, adminData?.isAdmin, isCustomerPreview, segments, router]);

  return (
    <View style={styles.root}>
      {!splashDone && (
        <AnimatedSplashScreen
          isReady={fontsLoaded && !isLoading}
          onFinish={() => setSplashDone(true)}
        />
      )}
      <ToastBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="shop/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="booking/[id]"
          options={{
            headerShown: false,
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="admin/index"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(MOTION_ASSETS.fonts);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" backgroundColor={COLORS.bg} />
          <AppShell fontsLoaded={Boolean(fontsLoaded || fontError)} />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
