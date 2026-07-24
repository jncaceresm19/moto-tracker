import { relations } from "drizzle-orm/relations";
import { motorcycles, documents, kilometerHistory, oilCatalogProducts, maintenanceRecords, motorcycleCatalogBrands, motorcycleCatalogModels, users, municipalities, notifications, oilCatalogBrands, theftAlertResponses, theftAlerts, activeMotos, otps, verificacionesPendientes, fuelRecords, pendingUsers, pendingOtps, gpsTrackers } from "./schema";

export const documentsRelations = relations(documents, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [documents.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const motorcyclesRelations = relations(motorcycles, ({one, many}) => ({
	documents: many(documents),
	kilometerHistories: many(kilometerHistory),
	maintenanceRecords: many(maintenanceRecords),
	motorcycleCatalogModel: one(motorcycleCatalogModels, {
		fields: [motorcycles.modelId],
		references: [motorcycleCatalogModels.id]
	}),
	motorcycleCatalogBrand: one(motorcycleCatalogBrands, {
		fields: [motorcycles.brandId],
		references: [motorcycleCatalogBrands.id]
	}),
	user: one(users, {
		fields: [motorcycles.userId],
		references: [users.id]
	}),
	municipality: one(municipalities, {
		fields: [motorcycles.permitMunicipalityId],
		references: [municipalities.id]
	}),
	notifications: many(notifications),
	theftAlerts: many(theftAlerts),
	activeMotos: many(activeMotos),
	verificacionesPendientes: many(verificacionesPendientes),
	fuelRecords: many(fuelRecords),
	gpsTrackers: many(gpsTrackers),
}));

export const kilometerHistoryRelations = relations(kilometerHistory, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [kilometerHistory.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({one}) => ({
	oilCatalogProduct: one(oilCatalogProducts, {
		fields: [maintenanceRecords.oilTypeId],
		references: [oilCatalogProducts.id]
	}),
	motorcycle: one(motorcycles, {
		fields: [maintenanceRecords.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const oilCatalogProductsRelations = relations(oilCatalogProducts, ({one, many}) => ({
	maintenanceRecords: many(maintenanceRecords),
	oilCatalogBrand: one(oilCatalogBrands, {
		fields: [oilCatalogProducts.brandId],
		references: [oilCatalogBrands.id]
	}),
}));

export const motorcycleCatalogModelsRelations = relations(motorcycleCatalogModels, ({one, many}) => ({
	motorcycleCatalogBrand: one(motorcycleCatalogBrands, {
		fields: [motorcycleCatalogModels.brandId],
		references: [motorcycleCatalogBrands.id]
	}),
	motorcycles: many(motorcycles),
}));

export const motorcycleCatalogBrandsRelations = relations(motorcycleCatalogBrands, ({many}) => ({
	motorcycleCatalogModels: many(motorcycleCatalogModels),
	motorcycles: many(motorcycles),
}));

export const usersRelations = relations(users, ({many}) => ({
	motorcycles: many(motorcycles),
	notifications: many(notifications),
	theftAlertResponses: many(theftAlertResponses),
	theftAlerts: many(theftAlerts),
	activeMotos: many(activeMotos),
	otps: many(otps),
	verificacionesPendientes: many(verificacionesPendientes),
	gpsTrackers: many(gpsTrackers),
}));

export const municipalitiesRelations = relations(municipalities, ({many}) => ({
	motorcycles: many(motorcycles),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [notifications.motorcycleId],
		references: [motorcycles.id]
	}),
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const oilCatalogBrandsRelations = relations(oilCatalogBrands, ({many}) => ({
	oilCatalogProducts: many(oilCatalogProducts),
}));

export const theftAlertResponsesRelations = relations(theftAlertResponses, ({one}) => ({
	user: one(users, {
		fields: [theftAlertResponses.userId],
		references: [users.id]
	}),
	theftAlert: one(theftAlerts, {
		fields: [theftAlertResponses.theftAlertId],
		references: [theftAlerts.id]
	}),
}));

export const theftAlertsRelations = relations(theftAlerts, ({one, many}) => ({
	theftAlertResponses: many(theftAlertResponses),
	user: one(users, {
		fields: [theftAlerts.userId],
		references: [users.id]
	}),
	motorcycle: one(motorcycles, {
		fields: [theftAlerts.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const activeMotosRelations = relations(activeMotos, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [activeMotos.motorcycleId],
		references: [motorcycles.id]
	}),
	user: one(users, {
		fields: [activeMotos.userId],
		references: [users.id]
	}),
}));

export const otpsRelations = relations(otps, ({one}) => ({
	user: one(users, {
		fields: [otps.userId],
		references: [users.id]
	}),
}));

export const verificacionesPendientesRelations = relations(verificacionesPendientes, ({one}) => ({
	user: one(users, {
		fields: [verificacionesPendientes.userId],
		references: [users.id]
	}),
	motorcycle: one(motorcycles, {
		fields: [verificacionesPendientes.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const fuelRecordsRelations = relations(fuelRecords, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [fuelRecords.motorcycleId],
		references: [motorcycles.id]
	}),
}));

export const pendingOtpsRelations = relations(pendingOtps, ({one}) => ({
	pendingUser: one(pendingUsers, {
		fields: [pendingOtps.pendingUserId],
		references: [pendingUsers.id]
	}),
}));

export const pendingUsersRelations = relations(pendingUsers, ({many}) => ({
	pendingOtps: many(pendingOtps),
}));

export const gpsTrackersRelations = relations(gpsTrackers, ({one}) => ({
	motorcycle: one(motorcycles, {
		fields: [gpsTrackers.motorcycleId],
		references: [motorcycles.id]
	}),
	user: one(users, {
		fields: [gpsTrackers.userId],
		references: [users.id]
	}),
}));