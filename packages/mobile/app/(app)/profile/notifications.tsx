import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';
import { Notification, getNotifications, markAsRead, markAllAsRead } from '../../../src/services/notificationService';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (e: any) {
      console.log('[NOTIFICATIONS] Error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e: any) {
      console.log('[NOTIFICATIONS] Error marking all read:', e?.message);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      } catch (e) {
        console.log('[NOTIFICATIONS] Error marking as read:', e?.message);
      }
    }
    // No navigation - stay on notifications page
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'theft_alert':
        return 'alert-circle';
      case 'alert_response':
        return 'chatbubble';
      case 'theft_recovered':
        return 'checkmark-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'theft_alert':
        return '#EF4444';
      case 'alert_response':
        return '#3B82F6';
      case 'theft_recovered':
        return '#22C55E';
      default:
        return colors.inkFaint;
    }
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes}m`;
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${days}d`;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Custom header matching app style */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('notifications')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.inkFaint} />
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>{t('noNotifications')}</Text>
          <Text style={[styles.emptyText, { color: colors.inkFaint }]}>{t('noNotificationsText')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.notificationItem,
                { backgroundColor: item.isRead ? colors.surface : colors.primary + '10' },
                { borderBottomColor: colors.border }
              ]}
              onPress={() => handleNotificationPress(item)}
            >
              <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
                <Ionicons
                  name={getNotificationIcon(item.type) as any}
                  size={20}
                  color={getNotificationColor(item.type)}
                />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationTitle, { color: colors.ink }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.notificationTime, { color: colors.inkFaint }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.notificationMessage, { color: colors.inkSoft }]} numberOfLines={2}>
                  {item.message}
                </Text>
              </View>
              {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: { flex: 1 },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  notificationTime: { fontSize: 12, marginLeft: 8 },
  notificationMessage: { fontSize: 14, lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
