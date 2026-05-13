import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { auditsApi, propertiesApi } from '@/services/api';
import { Property } from '@/types';

export default function NewAuditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: propertiesApi.list,
  });

  const create = useMutation({
    mutationFn: (propertyId: string) =>
      auditsApi.create({ property_id: propertyId }),
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: ['audits'] });
      router.replace({
        pathname: '/(app)/audits/[id]',
        params: { id: audit.id },
      });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível criar a auditoria.';
      Alert.alert('Erro', String(detail));
    },
  });

  function pickProperty(prop: Property) {
    Alert.alert(
      'Iniciar auditoria',
      `Confirma o início da auditoria para "${prop.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar', onPress: () => create.mutate(prop.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Selecionar Propriedade</Text>
        <View style={{ width: 30 }} />
      </View>

      {isLoading || create.isPending ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => pickProperty(item)}
              activeOpacity={0.85}
            >
              <Ionicons name="leaf-outline" size={22} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>
                  {item.municipality}, {item.state} · {item.total_area_ha} ha · {item.employees_count} func.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Nenhuma propriedade cadastrada.{'\n'}
                Peça ao produtor para cadastrar antes de auditar.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginVertical: 6,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
