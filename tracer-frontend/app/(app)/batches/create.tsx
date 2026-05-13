import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { batchesApi, propertiesApi, qrApi } from '@/services/api';
import { CoffeeType, CreateBatchRequest, Property } from '@/types';

interface CoffeeOption {
  value: CoffeeType;
  label: string;
  emoji: string;
}

const COFFEE_OPTIONS: CoffeeOption[] = [
  { value: CoffeeType.ARABICA, label: 'Arábica', emoji: '🌿' },
  { value: CoffeeType.ROBUSTA, label: 'Robusta', emoji: '💪' },
  { value: CoffeeType.BLEND, label: 'Blend', emoji: '✨' },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ---------- Calendar picker ----------

interface CalendarPickerProps {
  value: string;
  onConfirm: (iso: string) => void;
  onClose: () => void;
}

function CalendarPicker({ value, onConfirm, onClose }: CalendarPickerProps) {
  const today = new Date();
  const initial = value ? new Date(value + 'T12:00:00') : today;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState(value);

  function daysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }
  function firstDayOfWeek(y: number, m: number) {
    return (new Date(y, m, 1).getDay() + 6) % 7;
  }
  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    if (next > today) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }
  function isFuture(d: number) {
    return new Date(year, month, d) > today;
  }
  function toIso(d: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const totalDays = daysInMonth(year, month);
  const offset = firstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isNextDisabled = new Date(year, month + 1, 1) > today;

  return (
    <View style={cal.container}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} style={cal.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={cal.navBtn}
          activeOpacity={0.7}
          disabled={isNextDisabled}
        >
          <Ionicons name="chevron-forward" size={22} color={isNextDisabled ? Colors.border : Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={cal.weekRow}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <Text key={d} style={cal.weekDay}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={cal.cell} />;
          const iso = toIso(day);
          const isSelected = iso === selected;
          const disabled = isFuture(day);
          return (
            <TouchableOpacity
              key={iso}
              style={[cal.cell, isSelected && cal.cellSelected, disabled && cal.cellDisabled]}
              onPress={() => !disabled && setSelected(iso)}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <Text style={[cal.dayText, isSelected && cal.dayTextSelected, disabled && cal.dayTextDisabled]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={cal.actions}>
        <TouchableOpacity style={cal.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={cal.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cal.confirmBtn, !selected && cal.confirmBtnDisabled]}
          onPress={() => selected && onConfirm(selected)}
          activeOpacity={0.7}
          disabled={!selected}
        >
          <Text style={cal.confirmText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const CELL_SIZE = 40;
const cal = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  cellSelected: { backgroundColor: Colors.primary },
  cellDisabled: { opacity: 0.3 },
  dayText: { fontSize: 14, color: Colors.textPrimary },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextDisabled: { color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ---------- Helpers ----------

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ---------- Main screen ----------

export default function CreateBatchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [coffeeType, setCoffeeType] = useState<CoffeeType>(CoffeeType.ARABICA);
  const [weightKg, setWeightKg] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [description, setDescription] = useState('');

  const [propertyModal, setPropertyModal] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const [createdQrToken, setCreatedQrToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const { data: properties = [], isLoading: propsLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: propertiesApi.list,
  });

  const selectedProperty = properties.find((p) => p.id === propertyId) ?? null;

  const mutation = useMutation({
    mutationFn: (data: CreateBatchRequest) => batchesApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      if (response.qr_token) {
        setCreatedQrToken(response.qr_token);
      } else {
        Alert.alert('Sucesso', 'Lote criado com sucesso!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível criar o lote.';
      Alert.alert('Erro', String(message));
    },
  });

  function handleWeightChange(text: string) {
    const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parts = cleaned.split('.');
    setWeightKg(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned);
  }

  async function handleShare(token: string) {
    try {
      setShareLoading(true);
      const localUri = (FileSystem.cacheDirectory ?? '') + `qr_${token}.png`;
      await FileSystem.downloadAsync(qrApi.imageUrl(token), localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Indisponível', 'O compartilhamento não está disponível neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartilhar QR Code',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o QR code.');
    } finally {
      setShareLoading(false);
    }
  }

  function handleSubmit() {
    if (!propertyId) return Alert.alert('Atenção', 'Selecione uma propriedade.');
    const weight = parseFloat(weightKg);
    if (!weightKg || isNaN(weight) || weight <= 0) return Alert.alert('Atenção', 'Informe um peso válido.');
    if (!harvestDate) return Alert.alert('Atenção', 'Selecione a data da colheita.');

    mutation.mutate({
      property_id: propertyId,
      coffee_type: coffeeType,
      weight_kg: weight,
      harvest_date: harvestDate,
      description: description.trim() || undefined,
    });
  }

  if (createdQrToken) {
    const imageUrl = qrApi.imageUrl(createdQrToken);
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.qrSuccessContent}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          <Text style={styles.qrSuccessTitle}>Lote Criado!</Text>
          <Text style={styles.qrSuccessSubtitle}>
            Compartilhe o QR code abaixo com o processador para a próxima etapa.
          </Text>
          <View style={styles.qrCard}>
            <Image source={{ uri: imageUrl }} style={styles.qrImage} resizeMode="contain" />
            <Text style={styles.qrTokenText}>{createdQrToken.slice(0, 20)}...</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(createdQrToken)}
              activeOpacity={0.75}
              disabled={shareLoading}
            >
              {shareLoading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="share-outline" size={18} color={Colors.primary} />
              }
              <Text style={styles.shareButtonText}>
                {shareLoading ? 'Preparando...' : 'Compartilhar QR Code'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.qrActions}>
            <Button title="Ver Meus Lotes" onPress={() => router.replace('/(app)/batches')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo Lote</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Property picker */}
          <View style={styles.section}>
            <Text style={styles.label}>Propriedade</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerTrigger]}
              onPress={() => setPropertyModal(true)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                {selectedProperty ? (
                  <>
                    <Text style={styles.pickerValue}>{selectedProperty.name}</Text>
                    <Text style={styles.pickerSub}>
                      {selectedProperty.municipality}, {selectedProperty.state}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    {propsLoading ? 'Carregando…' : 'Selecionar propriedade'}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {!propsLoading && properties.length === 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(app)/properties/create')}
                activeOpacity={0.7}
                style={styles.linkRow}
              >
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.linkText}>Cadastrar primeira propriedade</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Café</Text>
            <View style={styles.coffeeTypeRow}>
              {COFFEE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.coffeeTypeCard, coffeeType === option.value && styles.coffeeTypeCardActive]}
                  onPress={() => setCoffeeType(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.coffeeTypeEmoji}>{option.emoji}</Text>
                  <Text style={[styles.coffeeTypeLabel, coffeeType === option.value && styles.coffeeTypeLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Peso (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={handleWeightChange}
              placeholder="Ex: 500"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Data da Colheita</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerTrigger]}
              onPress={() => setCalendarVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={harvestDate ? styles.pickerValue : styles.pickerPlaceholder}>
                {harvestDate ? formatDisplayDate(harvestDate) : 'Selecionar data'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Informações adicionais sobre este lote..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.submitWrapper}>
            <Button title="Criar Lote" onPress={handleSubmit} loading={mutation.isPending} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Property picker modal */}
      <Modal
        visible={propertyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setPropertyModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPropertyModal(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Propriedade</Text>
            <TouchableOpacity onPress={() => setPropertyModal(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={properties}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.propItem, propertyId === item.id && styles.propItemSelected]}
                onPress={() => { setPropertyId(item.id); setPropertyModal(false); }}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{item.name}</Text>
                  <Text style={styles.propSub}>
                    {item.municipality}, {item.state} · {item.total_area_ha} ha
                  </Text>
                </View>
                {propertyId === item.id && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={styles.pickerPlaceholder}>
                  Nenhuma propriedade cadastrada.
                </Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Calendar modal */}
      <Modal
        visible={calendarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalendarVisible(false)}
        />
        <CalendarPicker
          value={harvestDate}
          onConfirm={(iso) => { setHarvestDate(iso); setCalendarVisible(false); }}
          onClose={() => setCalendarVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 30 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  coffeeTypeRow: { flexDirection: 'row', gap: 10 },
  coffeeTypeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  coffeeTypeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  coffeeTypeEmoji: { fontSize: 28, marginBottom: 6 },
  coffeeTypeLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  coffeeTypeLabelActive: { color: Colors.primary },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  pickerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted },
  textArea: { height: 100, paddingTop: 14 },
  submitWrapper: { marginTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  propItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  propItemSelected: { backgroundColor: Colors.primary + '0D' },
  propName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  propSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  qrSuccessContent: { alignItems: 'center', padding: 32, paddingTop: 60, gap: 12 },
  qrSuccessTitle: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  qrSuccessSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginVertical: 16,
  },
  qrImage: { width: 220, height: 220 },
  qrTokenText: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace', marginTop: 12 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  shareButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  qrActions: { width: '100%', gap: 12, marginTop: 8 },
});
