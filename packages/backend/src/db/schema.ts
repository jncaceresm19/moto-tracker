import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  googleId: text('google_id').unique(),
  rut: text('rut').unique(),
  verificadoClaveunica: integer('verificado_claveunica', { mode: 'boolean' }).default(false),
  identidadVerificada: integer('identidad_verificada', { mode: 'boolean' }).default(false),
  otpAttempts: integer('otp_attempts').default(0),
  otpLockedUntil: integer('otp_locked_until', { mode: 'timestamp' }),
  avatarUrl: text('avatar_url'),
  pushToken: text('push_token'),
  lastLatitude: real('last_latitude'),
  lastLongitude: real('last_longitude'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Motorcycles table
export const motorcycles = sqliteTable('motorcycles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  brandId: text('brand_id').references(() => motorcycleCatalogBrands.id),
  modelId: text('model_id').references(() => motorcycleCatalogModels.id),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  licensePlate: text('license_plate').notNull().unique(),
  currentKilometers: real('current_kilometers').notNull().default(0),
  imageUrl: text('image_url'),
  gpsTracker: text('gps_tracker'),
  // Verification fields
  verificada: integer('verificada', { mode: 'boolean' }).default(false),
  verificadaEn: integer('verificada_en', { mode: 'timestamp' }),
  verificadaPor: text('verificada_por'), // 'clave_unica' | 'carnet' | 'padron'
  fotoConPatente: text('foto_con_patente'),
  rtVigente: integer('rt_vigente', { mode: 'boolean' }),
  encargoRobo: integer('encargo_robo', { mode: 'boolean' }).default(false),
  desvinculada: integer('desvinculada', { mode: 'boolean' }).default(false),
  desvinculadaEn: integer('desvinculada_en', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Maintenance records table
export const maintenanceRecords = sqliteTable('maintenance_records', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  type: text('type').notNull(), // 'oil_change', 'tire_change', 'brake_check', 'technical_review', 'circulation_permit', 'other'
  description: text('description').notNull(),
  kilometersAtService: real('kilometers_at_service').notNull(),
  serviceDate: integer('service_date', { mode: 'timestamp' }).notNull(),
  cost: real('cost'),
  notes: text('notes'),
  photoUrl: text('photo_url'), // Photo of the product/service
  nextServiceKilometers: real('next_service_kilometers'),
  nextServiceDate: integer('next_service_date', { mode: 'timestamp' }),
  oilTypeId: text('oil_type_id').references(() => oilCatalogProducts.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Documents table (for circulation permit, technical review, etc.)
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  type: text('type').notNull(), // 'circulation_permit', 'technical_review', 'insurance', 'padron', 'drivers_license', 'fines'
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  fileUrlBack: text('file_url_back'), // For driver's license back photo
  issueDate: integer('issue_date', { mode: 'timestamp' }),
  expiryDate: integer('expiry_date', { mode: 'timestamp' }),
  notes: text('notes'),
  imagePath: text('image_path'),
  ocrConfidence: real('ocr_confidence'),
  status: text('status').default('valid'), // 'valid', 'expiring', 'expired'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Kilometer history table
export const kilometerHistory = sqliteTable('kilometer_history', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  readingKm: real('reading_km').notNull(),
  recordedAt: integer('recorded_at', { mode: 'timestamp' }).notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Motorcycle catalog brands
export const motorcycleCatalogBrands = sqliteTable('motorcycle_catalog_brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
});

// Motorcycle catalog models
export const motorcycleCatalogModels = sqliteTable('motorcycle_catalog_models', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => motorcycleCatalogBrands.id),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  imageUrl: text('image_url'),
});

// Oil catalog brands
export const oilCatalogBrands = sqliteTable('oil_catalog_brands', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

// Oil catalog products
export const oilCatalogProducts = sqliteTable('oil_catalog_products', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => oilCatalogBrands.id),
  name: text('name').notNull(),
  viscosity: text('viscosity').notNull(),
  type: text('type').notNull(), // 'synthetic', 'semi-synthetic', 'mineral'
});

// Maintenance types
export const maintenanceTypes = sqliteTable('maintenance_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultKmInterval: real('default_km_interval'),
  defaultMonthInterval: integer('default_month_interval'),
  category: text('category').notNull(),
});

// Notifications
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  motorcycleId: text('motorcycle_id').references(() => motorcycles.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  showAt: integer('show_at', { mode: 'timestamp' }), // when to show (null = immediately)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Theft Alerts table
export const theftAlerts = sqliteTable('theft_alerts', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  userId: text('user_id').notNull().references(() => users.id),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  licensePlate: text('license_plate').notNull(),
  photoUrl: text('photo_url'),
  lastLatitude: real('last_latitude'), // nullable for manual publications without GPS
  lastLongitude: real('last_longitude'), // nullable for manual publications without GPS
  lastLocationName: text('last_location_name'),
  notes: text('notes'),
  status: text('status').notNull().default('active'), // 'active', 'closed', 'recovered'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  recoveredAt: integer('recovered_at', { mode: 'timestamp' }), // when owner marked as found (card stays green until end of day)
});

// Theft Alert Responses table
export const theftAlertResponses = sqliteTable('theft_alert_responses', {
  id: text('id').primaryKey(),
  theftAlertId: text('theft_alert_id').notNull().references(() => theftAlerts.id),
  userId: text('user_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Indexes
export const idxMotorcyclesUserId = index('idx_motorcycles_user_id').on(motorcycles.userId);
export const idxMaintenanceMotorcycleId = index('idx_maintenance_motorcycle_id').on(maintenanceRecords.motorcycleId);
export const idxDocumentsMotorcycleId = index('idx_documents_motorcycle_id').on(documents.motorcycleId);
export const idxKilometerMotorcycleId = index('idx_kilometer_motorcycle_id').on(kilometerHistory.motorcycleId);
export const idxNotificationsUserIdRead = index('idx_notifications_user_id_read').on(notifications.userId, notifications.isRead);
export const idxDocumentsExpiry = index('idx_documents_expiry').on(documents.expiryDate);
export const idxMaintenanceNextService = index('idx_maintenance_next_service').on(maintenanceRecords.nextServiceDate, maintenanceRecords.nextServiceKilometers);
export const idxUsersEmail = uniqueIndex('idx_users_email').on(users.email);
export const idxUsersGoogleId = uniqueIndex('idx_users_google_id').on(users.googleId);
export const idxTheftAlertsUserId = index('idx_theft_alerts_user_id').on(theftAlerts.userId);
export const idxTheftAlertsStatus = index('idx_theft_alerts_status').on(theftAlerts.status);
export const idxTheftAlertsMotorcycleId = index('idx_theft_alerts_motorcycle_id').on(theftAlerts.motorcycleId);
export const idxTheftAlertResponsesAlertId = index('idx_theft_alert_responses_alert_id').on(theftAlertResponses.theftAlertId);

// Active Motorcycles table (for "moto en uso" feature)
export const activeMotos = sqliteTable('active_motos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  activatedAt: integer('activated_at', { mode: 'timestamp' }).notNull(),
  activationLat: real('activation_lat'),
  activationLon: real('activation_lon'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const idxActiveMotosUserId = index('idx_active_motos_user_id').on(activeMotos.userId);
export const idxActiveMotosUserUnique = uniqueIndex('idx_active_motos_user_unique').on(activeMotos.userId);

// Weather Cache table (for rain alerts)
export const weatherCache = sqliteTable('weather_cache', {
  zoneId: text('zone_id').primaryKey(),
  zoneName: text('zone_name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  data: text('data').notNull(),
  lastFetchedAt: integer('last_fetched_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const idxWeatherCacheLastFetched = index('idx_weather_cache_last_fetched').on(weatherCache.lastFetchedAt);

// OTP table
export const otps = sqliteTable('otps', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  code: text('code').notNull(),
  tipo: text('tipo').notNull().default('email'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
});

export const idxOtpsUserId = index('idx_otps_user_id').on(otps.userId);

// Pending verifications table (for manual review)
export const verificacionesPendientes = sqliteTable('verificaciones_pendientes', {
  id: text('id').primaryKey(),
  motorcycleId: text('motorcycle_id').notNull().references(() => motorcycles.id),
  userId: text('user_id').notNull().references(() => users.id),
  tipo: text('tipo').notNull(),
  archivoUrl: text('archivo_url').notNull(),
  estado: text('estado').notNull().default('pendiente'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewerNotes: text('reviewer_notes'),
});

export const idxVerificacionesMotorcycleId = index('idx_verificaciones_motorcycle_id').on(verificacionesPendientes.motorcycleId);
export const idxVerificacionesUserId = index('idx_verificaciones_user_id').on(verificacionesPendientes.userId);

// Indexes for verification
export const idxMotorcyclesVerificada = index('idx_motorcycles_verificada').on(motorcycles.verificada);
export const idxUsersRut = uniqueIndex('idx_users_rut').on(users.rut);