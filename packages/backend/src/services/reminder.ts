import { eq, and, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { notifications, documents, motorcycles, maintenanceRecords, reminderState } from '../db/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export interface ReminderEngineConfig {
  checkIntervalMs: number; // Default: 1 hour (3,600,000 ms)
}

const DEFAULT_CONFIG: ReminderEngineConfig = {
  checkIntervalMs: 60 * 60 * 1000, // 1 hour
};

export class ReminderEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private config: ReminderEngineConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Start the reminder engine. Runs immediately, then on interval.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.runCheck();
    this.intervalId = setInterval(() => this.runCheck(), this.config.checkIntervalMs);
  }

  /**
   * Stop the reminder engine.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  /**
   * Run a single check cycle (exported for testing).
   */
  async runCheck(): Promise<void> {
    try {
      this.checkDocumentExpiry();
      this.checkMaintenanceDue();
      this.updateLastCheckedAt();
    } catch (error) {
      console.error('[ReminderEngine] Error during check:', error);
    }
  }

  private checkDocumentExpiry(): void {
    const now = new Date();
    const nowMs = now.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Find documents expiring within 30 days (using raw SQL with timestamps)
    const expiringDocs = this.db.all(
      sql`SELECT * FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= ${nowMs + thirtyDaysMs} AND expiry_date > ${nowMs}`
    ) as any[];

    for (const doc of expiringDocs) {
      const expiryDate = new Date(doc.expiry_date);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)
      );

      // Find the motorcycle to get the user_id
      const motorcycle = this.db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.id, doc.motorcycle_id))
        .get();

      if (!motorcycle) continue;

      const isUrgent = daysUntilExpiry <= 7;
      const notificationType = isUrgent ? 'document_expiry' : 'document_expiring';
      const title = `Documento vence en ${daysUntilExpiry} días`;
      const message = isUrgent
        ? `El documento "${doc.title}" vence el ${expiryDate.toLocaleDateString('es-CL')}. ¡Urgente!`
        : `El documento "${doc.title}" vence el ${expiryDate.toLocaleDateString('es-CL')}.`;

      this.insertNotificationIfNotExists({
        userId: motorcycle.userId,
        motorcycleId: motorcycle.id,
        type: notificationType,
        title,
        message,
        sourceType: 'document',
        sourceId: doc.id,
      });
    }
  }

  private checkMaintenanceDue(): void {
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Find maintenance records where next_service_date is within 7 days (raw SQL)
    const maintenanceByDate = this.db.all(
      sql`SELECT mr.*, m.user_id FROM maintenance_records mr
          JOIN motorcycles m ON m.id = mr.motorcycle_id
          WHERE mr.next_service_date IS NOT NULL AND mr.next_service_date <= ${nowMs + sevenDaysMs} AND mr.next_service_date > ${nowMs}`
    ) as any[];

    for (const record of maintenanceByDate) {
      const nextDate = new Date(record.next_service_date);

      this.insertNotificationIfNotExists({
        userId: record.user_id,
        motorcycleId: record.motorcycle_id,
        type: 'maintenance_due',
        title: `Mantenimiento próximo: ${record.type}`,
        message: `Servicio recomendado el ${nextDate.toLocaleDateString('es-CL')}.`,
        sourceType: 'maintenance',
        sourceId: record.id,
      });
    }

    // Find maintenance records where next_service_km is within 500km (raw SQL)
    const maintenanceByKm = this.db.all(
      sql`SELECT mr.*, m.user_id, m.current_kilometers FROM maintenance_records mr
          JOIN motorcycles m ON m.id = mr.motorcycle_id
          WHERE mr.next_service_kilometers IS NOT NULL
            AND mr.next_service_kilometers > m.current_kilometers
            AND mr.next_service_kilometers <= m.current_kilometers + 500`
    ) as any[];

    for (const record of maintenanceByKm) {
      const kmRemaining = record.next_service_kilometers - record.current_kilometers;

      this.insertNotificationIfNotExists({
        userId: record.user_id,
        motorcycleId: record.motorcycle_id,
        type: 'maintenance_km_due',
        title: `Mantenimiento próximo por kilómetros`,
        message: `Servicio recomendado en ${Math.round(kmRemaining)} km.`,
        sourceType: 'maintenance',
        sourceId: record.id,
      });
    }
  }

  private insertNotificationIfNotExists(params: {
    userId: string;
    motorcycleId?: string;
    type: string;
    title: string;
    message: string;
    sourceType: string;
    sourceId: string;
  }): void {
    // Check if notification already exists for this source
    const existing = this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, params.userId),
          eq(notifications.type, params.type),
          eq(notifications.sourceId, params.sourceId)
        )
      )
      .get();

    if (existing) return;

    this.db.insert(notifications)
      .values({
        id: uuidv4(),
        userId: params.userId,
        motorcycleId: params.motorcycleId ?? null,
        type: params.type,
        title: params.title,
        message: params.message,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        isRead: false,
        createdAt: new Date(),
      })
      .run();
  }

  private updateLastCheckedAt(): void {
    const existing = this.db.select().from(reminderState).get();
    if (existing) {
      this.db.update(reminderState)
        .set({ lastCheckedAt: new Date() })
        .where(eq(reminderState.id, existing.id))
        .run();
    } else {
      this.db.insert(reminderState)
        .values({ id: 'singleton', lastCheckedAt: new Date() })
        .run();
    }
  }
}
