import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getShiftStatus, startShift, endShift } from '../api/staffApi';
import { colors, spacing, radius } from '../theme';

type Shift = { id: string; startedAt: string; isActive: boolean };

function useElapsed(startedAt: string | null) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }

    const update = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };

    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [startedAt]);

  return elapsed;
}

export function ShiftBar() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['shift-status'],
    queryFn: async () => {
      const { data } = await getShiftStatus();
      return data.shift as Shift | null;
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const startMutation = useMutation({
    mutationFn: () => startShift(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-status'] }),
    onError: () => Alert.alert(t('shiftBar.error'), t('shiftBar.startError')),
  });

  const endMutation = useMutation({
    mutationFn: () => endShift(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-status'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => Alert.alert(t('shiftBar.error'), t('shiftBar.endError')),
  });

  const elapsed = useElapsed(data?.startedAt ?? null);
  const onShift = !!data;
  const isPending = startMutation.isPending || endMutation.isPending;

  const handleEnd = () => {
    Alert.alert(
      t('shiftBar.endShift'),
      t('shiftBar.endConfirm', { elapsed }),
      [
        { text: t('shiftBar.cancel'), style: 'cancel' },
        { text: t('shiftBar.endShift'), style: 'destructive', onPress: () => endMutation.mutate() },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.bar, styles.barLoading]}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  if (onShift) {
    return (
      <View style={[styles.bar, styles.barActive]}>
        <View style={styles.dot} />
        <Text style={styles.activeText}>{t('shiftBar.onShift', { elapsed })}</Text>
        <TouchableOpacity style={styles.action} onPress={handleEnd} disabled={isPending}>
          {isPending ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <MaterialIcons name="logout" size={14} color={colors.error} />
              <Text style={styles.endText}>{t('shiftBar.end')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.bar, styles.barInactive]}>
      <MaterialIcons name="schedule" size={15} color={colors.warning} />
      <Text style={styles.inactiveText}>{t('shiftBar.notOnShift')}</Text>
      <TouchableOpacity
        style={[styles.action, styles.startBtn]}
        onPress={() => startMutation.mutate()}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.startBtnText}>{t('shiftBar.startShift')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  barLoading: { backgroundColor: colors.background },
  barActive: { backgroundColor: '#F0FDF4' },     // soft green
  barInactive: { backgroundColor: '#FFFBEB' },   // soft amber

  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.success,
  },

  activeText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.success },
  inactiveText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.warning },

  action: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.full,
  },
  endText: { fontSize: 12, fontWeight: '700', color: colors.error },

  startBtn: {
    backgroundColor: colors.primary,
  },
  startBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
});
