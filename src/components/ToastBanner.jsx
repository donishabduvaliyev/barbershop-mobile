import React, { useEffect } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';

export const ToastBanner = () => {
  const { toast, clearToast } = useAppContext();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 3600);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16)}
      exiting={FadeOutUp}
      style={[
        styles.container,
        { top: Math.max(insets.top + 8, 24) },
        isError ? styles.errorBg : styles.successBg,
      ]}
    >
      <Pressable onPress={clearToast} style={styles.inner}>
        <Ionicons
          name={isError ? 'alert-circle' : 'checkmark-circle'}
          size={20}
          color={isError ? COLORS.danger : COLORS.success}
        />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
    maxWidth: 420,
    width: '92%',
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  successBg: {
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.success,
  },
  errorBg: {
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.danger,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  message: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
