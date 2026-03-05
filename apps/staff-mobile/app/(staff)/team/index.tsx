import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getOnlineStaff } from '../../../src/api/staffApi';
import { CreateTaskModal } from '../../../src/components/CreateTaskModal';
import { colors, spacing, radius } from '../../../src/theme';
import { useState } from 'react';

type OnlineStaff = {
  id: string;
  firstName: string;
  lastName?: string;
  role: string;
  department: string;
  activeTaskCount: number;
  assignedFloor?: string;
};

const DEPT_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  HOUSEKEEPING: 'cleaning-services',
  MAINTENANCE: 'build',
  FOOD_AND_BEVERAGE: 'restaurant',
  FRONT_OFFICE: 'desk',
  SECURITY: 'security',
  MANAGEMENT: 'manage-accounts',
};

// ROLE_LABEL is now handled via i18n t('roles.X')

function loadColor(count: number) {
  if (count === 0) return colors.textTertiary;
  if (count <= 2) return colors.success;
  if (count <= 4) return colors.warning;
  return colors.error;
}

function StaffRow({ member, onCreateTask }: { member: OnlineStaff; onCreateTask: () => void }) {
  const { t } = useTranslation();
  const icon = DEPT_ICON[member.department] ?? 'person';
  const lc = loadColor(member.activeTaskCount);
  const loadLabel = (count: number) => count === 0 ? t('team.free') : t('team.tasks', { count });

  return (
    <View style={styles.row}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {member.firstName[0]}{member.lastName?.[0] || ''}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name}>{member.firstName} {member.lastName}</Text>
        <View style={styles.metaRow}>
          <MaterialIcons name={icon} size={12} color={colors.textTertiary} />
          <Text style={styles.dept}>{t(`departments.${member.department}`, { defaultValue: member.department.replace(/_/g, ' ') })}</Text>
          {member.assignedFloor && (
            <>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.dept}>{t('team.floor', { number: member.assignedFloor })}</Text>
            </>
          )}
        </View>
        <Text style={styles.roleText}>{t(`roles.${member.role}`, { defaultValue: member.role })}</Text>
      </View>

      {/* Load + actions */}
      <View style={styles.right}>
        <View style={[styles.loadBadge, { borderColor: lc }]}>
          <Text style={[styles.loadText, { color: lc }]}>
            {loadLabel(member.activeTaskCount)}
          </Text>

        </View>
        <TouchableOpacity style={styles.taskBtn} onPress={onCreateTask}>
          <MaterialIcons name="add-task" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TeamScreen() {
  const { t } = useTranslation();
  const [createFor, setCreateFor] = useState<string | null>(null);

  const { data: staff = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['online-staff'],
    queryFn: async () => {
      const { data } = await getOnlineStaff();
      return data as OnlineStaff[];
    },
    staleTime: 30000,
    refetchInterval: 60000, // auto-refresh every minute
  });

  const byDept = staff.reduce<Record<string, OnlineStaff[]>>((acc, s) => {
    const key = s.department;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sections = Object.entries(byDept).sort(([a], [b]) => a.localeCompare(b));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('team.title')}</Text>
          <Text style={styles.headerSub}>{t('team.staffActive', { count: staff.length })}</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <MaterialIcons name="refresh" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : staff.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>{t('team.noStaff')}</Text>
          <Text style={styles.emptyText}>{t('team.noStaffDesc')}</Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={([dept]) => dept}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item: [dept, members] }) => (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons
                  name={DEPT_ICON[dept] ?? 'people'}
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.sectionTitle}>
                  {t(`departments.${dept}`, { defaultValue: dept.replace(/_/g, ' ') })}
                </Text>
                <Text style={styles.sectionCount}>{members.length}</Text>
              </View>
              {members.map(m => (
                <StaffRow
                  key={m.id}
                  member={m}
                  onCreateTask={() => setCreateFor(m.id)}
                />
              ))}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <CreateTaskModal
        visible={!!createFor}
        preAssignStaffId={createFor ?? undefined}
        onClose={() => setCreateFor(null)}
        onCreated={() => setCreateFor(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  refreshBtn: { padding: spacing.sm },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxl },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  section: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.textTertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dept: { fontSize: 12, color: colors.textTertiary },
  dot: { fontSize: 12, color: colors.textTertiary },
  roleText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  right: { alignItems: 'flex-end', gap: spacing.sm },
  loadBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  loadText: { fontSize: 11, fontWeight: '700' },
  taskBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
});
