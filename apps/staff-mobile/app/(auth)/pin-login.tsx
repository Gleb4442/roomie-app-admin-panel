import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { loginByPin } from '../../src/api/staffApi';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, spacing, radius } from '../../src/theme';

const PIN_LENGTH = 4;

const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export default function PinLoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setStaff } = useAuthStore();

  const [hotelId, setHotelId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (digit === '⌫') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (digit === '') return;
    if (pin.length >= PIN_LENGTH) return;

    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === PIN_LENGTH) {
      submit(newPin);
    }
  };

  const submit = async (finalPin: string) => {
    if (!hotelId.trim()) {
      Alert.alert(t('pinLogin.error'), t('pinLogin.errorHotelId'));
      setPin('');
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginByPin(hotelId.trim(), finalPin);
      await setStaff(data.staff, data.accessToken, data.refreshToken);
    } catch {
      Vibration.vibrate(400);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setPin('');
      Alert.alert(t('pinLogin.wrongPin'), t('pinLogin.tryAgain'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoIcon}>
          <MaterialIcons name="pin" size={28} color={colors.white} />
        </View>
        <Text style={styles.title}>{t('pinLogin.title')}</Text>
        <Text style={styles.subtitle}>{t('pinLogin.subtitle')}</Text>
      </View>

      {/* Hotel ID */}
      <View style={styles.hotelRow}>
        <MaterialIcons name="hotel" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.hotelInput}
          placeholder={t('pinLogin.hotelIdPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={hotelId}
          onChangeText={setHotelId}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
      </View>

      {/* PIN dots */}
      <View style={[styles.dotsRow, shake && styles.dotsShake]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
            ]}
          />
        ))}
      </View>

      {pin.length < PIN_LENGTH && (
        <Text style={styles.pinHint}>{t('pinLogin.enterPin', { length: PIN_LENGTH })}</Text>
      )}
      {loading && (
        <Text style={styles.pinHint}>{t('pinLogin.signingIn')}</Text>
      )}

      {/* Numpad */}
      <View style={styles.numpad}>
        {NUMPAD.map((row, ri) => (
          <View key={ri} style={styles.numrow}>
            {row.map((digit, di) => (
              <TouchableOpacity
                key={di}
                style={[
                  styles.numkey,
                  digit === '' && styles.numkeyEmpty,
                  digit === '⌫' && styles.numkeyBack,
                ]}
                onPress={() => handleDigit(digit)}
                disabled={loading || digit === ''}
                activeOpacity={digit === '' ? 1 : 0.6}
              >
                <Text style={[
                  styles.numkeyText,
                  digit === '⌫' && styles.numkeyBackText,
                ]}>
                  {digit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.white,
    alignItems: 'center',
  },

  back: {
    alignSelf: 'flex-start',
    padding: spacing.lg,
  },

  header: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxxl },
  logoIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  hotelRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.xxxl,
    width: '80%',
  },
  hotelInput: {
    flex: 1, height: 44, fontSize: 14, color: colors.text,
    marginLeft: spacing.sm,
  },

  dotsRow: {
    flexDirection: 'row', gap: 20, marginBottom: spacing.md,
  },
  dotsShake: {
    // Shake animation would require Animated — just red dots for now
  },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: colors.primary },

  pinHint: { fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xxl },

  numpad: { width: '80%', marginTop: spacing.lg },
  numrow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  numkey: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  numkeyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  numkeyBack: { backgroundColor: colors.background },
  numkeyText: { fontSize: 26, fontWeight: '500', color: colors.text },
  numkeyBackText: { fontSize: 22, color: colors.textSecondary },
});
