import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { authApi, usersApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { UserRole } from '@/types';

interface RoleOption {
  value: UserRole;
  label: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: UserRole.FARMER, label: 'Fazendeiro' },
  { value: UserRole.PROCESSOR, label: 'Processador' },
  { value: UserRole.TRANSPORTER, label: 'Transportador' },
  { value: UserRole.AUDITOR, label: 'Auditor' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.FARMER);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });

      // Auto-login after registration
      const tokens = await authApi.login({ email: email.trim(), password });
      await setTokens(tokens.access_token, tokens.refresh_token);

      const user = await usersApi.me();
      setUser(user);

      router.replace('/(app)');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível criar sua conta. Tente novamente.';
      Alert.alert('Erro ao cadastrar', String(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header gradient */}
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            style={styles.header}
          >
            <SafeAreaView edges={['top']}>
              <View style={styles.headerContent}>
                <Text style={styles.headerEmoji}>☕</Text>
                <Text style={styles.headerTitle}>Criar Conta</Text>
              </View>
            </SafeAreaView>
          </LinearGradient>

          {/* Form card */}
          <View style={styles.card}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome completo"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                returnKeyType="done"
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Perfil</Text>
              <View style={styles.roleContainer}>
                {ROLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.roleChip,
                      role === option.value && styles.roleChipActive,
                    ]}
                    onPress={() => setRole(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        role === option.value && styles.roleChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.buttonWrapper}>
              <Button
                title="Criar Conta"
                onPress={handleRegister}
                loading={loading}
              />
            </View>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Já tem conta? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkAction}>Entrar</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingBottom: 40,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  headerEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.textInverted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    flex: 1,
    padding: 28,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  roleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleChipTextActive: {
    color: Colors.textInverted,
  },
  buttonWrapper: {
    marginTop: 8,
    marginBottom: 20,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  linkText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  linkAction: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
});
