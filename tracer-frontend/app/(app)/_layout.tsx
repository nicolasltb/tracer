import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

export default function AppLayout() {
  const storeUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Carrega o usuário antes de renderizar as abas — evita race condition
  // entre a chegada do role e o gating de visibilidade das abas role-based.
  const { data: user, isLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: usersApi.me,
    initialData: storeUser ?? undefined,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (user) setUser(user);
  }, [user, setUser]);

  if (isLoading && !storeUser) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashEmoji}>☕</Text>
        <ActivityIndicator color={Colors.secondary} size="large" />
      </View>
    );
  }

  const role = (user ?? storeUser)?.role;

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

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  splashEmoji: { fontSize: 56 },
});
