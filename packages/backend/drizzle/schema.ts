import { sqliteTable, AnySQLiteColumn, foreignKey, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const documents = sqliteTable("documents", {
	id: text().primaryKey().notNull(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	type: text().notNull(),
	title: text().notNull(),
	fileUrl: text("file_url").notNull(),
	expiryDate: integer("expiry_date"),
	notes: text(),
	imagePath: text("image_path"),
	ocrConfidence: real("ocr_confidence"),
	status: text().default("valid"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	issueDate: integer("issue_date"),
	fileUrlBack: text("file_url_back"),
	fileUrlGenerated: text("file_url_generated"),
	fileUrlBackGenerated: text("file_url_back_generated"),
});

export const kilometerHistory = sqliteTable("kilometer_history", {
	id: text().primaryKey().notNull(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	readingKm: real("reading_km").notNull(),
	recordedAt: integer("recorded_at").notNull(),
	notes: text(),
	createdAt: integer("created_at").notNull(),
});

export const maintenanceRecords = sqliteTable("maintenance_records", {
	id: text().primaryKey().notNull(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	type: text().notNull(),
	description: text().notNull(),
	kilometersAtService: real("kilometers_at_service").notNull(),
	serviceDate: integer("service_date").notNull(),
	cost: real(),
	notes: text(),
	nextServiceKilometers: real("next_service_kilometers"),
	nextServiceDate: integer("next_service_date"),
	oilTypeId: text("oil_type_id").references(() => oilCatalogProducts.id),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	photoUrl: text("photo_url"),
});

export const maintenanceTypes = sqliteTable("maintenance_types", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	defaultKmInterval: real("default_km_interval"),
	defaultMonthInterval: integer("default_month_interval"),
	category: text().notNull(),
});

export const motorcycleCatalogBrands = sqliteTable("motorcycle_catalog_brands", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	logoUrl: text("logo_url"),
});

export const motorcycleCatalogModels = sqliteTable("motorcycle_catalog_models", {
	id: text().primaryKey().notNull(),
	brandId: text("brand_id").notNull().references(() => motorcycleCatalogBrands.id),
	name: text().notNull(),
	year: integer().notNull(),
	imageUrl: text("image_url"),
});

export const motorcycles = sqliteTable("motorcycles", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id),
	brandId: text("brand_id").references(() => motorcycleCatalogBrands.id),
	modelId: text("model_id").references(() => motorcycleCatalogModels.id),
	brand: text().notNull(),
	model: text().notNull(),
	year: integer().notNull(),
	licensePlate: text("license_plate").notNull(),
	currentKilometers: real("current_kilometers").notNull(),
	imageUrl: text("image_url"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	gpsTracker: text("gps_tracker"),
	verificada: integer().default(0).notNull(),
	verificadaEn: text("verificada_en"),
	verificadaPor: text("verificada_por"),
	fotoConPatente: text("foto_con_patente"),
	rtVigente: integer("rt_vigente"),
	encargoRobo: integer("encargo_robo").default(0).notNull(),
	desvinculada: integer().default(0).notNull(),
	desvinculadaEn: text("desvinculada_en"),
	color: text(),
	engineNumber: text("engine_number"),
	chassisNumber: text("chassis_number"),
	serialNumber: text("serial_number"),
	padronBackUrl: text("padron_back_url"),
	rutTitular: text("rut_titular"),
	permitMunicipalityId: text("permit_municipality_id").references(() => municipalities.id),
},
(table) => [
	index("idx_motorcycles_permit_municipality").on(table.permitMunicipalityId),
	uniqueIndex("motorcycles_license_plate_unique").on(table.licensePlate),
]);

export const notifications = sqliteTable("notifications", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id),
	motorcycleId: text("motorcycle_id").references(() => motorcycles.id),
	type: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	isRead: integer("is_read").default(false),
	createdAt: integer("created_at").notNull(),
	showAt: integer("show_at"),
});

export const oilCatalogBrands = sqliteTable("oil_catalog_brands", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
});

export const oilCatalogProducts = sqliteTable("oil_catalog_products", {
	id: text().primaryKey().notNull(),
	brandId: text("brand_id").notNull().references(() => oilCatalogBrands.id),
	name: text().notNull(),
	viscosity: text().notNull(),
	type: text().notNull(),
});

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text().notNull(),
	googleId: text("google_id"),
	avatarUrl: text("avatar_url"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	phone: text(),
	pushToken: text("push_token"),
	lastLatitude: real("last_latitude"),
	lastLongitude: real("last_longitude"),
	rut: text(),
	verificadoClaveunica: integer("verificado_claveunica").default(0).notNull(),
	identidadVerificada: integer("identidad_verificada").default(0).notNull(),
	otpAttempts: integer("otp_attempts").default(0).notNull(),
	otpLockedUntil: text("otp_locked_until"),
	role: text().default("user").notNull(),
	birthDate: text("birth_date"),
},
(table) => [
	uniqueIndex("users_google_id_unique").on(table.googleId),
	uniqueIndex("users_email_unique").on(table.email),
]);

export const theftAlertResponses = sqliteTable("theft_alert_responses", {
	id: text().primaryKey().notNull(),
	theftAlertId: text("theft_alert_id").notNull().references(() => theftAlerts.id),
	userId: text("user_id").notNull().references(() => users.id),
	text: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

export const theftAlerts = sqliteTable("theft_alerts", {
	id: text().primaryKey(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	userId: text("user_id").notNull().references(() => users.id),
	brand: text().notNull(),
	model: text().notNull(),
	licensePlate: text("license_plate").notNull(),
	photoUrl: text("photo_url"),
	lastLatitude: real("last_latitude"),
	lastLongitude: real("last_longitude"),
	lastLocationName: text("last_location_name"),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	closedAt: integer("closed_at"),
	recoveredAt: integer("recovered_at"),
	notes: text(),
},
(table) => [
	index("idx_theft_alerts_motorcycle_id").on(table.motorcycleId),
	index("idx_theft_alerts_status").on(table.status),
	index("idx_theft_alerts_user_id").on(table.userId),
]);

export const activeMotos = sqliteTable("active_motos", {
	id: text().primaryKey(),
	userId: text("user_id").notNull().references(() => users.id),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	activatedAt: integer("activated_at").notNull(),
	activationLat: real("activation_lat"),
	activationLon: real("activation_lon"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("idx_active_motos_user_unique").on(table.userId),
	index("idx_active_motos_user_id").on(table.userId),
]);

export const otps = sqliteTable("otps", {
	id: text().primaryKey(),
	userId: text("user_id").notNull().references(() => users.id),
	code: text().notNull(),
	expiresAt: text("expires_at").notNull(),
	verified: integer().default(0).notNull(),
	attempts: integer().default(0).notNull(),
	createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
	tipo: text().default("email").notNull(),
	used: integer().default(0).notNull(),
});

export const verificacionesPendientes = sqliteTable("verificaciones_pendientes", {
	id: text().primaryKey(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	userId: text("user_id").notNull().references(() => users.id),
	padronUrl: text("padron_url").notNull(),
	carnetFrontUrl: text("carnet_front_url"),
	carnetBackUrl: text("carnet_back_url"),
	selfieUrl: text("selfie_url"),
	estado: text().default("pendiente").notNull(),
	revisadoPor: text("revisado_por"),
	revisadoEn: text("revisado_en"),
	createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
});

export const weatherCache = sqliteTable("weather_cache", {
	zoneId: text("zone_id").primaryKey(),
	zoneName: text("zone_name").notNull(),
	latitude: real().notNull(),
	longitude: real().notNull(),
	data: text().notNull(),
	lastFetchedAt: text("last_fetched_at").notNull(),
	createdAt: text("created_at").default("sql`(datetime('now'))`").notNull(),
	updatedAt: text("updated_at").default("sql`(datetime('now'))`").notNull(),
});

export const fuelRecords = sqliteTable("fuel_records", {
	id: text().primaryKey(),
	motorcycleId: text("motorcycle_id").notNull().references(() => motorcycles.id),
	liters: real().notNull(),
	pricePerLiter: real("price_per_liter").notNull(),
	totalCost: real("total_cost").notNull(),
	location: text(),
	recordedAt: integer("recorded_at").notNull(),
	createdAt: integer("created_at").notNull(),
	stationName: text("station_name"),
	octane: text(),
	kilometersAtFill: real("kilometers_at_fill"),
});

export const pendingUsers = sqliteTable("pending_users", {
	id: text().primaryKey(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text().notNull(),
	phone: text(),
	rut: text().notNull(),
	createdAt: integer("created_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
	birthDate: text("birth_date"),
});

export const pendingOtps = sqliteTable("pending_otps", {
	id: text().primaryKey(),
	pendingUserId: text("pending_user_id").notNull().references(() => pendingUsers.id),
	code: text().notNull(),
	tipo: text().default("email").notNull(),
	createdAt: integer("created_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
	used: integer().default(0).notNull(),
	attempts: integer().default(0).notNull(),
});

export const gpsTrackers = sqliteTable("gps_trackers", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id),
	motorcycleId: text("motorcycle_id").references(() => motorcycles.id),
	imei: text().notNull(),
	name: text().notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("idx_gps_trackers_imei").on(table.imei),
	index("idx_gps_trackers_user_id").on(table.userId),
]);

export const municipalities = sqliteTable("municipalities", {
	id: text().primaryKey(),
	name: text().notNull(),
	commune: text().notNull(),
	region: text().notNull(),
	paymentUrl: text("payment_url").default("").notNull(),
	active: integer().default(1).notNull(),
	order: integer().default(0).notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	appointmentUrl: text("appointment_url").default("").notNull(),
},
(table) => [
	index("idx_municipalities_active").on(table.active),
	index("idx_municipalities_commune").on(table.commune),
]);

