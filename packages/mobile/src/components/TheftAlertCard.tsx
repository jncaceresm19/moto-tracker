import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';

interface TheftAlertCardProps {
  title: string;
  metadata: string;
  timeAgo: string;
  responses?: { name: string; text: string; timeAgo: string }[];
  onWhatsApp?: () => void;
  onFacebook?: () => void;
  onX?: () => void;
  onCopyData?: () => void;
}

export function TheftAlertCard({
  title,
  metadata,
  timeAgo,
  responses = [],
  onWhatsApp,
  onFacebook,
  onX,
  onCopyData,
}: TheftAlertCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.alertRedBg, borderColor: colors.alertRedBorder }]}>
      {/* Danger tape bar */}
      <View style={styles.tapeBar}>
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={[styles.tapeStripe, i % 2 === 0 ? styles.tapeRed : styles.tapeWhite]} />
        ))}
      </View>

      {/* Active label */}
      <View style={[styles.activeLabel, { backgroundColor: colors.alertRed }]}>
        <Text style={styles.activeLabelText}>TU PUBLICACIÓN · ACTIVA</Text>
      </View>

      {/* Content */}
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.metadata, { color: colors.inkFaint }]}>{metadata} · {timeAgo}</Text>

      {/* Share buttons */}
      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={onWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={styles.shareLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={onFacebook}>
          <Ionicons name="logo-facebook" size={20} color="#1877F2" />
          <Text style={styles.shareLabel}>Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={onX}>
          <Ionicons name="logo-twitter" size={20} color="#000" />
          <Text style={styles.shareLabel}>X</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={onCopyData}>
          <Ionicons name="copy-outline" size={20} color={colors.inkSoft} />
          <Text style={styles.shareLabel}>Copiar</Text>
        </TouchableOpacity>
      </View>

      {/* Responses */}
      {responses.map((r, i) => (
        <View key={i} style={[styles.response, { borderTopColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.brandBlue }]}>
            <Text style={styles.avatarText}>{r.name.charAt(0)}</Text>
          </View>
          <View style={styles.responseContent}>
            <Text style={[styles.responseName, { color: colors.ink }]}>{r.name}</Text>
            <Text style={[styles.responseText, { color: colors.inkSoft }]}>{r.text}</Text>
            <Text style={[styles.responseTime, { color: colors.inkFaint }]}>{r.timeAgo}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  tapeBar: { flexDirection: 'row', height: 6 },
  tapeStripe: { width: 12, height: 6 },
  tapeRed: { backgroundColor: '#E14336' },
  tapeWhite: { backgroundColor: '#FFFFFF' },
  activeLabel: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 14, marginTop: 10, borderRadius: 6 },
  activeLabelText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 15, fontWeight: '600', marginHorizontal: 14, marginTop: 10 },
  metadata: { fontSize: 12, marginHorizontal: 14, marginTop: 4, fontFamily: 'monospace' },
  shareRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingHorizontal: 14, paddingBottom: 14 },
  shareBtn: { alignItems: 'center', gap: 4 },
  shareLabel: { fontSize: 11, color: '#5A6478' },
  response: { borderTopWidth: 1, padding: 14, flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  responseContent: { flex: 1 },
  responseName: { fontSize: 13, fontWeight: '600' },
  responseText: { fontSize: 13, marginTop: 2 },
  responseTime: { fontSize: 11, marginTop: 4 },
});
