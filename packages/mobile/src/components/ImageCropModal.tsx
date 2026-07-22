import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, ActivityIndicator, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

interface ImageCropModalProps {
  visible: boolean;
  imageUri: string;
  onConfirm: (base64: string) => void;
  onCancel: () => void;
}

const PREVIEW_W = 320;
const PREVIEW_H = 320;
const MIN_BOX = 40; // tamaño mínimo del cuadro de recorte, en px de pantalla

type Box = { x: number; y: number; w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number; scale: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';

export function ImageCropModal({ visible, imageUri, onConfirm, onCancel }: ImageCropModalProps) {
  const [currentUri, setCurrentUri] = useState(imageUri);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [cropMode, setCropMode] = useState(true);

  // Refs siempre sincronizados con el último valor, para que los PanResponder
  // (creados una sola vez con useRef) nunca lean un valor viejo por closure.
  const boxRef = useRef<Box | null>(null);
  useEffect(() => { boxRef.current = box; }, [box]);

  const cropModeRef = useRef(cropMode);
  useEffect(() => { cropModeRef.current = cropMode; }, [cropMode]);

  const imgRectRef = useRef<typeof imgRect>(imgRect);
  useEffect(() => { imgRectRef.current = imgRect; }, [imgRect]);

  // Rect de la imagen dentro del preview (resizeMode contain).
  // Este es el límite superior real: el cuadro de recorte nunca puede salir de aquí.
  const imgRect = useCallback((): Rect | null => {
    if (!natural) return null;
    const scale = Math.min(PREVIEW_W / natural.w, PREVIEW_H / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    const x = (PREVIEW_W - w) / 2;
    const y = (PREVIEW_H - h) / 2;
    return { x, y, w, h, scale };
  }, [natural]);

  // Reinicia todo cuando cambia la imagen de entrada. Evita procesar cuando
  // aún no hay foto seleccionada (imageUri === ''), lo que causaba el warning
  // "source.uri should not be an empty string".
  useEffect(() => {
    if (!imageUri) return;
    setCurrentUri(imageUri);
    setNatural(null);
    setBox(null);
    setCropMode(true);
  }, [imageUri]);

  const handleLoad = (w: number, h: number) => {
    setNatural({ w, h });
  };

  // El cuadro parte al 90% del tamaño de la imagen (inset 5% por lado)
  // para que se vea ajustable desde el inicio.
  useEffect(() => {
    const rect = imgRect();
    if (rect && !box) {
      const inset = 0.05; // 5% de margen por lado → 90% del tamaño
      setBox({
        x: rect.x + rect.w * inset,
        y: rect.y + rect.h * inset,
        w: rect.w * (1 - 2 * inset),
        h: rect.h * (1 - 2 * inset),
      });
    }
  }, [natural]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clamp para MOVER el cuadro completo: w/h no cambian, solo x/y,
  // y siempre quedan dentro de rect (el ancho/alto real de la foto).
  const clampMove = (b: Box, rect: Rect): Box => {
    const w = b.w;
    const h = b.h;
    const x = Math.min(Math.max(b.x, rect.x), rect.x + rect.w - w);
    const y = Math.min(Math.max(b.y, rect.y), rect.y + rect.h - h);
    return { x, y, w, h };
  };

  // Clamp para REDIMENSIONAR desde una esquina: la esquina OPUESTA queda fija
  // (ancla real), y solo la esquina que arrastras se limita al ancho/alto de la foto.
  const resizeFromCorner = (corner: Corner, start: Box, dx: number, dy: number, rect: Rect): Box => {
    if (corner === 'br') {
      const anchorX = start.x, anchorY = start.y;
      const right = Math.min(Math.max(start.x + start.w + dx, anchorX + MIN_BOX), rect.x + rect.w);
      const bottom = Math.min(Math.max(start.y + start.h + dy, anchorY + MIN_BOX), rect.y + rect.h);
      return { x: anchorX, y: anchorY, w: right - anchorX, h: bottom - anchorY };
    }
    if (corner === 'tl') {
      const anchorX = start.x + start.w, anchorY = start.y + start.h;
      const left = Math.max(Math.min(start.x + dx, anchorX - MIN_BOX), rect.x);
      const top = Math.max(Math.min(start.y + dy, anchorY - MIN_BOX), rect.y);
      return { x: left, y: top, w: anchorX - left, h: anchorY - top };
    }
    if (corner === 'tr') {
      const anchorX = start.x, anchorY = start.y + start.h;
      const right = Math.min(Math.max(start.x + start.w + dx, anchorX + MIN_BOX), rect.x + rect.w);
      const top = Math.max(Math.min(start.y + dy, anchorY - MIN_BOX), rect.y);
      return { x: anchorX, y: top, w: right - anchorX, h: anchorY - top };
    }
    // bl
    const anchorX = start.x + start.w, anchorY = start.y;
    const left = Math.max(Math.min(start.x + dx, anchorX - MIN_BOX), rect.x);
    const bottom = Math.min(Math.max(start.y + start.h + dy, anchorY + MIN_BOX), rect.y + rect.h);
    return { x: left, y: anchorY, w: anchorX - left, h: bottom - anchorY };
  };

  // ── Mover el cuadro completo ──────────────────────────────────────────────
  const moveStartRef = useRef<Box | null>(null);
  const movePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => cropModeRef.current,
      onMoveShouldSetPanResponder: () => cropModeRef.current,
      onPanResponderGrant: () => { moveStartRef.current = boxRef.current; },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const start = moveStartRef.current;
        const rect = imgRectRef.current();
        if (!start || !rect || !cropModeRef.current) return;
        setBox(clampMove({ x: start.x + g.dx, y: start.y + g.dy, w: start.w, h: start.h }, rect));
      },
    })
  ).current;

  // ── Redimensionar desde una esquina ──────────────────────────────────────
  const cornerStartRef = useRef<Box | null>(null);
  const makeCornerResponder = (corner: Corner) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => cropModeRef.current,
      onMoveShouldSetPanResponder: () => cropModeRef.current,
      onPanResponderGrant: () => { cornerStartRef.current = boxRef.current; },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const start = cornerStartRef.current;
        const rect = imgRectRef.current();
        if (!start || !rect || !cropModeRef.current) return;
        setBox(resizeFromCorner(corner, start, g.dx, g.dy, rect));
      },
    });
  const tlResponder = useRef(makeCornerResponder('tl')).current;
  const trResponder = useRef(makeCornerResponder('tr')).current;
  const blResponder = useRef(makeCornerResponder('bl')).current;
  const brResponder = useRef(makeCornerResponder('br')).current;

  // ── Girar: rota los píxeles reales (no solo visualmente) y resetea el cuadro ──
  const rotate = async () => {
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCurrentUri(result.uri);
      setNatural({ w: result.width, h: result.height });
      setBox(null); // se recalcula al nuevo tamaño en el useEffect de arriba
    } catch (err) {
      console.error('[ImageCropModal] Error al girar la imagen:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Botón de recorte: alterna el modo. Al activarlo, asegura que el cuadro exista.
  const toggleCropMode = () => {
    if (!cropMode) {
      const rect = imgRect();
      if (rect && !box) setBox({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    }
    setCropMode((v) => !v);
  };

  const confirm = async () => {
    setProcessing(true);
    try {
      const rect = imgRect();

      if (!cropMode || !rect || !box || !natural) {
        const result = await ImageManipulator.manipulateAsync(currentUri, [], { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        if (result.base64) onConfirm(result.base64);
        return;
      }

      // Redondeo + clamp defensivo: origin y tamaño nunca pueden pasarse
      // del tamaño real de la imagen (natural.w/h), aunque el redondeo
      // independiente de cada valor sume 1px de más.
      let originX = Math.round((box.x - rect.x) / rect.scale);
      let originY = Math.round((box.y - rect.y) / rect.scale);
      let cropW = Math.round(box.w / rect.scale);
      let cropH = Math.round(box.h / rect.scale);

      originX = Math.max(0, Math.min(originX, natural.w - MIN_BOX));
      originY = Math.max(0, Math.min(originY, natural.h - MIN_BOX));
      cropW = Math.min(cropW, natural.w - originX);
      cropH = Math.min(cropH, natural.h - originY);

      const isFullImage = originX <= 0 && originY <= 0 && cropW >= natural.w && cropH >= natural.h;

      if (isFullImage) {
        const result = await ImageManipulator.manipulateAsync(currentUri, [], { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        if (result.base64) onConfirm(result.base64);
        return;
      }

      try {
        const cropped = await ImageManipulator.manipulateAsync(
          currentUri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (cropped.base64) onConfirm(cropped.base64);
      } catch (cropErr) {
        // El recorte falló (por ejemplo, bordes fuera de rango) — en vez de
        // cancelar todo silenciosamente, guardamos la imagen completa y
        // dejamos el error visible para poder depurarlo.
        console.error('[ImageCropModal] Falló el recorte, se guarda la imagen completa:', cropErr);
        const fallback = await ImageManipulator.manipulateAsync(currentUri, [], { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: true });
        if (fallback.base64) onConfirm(fallback.base64);
      }
    } catch (err) {
      console.error('[ImageCropModal] Error inesperado en confirm:', err);
      onCancel();
    } finally {
      setProcessing(false);
    }
  };

  const rect = imgRect();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <TouchableOpacity style={s.iconBtn} onPress={rotate} accessibilityLabel="Girar imagen" disabled={processing}>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.title}>Editar imagen</Text>
            <TouchableOpacity
              style={[s.iconBtn, cropMode && s.iconBtnActive]}
              onPress={toggleCropMode}
              accessibilityLabel="Activar recorte libre"
              disabled={processing}
            >
              <Ionicons name="crop-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Sin overflow:hidden aquí: así las manijas nunca se recortan visualmente
              cerca del borde de la foto. El borderRadius se aplica directo a la Image. */}
          <View style={s.preview}>
            {currentUri ? (
              <Image
                source={{ uri: currentUri }}
                style={{ width: PREVIEW_W, height: PREVIEW_H, borderRadius: 12 }}
                resizeMode="contain"
                onLoad={(e) => {
                  if (!natural) {
                    const { width, height } = e.nativeEvent.source;
                    handleLoad(width, height);
                  }
                }}
              />
            ) : null}

            {cropMode && rect && box && (
              <>
                <View pointerEvents="none" style={[s.dim, { left: rect.x, top: rect.y, width: rect.w, height: box.y - rect.y }]} />
                <View pointerEvents="none" style={[s.dim, { left: rect.x, top: box.y + box.h, width: rect.w, height: rect.y + rect.h - (box.y + box.h) }]} />
                <View pointerEvents="none" style={[s.dim, { left: rect.x, top: box.y, width: box.x - rect.x, height: box.h }]} />
                <View pointerEvents="none" style={[s.dim, { left: box.x + box.w, top: box.y, width: rect.x + rect.w - (box.x + box.w), height: box.h }]} />

                <View
                  {...movePanResponder.panHandlers}
                  style={[s.cropBox, { left: box.x, top: box.y, width: box.w, height: box.h }]}
                >
                  <View {...tlResponder.panHandlers} style={[s.handle, s.handleTL]}><View style={s.handleInner} /></View>
                  <View {...trResponder.panHandlers} style={[s.handle, s.handleTR]}><View style={s.handleInner} /></View>
                  <View {...blResponder.panHandlers} style={[s.handle, s.handleBL]}><View style={s.handleInner} /></View>
                  <View {...brResponder.panHandlers} style={[s.handle, s.handleBR]}><View style={s.handleInner} /></View>
                </View>
              </>
            )}
          </View>

          <Text style={s.hint}>
            {cropMode ? 'Arrastra las esquinas o mueve el cuadro para recortar' : 'Toca el ícono de recorte para activar el recorte'}
          </Text>

          <View style={s.row}>
            <TouchableOpacity style={[s.actionBtn, s.cancelBtn]} onPress={onCancel} disabled={processing}>
              <Ionicons name="close-outline" size={22} color="#fff" />
              <Text style={s.actionText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.actionBtn, s.confirmBtn]} onPress={confirm} disabled={processing}>
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={22} color="#fff" />
                  <Text style={s.actionText}>Confirmar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '90%', maxWidth: 400, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  iconBtnActive: { backgroundColor: '#3b82f6' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  preview: { width: PREVIEW_W, height: PREVIEW_H, backgroundColor: '#1a1a1a', borderRadius: 12, marginBottom: 8 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  cropBox: { position: 'absolute', borderWidth: 2, borderColor: '#fff' },
  handle: { position: 'absolute', width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  handleInner: { width: 22, height: 22, backgroundColor: '#fff', borderRadius: 11, borderWidth: 3, borderColor: '#3b82f6' },
  handleTL: { left: -22, top: -22 },
  handleTR: { right: -22, top: -22 },
  handleBL: { left: -22, bottom: -22 },
  handleBR: { right: -22, bottom: -22 },
  hint: { color: '#aaa', fontSize: 12, marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelBtn: { backgroundColor: '#ef4444' },
  confirmBtn: { backgroundColor: '#22c55e' },
});