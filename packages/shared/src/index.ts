// User types
export interface User {
  id: string;
  email: string;
  name: string;
  googleId?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Motorcycle types
export interface Motorcycle {
  id: string;
  userId: string;
  brandId?: string;
  modelId?: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  currentKilometers: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMotorcycleRequest {
  brandId?: string;
  modelId?: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  currentKilometers?: number;
  imageUrl?: string;
}

// Maintenance types
export type MaintenanceType = 
  | 'oil_change'
  | 'tire_change'
  | 'brake_check'
  | 'chain_adjustment'
  | 'valve_adjustment'
  | 'coolant_flush'
  | 'air_filter'
  | 'spark_plugs'
  | 'technical_review'
  | 'circulation_permit'
  | 'other';

export interface MaintenanceRecord {
  id: string;
  motorcycleId: string;
  type: MaintenanceType;
  description: string;
  kilometersAtService: number;
  serviceDate: Date;
  cost?: number;
  notes?: string;
  nextServiceKilometers?: number;
  nextServiceDate?: Date;
  oilTypeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMaintenanceRequest {
  type: MaintenanceType;
  description: string;
  kilometersAtService: number;
  serviceDate: Date;
  cost?: number;
  notes?: string;
  nextServiceKilometers?: number;
  nextServiceDate?: Date;
  oilTypeId?: string;
}

// Document types
export type DocumentType = 
  | 'permiso_circulacion'
  | 'revision_tecnica'
  | 'seguro'
  | 'libre_deuda';

export type DocumentStatus = 'valid' | 'expiring' | 'expired';

export interface Document {
  id: string;
  motorcycleId: string;
  type: DocumentType;
  title: string;
  fileUrl: string;
  expiryDate?: Date;
  notes?: string;
  imagePath?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentRequest {
  type: DocumentType;
  title: string;
  fileUrl: string;
  expiryDate?: Date;
  notes?: string;
  imagePath?: string;
  ocrConfidence?: number;
  status?: DocumentStatus;
}

// Kilometer history types
export interface KilometerEntry {
  id: string;
  motorcycleId: string;
  readingKm: number;
  recordedAt: Date;
  notes?: string;
  createdAt: Date;
}

export interface CreateKilometerEntryRequest {
  readingKm: number;
  recordedAt: Date;
  notes?: string;
}

// Catalog types
export interface MotorcycleCatalogBrand {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface MotorcycleCatalogModel {
  id: string;
  brandId: string;
  name: string;
  year: number;
  imageUrl?: string;
}

export interface OilCatalogBrand {
  id: string;
  name: string;
}

export interface OilCatalogProduct {
  id: string;
  brandId: string;
  name: string;
  viscosity: string;
  type: 'synthetic' | 'semi-synthetic' | 'mineral';
}

// Maintenance types catalog
export interface MaintenanceTypeCatalog {
  id: string;
  name: string;
  defaultKmInterval?: number;
  defaultMonthInterval?: number;
  category: string;
}

// Notification types
export type NotificationType = 'document_expiry' | 'document_expiring' | 'maintenance_due' | 'maintenance_km_due';

export interface Notification {
  id: string;
  userId: string;
  motorcycleId?: string;
  type: NotificationType;
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
  isRead: boolean;
  createdAt: Date;
}

// OCR types
export interface OcrResult {
  date?: string;
  confidence: number;
  rawText: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// Export error types
export * from './errors';
