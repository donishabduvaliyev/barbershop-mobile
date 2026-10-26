import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../theme/colors';
import { useAppContext } from '../context/AppContext';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'uz', name: 'O‘zbekcha' },
];

// Faithful React Native replication of languageDropdown.jsx Action Sheet from barbershop-main
export const LanguageActionSheet = () => {
  const { i18n, t } = useTranslation();
  const { changeLanguage } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setIsOpen(true);
  };

  const handleSelect = (langCode) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    changeLanguage(langCode);
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button (matching p-2 bg-surface-2 rounded-full in languageDropdown.jsx) */}
      <Pressable
        onPress={handleOpen}
        style={styles.triggerBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Open language selector"
      >
        <Ionicons name="language-outline" size={17} color="#D4AF5A" />
        <Text style={styles.triggerLangText}>{(i18n.language || 'uz').slice(0, 2).toUpperCase()}</Text>
      </Pressable>

      {/* Action Sheet Bottom Modal (matching languageDropdown.jsx) */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
            {/* Language Options Group */}
            <View style={styles.optionsCard}>
              {LANGUAGES.map((lang, index) => {
                const isActive = i18n.language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => handleSelect(lang.code)}
                    style={[
                      styles.optionRow,
                      index < LANGUAGES.length - 1 && styles.optionRowBorder,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isActive && styles.optionTextActive,
                      ]}
                    >
                      {lang.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Cancel Button */}
            <Pressable
              onPress={() => setIsOpen(false)}
              style={styles.cancelCard}
            >
              <Text style={styles.cancelText}>{t('Cancel', 'Cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1F', // var(--color-surface-2)
    borderWidth: 1,
    borderColor: '#27272E',
    justifyContent: 'center',
  },
  triggerLangText: {
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    fontSize: 11,
    color: '#D4AF5A',
    letterSpacing: 0.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  optionsCard: {
    backgroundColor: 'rgba(19, 19, 23, 0.96)', // var(--color-surface)
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  optionRow: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272E', // var(--color-border-soft)
  },
  optionText: {
    color: '#F4F4F5', // var(--color-text)
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
  },
  optionTextActive: {
    color: '#D4AF5A', // var(--color-accent)
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
  },
  cancelCard: {
    marginTop: 10,
    backgroundColor: 'rgba(19, 19, 23, 0.96)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272E',
  },
  cancelText: {
    color: '#D4AF5A',
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    fontWeight: '700',
  },
});
