import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface DashboardPanelProps {
  motorcycleName?: string;
  plate?: string;
  status?: 'safe' | 'alert';
  lastLocationTime?: string;
  address?: string;
  timeAgo?: string;
}

export function DashboardPanel({
  motorcycleName = '',
  plate = '',
  status = 'safe',
  lastLocationTime = '--:--',
  address = '',
  timeAgo = '',
}: DashboardPanelProps) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'alert') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status, pulseAnim]);

  const isAlert = status === 'alert';
  const statusColor = isAlert ? colors.alertRed : colors.green;
  const statusText = isAlert ? 'OUT OF ZONE' : 'IN SAFE ZONE';

  return (
    <View style={styles.container}>
      {/* Vertical line texture */}
      <View style={styles.textureOverlay}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={styles.textureLine} />
        ))}
      </View>

      <View style={styles.content}>
        {/* Top row: motorcycle info + status pill */}
        <View style={styles.topRow}>
          <View style={styles.motoInfo}>
            <Text style={styles.motoName}>{motorcycleName || 'Sin moto asignada'}</Text>
            {plate ? <Text style={styles.plate}>{plate}</Text> : null}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Animated.View style={[styles.statusDot, { backgroundColor: statusColor, opacity: pulseAnim }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Odometer time inline with label */}
        <View style={styles.odometerSection}>
          <Text style={styles.odometerTime}>{lastLocationTime}</Text>
          <Text style={styles.odometerLabel}>LAST LOCATION</Text>
        </View>

        {/* Address line */}
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
          <Text style={[styles.addressText, { color: colors.inkFaint }]} numberOfLines={1}>
            Parked at location - 6 minutes ago
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#171B26',
    overflow: 'hidden',
    minHeight: 160,
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    opacity: 0.06,
  },
  textureLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  motoInfo: {
    flex: 1,
  },
  motoName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  plate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  odometerSection: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  odometerTime: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  odometerLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  addressText: {
    fontSize: 13,
    flex: 1,
  },
});
