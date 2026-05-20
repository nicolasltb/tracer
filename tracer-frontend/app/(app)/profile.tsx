import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { CopyableText } from '@/components/CopyableText';
import { usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.FARMER]: 'Fazendeiro',
  [UserRole.PROCESSOR]: 'Processador',
  [UserRole.TRANSPORTER]: 'Transportador',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.ADMIN]: 'Administrador',
};

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  children?: React.ReactNode;
}

function InfoRow({ icon, label, value, children }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrapper}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.infoTextWrapper}>
        <Text style={styles.infoLabel}>{label}</Text>
        {children ?? (
          <Text style={styles.infoValue} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user: storeUser, logout, setUser } = useAuthStore();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      const u = await usersApi.me();
      setUser(u);
      return u;
    },
    initialData: storeUser ?? undefined,
  });

  const { data: wallet } = useQuery({
    queryKey: ['user-wallet'],
    queryFn: usersApi.wallet,
    enabled: !!user,
  });

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  function handleEditProfile() {
    Alert.alert('Editar Perfil', 'Funcionalidade em desenvolvimento.');
  }

  if (isLoading && !storeUser) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const displayUser = user ?? storeUser;
  if (!displayUser) return null;

  const initials = getInitials(displayUser.name);
  const roleLabel = ROLE_LABELS[displayUser.role] ?? displayUser.role;
  const walletAddress = wallet?.wallet_address ?? displayUser.wallet_address;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with avatar */}
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          style={styles.header}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
              <Text style={styles.userName}>{displayUser.name}</Text>
              <Text style={styles.userEmail}>{displayUser.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {/* Account info card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informações da Conta</Text>

            {walletAddress ? (
              <InfoRow icon="wallet-outline" label="Carteira Ethereum">
                <CopyableText
                  value={walletAddress}
                  truncate
                  textStyle={styles.infoValue}
                  copiedLabel="Copiar endereço da carteira"
                />
              </InfoRow>
            ) : (
              <InfoRow
                icon="wallet-outline"
                label="Carteira Ethereum"
                value="Não disponível"
              />
            )}

            <View style={styles.divider} />

            <InfoRow
              icon="calendar-outline"
              label="Membro desde"
              value={formatDate(displayUser.created_at)}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="shield-checkmark-outline"
              label="Status da Conta"
              value={displayUser.is_active ? 'Ativa' : 'Inativa'}
            />
          </View>

          {/* Actions */}
          <View style={styles.actionsSection}>
            <Button
              title="Editar Perfil"
              variant="outline"
              onPress={handleEditProfile}
            />
            <View style={styles.spacer} />
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={styles.logoutText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  header: {
    paddingBottom: 40,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textInverted,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textInverted,
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textInverted,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  actionsSection: {
    gap: 0,
  },
  spacer: {
    height: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: Colors.errorBg,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.error,
  },
});
