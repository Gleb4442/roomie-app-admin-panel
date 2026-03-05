import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, spacing, radius } from '../../../src/theme';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'uk', label: 'Ukrainian', native: 'Українська' },
] as const;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <View style={styles.content}>
        {/* Language section */}
        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <View key={lang.code}>
              <TouchableOpacity
                style={styles.langRow}
                onPress={() => i18n.changeLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <View style={styles.langInfo}>
                  <Text style={styles.langNative}>{lang.native}</Text>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                </View>
                {i18n.language === lang.code && (
                  <View style={styles.checkCircle}>
                    <MaterialIcons name="check" size={16} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Account section */}
        <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
            <MaterialIcons name="logout" size={20} color={colors.error} />
            <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text style={styles.version}>{t('settings.version')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },

  content: { flex: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  langInfo: { flex: 1 },
  langNative: { fontSize: 16, fontWeight: '600', color: colors.text },
  langLabel: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg },

  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: colors.error },

  version: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
});
