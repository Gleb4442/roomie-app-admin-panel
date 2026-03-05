import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '../../src/theme';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'];

export default function StaffLayout() {
  const { t } = useTranslation();
  const { staff } = useAuthStore();
  const isSupervisor = staff ? SUPERVISOR_ROLES.includes(staff.role) : false;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="kanban"
        options={{
          title: t('tabs.board'),
          href: isSupervisor ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="view-column" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: t('tabs.team'),
          href: isSupervisor ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="housekeeping"
        options={{
          title: t('tabs.rooms'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="hotel" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
