import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, FlatList, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTemplates } from '../api/staffApi';
import { colors, spacing, radius } from '../theme';

type ChecklistItem = { id: string; text: string; isRequired: boolean; sortOrder: number };

export type Template = {
  id: string;
  name: string;
  department: string;
  defaultPriority: string;
  slaMinutes: number | null;
  checklistItems: ChecklistItem[];
};

interface Props {
  visible: boolean;
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const DEPT_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  HOUSEKEEPING: 'cleaning-services',
  MAINTENANCE: 'build',
  FOOD_AND_BEVERAGE: 'restaurant',
  FRONT_OFFICE: 'desk',
  SECURITY: 'security',
  MANAGEMENT: 'manage-accounts',
};

export function TemplatePickerModal({ visible, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await getTemplates();
      return data as Template[];
    },
    enabled: visible,
    staleTime: 300000, // 5 min cache
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{t('templatePicker.title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : templates.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="content-paste-off" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>{t('templatePicker.noTemplates')}</Text>
            <Text style={styles.emptyHint}>{t('templatePicker.noTemplatesHint')}</Text>
          </View>
        ) : (
          <FlatList
            data={templates}
            keyExtractor={t => t.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onSelect(item)} activeOpacity={0.7}>
                <View style={styles.iconWrap}>
                  <MaterialIcons
                    name={DEPT_ICON[item.department] ?? 'assignment'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.meta}>
                    <Text style={styles.metaText}>{item.department.replace(/_/g, ' ')}</Text>
                    {item.checklistItems.length > 0 && (
                      <>
                        <Text style={styles.dot}>·</Text>
                        <Text style={styles.metaText}>{t('templatePicker.steps', { count: item.checklistItems.length })}</Text>
                      </>
                    )}
                    {item.slaMinutes && (
                      <>
                        <Text style={styles.dot}>·</Text>
                        <MaterialIcons name="timer" size={11} color={colors.textTertiary} />
                        <Text style={styles.metaText}>{t('templatePicker.sla', { minutes: item.slaMinutes })}</Text>
                      </>
                    )}
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
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
    maxHeight: '70%',
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

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: colors.textTertiary },
  dot: { fontSize: 12, color: colors.textTertiary },

  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.text },
  emptyHint: { fontSize: 13, color: colors.textSecondary },
});
