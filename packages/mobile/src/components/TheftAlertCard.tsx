import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Modal, Dimensions, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
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
  notes?: string;
  status?: 'active' | 'recovered' | 'closed';
  recoveredAt?: Date | null;
  alertOwnerId?: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
  ownerVerified?: boolean;
  responses?: Comment[];
  onWhatsApp?: () => void;
  onInstagram?: () => void;
  onComment?: (text: string) => void;
  onMarkAsFound?: () => void;
  onReport?: () => void;
  onViewProfile?: () => void;
}

export function TheftAlertCard({
  title,
  metadata,
  timeAgo,
  photoUrl,
  notes,
  status = 'active',
  recoveredAt,
  alertOwnerId,
  ownerName,
  ownerAvatarUrl,
  ownerVerified = false,
  responses = [],
  onWhatsApp,
  onInstagram,
  onComment,
  onMarkAsFound,
  onReport,
  onViewProfile,
}: TheftAlertCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuBtnRef = useRef<View>(null);

  const isOwner = user && alertOwnerId && user.id === alertOwnerId;
  const isRecovered = status === 'recovered' && !!recoveredAt;

  const handleSubmitComment = () => {
    if (commentText.trim() && onComment) {
      onComment(commentText.trim());
      setCommentText('');
    }
  };

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({
        top: y + height + 4,
        right: Math.max(12, Dimensions.get('window').width - (x + width)),
      });
      setShowMenu(true);
    });
  };

  const renderAvatar = (avatarUrl?: string, name: string = '?', size: number = 32, bgColor?: string) => {
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
      {/* Owner header: avatar + name + verified badge, 3-dot menu (Instagram style) */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {renderAvatar(ownerAvatarUrl, ownerName || 'Usuario', 32, colors.brandBlue)}
          <Text style={[styles.ownerName, { color: colors.ink }]} numberOfLines={1}>
            {ownerName || 'Usuario'}
          </Text>
          {ownerVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>

        <TouchableOpacity ref={menuBtnRef} style={styles.menuBtn} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.inkSoft} />
        </TouchableOpacity>
      </View>

      {/* Motorcycle photo */}
      {photoUrl && (
        <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      {/* Status label */}
      <View style={[styles.statusLabel, { backgroundColor: isRecovered ? colors.green : colors.alertRed }]}>
        <Text style={styles.statusLabelText}>
          {isRecovered ? 'ENCONTRADA · CERRADA' : 'ALERTA DE ROBO · ACTIVA'}
        </Text>
      </View>

      {/* Content */}
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.metadata, { color: colors.inkFaint }]}>{metadata}</Text>
      {notes ? (
        <Text style={[styles.notes, { color: colors.inkSoft }]}>{notes}</Text>
      ) : null}
      <Text style={[styles.time, { color: colors.inkFaint }]}>{timeAgo}</Text>

      {/* Action row: share + comments */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onWhatsApp}
          disabled={status === 'recovered'}
        >
          <Ionicons
            name="logo-whatsapp"
            size={20}
            color={status === 'recovered' ? colors.inkFaint : '#25D366'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onInstagram}
          disabled={status === 'recovered'}
        >
          <Ionicons
            name="logo-instagram"
            size={20}
            color={status === 'recovered' ? colors.inkFaint : '#E4405F'}
          />
        </TouchableOpacity>

        <View style={styles.actionSpacer} />

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowCommentsSheet(true)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.inkSoft} />
          {responses.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.countBadgeText}>{responses.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 3-dot dropdown menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View
            style={[
              styles.menuDropdown,
              { top: menuPosition.top, right: menuPosition.right, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); onReport?.(); }}
            >
              <Ionicons name="flag-outline" size={16} color={colors.ink} />
              <Text style={[styles.menuItemText, { color: colors.ink }]}>Reportar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); setShowProfileModal(true); }}
            >
              <Ionicons name="person-outline" size={16} color={colors.ink} />
              <Text style={[styles.menuItemText, { color: colors.ink }]}>Ver perfil</Text>
            </TouchableOpacity>

            {isOwner && !isRecovered && onMarkAsFound && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemLast]}
                onPress={() => { setShowMenu(false); onMarkAsFound(); }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.green} />
                <Text style={[styles.menuItemText, { color: colors.green }]}>Marcar como encontrada</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowProfileModal(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.profileModal, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setShowProfileModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              {ownerAvatarUrl ? (
                <Image source={{ uri: ownerAvatarUrl }} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.profilePhotoPlaceholder, { backgroundColor: colors.brandBlue }]}>
                  <Text style={styles.profilePhotoPlaceholderText}>
                    {(ownerName || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.profileNameRow}>
                <Text style={[styles.profileName, { color: colors.ink }]}>{ownerName || 'Usuario'}</Text>
                {ownerVerified && (
                  <View style={styles.verifiedBadgeLarge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Comments Bottom Sheet (Instagram style) */}
      <Modal visible={showCommentsSheet} transparent animationType="slide" onRequestClose={() => setShowCommentsSheet(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowCommentsSheet(false)}
          />
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: colors.ink }]}>Comentarios</Text>
              <TouchableOpacity onPress={() => setShowCommentsSheet(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Comments list */}
            {responses.length === 0 ? (
              <View style={styles.sheetEmpty}>
                <Ionicons name="chatbubble-outline" size={40} color={colors.inkFaint} />
                <Text style={[styles.sheetEmptyText, { color: colors.inkFaint }]}>No hay comentarios aún</Text>
                <Text style={[styles.sheetEmptySubtext, { color: colors.inkFaint }]}>Sé el primero en comentar</Text>
              </View>
            ) : (
              <FlatList
                data={responses}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.sheetCommentsList}
                renderItem={({ item: comment }) => (
                  <View style={[styles.sheetComment, { borderBottomColor: colors.borderLight }]}>
                    {renderAvatar(comment.userAvatar, comment.userName, 36, colors.brandBlue)}
                    <View style={styles.sheetCommentContent}>
                      <Text style={[styles.sheetCommentName, { color: colors.ink }]}>{comment.userName}</Text>
                      <Text style={[styles.sheetCommentText, { color: colors.inkSoft }]}>{comment.text}</Text>
                      <Text style={[styles.sheetCommentTime, { color: colors.inkFaint }]}>{comment.timeAgo}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            {/* Comment input */}
            <View style={[styles.sheetInputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              {renderAvatar(user?.avatarUrl, user?.name || user?.email?.split('@')[0] || '?', 32, colors.primary)}
              <TextInput
                style={[styles.sheetInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 14, marginTop: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  ownerName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  menuBtn: { padding: 4 },
  statusLabel: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginHorizontal: 14, marginTop: 10 },
  statusLabelText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  photo: { width: '100%', height: 180, marginTop: 10 },
  title: { fontSize: 16, fontWeight: '700', marginHorizontal: 14, marginTop: 10 },
  metadata: { fontSize: 13, marginHorizontal: 14, marginTop: 4 },
  notes: { fontSize: 13, marginHorizontal: 14, marginTop: 6, fontStyle: 'italic' },
  time: { fontSize: 12, marginHorizontal: 14, marginTop: 2, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, marginTop: 10 },
  actionBtn: { padding: 8, position: 'relative' },
  actionSpacer: { flex: 1 },
  countBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  countBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarImage: { backgroundColor: '#E5E7EB' },
  avatarText: { color: '#fff', fontWeight: '700' },
  // Menu
  menuDropdown: { position: 'absolute', minWidth: 200, borderRadius: 10, borderWidth: 1, paddingVertical: 4, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  menuItemLast: { paddingBottom: 12 },
  menuItemText: { fontSize: 14, fontWeight: '500' },
  // Profile Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  profileModal: { borderRadius: 16, padding: 24, alignItems: 'center' },
  profileCloseBtn: { position: 'absolute', top: 12, right: 12, padding: 4, zIndex: 1 },
  profilePhoto: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  profilePhotoPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profilePhotoPlaceholderText: { color: '#fff', fontSize: 40, fontWeight: '700' },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeLarge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Comments Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetContainer: { maxHeight: Dimensions.get('window').height * 0.75, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', position: 'absolute', top: 8, alignSelf: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginTop: 8 },
  sheetEmpty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  sheetEmptyText: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  sheetEmptySubtext: { fontSize: 13, marginTop: 4 },
  sheetCommentsList: { paddingHorizontal: 16, paddingTop: 8 },
  sheetComment: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  sheetCommentContent: { flex: 1 },
  sheetCommentName: { fontSize: 13, fontWeight: '600' },
  sheetCommentText: { fontSize: 13, marginTop: 2 },
  sheetCommentTime: { fontSize: 11, marginTop: 4 },
  sheetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  sheetInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  sendBtn: { padding: 6 },
});
