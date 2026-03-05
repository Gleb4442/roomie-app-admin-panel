import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { loginStaff } from '../../src/api/staffApi';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, spacing, radius } from '../../src/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { setStaff } = useAuthStore();

  const [hotelId, setHotelId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!hotelId.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('login.error'), t('login.fillFields'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginStaff(hotelId.trim(), email.trim(), password);
      await setStaff(data.staff, data.accessToken, data.refreshToken);
    } catch (err: any) {
      Alert.alert(
        t('login.loginFailed'),
        err.response?.data?.error || t('login.invalidCredentials'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <MaterialIcons name="business-center" size={32} color={colors.white} />
          </View>
          <Text style={styles.logoTitle}>{t('login.title')}</Text>
          <Text style={styles.logoSub}>{t('login.subtitle')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>{t('login.formTitle')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('login.hotelId')}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="hotel" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.hotelIdPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={hotelId}
                onChangeText={setHotelId}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('login.email')}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('login.password')}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>{t('login.signIn')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pinLink}
            onPress={() => router.push('/(auth)/pin-login')}
          >
            <MaterialIcons name="pin" size={16} color={colors.primary} />
            <Text style={styles.pinLinkText}>{t('login.pinLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },

  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  logoTitle: { fontSize: 24, fontWeight: '700', color: colors.text },
  logoSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  form: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xxl },

  inputGroup: { marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, height: 48, fontSize: 15, color: colors.text },
  eyeBtn: { padding: spacing.xs },

  loginBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  pinLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginTop: spacing.lg, paddingVertical: spacing.sm,
  },
  pinLinkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
