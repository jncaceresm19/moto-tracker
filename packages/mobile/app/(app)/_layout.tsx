import { Tabs, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
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
          headerLeft: () => <BackButton />,
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
    </Tabs>
  );
}