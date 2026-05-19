import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventChainData, EventKind } from '@/types';
import { Colors } from '@/constants/colors';

interface EventTypeConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const EVENT_CONFIG: Record<EventKind, EventTypeConfig> = {
  processing: {
    label: 'Processamento',
    icon: 'settings',
    color: Colors.status.processing,
  },
  roasting: {
    label: 'Torra',
    icon: 'flame',
    color: Colors.status.roasting,
  },
  transport: {
    label: 'Transporte',
    icon: 'car',
    color: Colors.status.in_transit,
  },
  delivery: {
    label: 'Entrega',
    icon: 'home',
    color: Colors.status.delivered,
  },
  certification_audit: {
    label: 'Certificação',
    icon: 'ribbon',
    color: Colors.status.certified,
  },
};

interface EventItemProps {
  event: EventChainData;
  isLast?: boolean;
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
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

// ---------- Metadata label maps ----------

const PROCESSING_METHOD_LABELS: Record<string, string> = {
  washed: 'Via Úmida',
  natural: 'Natural',
  honey: 'Honey',
  pulped_natural: 'Pulped Natural',
};

const ROAST_LEVEL_LABELS: Record<string, string> = {
  light: 'Torra Clara',
  medium: 'Torra Média',
  dark: 'Torra Escura',
};

const TRANSPORT_TYPE_LABELS: Record<string, string> = {
  road: 'Rodovia',
  sea: 'Marítimo',
  rail: 'Ferroviário',
};

const DELIVERY_CONDITION_LABELS: Record<string, string> = {
  good: 'Condição Boa',
  partial: 'Condição Parcial',
  damaged: 'Avariada',
};

const CERT_STANDARD_LABELS: Record<string, string> = {
  organic: 'Orgânico',
  fair_trade: 'Fair Trade',
  rainforest_alliance: 'Rainforest Alliance',
  other: 'Outro',
};

type MetaTag = { label: string; value: string };

function buildMetaTags(kind: EventKind, meta: Record<string, unknown> | null): MetaTag[] {
  if (!meta) return [];
  const tags: MetaTag[] = [];

  switch (kind) {
    case 'processing': {
      if (meta.method)
        tags.push({ label: 'Método', value: PROCESSING_METHOD_LABELS[meta.method as string] ?? String(meta.method) });
      break;
    }
    case 'roasting': {
      if (meta.temperature_c != null)
        tags.push({ label: 'Temperatura', value: `${meta.temperature_c}°C` });
      if (meta.humidity_pct != null)
        tags.push({ label: 'Umidade', value: `${meta.humidity_pct}%` });
      if (meta.duration_min != null)
        tags.push({ label: 'Duração', value: `${meta.duration_min} min` });
      if (meta.roast_level)
        tags.push({ label: 'Nível', value: ROAST_LEVEL_LABELS[meta.roast_level as string] ?? String(meta.roast_level) });
      break;
    }
    case 'transport': {
      if (meta.transport_type)
        tags.push({ label: 'Transporte', value: TRANSPORT_TYPE_LABELS[meta.transport_type as string] ?? String(meta.transport_type) });
      if (meta.vehicle_id)
        tags.push({ label: 'Veículo', value: String(meta.vehicle_id) });
      break;
    }
    case 'delivery': {
      if (meta.delivery_condition)
        tags.push({ label: 'Condição', value: DELIVERY_CONDITION_LABELS[meta.delivery_condition as string] ?? String(meta.delivery_condition) });
      if (meta.recipient_name)
        tags.push({ label: 'Destinatário', value: String(meta.recipient_name) });
      break;
    }
    case 'certification_audit': {
      if (meta.certificate_number)
        tags.push({ label: 'Certificado', value: String(meta.certificate_number) });
      if (meta.certification_standard)
        tags.push({ label: 'Padrão', value: CERT_STANDARD_LABELS[meta.certification_standard as string] ?? String(meta.certification_standard) });
      break;
    }
  }

  return tags;
}

export function EventItem({ event, isLast = false }: EventItemProps) {
  const config = EVENT_CONFIG[event.event_type] ?? {
    label: event.event_type,
    icon: 'ellipse' as keyof typeof Ionicons.glyphMap,
    color: Colors.textMuted,
  };

  const metaTags = buildMetaTags(event.event_type, event.metadata);

  return (
    <View style={styles.container}>
      {/* Timeline line + icon */}
      <View style={styles.timelineColumn}>
        <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon} size={16} color={config.color} />
        </View>
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Content */}
      <View style={styles.contentColumn}>
        <Text style={styles.eventType}>{config.label}</Text>
        <Text style={styles.dateText}>{formatDateTime(event.timestamp)}</Text>

        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.metaText}>{event.location}</Text>
          </View>
        ) : null}

        {metaTags.length > 0 && (
          <View style={styles.tagsRow}>
            {metaTags.map((tag) => (
              <View key={tag.label} style={[styles.tag, { borderColor: config.color + '60' }]}>
                <Text style={[styles.tagLabel, { color: config.color }]}>{tag.label}</Text>
                <Text style={styles.tagValue}>{tag.value}</Text>
              </View>
            ))}
          </View>
        )}

        {event.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{event.notes}</Text>
          </View>
        ) : null}

        {event.block_number ? (
          <View style={styles.txRow}>
            <Ionicons name="cube-outline" size={12} color={Colors.status.in_transit} />
            <Text style={styles.txText}>Bloco #{event.block_number}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  timelineColumn: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: 4,
    marginBottom: 0,
    minHeight: 16,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 20,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tagValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  notesBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  notesText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  txText: {
    fontSize: 11,
    color: Colors.status.in_transit,
    fontFamily: 'monospace' as 'monospace',
  },
});
