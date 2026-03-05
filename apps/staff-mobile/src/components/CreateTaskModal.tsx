import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createTask } from '../api/staffApi';
import { TemplatePickerModal, Template } from './TemplatePickerModal';
import { colors, spacing, radius } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  preAssignStaffId?: string;
}

const DEPARTMENTS = [
  'HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE',
  'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT',
];

const DEPT_LABEL: Record<string, string> = {
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  FOOD_AND_BEVERAGE: 'Food & Beverage',
  FRONT_OFFICE: 'Front Office',
  SECURITY: 'Security',
  MANAGEMENT: 'Management',
};

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const PRIORITY_COLOR: Record<string, string> = {
  LOW: colors.low,
  NORMAL: colors.normal,
  HIGH: colors.high,
  URGENT: colors.urgent,
};

export function CreateTaskModal({ visible, onClose, onCreated, preAssignStaffId }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('HOUSEKEEPING');
  const [roomNumber, setRoomNumber] = useState('');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [autoAssign, setAutoAssign] = useState(true);
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const applyTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setTemplateId(t.id);
    setTitle(t.name);
    setDepartment(t.department);
    setPriority(t.defaultPriority);
    setShowTemplatePicker(false);
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setTemplateId(undefined);
    setTitle('');
    setPriority('NORMAL');
  };

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        department,
        roomNumber: roomNumber.trim() || undefined,
        priority,
        templateId,
        assignedToId: preAssignStaffId,
        autoAssign: !preAssignStaffId && autoAssign ? true : undefined,
      }),
    onSuccess: () => {
      resetForm();
      onCreated();
    },
    onError: () => {
      Alert.alert(t('createTask.error'), t('createTask.createError'));
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDepartment('HOUSEKEEPING');
    setRoomNumber('');
    setPriority('NORMAL');
    setAutoAssign(true);
    setTemplateId(undefined);
    setSelectedTemplate(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canSubmit = title.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('createTask.title')}</Text>
          <TouchableOpacity onPress={handleClose}>
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Template picker */}
          {selectedTemplate ? (
            <View style={styles.templateSelected}>
              <MaterialIcons name="assignment-turned-in" size={16} color={colors.primary} />
              <Text style={styles.templateSelectedText} numberOfLines={1}>{selectedTemplate.name}</Text>
              <TouchableOpacity onPress={clearTemplate}>
                <MaterialIcons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={() => setShowTemplatePicker(true)}
            >
              <MaterialIcons name="content-paste" size={16} color={colors.textSecondary} />
              <Text style={styles.templateBtnText}>{t('createTask.useTemplate')}</Text>
              <MaterialIcons name="chevron-right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          {/* Title */}
          <Text style={styles.label}>{t('createTask.titleLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('createTask.titlePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          {/* Description */}
          <Text style={styles.label}>{t('createTask.descriptionLabel')}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder={t('createTask.descriptionPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          {/* Room Number */}
          <Text style={styles.label}>{t('createTask.roomLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('createTask.roomPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={roomNumber}
            onChangeText={setRoomNumber}
            keyboardType="number-pad"
          />

          {/* Department */}
          <Text style={styles.label}>{t('createTask.deptLabel')}</Text>
          <View style={styles.chipRow}>
            {DEPARTMENTS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, department === d && styles.chipActive]}
                onPress={() => setDepartment(d)}
              >
                <Text style={[styles.chipText, department === d && styles.chipTextActive]}>
                  {t(`departments.${d}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text style={styles.label}>{t('createTask.priorityLabel')}</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityBtn,
                  priority === p && { backgroundColor: PRIORITY_COLOR[p] },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text style={[
                  styles.priorityBtnText,
                  priority === p && styles.priorityBtnTextActive,
                ]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {preAssignStaffId ? (
            <View style={styles.autoAssignNote}>
              <MaterialIcons name="person-pin" size={16} color={colors.primary} />
              <Text style={styles.autoAssignText}>{t('createTask.assignedTo')}</Text>
            </View>
          ) : (
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>{t('createTask.autoAssign')}</Text>
                <Text style={styles.switchDesc}>{t('createTask.autoAssignDesc')}</Text>
              </View>
              <Switch
                value={autoAssign}
                onValueChange={setAutoAssign}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          )}
        </ScrollView>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>{t('createTask.createTask')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Template picker modal */}
      <TemplatePickerModal
        visible={showTemplatePicker}
        onSelect={applyTemplate}
        onClose={() => setShowTemplatePicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },

  label: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    marginBottom: spacing.xs, marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15, color: colors.text,
    borderWidth: 1, borderColor: colors.border,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  templateBtnText: { flex: 1, fontSize: 14, color: colors.textSecondary },

  templateSelected: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
  },
  templateSelectedText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.primary },

  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },

  priorityRow: { flexDirection: 'row', gap: spacing.xs },
  priorityBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.background,
  },
  priorityBtnText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  priorityBtnTextActive: { color: colors.white },

  autoAssignNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.lg, padding: spacing.md,
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
  },
  autoAssignText: { fontSize: 13, color: colors.primary },

  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.lg, padding: spacing.md,
    backgroundColor: colors.background, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  switchInfo: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { backgroundColor: colors.textTertiary },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
