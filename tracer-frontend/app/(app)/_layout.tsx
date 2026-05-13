import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function AppLayout() {
  const role = useAuthStore((s) => s.user?.role);

  // Visibilidade por papel — true = visível na tab bar
  const showBatches =
    role === UserRole.FARMER ||
    role === UserRole.PROCESSOR ||
    role === UserRole.TRANSPORTER ||
    role === UserRole.ADMIN;
  const showProperties = role === UserRole.FARMER || role === UserRole.ADMIN;
  const showAudits = role === UserRole.AUDITOR || role === UserRole.ADMIN;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBackground,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'home' as IoniconName} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: 'Lotes',
          href: showBatches ? '/(app)/batches' : null,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'layers' as IoniconName} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Propriedades',
          href: showProperties ? '/(app)/properties/index' : null,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'leaf' as IoniconName} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="audits"
        options={{
          title: 'Auditorias',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href: (showAudits ? '/(app)/audits/index' : null) as any,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'clipboard' as IoniconName} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'qr-code' as IoniconName} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name={'person' as IoniconName} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
