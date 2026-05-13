export enum UserRole {
  FARMER = 'farmer',
  PROCESSOR = 'processor',
  TRANSPORTER = 'transporter',
  AUDITOR = 'auditor',
  ADMIN = 'admin',
}

export enum BatchStatus {
  HARVESTED = 'harvested',
  PROCESSING = 'processing',
  ROASTING = 'roasting',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CERTIFIED = 'certified',
}

export enum CoffeeType {
  ARABICA = 'arabica',
  ROBUSTA = 'robusta',
  BLEND = 'blend',
}

export enum EventType {
  HARVEST = 'harvest',
  PROCESSING_START = 'processing_start',
  PROCESSING_END = 'processing_end',
  PICKUP = 'pickup',
  IN_TRANSIT = 'in_transit',
  DELIVERY = 'delivery',
  ROASTING_START = 'roasting_start',
  ROASTING_END = 'roasting_end',
  PACKAGING = 'packaging',
  INSPECTION = 'inspection',
  CERTIFICATION = 'certification',
  NOTE = 'note',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  wallet_address: string | null;
  created_at: string;
}

export interface WalletInfo {
  wallet_address: string | null;
  role: UserRole;
}

// ---------- Batch (DB index — list view) ----------

export interface Batch {
  id: string;
  code: string;
  status: BatchStatus;
  owner_id: string;
  property_id: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Batch chain data (detail view) ----------

export interface BatchChainData {
  coffee_type: string | null;
  weight_kg: number | null;
  origin_farm: string | null;
  origin_city: string | null;
  origin_state: string | null;
  harvest_date: string | null;
  description: string | null;
}

// ---------- Event from chain ----------

export interface EventChainData {
  event_type: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata_json: Record<string, unknown> | null;
  notes: string | null;
  actor_address: string;
  timestamp: string;
  block_number: number;
  tx_hash?: string | null;
}

// ---------- Batch detail (DB index + chain data) ----------

export interface BatchDetail {
  id: string;
  code: string;
  status: BatchStatus;
  owner_id: string;
  property_id: string;
  tx_hash: string | null;
  created_at: string;
  chain: BatchChainData | null;
  events: EventChainData[];
}

// ---------- Event index (DB) ----------

export interface BatchEvent {
  id: string;
  batch_id: string;
  actor_id: string;
  event_type: EventType;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface CreateBatchRequest {
  property_id: string;
  coffee_type: CoffeeType;
  weight_kg: number;
  harvest_date: string;
  description?: string;
}

export interface UpdateBatchStatusRequest {
  status: BatchStatus;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// ---------- QR Code ----------

export interface QRTokenInfo {
  token: string;
  batch_id: string;
  batch_code: string;
  batch_status: BatchStatus;
  next_status: BatchStatus | null;
  expected_role: UserRole | null;
  is_consumer: boolean;
  is_active: boolean;
}

export interface QRScanRequest {
  location?: string;
  latitude?: number;
  longitude?: number;
  metadata_json?: Record<string, unknown>;
  notes?: string;
}

export interface QRScanResponse {
  batch_id: string;
  batch_code: string;
  new_status: BatchStatus;
  event: BatchEvent;
  next_qr_token: string | null;
  is_final: boolean;
}

export interface TraceEvent {
  event_type: string;
  actor_address: string;
  location: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  block_number: number;
}

export interface TracePropertySummary {
  id: string;
  name: string;
  municipality: string;
  state: string;
}

export interface TraceCertification {
  id: string;
  issued_at: string;
  valid_until: string;
  is_active: boolean;
  on_chain_hash: string;
  tx_hash: string | null;
  block_number: number | null;
}

export interface TraceResponse {
  code: string;
  status: BatchStatus;
  tx_hash: string | null;
  created_at: string;
  coffee_type: string | null;
  weight_kg: number | null;
  origin_farm: string | null;
  origin_city: string | null;
  origin_state: string | null;
  harvest_date: string | null;
  owner_address: string | null;
  property_: TracePropertySummary | null;
  certification: TraceCertification | null;
  events: TraceEvent[];
}

export interface BatchCreateResponse {
  id: string;
  code: string;
  status: BatchStatus;
  owner_id: string;
  property_id: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
  qr_token: string | null;
}

// ---------- Documents ----------

export enum DocumentType {
  PROPERTY_MAP = 'property_map',
  WATER_SOURCE_PHOTO = 'water_source_photo',
  CIPA_TR = 'cipa_tr',
  INVOICE = 'invoice',
  AUDIT_EVIDENCE = 'audit_evidence',
  OTHER = 'other',
}

export interface Document {
  id: string;
  uploaded_by_id: string;
  doc_type: DocumentType;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
}

// ---------- Property ----------

export enum PropertyAreaType {
  COFFEE = 'coffee',
  NATIVE_FOREST = 'native_forest',
  APP = 'app',
  BUILDINGS = 'buildings',
  WATER_BODIES = 'water_bodies',
  OTHER = 'other',
}

export enum WaterSourceType {
  NASCENTE = 'nascente',
  CURSO_AGUA = 'curso_agua',
  POCO = 'poco',
  OTHER = 'other',
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  municipality: string;
  state: string;
  total_area_ha: string;
  employees_count: number;
  map_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyDetail extends Property {
  areas: PropertyArea[];
  water_sources: WaterSource[];
}

export interface PropertyArea {
  id: string;
  property_id: string;
  area_type: PropertyAreaType;
  area_ha: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaterSource {
  id: string;
  property_id: string;
  name: string;
  source_type: WaterSourceType;
  latitude: string | null;
  longitude: string | null;
  description: string | null;
  is_protected: boolean;
  protection_notes: string | null;
  photo_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePropertyRequest {
  name: string;
  address: string;
  municipality: string;
  state: string;
  total_area_ha: number;
  employees_count: number;
  map_doc_id?: string | null;
}

export type UpdatePropertyRequest = Partial<CreatePropertyRequest>;

export interface CreatePropertyAreaRequest {
  area_type: PropertyAreaType;
  area_ha: number;
  description?: string | null;
}

export interface CreateWaterSourceRequest {
  name: string;
  source_type: WaterSourceType;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  is_protected: boolean;
  protection_notes?: string | null;
  photo_doc_id?: string | null;
}

// ---------- Sales (B.3) ----------

export interface SaleRecord {
  id: string;
  property_id: string;
  batch_id: string | null;
  sale_date: string;
  buyer_name: string;
  buyer_document: string | null;
  quantity_kg: string;
  unit_price: string | null;
  total_value: string | null;
  notes: string | null;
  invoice_doc_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSaleRequest {
  batch_id?: string | null;
  sale_date: string;
  buyer_name: string;
  buyer_document?: string | null;
  quantity_kg: number;
  unit_price?: number | null;
  total_value?: number | null;
  notes?: string | null;
  invoice_doc_id?: string | null;
}

// ---------- Audits ----------

export enum AuditStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export enum ComplianceStatus {
  CONFORME = 'conforme',
  NAO_CONFORME = 'nao_conforme',
  NAO_APLICAVEL = 'nao_aplicavel',
}

export enum RequirementCode {
  REQ_4_1 = '4.1',
  REQ_B_3 = 'B.3',
  REQ_C_3_1 = 'C.3.1',
  REQ_C_3_2 = 'C.3.2',
  REQ_C_3_6 = 'C.3.6',
  REQ_C_4_1 = 'C.4.1',
  REQ_C_5_1 = 'C.5.1',
  REQ_C_6_3 = 'C.6.3',
  REQ_D_1 = 'D.1',
  REQ_D_2 = 'D.2',
  REQ_D_3 = 'D.3',
  REQ_D_4 = 'D.4',
  REQ_D_5 = 'D.5',
  REQ_D_6 = 'D.6',
}

export const REQUIREMENT_LABELS: Record<RequirementCode, string> = {
  [RequirementCode.REQ_4_1]:
    'Áreas da propriedade identificadas em mapa ou croqui',
  [RequirementCode.REQ_B_3]:
    'Registro atualizado de comercialização, sem indícios de irregularidades',
  [RequirementCode.REQ_C_3_1]:
    'Fontes de água identificadas em mapa, croqui ou foto aérea',
  [RequirementCode.REQ_C_3_2]: 'Práticas de proteção das nascentes',
  [RequirementCode.REQ_C_3_6]:
    'Sem intervenções não autorizadas em cursos d’água',
  [RequirementCode.REQ_C_4_1]: 'Sem desmatamento sem autorização',
  [RequirementCode.REQ_C_5_1]:
    'Sem comércio de fauna/flora silvestres; preservação ambiental',
  [RequirementCode.REQ_C_6_3]:
    'Resíduos agroindustriais tratados ou utilizados adequadamente',
  [RequirementCode.REQ_D_1]: 'Proibição de trabalho infantil',
  [RequirementCode.REQ_D_2]: 'Proibição de trabalho forçado',
  [RequirementCode.REQ_D_3]:
    'Proibição de discriminação e tráfico de pessoas',
  [RequirementCode.REQ_D_4]: 'Liberdade de organização dos trabalhadores',
  [RequirementCode.REQ_D_5]: 'Acesso ao sistema de saúde',
  [RequirementCode.REQ_D_6]:
    'CIPA TR obrigatória para >20 empregados fixos',
};

export const ALL_REQUIREMENTS: RequirementCode[] = [
  RequirementCode.REQ_4_1,
  RequirementCode.REQ_B_3,
  RequirementCode.REQ_C_3_1,
  RequirementCode.REQ_C_3_2,
  RequirementCode.REQ_C_3_6,
  RequirementCode.REQ_C_4_1,
  RequirementCode.REQ_C_5_1,
  RequirementCode.REQ_C_6_3,
  RequirementCode.REQ_D_1,
  RequirementCode.REQ_D_2,
  RequirementCode.REQ_D_3,
  RequirementCode.REQ_D_4,
  RequirementCode.REQ_D_5,
  RequirementCode.REQ_D_6,
];

export interface ComplianceCheck {
  id: string;
  audit_id: string;
  requirement_code: RequirementCode;
  status: ComplianceStatus;
  notes: string | null;
  evidence_doc_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  property_id: string;
  auditor_id: string;
  status: AuditStatus;
  visit_date: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditDetail extends Audit {
  checks: ComplianceCheck[];
  certification_id: string | null;
}

export interface CreateAuditRequest {
  property_id: string;
  visit_date?: string | null;
  notes?: string | null;
}

export interface UpsertCheckRequest {
  requirement_code: RequirementCode;
  status: ComplianceStatus;
  notes?: string | null;
  evidence_doc_ids: string[];
}

export interface SubmitAuditRequest {
  latitude: number;
  longitude: number;
  visit_date?: string | null;
  notes?: string | null;
}

export interface AuditSubmitResponse extends AuditDetail {
  certification_issued: boolean;
  certification_reason: string | null;
}

// ---------- Certification ----------

export interface Certification {
  id: string;
  property_id: string;
  audit_id: string;
  issued_at: string;
  valid_until: string;
  is_active: boolean;
  on_chain_hash: string;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}
