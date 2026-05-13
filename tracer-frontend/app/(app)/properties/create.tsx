import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Button } from '@/components/Button';
import { propertiesApi } from '@/services/api';
import { CreatePropertyRequest } from '@/types';

const STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function CreatePropertyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [stateUf, setStateUf] = useState('MG');
  const [totalAreaHa, setTotalAreaHa] = useState('');
  const [employeesCount, setEmployeesCount] = useState('0');
  const [stateModal, setStateModal] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: CreatePropertyRequest) => propertiesApi.create(data),
    onSuccess: (prop) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      router.replace({
        pathname: '/(app)/properties/[id]',
        params: { id: prop.id },
      });
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Não foi possível cadastrar a propriedade.';
      Alert.alert('Erro', String(detail));
    },
  });

  function handleSubmit() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome da propriedade.');
    if (!address.trim()) return Alert.alert('Atenção', 'Informe o endereço.');
    if (!municipality.trim()) return Alert.alert('Atenção', 'Informe o município.');
    const area = parseFloat(totalAreaHa.replace(',', '.'));
    if (!area || isNaN(area) || area <= 0) {
      return Alert.alert('Atenção', 'Informe a área total em hectares.');
    }
    const emp = parseInt(employeesCount || '0', 10);
    if (isNaN(emp) || emp < 0) {
      return Alert.alert('Atenção', 'Informe um número válido de empregados.');
    }

    mutation.mutate({
      name: name.trim(),
      address: address.trim(),
      municipality: municipality.trim(),
      state: stateUf,
      total_area_ha: area,
      employees_count: emp,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova Propriedade</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Fazenda Santa Luzia"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Endereço completo</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={address}
              onChangeText={setAddress}
              placeholder="Estrada, distrito, referência..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 2 }]}>
              <Text style={styles.label}>Município</Text>
              <TextInput
                style={styles.input}
                value={municipality}
                onChangeText={setMunicipality}
                placeholder="Ex: Carmo de Minas"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>UF</Text>
              <TouchableOpacity
                style={[styles.input, styles.picker]}
                onPress={() => setStateModal(true)}
              >
                <Text style={styles.pickerVal}>{stateUf}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Área total (ha)</Text>
              <TextInput
                style={styles.input}
                value={totalAreaHa}
                onChangeText={setTotalAreaHa}
                placeholder="Ex: 80"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Empregados fixos</Text>
              <TextInput
                style={styles.input}
                value={employeesCount}
                onChangeText={(t) => setEmployeesCount(t.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.hint}>
            A contagem de empregados é usada para verificar se a CIPA TR
            (requisito D.6) se aplica à propriedade — só obrigatória acima de 20.
          </Text>

          <View style={{ marginTop: 24 }}>
            <Button
              title="Cadastrar Propriedade"
              onPress={handleSubmit}
              loading={mutation.isPending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={stateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setStateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStateModal(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar UF</Text>
            <TouchableOpacity onPress={() => setStateModal(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={STATES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.stateItem, stateUf === item && styles.stateItemSel]}
                onPress={() => {
                  setStateUf(item);
                  setStateModal(false);
                }}
              >
                <Text style={[styles.stateText, stateUf === item && styles.stateTextSel]}>
                  {item}
                </Text>
                {stateUf === item && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
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
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
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
    backgroundColor: Colors.surface,
  },
  multiline: { height: 88, paddingTop: 14 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerVal: { fontSize: 15, color: Colors.textPrimary },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: -4,
  },
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
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  stateItemSel: { backgroundColor: Colors.primary + '0D' },
  stateText: { fontSize: 16, color: Colors.textPrimary },
  stateTextSel: { fontWeight: '600', color: Colors.primary },
});
