import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { qrApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { QRScanRequest, UserRole, BatchStatus } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.FARMER]: 'Fazendeiro',
  [UserRole.PROCESSOR]: 'Processador',
  [UserRole.TRANSPORTER]: 'Transportador',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.ADMIN]: 'Administrador',
};

const STATUS_LABELS: Record<BatchStatus, string> = {
  [BatchStatus.HARVESTED]: 'Colhido',
  [BatchStatus.PROCESSING]: 'Em Processamento',
  [BatchStatus.ROASTING]: 'Em Torra',
  [BatchStatus.IN_TRANSIT]: 'Em Trânsito',
  [BatchStatus.DELIVERED]: 'Entregue',
  [BatchStatus.CERTIFIED]: 'Certificado',
};

// ---------- ChipSelect ----------

interface ChipSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}

function ChipSelect({ options, value, onChange }: ChipSelectProps) {
  return (
    <View style={chipStyles.row}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={[chipStyles.chip, selected && chipStyles.chipSelected]}
          >
            <Text style={[chipStyles.chipText, selected && chipStyles.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
  },
});

// ---------- Step-specific form sections ----------

interface ProcessingFormProps {
  processingMethod: string;
  setProcessingMethod: (v: string) => void;
}

function ProcessingForm({ processingMethod, setProcessingMethod }: ProcessingFormProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Método de Processamento</Text>
      <ChipSelect
        value={processingMethod}
        onChange={setProcessingMethod}
        options={[
          { label: 'Via Úmida', value: 'washed' },
          { label: 'Natural', value: 'natural' },
          { label: 'Honey', value: 'honey' },
          { label: 'Pulped Natural', value: 'pulped_natural' },
        ]}
      />
    </View>
  );
}

interface RoastingFormProps {
  temperature: string;
  setTemperature: (v: string) => void;
  humidity: string;
  setHumidity: (v: string) => void;
  duration: string;
  setDuration: (v: string) => void;
  roastLevel: string;
  setRoastLevel: (v: string) => void;
}

function RoastingForm({
  temperature,
  setTemperature,
  humidity,
  setHumidity,
  duration,
  setDuration,
  roastLevel,
  setRoastLevel,
}: RoastingFormProps) {
  return (
    <>
      <View style={styles.row2}>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Temperatura (°C)</Text>
          <TextInput
            style={styles.input}
            value={temperature}
            onChangeText={setTemperature}
            placeholder="Ex: 220"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Umidade (%)</Text>
          <TextInput
            style={styles.input}
            value={humidity}
            onChangeText={setHumidity}
            placeholder="Ex: 11"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Duração (min) — opcional</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="Ex: 12"
          placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nível de Torra</Text>
        <ChipSelect
          value={roastLevel}
          onChange={setRoastLevel}
          options={[
            { label: 'Clara', value: 'light' },
            { label: 'Média', value: 'medium' },
            { label: 'Escura', value: 'dark' },
          ]}
        />
      </View>
    </>
  );
}

interface TransportFormProps {
  transportType: string;
  setTransportType: (v: string) => void;
  vehicleId: string;
  setVehicleId: (v: string) => void;
}

function TransportForm({ transportType, setTransportType, vehicleId, setVehicleId }: TransportFormProps) {
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Meio de Transporte</Text>
        <ChipSelect
          value={transportType}
          onChange={setTransportType}
          options={[
            { label: 'Rodovia', value: 'road' },
            { label: 'Marítimo', value: 'sea' },
            { label: 'Ferroviário', value: 'rail' },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Placa / ID do Veículo — opcional</Text>
        <TextInput
          style={styles.input}
          value={vehicleId}
          onChangeText={setVehicleId}
          placeholder="Ex: ABC-1234"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          returnKeyType="done"
        />
      </View>
    </>
  );
}

interface DeliveryFormProps {
  condition: string;
  setCondition: (v: string) => void;
  recipientName: string;
  setRecipientName: (v: string) => void;
}

function DeliveryForm({ condition, setCondition, recipientName, setRecipientName }: DeliveryFormProps) {
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Condição da Entrega</Text>
        <ChipSelect
          value={condition}
          onChange={setCondition}
          options={[
            { label: 'Boa', value: 'good' },
            { label: 'Parcial', value: 'partial' },
            { label: 'Avariada', value: 'damaged' },
          ]}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nome do Destinatário — opcional</Text>
        <TextInput
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Ex: Torrefação Boa Vista"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="done"
        />
      </View>
    </>
  );
}

interface CertificationFormProps {
  certNumber: string;
  setCertNumber: (v: string) => void;
  certStandard: string;
  setCertStandard: (v: string) => void;
}

function CertificationForm({ certNumber, setCertNumber, certStandard, setCertStandard }: CertificationFormProps) {
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Número do Certificado — opcional</Text>
        <TextInput
          style={styles.input}
          value={certNumber}
          onChangeText={setCertNumber}
          placeholder="Ex: CERT-2024-00123"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          returnKeyType="next"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Certificação — opcional</Text>
        <ChipSelect
          value={certStandard}
          onChange={setCertStandard}
          options={[
            { label: 'Orgânico', value: 'organic' },
            { label: 'Fair Trade', value: 'fair_trade' },
            { label: 'Rainforest', value: 'rainforest_alliance' },
            { label: 'Outro', value: 'other' },
          ]}
        />
      </View>
    </>
  );
}

// ---------- Main screen ----------

export default function ProcessScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Common fields
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Processing step
  const [processingMethod, setProcessingMethod] = useState('');

  // Roasting step
  const [roastingTemp, setRoastingTemp] = useState('');
  const [roastingHumidity, setRoastingHumidity] = useState('');
  const [roastingDuration, setRoastingDuration] = useState('');
  const [roastLevel, setRoastLevel] = useState('');

  // Transport step
  const [transportType, setTransportType] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  // Delivery step
  const [deliveryCondition, setDeliveryCondition] = useState('');
  const [recipientName, setRecipientName] = useState('');

  // Certification step
  const [certNumber, setCertNumber] = useState('');
  const [certStandard, setCertStandard] = useState('');

  const [resultToken, setResultToken] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const {
    data: qrInfo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['qr-info', token],
    queryFn: () => qrApi.info(token),
    enabled: !!token,
  });

  const scanMutation = useMutation({
    mutationFn: (data: QRScanRequest) => qrApi.scan(token, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batch', response.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['events', response.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['batch-qr', response.batch_id] });
      if (response.next_qr_token) {
        setResultToken(response.next_qr_token);
      } else {
        Alert.alert('Sucesso', 'Etapa processada! Este é o passo final.', [
          { text: 'OK', onPress: () => router.replace('/(app)/batches') },
        ]);
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível processar esta etapa.';
      Alert.alert('Erro', String(message));
    },
  });

  function buildMetadata(): Record<string, unknown> | undefined {
    if (!qrInfo) return undefined;

    switch (qrInfo.batch_status) {
      case BatchStatus.HARVESTED:
        return processingMethod ? { processing_method: processingMethod } : undefined;

      case BatchStatus.PROCESSING: {
        const meta: Record<string, unknown> = {};
        if (roastingTemp) meta.temperature_c = parseFloat(roastingTemp);
        if (roastingHumidity) meta.humidity_pct = parseFloat(roastingHumidity);
        if (roastingDuration) meta.duration_min = parseFloat(roastingDuration);
        if (roastLevel) meta.roast_level = roastLevel;
        return Object.keys(meta).length ? meta : undefined;
      }

      case BatchStatus.ROASTING: {
        const meta: Record<string, unknown> = {};
        if (transportType) meta.transport_type = transportType;
        if (vehicleId.trim()) meta.vehicle_id = vehicleId.trim();
        return Object.keys(meta).length ? meta : undefined;
      }

      case BatchStatus.IN_TRANSIT: {
        const meta: Record<string, unknown> = {};
        if (deliveryCondition) meta.delivery_condition = deliveryCondition;
        if (recipientName.trim()) meta.recipient_name = recipientName.trim();
        return Object.keys(meta).length ? meta : undefined;
      }

      case BatchStatus.DELIVERED: {
        const meta: Record<string, unknown> = {};
        if (certNumber.trim()) meta.certificate_number = certNumber.trim();
        if (certStandard) meta.certification_standard = certStandard;
        return Object.keys(meta).length ? meta : undefined;
      }

      default:
        return undefined;
    }
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
    const payload: QRScanRequest = {
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      metadata_json: buildMetadata(),
    };
    scanMutation.mutate(payload);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !qrInfo) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <Text style={styles.errorText}>Não foi possível carregar as informações do QR code.</Text>
        <Button title="Voltar" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // Success — show generated QR
  if (resultToken) {
    const imageUrl = qrApi.imageUrl(resultToken);
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          <Text style={styles.successTitle}>Etapa Registrada!</Text>
          <Text style={styles.successSubtitle}>
            Compartilhe o QR code abaixo com o próximo responsável da cadeia.
          </Text>

          <View style={styles.qrCard}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
            <Text style={styles.qrTokenText}>{resultToken.slice(0, 20)}...</Text>

            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(resultToken)}
              activeOpacity={0.75}
              disabled={shareLoading}
            >
              {shareLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="share-outline" size={18} color={Colors.primary} />
              )}
              <Text style={styles.shareButtonText}>
                {shareLoading ? 'Preparando...' : 'Compartilhar QR Code'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.successActions}>
            <Button
              title="Ver Lote"
              onPress={() =>
                router.replace(`/(app)/batches/${qrInfo.batch_id}`)
              }
            />
            <Button
              title="Escanear Outro"
              variant="outline"
              onPress={() => router.replace('/(app)/scan')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const canProcess =
    user &&
    (user.role === UserRole.ADMIN || user.role === qrInfo.expected_role);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Processar Etapa</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Batch info card */}
          <View style={styles.infoCard}>
            <Text style={styles.batchCode}>{qrInfo.batch_code}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.infoLabel}>Status atual:</Text>
              <StatusBadge status={qrInfo.batch_status} small />
            </View>
            {qrInfo.next_status && (
              <View style={styles.statusRow}>
                <Text style={styles.infoLabel}>Próximo status:</Text>
                <StatusBadge status={qrInfo.next_status} small />
              </View>
            )}
            {qrInfo.expected_role && (
              <View style={styles.statusRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.roleText}>
                  Papel esperado: {ROLE_LABELS[qrInfo.expected_role]}
                </Text>
              </View>
            )}
          </View>

          {!canProcess && (
            <View style={styles.warningCard}>
              <Ionicons name="warning-outline" size={20} color={Colors.warning} />
              <Text style={styles.warningText}>
                Seu papel ({user ? ROLE_LABELS[user.role] : '?'}) não corresponde ao
                esperado ({qrInfo.expected_role ? ROLE_LABELS[qrInfo.expected_role] : '?'}).
              </Text>
            </View>
          )}

          {/* Event form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Dados da Etapa</Text>

            {/* Step-specific fields */}
            {qrInfo.batch_status === BatchStatus.HARVESTED && (
              <ProcessingForm
                processingMethod={processingMethod}
                setProcessingMethod={setProcessingMethod}
              />
            )}

            {qrInfo.batch_status === BatchStatus.PROCESSING && (
              <RoastingForm
                temperature={roastingTemp}
                setTemperature={setRoastingTemp}
                humidity={roastingHumidity}
                setHumidity={setRoastingHumidity}
                duration={roastingDuration}
                setDuration={setRoastingDuration}
                roastLevel={roastLevel}
                setRoastLevel={setRoastLevel}
              />
            )}

            {qrInfo.batch_status === BatchStatus.ROASTING && (
              <TransportForm
                transportType={transportType}
                setTransportType={setTransportType}
                vehicleId={vehicleId}
                setVehicleId={setVehicleId}
              />
            )}

            {qrInfo.batch_status === BatchStatus.IN_TRANSIT && (
              <DeliveryForm
                condition={deliveryCondition}
                setCondition={setDeliveryCondition}
                recipientName={recipientName}
                setRecipientName={setRecipientName}
              />
            )}

            {qrInfo.batch_status === BatchStatus.DELIVERED && (
              <CertificationForm
                certNumber={certNumber}
                setCertNumber={setCertNumber}
                certStandard={certStandard}
                setCertStandard={setCertStandard}
              />
            )}

            {/* Common fields */}
            <View style={styles.field}>
              <Text style={styles.label}>Localização (opcional)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Ex: Armazém Central, São Paulo"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Observações (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Detalhes sobre esta etapa..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.submitWrapper}>
            <Button
              title="Confirmar Etapa"
              onPress={handleSubmit}
              loading={scanMutation.isPending}
              disabled={!canProcess}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
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
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 30,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  batchCode: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  roleText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.warningBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 18,
  },
  formSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
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
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  submitWrapper: {
    marginTop: 8,
  },
  // Success state
  successContent: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 60,
    gap: 12,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  successSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
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
  qrImage: {
    width: 220,
    height: 220,
  },
  qrTokenText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 12,
  },
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
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  successActions: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
});
