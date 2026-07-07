import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme-context';
import { useAuth } from '../auth-context';

interface Comment {
  id: string;
  userName: string;
  text: string;
  timeAgo: string;
}

interface TheftAlertCardProps {
  title: string;
  metadata: string;
  timeAgo: string;
  photoUrl?: string;
  responses?: Comment[];
  onWhatsApp?: () => void;
  onInstagram?: () => void;
  onComment?: (text: string) => void;
}

export function TheftAlertCard({
  title,
  metadata,
  timeAgo,
  photoUrl,
  responses = [],
  onWhatsApp,
  onInstagram,
  onComment,
}: TheftAlertCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const handleSubmitComment = () => {
    if (commentText.trim() && onComment) {
      onComment(commentText.trim());
      setCommentText('');
    }
  };

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
        <Text style={styles.activeLabelText}>ALERTA DE ROBO · ACTIVA</Text>
      </View>

      {/* Photo */}
      {photoUrl && (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      {/* Content */}
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.metadata, { color: colors.inkFaint }]}>{metadata}</Text>
      <Text style={[styles.time, { color: colors.inkFaint }]}>{timeAgo}</Text>

      {/* Share buttons */}
      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={onWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <Text style={styles.shareLabel}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={onInstagram}>
          <Ionicons name="logo-instagram" size={22} color="#E4405F" />
          <Text style={styles.shareLabel}>Instagram</Text>
        </TouchableOpacity>
      </View>

      {/* Comments toggle */}
      <TouchableOpacity 
        style={[styles.commentsToggle, { borderTopColor: colors.border }]}
        onPress={() => setShowComments(!showComments)}
      >
        <Ionicons name="chatbubble-outline" size={18} color={colors.inkSoft} />
        <Text style={[styles.commentsToggleText, { color: colors.inkSoft }]}>
          {responses.length > 0 ? `${responses.length} comentario${responses.length > 1 ? 's' : ''}` : 'Comentar'}
        </Text>
        <Ionicons 
          name={showComments ? "chevron-up" : "chevron-down"} 
          size={16} 
          color={colors.inkFaint} 
        />
      </TouchableOpacity>

      {/* Comments section */}
      {showComments && (
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
          {/* Comments list */}
          {responses.map((comment) => (
            <View key={comment.id} style={[styles.comment, { borderBottomColor: colors.borderLight }]}>
              <View style={[styles.commentAvatar, { backgroundColor: colors.brandBlue }]}>
                <Text style={styles.commentAvatarText}>{comment.userName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.commentContent}>
                <Text style={[styles.commentName, { color: colors.ink }]}>{comment.userName}</Text>
                <Text style={[styles.commentText, { color: colors.inkSoft }]}>{comment.text}</Text>
                <Text style={[styles.commentTime, { color: colors.inkFaint }]}>{comment.timeAgo}</Text>
              </View>
            </View>
          ))}

          {/* Comment input */}
          <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
            <View style={[styles.commentAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.commentAvatarText}>{user?.email?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
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
  tapeWhite: { backgroundColor: '#FFFFFF' },
  activeLabel: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 14, marginTop: 10, borderRadius: 6 },
  activeLabelText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  photo: { width: '100%', height: 180, marginTop: 10 },
  title: { fontSize: 16, fontWeight: '700', marginHorizontal: 14, marginTop: 10 },
  metadata: { fontSize: 13, marginHorizontal: 14, marginTop: 4 },
  time: { fontSize: 12, marginHorizontal: 14, marginTop: 2, fontStyle: 'italic' },
  shareRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 14, paddingHorizontal: 14, paddingBottom: 14 },
  shareBtn: { alignItems: 'center', gap: 4 },
  shareLabel: { fontSize: 11, color: '#5A6478' },
  commentsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  commentsToggleText: { fontSize: 13, flex: 1 },
  commentsSection: { borderTopWidth: 1 },
  comment: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentName: { fontSize: 13, fontWeight: '600' },
  commentText: { fontSize: 13, marginTop: 2 },
  commentTime: { fontSize: 11, marginTop: 4 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  sendBtn: { padding: 6 },
});
