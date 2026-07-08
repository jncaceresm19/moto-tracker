import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useLanguage } from '../language-context';

interface DashboardPanelProps {
  motorcycleName?: string;
  plate?: string;
  status?: 'safe' | 'alert';
  lastLocationTime?: string;
  address?: string;
  timeAgo?: string;
  hasGps?: boolean;
  isActive?: boolean;
  activatedAt?: Date;
  activationAddress?: string;
  onLongPress?: () => void;
}

export function DashboardPanel({
  motorcycleName = '',
  plate = '',
  status = 'safe',
  lastLocationTime = '--:--',
  address = '',
  timeAgo = '',
  hasGps = false,
  isActive = false,
  activatedAt,
  activationAddress,
  onLongPress,
}: DashboardPanelProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
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
  const statusColor = isAlert ? colors.alertRed : hasGps ? colors.green : '#6B7280';
  const statusText = isAlert ? t('outOfZone') : hasGps ? t('inSafeZone') : t('noData');

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.9}
    >
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
            <Text style={styles.motoName}>{motorcycleName || t('noMotoAssigned')}</Text>
            {plate ? <Text style={styles.plate}>{plate}</Text> : null}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Animated.View style={[styles.statusDot, { backgroundColor: statusColor, opacity: pulseAnim }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Active moto info */}
        {isActive && activatedAt && (
          <View style={styles.activeInfo}>
            <View style={styles.activeRow}>
              <Ionicons name="time-outline" size={14} color="#22C55E" />
              <Text style={styles.activeText}>
                {t('activeSince')} {timeAgo}
              </Text>
            </View>
            {activationAddress && (
              <View style={styles.activeRow}>
                <Ionicons name="location-outline" size={14} color="#22C55E" />
                <Text style={styles.activeText} numberOfLines={1}>
                  {t('parkedAt')} {activationAddress}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Odometer time inline with label */}
        {!isActive && (
          <View style={styles.odometerSection}>
            <Text style={styles.odometerTime}>{lastLocationTime}</Text>
            <Text style={styles.odometerLabel}>{t('lastLocation')}</Text>
          </View>
        )}

        {/* Address line */}
        {!isActive && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color={colors.inkFaint} />
            <Text style={[styles.addressText, { color: colors.inkFaint }]} numberOfLines={1}>
              {hasGps ? t('parkedAtLocation') : t('enableGpsToTrack')}
            </Text>
          </View>
        )}

        {/* Long press hint */}
        <View style={styles.hintRow}>
          <Text style={[styles.hintText, { color: colors.inkFaint }]}>
            {isActive ? t('longPressForActions') : t('longPressToActivate')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
  activeInfo: {
    marginTop: 16,
    gap: 6,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '500',
  },
  hintRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
