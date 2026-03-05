import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { getTasks, updateTaskStatus, assignTaskToMe } from '../../../src/api/staffApi';
import { useAuthStore } from '../../../src/stores/authStore';
import { CreateTaskModal } from '../../../src/components/CreateTaskModal';
import { ShiftBar } from '../../../src/components/ShiftBar';
import {
  colors, spacing, radius,
  priorityColor, statusColor, statusLabel,
} from '../../../src/theme';

const CAN_CREATE_ROLES = ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER', 'RECEPTIONIST'];

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.5:3001';

const TASK_TYPE_ICON: Record<string, string> = {
  INTERNAL: 'build',
  ORDER: 'restaurant',
  SERVICE_REQUEST: 'room-service',
};

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { staff, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [createVisible, setCreateVisible] = useState(false);
  const canCreate = staff ? CAN_CREATE_ROLES.includes(staff.role) : false;
  const sseRef = useRef<any>(null);

  const FILTERS = [
    { key: 'all', label: t('filter.all') },
    { key: 'mine', label: t('filter.mine') },
    { key: 'new', label: t('filter.new') },
    { key: 'active', label: t('filter.active') },
  ];

  // Build query params
  const queryParams: any = {};
  if (filter === 'mine') queryParams.onlyMine = true;
  if (filter === 'new') queryParams.status = 'NEW';
  if (filter === 'active') queryParams.status = 'IN_PROGRESS,ASSIGNED';

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: async () => {
      const { data } = await getTasks(queryParams);
      return data;
    },
    refetchInterval: 60000,
  });

  // SSE real-time
  useEffect(() => {
    const connect = async () => {
      const token = await SecureStore.getItemAsync('staff_access_token');
      if (!token) return;

      const url = `${BASE_URL}/api/staff/tasks/stream`;
      // Use fetch-based SSE since EventSource not available in RN
      const controller = new AbortController();
      sseRef.current = controller;

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          if (chunk.includes('task_update')) {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }
        }
      } catch {}
    };

    connect();
    return () => sseRef.current?.abort();
  }, []);

  const handleTakeTask = async (task: any) => {
    try {
      await assignTaskToMe(task.taskType, task.id);
      await updateTaskStatus(task.taskType, task.id, 'IN_PROGRESS');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch {
      Alert.alert(t('tasks.error'), t('tasks.takeError'));
    }
  };

  const handleComplete = async (task: any) => {
    Alert.alert(
      t('tasks.completeTask'),
      t('tasks.completeConfirm'),
      [
        { text: t('tasks.cancel'), style: 'cancel' },
        {
          text: t('tasks.complete'),
          onPress: async () => {
            try {
              await updateTaskStatus(task.taskType, task.id, 'COMPLETED');
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
            } catch {
              Alert.alert(t('tasks.error'), t('tasks.completeError'));
            }
          },
        },
      ],
    );
  };

  const newCount = tasks.filter((t: any) => t.status === 'NEW').length;
  const activeCount = tasks.filter((t: any) => ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length;

  const renderTask = ({ item: task, index }: { item: any; index: number }) => {
    const pColor = priorityColor(task.priority);
    const sColor = statusColor(task.status);
    const icon = TASK_TYPE_ICON[task.taskType] || 'assignment';
    const isNew = task.status === 'NEW';
    const isActive = ['ASSIGNED', 'IN_PROGRESS'].includes(task.status);
    const isMine = task.assignedTo?.id === staff?.id;

    return (
      <View>
        <TouchableOpacity
          style={[styles.card, isNew && styles.cardNew]}
          onPress={() => router.push(`/(staff)/tasks/${task.taskType}/${task.id}`)}
          activeOpacity={0.7}
        >
          {/* Priority stripe */}
          <View style={[styles.priorityStripe, { backgroundColor: pColor }]} />

          <View style={styles.cardBody}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.typeIcon, { backgroundColor: `${pColor}15` }]}>
                <MaterialIcons name={icon as any} size={16} color={pColor} />
              </View>
              <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${sColor}15` }]}>
                <Text style={[styles.statusText, { color: sColor }]}>{statusLabel(task.status)}</Text>
              </View>
            </View>

            {/* Location + items */}
            {task.roomNumber && (
              <View style={styles.rowInfo}>
                <MaterialIcons name="room" size={13} color={colors.textTertiary} />
                <Text style={styles.infoText}>{t('tasks.room', { number: task.roomNumber })}</Text>
              </View>
            )}
            {task.items?.length > 0 && (
              <Text style={styles.itemsText} numberOfLines={1}>
                {task.items.join(', ')}
              </Text>
            )}
            {task.description && !task.items?.length && (
              <Text style={styles.itemsText} numberOfLines={1}>{task.description}</Text>
            )}

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.timeText}>{formatTime(task.createdAt, t)}</Text>

              {isNew && !isMine && (
                <TouchableOpacity
                  style={styles.takeBtn}
                  onPress={() => handleTakeTask(task)}
                >
                  <Text style={styles.takeBtnText}>{t('tasks.take')}</Text>
                </TouchableOpacity>
              )}
              {isActive && isMine && (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => handleComplete(task)}
                >
                  <MaterialIcons name="check" size={14} color={colors.white} />
                  <Text style={styles.doneBtnText}>{t('tasks.done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('tasks.greeting', { name: staff?.firstName })}</Text>
          <Text style={styles.headerSub}>
            {newCount > 0
              ? t('tasks.newAndActive', { newCount, activeCount })
              : t('tasks.onlyActive', { activeCount })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => Alert.alert(t('tasks.signOut'), t('tasks.signOutConfirm'), [
            { text: t('tasks.cancel'), style: 'cancel' },
            { text: t('tasks.signOut'), onPress: logout, style: 'destructive' },
          ])}
        >
          <MaterialIcons name="logout" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Shift status bar */}
      <ShiftBar />

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={tasks}
        keyExtractor={(item) => `${item.taskType}-${item.id}`}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="check-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {isLoading ? t('tasks.loading') : t('tasks.noTasks')}
            </Text>
          </View>
        }
      />

      {/* FAB — create task */}
      {canCreate && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={26} color={colors.white} />
        </TouchableOpacity>
      )}

      <CreateTaskModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          setCreateVisible(false);
        }}
      />
    </View>
  );
}

function formatTime(iso: string, t: (key: string, opts?: any) => string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return t('tasks.justNow');
  if (diff < 60) return t('tasks.minutesAgo', { n: diff });
  if (diff < 1440) return t('tasks.hoursAgo', { n: Math.floor(diff / 60) });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  filters: {
    flexDirection: 'row', paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md, gap: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterTextActive: { color: colors.white },

  list: { paddingHorizontal: spacing.xxl, paddingBottom: 40 },

  card: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    marginBottom: spacing.md, flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardNew: {
    shadowColor: colors.primary, shadowOpacity: 0.12, elevation: 4,
  },
  priorityStripe: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  typeIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },

  rowInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  infoText: { fontSize: 12, color: colors.textTertiary },
  itemsText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md,
  },
  timeText: { fontSize: 12, color: colors.textTertiary },

  takeBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: 6,
    backgroundColor: colors.primary, borderRadius: radius.full,
  },
  takeBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.success, borderRadius: radius.full,
  },
  doneBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },

  fab: {
    position: 'absolute',
    right: spacing.xxl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
});
