import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomBottomSheet, { CustomBottomSheetRef, SheetFlatList } from '../../src/components/CustomBottomSheet';
import { useTheme } from '../../src/theme-context';
import { useAuth } from '../../src/auth-context';
import {
  TheftAlertDetail,
  getTheftAlertById,
  respondToAlert,
} from '../../src/services/theftAlertService';

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  userVerified?: boolean;
  text: string;
  timeAgo: string;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const bottomSheetRef = useRef<CustomBottomSheetRef>(null);

  // Get params from navigation
  const params = useLocalSearchParams<{
    alertId: string;
    title: string;
    metadata: string;
    timeAgo: string;
    photoUrl?: string;
    notes?: string;
    status?: string;
    ownerName?: string;
    ownerAvatarUrl?: string;
    ownerVerified?: string;
  }>();

  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);

  const snapPoints = useMemo(() => ['40%', '75%', '95%'], []);

  // Load comments when sheet opens
  const loadComments = useCallback(async () => {
    try {
      const detail: TheftAlertDetail = await getTheftAlertById(params.alertId);
      setComments(
        detail.responses.map((r) => ({
          id: r.id,
          userName: r.userName,
          userAvatar: r.userAvatarUrl,
          userVerified: r.userVerified,
          text: r.text,
          timeAgo: formatTimeAgo(r.createdAt),
        }))
      );
    } catch (e) {
      console.log('[POST_DETAIL] Error loading comments:', e);
    }
  }, [params.alertId]);

  // Open sheet and load comments
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index >= 0 && comments.length === 0) {
        loadComments();
      }
    },
    [comments.length, loadComments]
  );

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');

    // Optimistic add
    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      userName: user?.name || user?.email?.split('@')[0] || 'Usuario',
      userAvatar: user?.avatarUrl,
      userVerified: false,
      text,
      timeAgo: 'ahora mismo',
    };
    setComments((prev) => [...prev, optimistic]);

    // Persist to backend
    try {
      await respondToAlert(params.alertId, text);
      // Reload to get real data
      const detail = await getTheftAlertById(params.alertId);
      setComments(
        detail.responses.map((r) => ({
          id: r.id,
          userName: r.userName,
          userAvatar: r.userAvatarUrl,
          userVerified: r.userVerified,
          text: r.text,
          timeAgo: formatTimeAgo(r.createdAt),
        }))
      );
    } catch (e) {
      console.log('[POST_DETAIL] Error saving comment:', e);
    }
  };

  const renderComment = useCallback(
    ({ item }: { item: Comment }) => (
      <View style={[styles.commentRow, { borderBottomColor: colors.borderLight }]}>
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
        ) : (
          <View style={[styles.commentAvatarPlaceholder, { backgroundColor: colors.brandBlue }]}>
            <Text style={styles.commentAvatarText}>{item.userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.commentContent}>
          <View style={styles.commentNameRow}>
            <Text style={[styles.commentName, { color: colors.ink }]}>{item.userName}</Text>
            {item.userVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={8} color="#fff" />
              </View>
            )}
          </View>
          <Text style={[styles.commentText, { color: colors.inkSoft }]}>{item.text}</Text>
          <Text style={[styles.commentTime, { color: colors.inkFaint }]}>{item.timeAgo}</Text>
        </View>
      </View>
    ),
    [colors]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-outline" size={40} color={colors.inkFaint} />
        <Text style={[styles.emptyText, { color: colors.inkFaint }]}>No hay comentarios aún</Text>
        <Text style={[styles.emptySubtext, { color: colors.inkFaint }]}>Sé el primero en comentar</Text>
      </View>
    ),
    [colors]
  );

  const sheetHeader = useCallback(
    () => (
      <View style={styles.sheetHandleBar}>
        <View style={styles.sheetPill} />
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>Comentarios</Text>
      </View>
    ),
    [colors]
  );

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>Publicación</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Post content — stays visible at top */}
      <View style={styles.postContainer}>
        {/* Owner header */}
        <View style={styles.postHeader}>
          <View style={styles.postHeaderLeft}>
            {params.ownerAvatarUrl ? (
              <Image source={{ uri: params.ownerAvatarUrl }} style={styles.ownerAvatar} />
            ) : (
              <View style={[styles.ownerAvatarPlaceholder, { backgroundColor: colors.brandBlue }]}>
                <Text style={styles.ownerAvatarText}>
                  {(params.ownerName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.ownerName, { color: colors.ink }]} numberOfLines={1}>
              {params.ownerName || 'Usuario'}
            </Text>
            {params.ownerVerified === 'true' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </View>
        </View>

        {/* Photo */}
        {params.photoUrl ? (
          <Image source={{ uri: params.photoUrl }} style={styles.postPhoto} resizeMode="cover" />
        ) : null}

        {/* Status */}
        <View style={[styles.statusLabel, { backgroundColor: params.status === 'recovered' ? colors.green : colors.alertRed }]}>
          <Text style={styles.statusText}>
            {params.status === 'recovered' ? 'ENCONTRADA · CERRADA' : 'ALERTA DE ROBO · ACTIVA'}
          </Text>
        </View>

        {/* Content */}
        <Text style={[styles.postTitle, { color: colors.ink }]}>{params.title}</Text>
        <Text style={[styles.postMetadata, { color: colors.inkFaint }]}>{params.metadata}</Text>
        {params.notes ? (
          <Text style={[styles.postNotes, { color: colors.inkSoft }]}>{params.notes}</Text>
        ) : null}
        <Text style={[styles.postTime, { color: colors.inkFaint }]}>{params.timeAgo}</Text>

        {/* Comment count */}
        <TouchableOpacity
          style={[styles.commentsTrigger, { borderTopColor: colors.border }]}
          onPress={() => bottomSheetRef.current?.snapToIndex(0)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.inkSoft} />
          <Text style={[styles.commentsCount, { color: colors.inkSoft }]}>
            {comments.length > 0 ? `${comments.length} comentarios` : 'Ver comentarios'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet — comments */}
      <CustomBottomSheet
        ref={bottomSheetRef}
        initialIndex={0}
        snapPoints={snapPoints}
        onChange={handleSheetChange}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB', width: 40 }}
        handleStyle={styles.sheetHandle}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        {sheetHeader()}

        <SheetFlatList
          data={comments}
          keyExtractor={keyExtractor}
          renderItem={renderComment}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.commentsList}
        />

        {/* Comment input */}
        {params.status !== 'recovered' ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.inputAvatar} />
              ) : (
                <View style={[styles.inputAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.inputAvatarText}>
                    {(user?.name || user?.email?.split('@')[0] || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
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
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface, opacity: 0.5 }]}>
            <Text style={{ color: colors.inkFaint, fontSize: 13, textAlign: 'center', flex: 1 }}>
              Esta alerta ya fue cerrada
            </Text>
          </View>
        )}
      </CustomBottomSheet>
    </View>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  // Post
  postContainer: { paddingBottom: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 14, marginTop: 12 },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  ownerAvatar: { width: 32, height: 32, borderRadius: 16 },
  ownerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  ownerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ownerName: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#1DA1F2', justifyContent: 'center', alignItems: 'center' },
  postPhoto: { width: '100%', height: 220, marginTop: 10 },
  statusLabel: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginHorizontal: 14, marginTop: 10 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  postTitle: { fontSize: 16, fontWeight: '700', marginHorizontal: 14, marginTop: 10 },
  postMetadata: { fontSize: 13, marginHorizontal: 14, marginTop: 4 },
  postNotes: { fontSize: 13, marginHorizontal: 14, marginTop: 6, fontStyle: 'italic' },
  postTime: { fontSize: 12, marginHorizontal: 14, marginTop: 2, fontStyle: 'italic' },
  commentsTrigger: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, marginTop: 10 },
  commentsCount: { fontSize: 14, fontWeight: '500' },
  // Sheet
  sheetHandle: { height: 24 },
  sheetHandleBar: { alignItems: 'center', paddingBottom: 8 },
  sheetPill: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  sheetTitle: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  // Comments
  commentsList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  commentAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentName: { fontSize: 13, fontWeight: '600' },
  commentText: { fontSize: 13, marginTop: 2 },
  commentTime: { fontSize: 11, marginTop: 4 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyText: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  inputAvatar: { width: 32, height: 32, borderRadius: 16 },
  inputAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  inputAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
  sendBtn: { padding: 6 },
});
