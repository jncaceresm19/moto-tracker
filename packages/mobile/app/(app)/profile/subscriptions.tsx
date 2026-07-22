import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme-context';
import { useLanguage } from '../../../src/language-context';

type PlanId = 'piloto' | 'vigia' | 'copiloto' | 'comandante' | 'garage';

interface Plan {
  id: PlanId;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  price: string;
  period?: string;
  tag: string; // ej: "Gratuito", "Popular", "Flota"
  featuresList: string[]; // checklist, se reparte en 2 columnas
  isFree?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'piloto',
    name: 'Piloto',
    icon: 'bicycle-outline',
    price: '$0',
    period: '/mes',
    tag: 'Gratuito',
    isFree: true,
    featuresList: ['1 moto', 'Documentos básicos', '9 mantenciones', '2 publicaciones /mes', 'Registro de bencina y total', 'Sin GPS'],
  },
  {
    id: 'vigia',
    name: 'Vigía',
    icon: 'radio-outline',
    price: '$4.990',
    period: '/mes',
    tag: 'Básico',
    featuresList: ['1 moto', 'Documentos básicos', '9 mantenciones', '3 publicaciones /mes', 'Registro de bencina completo', 'GPS'],
  },
  {
    id: 'copiloto',
    name: 'Copiloto',
    icon: 'people-outline',
    price: '$7.990',
    period: '/mes',
    tag: 'Popular',
    featuresList: ['2 moto', 'Documentos básicos', '2 mantenciones extra', '3 publicaciones /mes x moto', 'Registro de bencina completo', '2 GPS'],
  },
  {
    id: 'comandante',
    name: 'Comandante',
    icon: 'shield-outline',
    price: '$12.990',
    period: '/mes',
    tag: 'Avanzado',
    featuresList: ['4 moto', 'Documentos básicos', '4 mantenciones extra', '3 publicaciones /mes x moto', 'Registro de bencina completo', '4 GPS'],
  },
  {
    id: 'garage',
    name: 'Garage',
    icon: 'construct-outline',
    price: '$19.990',
    period: '/mes',
    tag: 'Flota',
    featuresList: ['Sin limite de motos', 'Documentos básicos', 'Sin limite de mantenciones', '1 publicación por moto /mes', 'Sin registro de bencina', 'Sin GPS'],
  },
];

// TODO: reemplazar por el plan real del usuario (ver PR #9 - Perfil / access_type)
const CURRENT_PLAN_ID: PlanId = 'piloto';

// TODO: reemplazar por datos reales de uso (ver PR #10/#11 - Control de acceso)
// Nota: el máximo de mantenciones debe coincidir con lo que ofrece el plan actual
// (Piloto = 9 mantenciones básicas, ver featuresList arriba)
const USAGE = {
  motos: { used: 1, max: 1 },
  mantenciones: { used: 2, max: 9 },
  renewsAt: null as string | null,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2;
const CARD_SPACING = 12;

// Color del botón "Plan actual" (mismo verde que los checkmarks de "Incluye:")
const PLAN_ACTUAL_GREEN = '#16A34A';

export default function SubscriptionsScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, PLANS.findIndex(p => p.id === CURRENT_PLAN_ID))
  );
  const scrollRef = useRef<ScrollView>(null);

  const currentPlan = PLANS.find(p => p.id === CURRENT_PLAN_ID)!;

  const handleManage = () => {
    // TODO: navegar a gestión de suscripción / Google Play, según access_type
    router.push('/(app)/profile/manage-subscription' as any);
  };

  const handleChangePlan = (planId: PlanId) => {
    // TODO: iniciar flujo de compra (Google Billing) o solicitud de cambio
    router.push({ pathname: '/(app)/profile/change-plan' as any, params: { plan: planId } });
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    setActiveIndex(Math.min(Math.max(index, 0), PLANS.length - 1));
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * (CARD_WIDTH + CARD_SPACING), animated: true });
    setActiveIndex(index);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={[]}>
      {/* Custom header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.replace('/(app)/profile')} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerTintColor }]}>{t('subscription')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Suscripción actual */}
        <View style={[styles.currentCard, { backgroundColor: colors.surface }]}>
          <View style={styles.currentCardTop}>
            <View style={styles.currentIconNameRow}>
              <View style={[styles.currentIconAvatar, { backgroundColor: colors.brandBlueBg }]}>
                <Ionicons name={currentPlan.icon} size={22} color={colors.brandBlue} />
              </View>
              <View>
                <Text style={[styles.currentLabel, { color: colors.inkFaint }]}>Tu plan actual</Text>
                <Text style={[styles.currentName, { color: colors.ink }]}>{currentPlan.name}</Text>
              </View>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: '#22C55E22' }]}>
              <Text style={[styles.activeBadgeText, { color: '#16A34A' }]}>Activo</Text>
            </View>
          </View>

          <View style={styles.usageBarsWrap}>
            <View style={styles.usageBarBlock}>
              <View style={styles.usageBarLabelRow}>
                <Text style={[styles.usageBarLabel, { color: colors.primary }]}>Motos</Text>
                <Text style={[styles.usageBarValue, { color: colors.ink }]}>
                  {USAGE.motos.used} / {USAGE.motos.max}
                </Text>
              </View>
              <View style={[styles.usageBarTrack, { backgroundColor: colors.background }]}>
                <View
                  style={[
                    styles.usageBarFill,
                    { backgroundColor: colors.brandBlue, width: `${Math.min(100, (USAGE.motos.used / USAGE.motos.max) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.usageBarBlock}>
              <View style={styles.usageBarLabelRow}>
                <Text style={[styles.usageBarLabel, { color: colors.primary }]}>Mantenciones</Text>
                <Text style={[styles.usageBarValue, { color: colors.ink }]}>
                  {USAGE.mantenciones.used} / {USAGE.mantenciones.max}
                </Text>
              </View>
              <View style={[styles.usageBarTrack, { backgroundColor: colors.background }]}>
                <View
                  style={[
                    styles.usageBarFill,
                    { backgroundColor: colors.brandBlue, width: `${Math.min(100, (USAGE.mantenciones.used / USAGE.mantenciones.max) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {!currentPlan.isFree && USAGE.renewsAt ? (
            <View style={[styles.renewRow, { borderTopColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={15} color={colors.inkSoft} />
              <Text style={[styles.renewText, { color: colors.inkSoft }]}>Se renueva el {USAGE.renewsAt}</Text>
            </View>
          ) : (
            <View style={[styles.renewRow, { borderTopColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={15} color={colors.inkSoft} />
              <Text style={[styles.renewText, { color: colors.textMuted }]}>Plan gratuito, sin cobro</Text>
            </View>
          )}

          {!currentPlan.isFree && (
            <View style={styles.currentActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.brandBlue }]}
                activeOpacity={0.8}
                onPress={handleManage}
              >
                <Text style={[styles.actionBtnText, { color: colors.brandBlue }]}>Gestionar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Todos los planes — carrusel horizontal, 1 card visible por vez */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Todos los planes</Text>

        <ScrollView
          ref={scrollRef}
          horizontal
          snapToInterval={CARD_WIDTH + CARD_SPACING}
          decelerationRate="fast"
          snapToAlignment="start"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          contentContainerStyle={styles.carouselContent}
        >
          {PLANS.map((plan, index) => {
            const isCurrent = plan.id === CURRENT_PLAN_ID;

            return (
              <View
                key={plan.id}
                style={[
                  styles.outerCard,
                  {
                    width: CARD_WIDTH,
                    marginRight: index === PLANS.length - 1 ? 0 : CARD_SPACING,
                    backgroundColor: colors.surface,
                    borderColor: isCurrent ? PLAN_ACTUAL_GREEN : colors.primary,
                  },
                  isCurrent && styles.outerCardCurrent,
                ]}
              >
                {/* Logo de la app, centrado (estilo Aikido) */}
                <Image
                  source={require('../../../assets/nombre.jpeg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                {/* Nombre del plan con su ícono, dentro del badge (como antes) */}
                <View style={[styles.tagPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name={plan.icon} size={14} color={colors.inkSoft} />
                  <Text style={[styles.tagPillText, { color: colors.ink }]}>{plan.name}</Text>
                </View>

                {/* Card interna con el detalle del plan */}
                <View style={[styles.innerCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {/* Texto del tier (Gratuito, Básico, etc.), simple, sin badge */}
                  <Text style={[styles.tierText, { color: colors.primary }]}>{plan.tag}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.priceValue, { color: colors.ink }]}>{plan.price}</Text>
                    {plan.period && <Text style={[styles.pricePeriod, { color: colors.inkFaint }]}>{plan.period}</Text>}
                  </View>

                  <Text style={[styles.includesLabel, { color: colors.inkFaint }]}>Incluye:</Text>

                  {/* Checklist en 1 columna, texto más pequeño */}
                  <View style={styles.featuresList}>
                    {plan.featuresList.map((feature, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={13} color={colors.success ?? '#16A34A'} />
                        <Text style={[styles.featureText, { color: colors.ink }]}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* CTA */}
                {isCurrent ? (
                  <View style={[styles.currentStateBtn, { backgroundColor: PLAN_ACTUAL_GREEN }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.currentStateBtnText}>Plan actual</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.changeBtn, { backgroundColor: colors.primary }]}
                    activeOpacity={0.85}
                    onPress={() => handleChangePlan(plan.id)}
                  >
                    <Text style={styles.changeBtnText}>Cambiar a este plan</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Dots de paginación */}
        <View style={styles.dotsRow}>
          {PLANS.map((plan, index) => (
            <TouchableOpacity key={plan.id} onPress={() => scrollToIndex(index)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? colors.brandBlue : colors.border,
                    width: index === activeIndex ? 18 : 6,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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

  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },

  // Current plan card (Opción A: avatar + barras de progreso)
  currentCard: { borderRadius: 20, padding: 20 },
  currentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  currentIconNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currentIconAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  currentLabel: { fontSize: 12, marginBottom: 2 },
  currentName: { fontSize: 18, fontWeight: '600' },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, height: 24 },
  activeBadgeText: { fontSize: 11, fontWeight: '600' },

  usageBarsWrap: { gap: 14 },
  usageBarBlock: {},
  usageBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  usageBarLabel: { fontSize: 13 },
  usageBarValue: { fontSize: 13, fontWeight: '600' },
  usageBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  usageBarFill: { height: '100%', borderRadius: 3 },

  renewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
  renewText: { fontSize: 13 },

  currentActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },

  // Section title
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 14,
  },

  // Carousel
  carouselContent: {
    paddingRight: 0,
  },

  // Outer card — envoltorio tipo Aikido (logo + headline arriba)
  outerCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  outerCardCurrent: { borderWidth: 2 },

  logo: {
    width: 300,
    height: 150,
    marginTop: -35,
    marginBottom: -50,
  },
  tierText: { fontSize: 20, fontWeight: '500', marginBottom: 10 },

  // Inner card — detalle del plan
  innerCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  tagPill: {

    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  tagPillText: { fontSize: 13, fontWeight: '600' },

  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 14 },
  priceValue: { fontSize: 30, fontWeight: '700' },
  pricePeriod: { fontSize: 13, marginBottom: 4 },

  includesLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },

  featuresList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, flexShrink: 1 },

  changeBtn: { width: '100%', borderRadius: 30, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  changeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  currentStateBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 30,
    paddingVertical: 12,
    marginTop: 18,
  },
  currentStateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 },
  dot: { height: 6, borderRadius: 3 },
});