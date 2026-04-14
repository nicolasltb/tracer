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
  coffee_type: CoffeeType;
  weight_kg: number;
  origin_farm: string;
  origin_city: string;
  origin_state: string;
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
  events: TraceEvent[];
}

export interface BatchCreateResponse {
  id: string;
  code: string;
  status: BatchStatus;
  owner_id: string;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
  qr_token: string | null;
}
