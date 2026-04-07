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

export interface BatchEvent {
  id: string;
  batch_id: string;
  event_type: EventType;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  metadata_json: Record<string, unknown> | null;
  tx_hash: string | null;
  created_at: string;
  created_by: string;
}

export interface Batch {
  id: string;
  code: string;
  coffee_type: CoffeeType;
  weight_kg: number;
  origin_farm: string;
  origin_city: string;
  origin_state: string;
  harvest_date: string;
  description: string | null;
  status: BatchStatus;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  events?: BatchEvent[];
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

export interface CreateEventRequest {
  event_type: EventType;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  metadata_json?: Record<string, unknown>;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}
