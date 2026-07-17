import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';
import { Notification, getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../../../src/services/notificationService';
import { RainAlertData, fetchRainAlert } from '../../../src/services/weatherApi';
import { getCurrentLocation } from '../../../src/services/gasStations';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rainAlert, setRainAlert] = useState<RainAlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
      // Auto-mark all as read after loading
      const unread = data.filter(n => !n.isRead);
      if (unread.length > 0) {
        try {
          await markAllAsRead();
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e: any) {
          console.log('[NOTIFICATIONS] Auto mark read error:', e?.message);
        }
      }
    } catch (e: any) {
      console.log('[NOTIFICATIONS] Error:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRainAlert = useCallback(async () => {
    try {
      let lat: number;
      let lon: number;
      try {
        const loc = await getCurrentLocation();
        lat = loc.lat;
        lon = loc.lon;
      } catch {
        lat = -33.45;
        lon = -70.66;
      }
      const alert = await fetchRainAlert(lat, lon);
      setRainAlert(alert.shouldShow ? alert : null);
    } catch (e: any) {
      console.log('[NOTIFICATIONS] Rain alert error:', e?.message);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadRainAlert();
  }, [loadNotifications, loadRainAlert]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNotifications(), loadRainAlert()]);
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
      } catch (e: any) {
        console.log('[NOTIFICATIONS] Error marking as read:', e?.message);
      }
    }
    // No navigation - stay on notifications page
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (e: any) {
      console.log('[NOTIFICATIONS] Error deleting:', e?.message);
    }
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    item: Notification
  ) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [100, 0],
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.deleteText}>{t('delete')}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'theft_alert':
        return 'alert-circle';
      case 'alert_response':
        return 'chatbubble';
      case 'theft_recovered':
        return 'checkmark-circle';
      case 'document_expiring':
        return 'document-text';
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
      case 'document_expiring':
        return '#F59E0B';
      default:
        return colors.inkFaint;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Custom header matching app style — siempre visible, cargando o no */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('notifications')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Área de contenido: spinner, vacío o lista, sin desmontar el header */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 && !rainAlert?.shouldShow ? (
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
          ListHeaderComponent={
            rainAlert?.shouldShow && rainAlert.minutesUntilRain != null ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.notificationItem, { backgroundColor: colors.amberBg, borderBottomColor: colors.border }]}
              >
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
                  <Ionicons name="rainy" size={20} color={colors.amber} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: colors.ink }]} numberOfLines={1}>
                      Lluvia en ~{rainAlert.minutesUntilRain} min
                    </Text>
                    <Text style={[styles.notificationTime, { color: colors.inkFaint }]}>
                      ahora
                    </Text>
                  </View>
                  <Text style={[styles.notificationMessage, { color: colors.inkSoft }]} numberOfLines={2}>
                    Probabilidad: {rainAlert.probability}%{rainAlert.zoneName ? ` · ${rainAlert.zoneName}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={(progress: Animated.AnimatedInterpolation<number>) => renderRightActions(progress, item)}
              overshootRight={false}
            >
              <TouchableOpacity activeOpacity={0.8}
                style={[
                  styles.notificationItem,
                  { backgroundColor: item.isRead ? colors.surface : colors.primary + '10' },
                  { borderBottomColor: colors.border }
                ]}
                onPress={() => handleNotificationPress(item)}
              >
                {/* Avatar for comments, icon for theft/recovery */}
                {item.type === 'alert_response' && item.senderAvatar ? (
                  <Image source={{ uri: item.senderAvatar }} style={styles.avatar} />
                ) : item.type === 'alert_response' ? (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {item.senderName ? item.senderName.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
                    <Ionicons
                      name={getNotificationIcon(item.type) as any}
                      size={20}
                      color={getNotificationColor(item.type)}
                    />
                  </View>
                )}
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: colors.ink }]} numberOfLines={1}>
                      {item.senderName || item.title}
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
            </Swipeable>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    width: 80,
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});