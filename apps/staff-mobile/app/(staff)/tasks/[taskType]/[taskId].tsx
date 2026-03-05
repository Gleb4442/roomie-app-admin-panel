import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getTasks, updateTaskStatus, updateChecklist,
  addComment, getComments, assignTaskToMe, updateRoomStatus,
} from '../../../../src/api/staffApi';
import { useAuthStore } from '../../../../src/stores/authStore';
import {
  colors, spacing, radius,
  priorityColor, statusColor, statusLabel,
} from '../../../../src/theme';

const STATUS_FLOW: Record<string, string> = {
  NEW: 'IN_PROGRESS',
  ASSIGNED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: 'CLOSED',
};

const STATUS_BTN_TKEY: Record<string, string> = {
  NEW: 'taskDetail.takeStart',
  ASSIGNED: 'taskDetail.start',
  IN_PROGRESS: 'taskDetail.markComplete',
  COMPLETED: 'taskDetail.close',
};

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { taskType, taskId } = useLocalSearchParams<{ taskType: string; taskId: string }>();
  const { staff } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [showHoldInput, setShowHoldInput] = useState(false);

  // Fetch task from unified list
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: async () => { const { data } = await getTasks({}); return data; },
  });
  const task = tasks.find((t: any) => t.id === taskId && t.taskType === taskType);

  // Comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['comments', taskType, taskId],
    queryFn: async () => {
      const { data } = await getComments(taskType!, taskId!);
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      if (task?.status === 'NEW') await assignTaskToMe(taskType!, taskId!);
      await updateStatus(taskType!, taskId!, status, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => Alert.alert(t('taskDetail.error'), t('taskDetail.updateError')),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      updateChecklist(taskId!, itemId, checked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment(taskType!, taskId!, commentText),
    onSuccess: () => {
      setCommentText('');
      refetchComments();
    },
  });

  const roomStatusMutation = useMutation({
    mutationFn: (status: string) => updateRoomStatus(task?.roomId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Alert.alert(t('taskDetail.roomUpdated'), t('taskDetail.roomUpdatedMsg'));
    },
    onError: () => Alert.alert(t('taskDetail.error'), t('taskDetail.updateError')),
  });

  const handleStatusChange = () => {
    const nextStatus = STATUS_FLOW[task?.status];
    if (!nextStatus) return;
    statusMutation.mutate({ status: nextStatus });
  };

  const handleHold = () => {
    if (!holdReason.trim()) {
      Alert.alert(t('taskDetail.holdRequired'), t('taskDetail.holdRequiredMsg'));
      return;
    }
    statusMutation.mutate({ status: 'ON_HOLD', reason: holdReason });
    setShowHoldInput(false);
    setHoldReason('');
  };

  if (!task) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const pColor = priorityColor(task.priority);
  const sColor = statusColor(task.status);
  const nextStatus = STATUS_FLOW[task.status];
  const isMine = task.assignedTo?.id === staff?.id;
  const canAct = isMine || task.status === 'NEW';
  const checklist = task.checklist;
  const completedItems = checklist?.completedItems as Record<string, boolean> | undefined;
  const allChecked = checklist ? Object.values(completedItems || {}).every(Boolean) : true;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{task.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Status + Priority */}
        <View style={styles.statusRow}>
          <View style={[styles.statusChip, { backgroundColor: `${sColor}15` }]}>
            <View style={[styles.statusDot, { backgroundColor: sColor }]} />
            <Text style={[styles.statusChipText, { color: sColor }]}>{statusLabel(task.status)}</Text>
          </View>
          <View style={[styles.priorityChip, { backgroundColor: `${pColor}15` }]}>
            <MaterialIcons name="flag" size={12} color={pColor} />
            <Text style={[styles.priorityChipText, { color: pColor }]}>{task.priority}</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          {task.roomNumber && (
            <InfoRow icon="room" label={t('taskDetail.location')} value={t('taskDetail.room', { number: task.roomNumber })} />
          )}
          {task.locationLabel && !task.roomNumber && (
            <InfoRow icon="place" label={t('taskDetail.location')} value={task.locationLabel} />
          )}
          {task.department && (
            <InfoRow icon="groups" label={t('taskDetail.department')} value={t(`departments.${task.department}`, { defaultValue: task.department.replace('_', ' ') })} />
          )}
          {task.assignedTo && (
            <InfoRow icon="person" label={t('taskDetail.assignedTo')} value={`${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim()} />
          )}
          {task.dueAt && (
            <InfoRow icon="schedule" label={t('taskDetail.due')} value={new Date(task.dueAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} />
          )}
          {task.guest && (
            <InfoRow icon="person-outline" label={t('taskDetail.guest')} value={task.guest.firstName} />
          )}
        </View>

        {/* Items (orders/service) */}
        {task.items?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('taskDetail.items')}</Text>
            {task.items.map((item: string, i: number) => (
              <Text key={i} style={styles.itemLine}>• {item}</Text>
            ))}
          </View>
        )}

        {/* Description */}
        {task.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('taskDetail.note')}</Text>
            <Text style={styles.descText}>{task.description}</Text>
          </View>
        )}

        {/* Room Status (for housekeeping tasks with roomId) */}
        {task.roomId && task.department === 'HOUSEKEEPING' && task.status === 'IN_PROGRESS' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('taskDetail.roomStatus')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.roomBtn, { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.3)' }]}
                onPress={() => roomStatusMutation.mutate('CLEANED')}
                disabled={roomStatusMutation.isPending}
              >
                <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 13 }}>{t('taskDetail.markCleaned')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Checklist */}
        {checklist && completedItems && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('taskDetail.checklist')}</Text>
            {Object.entries(completedItems).map(([itemId, checked]) => (
              <TouchableOpacity
                key={itemId}
                style={styles.checkRow}
                onPress={() => checklistMutation.mutate({ itemId, checked: !checked })}
                disabled={!canAct}
              >
                <View style={[styles.checkbox, checked && styles.checkboxDone]}>
                  {checked && <MaterialIcons name="check" size={12} color={colors.white} />}
                </View>
                <Text style={[styles.checkText, checked && styles.checkTextDone]}>
                  {itemId}
                </Text>
              </TouchableOpacity>
            ))}
            {!allChecked && (
              <Text style={styles.checklistWarning}>{t('taskDetail.checklistWarning')}</Text>
            )}
          </View>
        )}

        {/* Hold reason input */}
        {showHoldInput && (
          <View style={styles.holdBox}>
            <Text style={styles.holdLabel}>{t('taskDetail.reasonForHold')}</Text>
            <TextInput
              style={styles.holdInput}
              value={holdReason}
              onChangeText={setHoldReason}
              placeholder={t('taskDetail.holdPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <View style={styles.holdActions}>
              <TouchableOpacity onPress={() => setShowHoldInput(false)} style={styles.holdCancel}>
                <Text style={styles.holdCancelText}>{t('taskDetail.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleHold} style={styles.holdConfirm}>
                <Text style={styles.holdConfirmText}>{t('taskDetail.putOnHold')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {canAct && nextStatus && (
          <View style={styles.actions}>
            {task.status === 'IN_PROGRESS' && (
              <TouchableOpacity
                style={styles.holdBtn}
                onPress={() => setShowHoldInput(v => !v)}
              >
                <MaterialIcons name="pause" size={16} color={colors.warning} />
                <Text style={styles.holdBtnText}>{t('taskDetail.hold')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.mainActionBtn,
                checklist && !allChecked && { opacity: 0.4 },
              ]}
              onPress={handleStatusChange}
              disabled={statusMutation.isPending || (!!checklist && !allChecked)}
            >
              {statusMutation.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.white} />
                  <Text style={styles.mainActionText}>{t(STATUS_BTN_TKEY[task.status])}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('taskDetail.comments', { count: comments.length })}</Text>
          {comments.map((c: any) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{c.author.firstName}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
              <Text style={styles.commentTime}>{formatTime(c.createdAt)}</Text>
            </View>
          ))}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentField}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={t('taskDetail.commentPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <TouchableOpacity
              onPress={() => commentMutation.mutate()}
              disabled={!commentText.trim() || commentMutation.isPending}
              style={styles.sendBtn}
            >
              <MaterialIcons name="send" size={18} color={commentText.trim() ? colors.primary : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={16} color={colors.textTertiary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Import missing function
async function updateStatus(taskType: string, taskId: string, status: string, reason?: string) {
  const { updateTaskStatus } = await import('../../../../src/api/staffApi');
  return updateTaskStatus(taskType, taskId, status, reason);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  scroll: { padding: spacing.xxl, paddingBottom: 60 },

  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: { fontSize: 13, fontWeight: '700' },
  priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  priorityChipText: { fontSize: 12, fontWeight: '700' },

  infoCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: colors.textSecondary, width: 90 },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },

  section: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginBottom: spacing.md },
  itemLine: { fontSize: 14, color: colors.text, paddingVertical: 3 },
  descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkText: { fontSize: 14, color: colors.text },
  checkTextDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  checklistWarning: { fontSize: 12, color: colors.warning, marginTop: spacing.sm },

  holdBox: {
    backgroundColor: colors.warningLight, borderRadius: radius.xl,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  holdLabel: { fontSize: 13, fontWeight: '600', color: colors.warning, marginBottom: spacing.sm },
  holdInput: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.md, fontSize: 14, color: colors.text, minHeight: 80,
  },
  holdActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, justifyContent: 'flex-end' },
  holdCancel: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  holdCancelText: { fontSize: 14, color: colors.textSecondary },
  holdConfirm: { paddingHorizontal: spacing.lg, paddingVertical: 8, backgroundColor: colors.warning, borderRadius: radius.md },
  holdConfirmText: { fontSize: 14, fontWeight: '700', color: colors.white },
  roomBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderRadius: radius.xl, borderWidth: 1.5,
  },

  actions: {
    flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg,
  },
  holdBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.warning,
  },
  holdBtnText: { fontSize: 14, fontWeight: '700', color: colors.warning },
  mainActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: radius.xl,
  },
  mainActionText: { fontSize: 15, fontWeight: '700', color: colors.white },

  comment: {
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: colors.text },
  commentText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  commentTime: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  commentInput: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.md, backgroundColor: colors.background,
  },
  commentField: { flex: 1, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendBtn: { padding: spacing.xs, marginLeft: spacing.sm },
});
