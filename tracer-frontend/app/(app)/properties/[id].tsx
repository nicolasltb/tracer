import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { CalendarPickerModal, formatDisplayDate } from '@/components/CalendarPicker';
import { propertiesApi } from '@/services/api';
import {
  Certification,
  CreatePropertyAreaRequest,
  CreateSaleRequest,
  CreateWaterSourceRequest,
  PropertyArea,
  PropertyAreaType,
  PropertyDetail,
  SaleRecord,
  WaterSource,
  WaterSourceType,
} from '@/types';

const AREA_LABELS: Record<PropertyAreaType, string> = {
  [PropertyAreaType.COFFEE]: 'Café',
  [PropertyAreaType.NATIVE_FOREST]: 'Mata nativa',
  [PropertyAreaType.APP]: 'APP (Preservação)',
  [PropertyAreaType.BUILDINGS]: 'Benfeitorias',
  [PropertyAreaType.WATER_BODIES]: 'Corpos d’água',
  [PropertyAreaType.OTHER]: 'Outro',
};

const WATER_LABELS: Record<WaterSourceType, string> = {
  [WaterSourceType.NASCENTE]: 'Nascente',
  [WaterSourceType.CURSO_AGUA]: 'Curso d’água',
  [WaterSourceType.POCO]: 'Poço',
  [WaterSourceType.OTHER]: 'Outro',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [areaModal, setAreaModal] = useState(false);
  const [waterModal, setWaterModal] = useState(false);
  const [saleModal, setSaleModal] = useState(false);

  const { data: property, isLoading } = useQuery<PropertyDetail>({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.get(id),
    enabled: !!id,
  });

  const { data: certification } = useQuery<Certification | null>({
    queryKey: ['property-cert', id],
    queryFn: () => propertiesApi.getCertification(id),
    enabled: !!id,
  });

  const { data: sales = [] } = useQuery<SaleRecord[]>({
    queryKey: ['property-sales', id],
    queryFn: () => propertiesApi.listSales(id),
    enabled: !!id,
  });

  if (isLoading || !property) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {property.name}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CertificationCard cert={certification ?? null} />

        <Section title="Informações">
          <View style={styles.infoCard}>
            <InfoRow icon="location-outline" label="Endereço" value={property.address} />
            <InfoRow
              icon="map-outline"
              label="Município"
              value={`${property.municipality}, ${property.state}`}
            />
            <InfoRow
              icon="resize-outline"
              label="Área total"
              value={`${property.total_area_ha} ha`}
            />
            <InfoRow
              icon="people-outline"
              label="Empregados fixos"
              value={String(property.employees_count)}
            />
          </View>
        </Section>

        <Section
          title={`Áreas (${property.areas.length})`}
          onAdd={() => setAreaModal(true)}
        >
          {property.areas.length === 0 ? (
            <Empty text="Nenhuma área cadastrada (requisito 4.1)" />
          ) : (
            property.areas.map((area) => (
              <AreaRow key={area.id} area={area} propertyId={property.id} />
            ))
          )}
        </Section>

        <Section
          title={`Fontes de água (${property.water_sources.length})`}
          onAdd={() => setWaterModal(true)}
        >
          {property.water_sources.length === 0 ? (
            <Empty text="Nenhuma fonte de água registrada (C.3.1)" />
          ) : (
            property.water_sources.map((ws) => (
              <WaterRow key={ws.id} ws={ws} propertyId={property.id} />
            ))
          )}
        </Section>

        <Section
          title={`Vendas (${sales.length})`}
          onAdd={() => setSaleModal(true)}
        >
          {sales.length === 0 ? (
            <Empty text="Nenhum registro de venda (B.3)" />
          ) : (
            sales.map((s) => <SaleRow key={s.id} sale={s} />)
          )}
        </Section>
      </ScrollView>

      <AreaModal
        visible={areaModal}
        onClose={() => setAreaModal(false)}
        propertyId={property.id}
      />
      <WaterModal
        visible={waterModal}
        onClose={() => setWaterModal(false)}
        propertyId={property.id}
      />
      <SaleModal
        visible={saleModal}
        onClose={() => setSaleModal(false)}
        propertyId={property.id}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} style={styles.addBtn} activeOpacity={0.7}>
            <Ionicons name="add" size={20} color={Colors.primary} />
            <Text style={styles.addBtnText}>Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function CertificationCard({ cert }: { cert: Certification | null }) {
  if (!cert) {
    return (
      <View style={[styles.certCard, styles.certInactive]}>
        <Ionicons name="alert-circle" size={28} color={Colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.certTitleInactive}>Sem certificação ativa</Text>
          <Text style={styles.certSubtitle}>
            Realize uma auditoria para emitir a certificação Certifica Minas.
          </Text>
        </View>
      </View>
    );
  }

  const validUntil = formatDate(cert.valid_until);
  return (
    <View style={[styles.certCard, styles.certActive]}>
      <Ionicons name="ribbon" size={32} color={Colors.success} />
      <View style={{ flex: 1 }}>
        <Text style={styles.certTitleActive}>Certifica Minas ativo</Text>
        <Text style={styles.certSubtitle}>Válido até {validUntil}</Text>
        <Text style={styles.certHash} numberOfLines={1}>
          hash: {cert.on_chain_hash.slice(0, 16)}…
        </Text>
        {cert.tx_hash && (
          <Text style={styles.certHash} numberOfLines={1}>
            tx: {cert.tx_hash.slice(0, 16)}…
          </Text>
        )}
      </View>
    </View>
  );
}

function AreaRow({
  area,
  propertyId,
}: {
  area: PropertyArea;
  propertyId: string;
}) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => propertiesApi.deleteArea(propertyId, area.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property', propertyId] }),
  });

  function confirm() {
    Alert.alert('Remover área', 'Confirma a remoção desta área?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => del.mutate() },
    ]);
  }

  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{AREA_LABELS[area.area_type]}</Text>
        <Text style={styles.itemSubtitle}>
          {area.area_ha} ha{area.description ? ` · ${area.description}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={confirm} style={styles.trashBtn}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

function WaterRow({
  ws,
  propertyId,
}: {
  ws: WaterSource;
  propertyId: string;
}) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => propertiesApi.deleteWaterSource(propertyId, ws.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] }),
  });

  function confirm() {
    Alert.alert('Remover fonte', 'Confirma a remoção desta fonte?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => del.mutate() },
    ]);
  }

  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>
          {ws.name} · {WATER_LABELS[ws.source_type]}
        </Text>
        <Text style={styles.itemSubtitle}>
          {ws.is_protected ? 'Protegida' : 'Sem proteção declarada'}
          {ws.latitude && ws.longitude
            ? ` · ${ws.latitude}, ${ws.longitude}`
            : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={confirm} style={styles.trashBtn}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

function SaleRow({ sale }: { sale: SaleRecord }) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>
          {sale.buyer_name} · {sale.quantity_kg} kg
        </Text>
        <Text style={styles.itemSubtitle}>
          {formatDate(sale.sale_date)}
          {sale.total_value ? ` · R$ ${sale.total_value}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────

function AreaModal({
  visible,
  onClose,
  propertyId,
}: {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
}) {
  const [areaType, setAreaType] = useState<PropertyAreaType>(PropertyAreaType.COFFEE);
  const [areaHa, setAreaHa] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreatePropertyAreaRequest) =>
      propertiesApi.createArea(propertyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      setAreaHa('');
      setDescription('');
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível adicionar a área.';
      Alert.alert('Erro', String(detail));
    },
  });

  function submit() {
    const v = parseFloat(areaHa.replace(',', '.'));
    if (!v || isNaN(v) || v <= 0) {
      return Alert.alert('Atenção', 'Informe a área em hectares.');
    }
    mutation.mutate({
      area_type: areaType,
      area_ha: v,
      description: description.trim() || null,
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nova área">
      <Text style={styles.label}>Tipo de uso</Text>
      <View style={styles.chipsRow}>
        {(Object.keys(AREA_LABELS) as PropertyAreaType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, areaType === t && styles.chipActive]}
            onPress={() => setAreaType(t)}
          >
            <Text
              style={[styles.chipText, areaType === t && styles.chipTextActive]}
            >
              {AREA_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Área (ha)</Text>
      <TextInput
        style={styles.input}
        value={areaHa}
        onChangeText={setAreaHa}
        placeholder="Ex: 30"
        keyboardType="decimal-pad"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Descrição (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 64, paddingTop: 12 }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Talhão, variedade, etc."
        multiline
        placeholderTextColor={Colors.textMuted}
      />

      <Button title="Adicionar" onPress={submit} loading={mutation.isPending} />
    </BottomSheet>
  );
}

function WaterModal({
  visible,
  onClose,
  propertyId,
}: {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
}) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<WaterSourceType>(WaterSourceType.NASCENTE);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [protectionNotes, setProtectionNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateWaterSourceRequest) =>
      propertiesApi.createWaterSource(propertyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      setName('');
      setLat('');
      setLng('');
      setIsProtected(false);
      setProtectionNotes('');
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Erro ao adicionar fonte de água.';
      Alert.alert('Erro', String(detail));
    },
  });

  function submit() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    const latNum = lat ? parseFloat(lat.replace(',', '.')) : null;
    const lngNum = lng ? parseFloat(lng.replace(',', '.')) : null;
    mutation.mutate({
      name: name.trim(),
      source_type: sourceType,
      latitude: latNum,
      longitude: lngNum,
      is_protected: isProtected,
      protection_notes: protectionNotes.trim() || null,
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nova fonte de água">
      <Text style={styles.label}>Nome / identificação</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex: Nascente do morro"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipsRow}>
        {(Object.keys(WATER_LABELS) as WaterSourceType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, sourceType === t && styles.chipActive]}
            onPress={() => setSourceType(t)}
          >
            <Text
              style={[styles.chipText, sourceType === t && styles.chipTextActive]}
            >
              {WATER_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Latitude (opc.)</Text>
          <TextInput
            style={styles.input}
            value={lat}
            onChangeText={setLat}
            placeholder="-21.5"
            keyboardType="numbers-and-punctuation"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Longitude (opc.)</Text>
          <TextInput
            style={styles.input}
            value={lng}
            onChangeText={setLng}
            placeholder="-45.1"
            keyboardType="numbers-and-punctuation"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setIsProtected((p) => !p)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isProtected ? 'checkbox' : 'square-outline'}
          size={22}
          color={Colors.primary}
        />
        <Text style={styles.toggleLabel}>Possui medidas de proteção</Text>
      </TouchableOpacity>

      {isProtected && (
        <>
          <Text style={styles.label}>Como é protegida?</Text>
          <TextInput
            style={[styles.input, { height: 64, paddingTop: 12 }]}
            value={protectionNotes}
            onChangeText={setProtectionNotes}
            placeholder="Cercamento, mata ciliar..."
            multiline
            placeholderTextColor={Colors.textMuted}
          />
        </>
      )}

      <Button title="Adicionar" onPress={submit} loading={mutation.isPending} />
    </BottomSheet>
  );
}

function SaleModal({
  visible,
  onClose,
  propertyId,
}: {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
}) {
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerDoc, setBuyerDoc] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateSaleRequest) =>
      propertiesApi.createSale(propertyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-sales', propertyId] });
      setBuyerName('');
      setBuyerDoc('');
      setQuantityKg('');
      setUnitPrice('');
      setNotes('');
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Erro ao registrar venda.';
      Alert.alert('Erro', String(detail));
    },
  });

  function submit() {
    if (!buyerName.trim()) return Alert.alert('Atenção', 'Informe o comprador.');
    const qty = parseFloat(quantityKg.replace(',', '.'));
    if (!qty || isNaN(qty) || qty <= 0) {
      return Alert.alert('Atenção', 'Informe a quantidade em kg.');
    }
    const price = unitPrice ? parseFloat(unitPrice.replace(',', '.')) : null;
    const total = price ? price * qty : null;
    mutation.mutate({
      sale_date: saleDate,
      buyer_name: buyerName.trim(),
      buyer_document: buyerDoc.trim() || null,
      quantity_kg: qty,
      unit_price: price,
      total_value: total,
      notes: notes.trim() || null,
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Registrar venda">
      <Text style={styles.label}>Data da venda</Text>
      <TouchableOpacity
        style={[styles.input, styles.dateTrigger]}
        onPress={() => setCalendarOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.dateValue}>
          {saleDate ? formatDisplayDate(saleDate) : 'Selecionar data'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
      <CalendarPickerModal
        visible={calendarOpen}
        value={saleDate}
        onConfirm={(iso) => {
          setSaleDate(iso);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      <Text style={styles.label}>Comprador</Text>
      <TextInput
        style={styles.input}
        value={buyerName}
        onChangeText={setBuyerName}
        placeholder="Nome / empresa"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>CPF / CNPJ (opcional)</Text>
      <TextInput
        style={styles.input}
        value={buyerDoc}
        onChangeText={setBuyerDoc}
        placeholder="Apenas números"
        keyboardType="number-pad"
        placeholderTextColor={Colors.textMuted}
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Quantidade (kg)</Text>
          <TextInput
            style={styles.input}
            value={quantityKg}
            onChangeText={setQuantityKg}
            placeholder="0"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Preço/kg (opc.)</Text>
          <TextInput
            style={styles.input}
            value={unitPrice}
            onChangeText={setUnitPrice}
            placeholder="R$ 0,00"
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>

      <Text style={styles.label}>Notas (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 64, paddingTop: 12 }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="NF, contrato, observações..."
        multiline
        placeholderTextColor={Colors.textMuted}
      />

      <Button title="Registrar" onPress={submit} loading={mutation.isPending} />
    </BottomSheet>
  );
}

function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────

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
  scrollContent: { padding: 16, paddingBottom: 40 },

  certCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  certActive: { backgroundColor: Colors.successBg },
  certInactive: { backgroundColor: Colors.warningBg },
  certTitleActive: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.success,
  },
  certTitleInactive: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.warning,
  },
  certSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  certHash: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },

  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },

  itemRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemSubtitle: { fontSize: 12, color: Colors.textSecondary },
  trashBtn: { padding: 4 },

  empty: {
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  // Sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  sheetContent: { padding: 20, paddingBottom: 40, gap: 8 },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateValue: { fontSize: 14, color: Colors.textPrimary },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.textInverted, fontWeight: '700' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  toggleLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
});
