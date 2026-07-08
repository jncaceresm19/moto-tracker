import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useAuth } from '../auth-context';

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timeAgo: string;
}

interface TheftAlertCardProps {
  title: string;
  metadata: string;
  timeAgo: string;
  photoUrl?: string;
  status?: 'active' | 'recovered' | 'closed';
  recoveredAt?: Date | null;
  alertOwnerId?: string;
  responses?: Comment[];
  onWhatsApp?: () => void;
  onInstagram?: () => void;
  onComment?: (text: string) => void;
  onMarkAsFound?: () => void;
}

export function TheftAlertCard({
  title,
  metadata,
  timeAgo,
  photoUrl,
  status = 'active',
  recoveredAt,
  alertOwnerId,
  responses = [],
  onWhatsApp,
  onInstagram,
  onComment,
  onMarkAsFound,
}: TheftAlertCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const isOwner = user && alertOwnerId && user.id === alertOwnerId;
  // Card is green if recoveredAt is set (stays green until end of day)
  const isRecovered = !!recoveredAt;

  const handleSubmitComment = () => {
    if (commentText.trim() && onComment) {
      onComment(commentText.trim());
      setCommentText('');
    }
  };

  const renderAvatar = (avatarUrl?: string, name: string, size: number = 32, bgColor?: string) => {
    if (avatarUrl) {
      return <Image source={{ uri: avatarUrl }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />;
    }
    return (
      <View style={[styles.avatar, { backgroundColor: bgColor || colors.brandBlue, width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.44 }]}>{name.charAt(0).toUpperCase()}</Text>
      </View>
    );
  };

  const cardBg = isRecovered ? colors.green + '15' : colors.alertRedBg;
  const cardBorder = isRecovered ? colors.green : colors.alertRedBorder;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Danger tape bar */}
      <View style={[styles.tapeBar, isRecovered && { opacity: 0.4 }]}>
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={[styles.tapeStripe, i % 2 === 0 ? (isRecovered ? styles.tapeGreen : styles.tapeRed) : styles.tapeWhite]} />
        ))}
      </View>

      {/* Active / Recovered label + owner button */}
      <View style={styles.labelRow}>
        <View style={[styles.activeLabel, { backgroundColor: isRecovered ? colors.green : colors.alertRed }]}>
          <Text style={styles.activeLabelText}>
            {isRecovered ? 'ENCONTRADA · CERRADA' : 'ALERTA DE ROBO · ACTIVA'}
          </Text>
        </View>

        <View style={styles.labelSpacer} />

        {isOwner && isRecovered && (
          <View style={[styles.recoveredBadge, { backgroundColor: colors.green }]}>
            <Ionicons name="checkmark-circle" size={12} color="#fff" />
            <Text style={styles.recoveredBadgeText}>Recuperada</Text>
          </View>
        )}

        {isOwner && !isRecovered && onMarkAsFound && (
          <TouchableOpacity
            style={[styles.foundBtn, { backgroundColor: colors.green }]}
            onPress={onMarkAsFound}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.foundBtnText}>Encontrada</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photo */}
      {photoUrl && (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      {/* Content */}
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.metadata, { color: colors.inkFaint }]}>{metadata}</Text>
      <Text style={[styles.time, { color: colors.inkFaint }]}>{timeAgo}</Text>

      {/* Action row: share + comments */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onInstagram}>
          <Ionicons name="logo-instagram" size={20} color="#E4405F" />
        </TouchableOpacity>
        
        <View style={styles.actionSpacer} />
        
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.inkSoft} />
          {responses.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.countBadgeText}>{responses.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => setShowComments(!showComments)}
        >
          <Ionicons 
            name={showComments ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={colors.inkFaint} 
          />
        </TouchableOpacity>
      </View>

      {/* Comments section */}
      {showComments && (
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
          {/* Comments list */}
          {responses.map((comment) => (
            <View key={comment.id} style={[styles.comment, { borderBottomColor: colors.borderLight }]}>
              {renderAvatar(comment.userAvatar, comment.userName, 32, colors.brandBlue)}
              <View style={styles.commentContent}>
                <Text style={[styles.commentName, { color: colors.ink }]}>{comment.userName}</Text>
                <Text style={[styles.commentText, { color: colors.inkSoft }]}>{comment.text}</Text>
                <Text style={[styles.commentTime, { color: colors.inkFaint }]}>{comment.timeAgo}</Text>
              </View>
            </View>
          ))}

          {/* Comment input */}
          <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
            {renderAvatar(user?.avatarUrl, user?.name || user?.email?.split('@')[0] || '?', 32, colors.primary)}
            <TextInput
              style={[styles.commentInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Escribe un comentario..."
              placeholderTextColor={colors.inkFaint}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleSubmitComment}
              returnKeyType="send"
            />
            <TouchableOpacity 
              style={[styles.sendBtn, { opacity: commentText.trim() ? 1 : 0.4 }]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim()}
            >
              <Ionicons name="send" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  tapeBar: { flexDirection: 'row', height: 6 },
  tapeStripe: { width: 12, height: 6 },
  tapeRed: { backgroundColor: '#E14336' },
  tapeGreen: { backgroundColor: '#16A34A' },
  tapeWhite: { backgroundColor: '#FFFFFF' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 10 },
  labelSpacer: { flex: 1 },
  activeLabel: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  activeLabelText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  foundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  foundBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  recoveredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recoveredBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photo: { width: '100%', height: 180, marginTop: 10 },
  title: { fontSize: 16, fontWeight: '700', marginHorizontal: 14, marginTop: 10 },
  metadata: { fontSize: 13, marginHorizontal: 14, marginTop: 4 },
  time: { fontSize: 12, marginHorizontal: 14, marginTop: 2, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, marginTop: 10 },
  actionBtn: { padding: 8, position: 'relative' },
  actionSpacer: { flex: 1 },
  countBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  commentsSection: { borderTopWidth: 1 },
  comment: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarImage: { backgroundColor: '#E5E7EB' },
  avatarText: { color: '#fff', fontWeight: '700' },
  commentContent: { flex: 1 },
  commentName: { fontSize: 13, fontWeight: '600' },
  commentText: { fontSize: 13, marginTop: 2 },
  commentTime: { fontSize: 11, marginTop: 4 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  sendBtn: { padding: 6 },
});
