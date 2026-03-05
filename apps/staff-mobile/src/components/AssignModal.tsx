import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getOnlineStaff } from '../api/staffApi';
import { colors, spacing, radius } from '../theme';

interface Props {
  visible: boolean;
  taskTitle: string;
  onAssign: (staffId: string) => void;
  onClose: () => void;
}

const DEPT_ICON: Record<string, string> = {
  HOUSEKEEPING: 'cleaning-services',
  MAINTENANCE: 'build',
  FOOD_AND_BEVERAGE: 'restaurant',
  FRONT_OFFICE: 'desk',
  SECURITY: 'security',
  MANAGEMENT: 'manage-accounts',
};

export function AssignModal({ visible, taskTitle, onAssign, onClose }: Props) {
  const { t } = useTranslation();
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['online-staff'],
    queryFn: async () => { const { data } = await getOnlineStaff(); return data; },
    enabled: visible,
    staleTime: 15000,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>{t('assignModal.title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.taskName} numberOfLines={1}>{taskTitle}</Text>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : staff.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="person-off" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>{t('assignModal.noStaff')}</Text>
          </View>
        ) : (
          <FlatList
            data={staff}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: any }) => (
              <TouchableOpacity
                style={styles.staffRow}
                onPress={() => onAssign(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.firstName[0]}{item.lastName?.[0] || ''}
                  </Text>
                </View>
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{item.firstName} {item.lastName}</Text>
                  <Text style={styles.staffRole}>{item.department?.replace('_', ' ')}</Text>
                </View>
                <View style={styles.loadBadge}>
                  <Text style={[
                    styles.loadText,
                    { color: item.activeTaskCount > 3 ? colors.error : item.activeTaskCount > 1 ? colors.warning : colors.success },
                  ]}>
                    {item.activeTaskCount} tasks
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    maxHeight: '75%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  taskName: {
    fontSize: 13, color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  staffRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  staffInfo: { flex: 1 },
  staffName: { fontSize: 15, fontWeight: '600', color: colors.text },
  staffRole: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  loadBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: colors.background,
  },
  loadText: { fontSize: 11, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: spacing.md },
  emptyText: { fontSize: 15, color: colors.textSecondary },
});
