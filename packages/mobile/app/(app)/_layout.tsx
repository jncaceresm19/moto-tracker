import { Tabs, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../src/theme-context';
import { useLanguage } from '../../src/language-context';

function BackButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 12 }}>
      <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
    </TouchableOpacity>
  );
}

function MotoDetailBackButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={() => router.push('/(app)/motos')} style={{ marginLeft: 12 }}>
      <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
    </TouchableOpacity>
  );
}

function TrackingBackButton() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <TouchableOpacity onPress={() => router.replace(`/(app)/motorcycle/${id}`)} style={{ marginLeft: 12 }}>
      <Ionicons name="chevron-back" size={26} color={colors.headerTintColor} />
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerTintColor,
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '600',
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          height: 75,
          paddingBottom: 14,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: t('tabHome'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manual-publication"
        options={{
          title: t('tabManualPublication'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size + 8} color={color} />
          ),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="motos"
        options={{
          title: t('tabMotos'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]"
        options={{
          href: null,
          title: t('motorcycleDetail'),
          headerLeft: () => <MotoDetailBackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/documents"
        options={{
          href: null,
          title: t('documents'),
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/kilometers"
        options={{
          href: null,
          title: t('kilometers'),
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/maintenance"
        options={{
          href: null,
          title: t('maintenance'),
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/tracking"
        options={{
          href: null,
          title: t('gpsTracking'),
          headerLeft: () => <TrackingBackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/verification"
        options={{
          href: null,
          title: 'Verificación',
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="motorcycle/[id]/fuel"
        options={{
          href: null,
          title: 'Combustible',
          headerLeft: () => <BackButton />,
        }}
      />
      <Tabs.Screen
        name="my-publications"
        options={{
          href: null,
          title: t('myPublications'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile/notifications"
        options={{
          href: null,
          title: t('notifications'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile/tracker"
        options={{
          href: null,
          title: t('protocolTrakerConfig'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile/subscriptions"
        options={{
          href: null,
          title: t('subscription'),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile/admin"
        options={{
          href: null,
          title: t('admin'),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}