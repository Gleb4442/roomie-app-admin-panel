import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getTasks, assignTask } from '../../../src/api/staffApi';
import { AssignModal } from '../../../src/components/AssignModal';
import { CreateTaskModal } from '../../../src/components/CreateTaskModal';
import { colors, spacing, radius, priorityColor, statusLabel } from '../../../src/theme';

type UnifiedTask = {
  id: string;
  taskType: 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST';
  title: string;
  status: string;
  priority: string;
  roomNumber?: string;
  assignedTo?: { firstName: string; lastName?: string } | null;
  createdAt: string;
  slaMinutes?: number;
};

const COLUMN_KEYS = [
  { key: 'new',      tKey: 'new',      statuses: ['NEW'] },
  { key: 'assigned', tKey: 'assigned', statuses: ['ASSIGNED'] },
  { key: 'active',   tKey: 'active',   statuses: ['IN_PROGRESS'] },
  { key: 'hold',     tKey: 'hold',     statuses: ['ON_HOLD'] },
  { key: 'done',     tKey: 'done',     statuses: ['COMPLETED', 'INSPECTED', 'CLOSED'] },
];

const COLUMN_ACCENT: Record<string, string> = {
  new: colors.textSecondary,
  assigned: colors.primary,
  active: colors.warning,
  hold: colors.textTertiary,
  done: colors.success,
};

function TaskCard({
  task,
  onPress,
  onAssign,
}: {
  task: UnifiedTask;
  onPress: () => void;
  onAssign: () => void;
}) {
  const { t } = useTranslation();
  const age = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 60000);
  const ageStr = age < 60 ? `${age}m` : `${Math.floor(age / 60)}h`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.priorityBar, { backgroundColor: priorityColor(task.priority) }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
        <View style={styles.cardMeta}>
          {task.roomNumber && (
            <View style={styles.metaChip}>
              <MaterialIcons name="hotel" size={11} color={colors.textTertiary} />
              <Text style={styles.metaChipText}>{task.roomNumber}</Text>
            </View>
          )}
          <View style={styles.metaChip}>
            <MaterialIcons name="schedule" size={11} color={colors.textTertiary} />
            <Text style={styles.metaChipText}>{ageStr}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          {task.assignedTo ? (
            <View style={styles.assignedBadge}>
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>
                  {task.assignedTo.firstName[0]}{task.assignedTo.lastName?.[0] || ''}
                </Text>
              </View>
              <Text style={styles.assignedName} numberOfLines={1}>
                {task.assignedTo.firstName}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.assignBtn} onPress={onAssign}>
              <MaterialIcons name="person-add" size={13} color={colors.primary} />
              <Text style={styles.assignBtnText}>{t('kanban.assign')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function KanbanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [assignTarget, setAssignTarget] = useState<UnifiedTask | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['tasks-all'],
    queryFn: async () => {
      const { data } = await getTasks();
      return data as UnifiedTask[];
    },
    staleTime: 20000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ task, staffId }: { task: UnifiedTask; staffId: string }) =>
      assignTask(task.taskType, task.id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
      setAssignTarget(null);
    },
  });

  const COLUMNS = COLUMN_KEYS.map(col => ({ ...col, label: t(`kanban.${col.tKey}`) }));

  const grouped = COLUMNS.reduce<Record<string, UnifiedTask[]>>((acc, col) => {
    acc[col.key] = tasks.filter(t => col.statuses.includes(t.status));
    return acc;
  }, {});

  const handleAssign = useCallback((staffId: string) => {
    if (assignTarget) {
      assignMutation.mutate({ task: assignTarget, staffId });
    }
  }, [assignTarget]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('kanban.title')}</Text>
        </View>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Board</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <MaterialIcons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Kanban Columns */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.board}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      >
        {COLUMNS.map(col => {
          const colTasks = grouped[col.key] || [];
          return (
            <View key={col.key} style={styles.column}>
              {/* Column header */}
              <View style={[styles.colHeader, { borderTopColor: COLUMN_ACCENT[col.key] }]}>
                <Text style={styles.colLabel}>{col.label}</Text>
                <View style={[styles.countBadge, { backgroundColor: COLUMN_ACCENT[col.key] }]}>
                  <Text style={styles.countText}>{colTasks.length}</Text>
                </View>
              </View>

              {/* Task cards */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
              >
                {colTasks.length === 0 ? (
                  <View style={styles.emptyCol}>
                    <Text style={styles.emptyColText}>{t('kanban.empty')}</Text>
                  </View>
                ) : (
                  colTasks.map(task => (
                    <TaskCard
                      key={`${task.taskType}-${task.id}`}
                      task={task}
                      onPress={() =>
                        router.push({
                          pathname: '/(staff)/tasks/[taskType]/[taskId]',
                          params: { taskType: task.taskType, taskId: task.id },
                        })
                      }
                      onAssign={() => setAssignTarget(task)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Assign modal */}
      <AssignModal
        visible={!!assignTarget}
        taskTitle={assignTarget?.title || ''}
        onAssign={handleAssign}
        onClose={() => setAssignTarget(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
          setCreateVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const COLUMN_WIDTH = 240;

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
  addBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  board: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },

  column: {
    width: COLUMN_WIDTH,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { fontSize: 11, fontWeight: '700', color: colors.white },

  emptyCol: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyColText: { fontSize: 13, color: colors.textTertiary },

  // Task card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  priorityBar: { width: 4 },
  cardBody: { flex: 1, padding: spacing.sm },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },

  cardMeta: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.xs },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaChipText: { fontSize: 11, color: colors.textTertiary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  miniAvatar: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  miniAvatarText: { fontSize: 9, fontWeight: '700', color: colors.primary },
  assignedName: { fontSize: 12, color: colors.textSecondary, maxWidth: 100 },

  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.primary,
  },
  assignBtnText: { fontSize: 11, fontWeight: '600', color: colors.primary },
});
