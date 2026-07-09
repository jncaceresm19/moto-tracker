import { api } from '../api';

export interface Notification {
  id: string;
  userId: string;
  motorcycleId?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

// Get user's notifications
export async function getNotifications(): Promise<Notification[]> {
  const result = await api<Notification[]>('/api/notifications');
  return result.map(n => ({
    ...n,
    createdAt: new Date(n.createdAt),
  }));
}

// Get unread count
export async function getUnreadCount(): Promise<number> {
  const result = await api<{ count: number }>('/api/notifications/unread-count');
  return result.count;
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<void> {
  await api(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
}

// Mark all as read
export async function markAllAsRead(): Promise<void> {
  await api('/api/notifications/read-all', { method: 'PATCH' });
}
