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
import { CopyableText } from '@/components/CopyableText';
import { qrApi } from '@/services/api';
import { TraceEvent } from '@/types';

const EVENT_TYPE_LABEL: Record<string, string> = {
  harvest: 'Colheita',
  processing_start: 'Início do Processamento',
  processing_end: 'Fim do Processamento',
  pickup: 'Coleta',
  in_transit: 'Em Trânsito',
  delivery: 'Entrega',
  roasting_start: 'Início da Torra',
  roasting_end: 'Fim da Torra',
  packaging: 'Embalagem',
  inspection: 'Inspeção',
  certification: 'Certificação',
  note: 'Nota',
};

const EVENT_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  harvest: 'leaf',
  processing_start: 'settings',
  processing_end: 'checkmark-circle',
  pickup: 'cube',
  in_transit: 'car',
  delivery: 'home',
  roasting_start: 'flame',
  roasting_end: 'checkmark-done-circle',
  packaging: 'archive',
  inspection: 'search',
  certification: 'ribbon',
  note: 'document-text',
};

const COFFEE_TYPE_LABEL: Record<string, string> = {
  arabica: 'Arábica',
  robusta: 'Robusta',
  blend: 'Blend',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
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

function TraceEventItem({ event, isLast }: { event: TraceEvent; isLast: boolean }) {
  const icon = EVENT_TYPE_ICON[event.event_type] ?? 'ellipse';
  const label = EVENT_TYPE_LABEL[event.event_type] ?? event.event_type;

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
        <Text style={styles.eventDate}>{formatDateTime(event.timestamp)}</Text>
        {event.actor_address ? (
          <CopyableText
            value={event.actor_address}
            truncate={{ head: 10, tail: 6 }}
            textStyle={styles.eventActor}
            copiedLabel="Copiar endereço do ator"
          />
        ) : null}
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
        <View style={styles.eventMeta}>
          <Ionicons name="cube-outline" size={12} color={Colors.status.in_transit} />
          <Text style={styles.txText}>Bloco #{event.block_number}</Text>
        </View>
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

  const coffeeLabel = trace.coffee_type ? COFFEE_TYPE_LABEL[trace.coffee_type] ?? trace.coffee_type : '-';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rastreio do Café</Text>
            <View style={styles.backButton} />
          </View>

          {/* Certifica Minas seal */}
          {trace.certification && trace.certification.is_active ? (
            <View style={[styles.certBanner, styles.certActive]}>
              <Ionicons name="ribbon" size={36} color={Colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certTitleActive}>Certifica Minas ativo</Text>
                <Text style={styles.certSubtitle}>
                  Válido até {formatDate(trace.certification.valid_until)}
                </Text>
                <View style={styles.certHashRow}>
                  <Text style={styles.certHash}>hash:</Text>
                  <CopyableText
                    value={trace.certification.on_chain_hash}
                    truncate={{ head: 14, tail: 6 }}
                    textStyle={styles.certHash}
                    copiedLabel="Copiar hash on-chain"
                  />
                </View>
                {trace.certification.tx_hash ? (
                  <View style={styles.certHashRow}>
                    <Text style={styles.certHash}>tx:</Text>
                    <CopyableText
                      value={trace.certification.tx_hash}
                      truncate={{ head: 14, tail: 6 }}
                      textStyle={styles.certHash}
                      copiedLabel="Copiar hash da transação"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.certBanner, styles.certInactive]}>
              <Ionicons name="information-circle" size={28} color={Colors.textMuted} />
              <Text style={styles.certNoneText}>
                Esta propriedade ainda não possui certificação Certifica Minas ativa.
              </Text>
            </View>
          )}

          {/* Batch card */}
          <View style={styles.batchCard}>
            <View style={styles.batchHeader}>
              <Text style={styles.batchCode}>{trace.code}</Text>
              <StatusBadge status={trace.status} />
            </View>

            <View style={styles.batchGrid}>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Tipo</Text>
                <Text style={styles.fieldValue}>{coffeeLabel}</Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Peso</Text>
                <Text style={styles.fieldValue}>
                  {trace.weight_kg ? `${trace.weight_kg} kg` : '-'}
                </Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Propriedade</Text>
                <Text style={styles.fieldValue}>
                  {trace.property_?.name ?? trace.origin_farm ?? '-'}
                </Text>
              </View>
              <View style={styles.batchField}>
                <Text style={styles.fieldLabel}>Origem</Text>
                <Text style={styles.fieldValue}>
                  {trace.property_
                    ? `${trace.property_.municipality}, ${trace.property_.state}`
                    : trace.origin_city
                      ? `${trace.origin_city}, ${trace.origin_state ?? ''}`
                      : '-'}
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
                <Text style={styles.blockchainText}>Registrado na blockchain</Text>
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
                  key={`${event.event_type}-${event.timestamp}`}
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
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 30 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // Certifica Minas seal
  certBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  certActive: { backgroundColor: Colors.successBg },
  certInactive: { backgroundColor: Colors.surfaceElevated },
  certTitleActive: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.success,
  },
  certSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  certHash: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  certHashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  certNoneText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

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
  batchCode: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  batchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  batchField: { width: '46%' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
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

  timelineSection: { paddingHorizontal: 16, marginTop: 8 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  emptyTimeline: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  eventRow: { flexDirection: 'row' },
  timelineCol: { alignItems: 'center', width: 36, marginRight: 12 },
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
  eventContent: { flex: 1, paddingBottom: 20 },
  eventLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  eventActor: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  eventDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2, marginBottom: 4 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  eventMetaText: { fontSize: 12, color: Colors.textSecondary },
  notesBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  notesText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  txText: { fontSize: 11, color: Colors.status.in_transit, fontFamily: 'monospace' },
});
