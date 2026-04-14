import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { qrApi } from '@/services/api';
import { CoffeeType, EventType, UserRole, TraceEvent } from '@/types';

const COFFEE_TYPE_LABEL: Record<CoffeeType, string> = {
  [CoffeeType.ARABICA]: 'Arábica',
  [CoffeeType.ROBUSTA]: 'Robusta',
  [CoffeeType.BLEND]: 'Blend',
};

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  [EventType.HARVEST]: 'Colheita',
  [EventType.PROCESSING_START]: 'Início do Processamento',
  [EventType.PROCESSING_END]: 'Fim do Processamento',
  [EventType.PICKUP]: 'Coleta',
  [EventType.IN_TRANSIT]: 'Em Trânsito',
  [EventType.DELIVERY]: 'Entrega',
  [EventType.ROASTING_START]: 'Início da Torra',
  [EventType.ROASTING_END]: 'Fim da Torra',
  [EventType.PACKAGING]: 'Embalagem',
  [EventType.INSPECTION]: 'Inspeção',
  [EventType.CERTIFICATION]: 'Certificação',
  [EventType.NOTE]: 'Nota',
};

const EVENT_TYPE_ICON: Record<EventType, keyof typeof Ionicons.glyphMap> = {
  [EventType.HARVEST]: 'leaf',
  [EventType.PROCESSING_START]: 'settings',
  [EventType.PROCESSING_END]: 'checkmark-circle',
  [EventType.PICKUP]: 'cube',
  [EventType.IN_TRANSIT]: 'car',
  [EventType.DELIVERY]: 'home',
  [EventType.ROASTING_START]: 'flame',
  [EventType.ROASTING_END]: 'checkmark-done-circle',
  [EventType.PACKAGING]: 'archive',
  [EventType.INSPECTION]: 'search',
  [EventType.CERTIFICATION]: 'ribbon',
  [EventType.NOTE]: 'document-text',
};

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.FARMER]: 'Fazendeiro',
  [UserRole.PROCESSOR]: 'Processador',
  [UserRole.TRANSPORTER]: 'Transportador',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.ADMIN]: 'Administrador',
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function TraceEventItem({
  event,
  isLast,
}: {
  event: TraceEvent;
  isLast: boolean;
}) {
  const icon = EVENT_TYPE_ICON[event.event_type] ?? 'ellipse';
  const label = EVENT_TYPE_LABEL[event.event_type] ?? event.event_type;
  const roleLabel = ROLE_LABELS[event.actor_role] ?? event.actor_role;

  return (
    <View style={styles.eventRow}>
      <View style={styles.timelineCol}>
        <View style={styles.eventDot}>
          <Ionicons name={icon} size={14} color={Colors.primary} />
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.eventContent}>
        <Text style={styles.eventLabel}>{label}</Text>
        <Text style={styles.eventActor}>
          {event.actor_name} ({roleLabel})
        </Text>
        <Text style={styles.eventDate}>{formatDateTime(event.created_at)}</Text>
        {event.location ? (
          <View style={styles.eventMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{event.location}</Text>
          </View>
        ) : null}
        {event.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{event.notes}</Text>
          </View>
        ) : null}
        {event.tx_hash ? (
          <View style={styles.eventMeta}>
            <Ionicons name="link-outline" size={12} color={Colors.status.in_transit} />
            <Text style={styles.txText}>
              {event.tx_hash.slice(0, 10)}...{event.tx_hash.slice(-8)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function TraceScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const { data: trace, isLoading, isError } = useQuery({
    queryKey: ['trace', token],
    queryFn: () => qrApi.trace(token),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !trace) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>Não foi possível carregar o rastreio.</Text>
        <Button title="Voltar" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rastreio do Café</Text>
            <View style={styles.backButton} />
          </View>

          {/* Batch card */}
          <View style={styles.batchCard}>
            <View style={styles.batchHeader}>
              <Text style={styles.batchCode}>{trace.code}</Text>
              <StatusBadge status={trace.status} />
            </View>

            <View style={styles.batchGrid}>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Tipo</Text>
                <Text style={styles.fieldValue}>
                  {COFFEE_TYPE_LABEL[trace.coffee_type]}
                </Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Peso</Text>
                <Text style={styles.fieldValue}>{trace.weight_kg} kg</Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Fazenda</Text>
                <Text style={styles.fieldValue}>{trace.origin_farm}</Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Origem</Text>
                <Text style={styles.fieldValue}>
                  {trace.origin_city}, {trace.origin_state}
                </Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Colheita</Text>
                <Text style={styles.fieldValue}>{formatDate(trace.harvest_date)}</Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Criado em</Text>
                <Text style={styles.fieldValue}>{formatDate(trace.created_at)}</Text>
              </View>
            </View>

            {trace.tx_hash ? (
              <View style={styles.blockchainInfo}>
                <Ionicons name="link-outline" size={14} color={Colors.status.in_transit} />
                <Text style={styles.blockchainText}>
                  Registrado na blockchain
                </Text>
              </View>
            ) : null}
          </View>

          {/* Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Linha do Tempo</Text>
            {trace.events.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <Text style={styles.emptyText}>Nenhum evento registrado.</Text>
              </View>
            ) : (
              trace.events.map((event, index) => (
                <TraceEventItem
                  key={`${event.event_type}-${event.created_at}`}
                  event={event}
                  isLast={index === trace.events.length - 1}
                />
              ))
            )}
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 30,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  batchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  batchCode: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  batchField: {
    width: '46%',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  blockchainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  blockchainText: {
    fontSize: 12,
    color: Colors.status.in_transit,
    fontWeight: '600',
  },
  timelineSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  emptyTimeline: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  eventRow: {
    flexDirection: 'row',
  },
  timelineCol: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  eventDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
    minHeight: 16,
  },
  eventContent: {
    flex: 1,
    paddingBottom: 20,
  },
  eventLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventActor: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  eventDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  notesBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  notesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  txText: {
    fontSize: 11,
    color: Colors.status.in_transit,
    fontFamily: 'monospace',
  },
});
