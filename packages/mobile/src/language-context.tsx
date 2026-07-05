import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'es';

const translations = {
  en: {
    // Tabs
    tabHome: 'Home',
    tabMotos: 'Motos',
    tabProfile: 'Profile',
    // Home
    homeTitle: 'Welcome to Moto Tracker',
    homeSubtitle: 'Track your motorcycle maintenance and documents',
    // Motorcycles
    myMotorcycles: 'My Motorcycles',
    noMotorcycles: 'No motorcycles yet',
    noMotorcyclesSub: 'Tap + to add your first motorcycle',
    addMotorcycle: 'Add Motorcycle',
    // Forms
    brand: 'Brand',
    model: 'Model',
    year: 'Year',
    licensePlate: 'License Plate',
    currentKilometers: 'Current Kilometers',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    // Documents
    documents: 'Documents',
    noDocuments: 'No documents yet',
    noDocumentsSub: 'Tap + to add a document',
    addDocument: 'Add Document',
    title: 'Title',
    issueDate: 'Issue date',
    expiryDate: 'Expiry date',
    tapToAddPhoto: 'Tap to add document photo',
    // Profile
    account: 'Account',
    editProfile: 'Edit Profile',
    changePassword: 'Change Password',
    googleAccount: 'Google Account',
    connected: 'Connected',
    appSettings: 'App Settings',
    notifications: 'Notifications',
    theme: 'Theme',
    language: 'Language',
    support: 'Support',
    helpSupport: 'Help & Support',
    about: 'About',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure you want to sign out?',
    // Password
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    passwordChanged: 'Password changed successfully',
    // Theme
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    // Language
    english: 'English',
    spanish: 'Español',
    // Maintenance
    maintenance: 'Maintenance',
    serviceDate: 'Service Date',
    description: 'Description',
    kilometers: 'Kilometers',
    cost: 'Cost',
    notes: 'Notes',
    // Kilometers
    kilometerLog: 'Kilometer Log',
    recordedAt: 'Recorded At',
    readingKm: 'Reading (km)',
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    required: 'Required',
    optional: 'Optional',
    // About
    aboutTitle: 'About Moto Tracker',
    aboutVersion: 'Version 1.0.0',
    aboutDescription: 'Track your motorcycle maintenance and documents in one place.',
    // Help
    helpTitle: 'Help & Support',
    helpMessage: 'For support, contact us at support@mototracker.app',
    // Profile Edit
    changePhoto: 'Change Photo',
    profileUpdated: 'Profile updated successfully',
    name: 'Name',
    email: 'Email',
  },
  es: {
    // Tabs
    tabHome: 'Inicio',
    tabMotos: 'Motos',
    tabProfile: 'Perfil',
    // Home
    homeTitle: 'Bienvenido a Moto Tracker',
    homeSubtitle: 'Seguimiento del mantenimiento y documentos de tu moto',
    // Motorcycles
    myMotorcycles: 'Mis Motos',
    noMotorcycles: 'Aún no hay motos',
    noMotorcyclesSub: 'Toca + para agregar tu primera moto',
    addMotorcycle: 'Agregar Moto',
    // Forms
    brand: 'Marca',
    model: 'Modelo',
    year: 'Año',
    licensePlate: 'Patente',
    currentKilometers: 'Kilometraje Actual',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    // Documents
    documents: 'Documentos',
    noDocuments: 'Aún no hay documentos',
    noDocumentsSub: 'Toca + para agregar un documento',
    addDocument: 'Agregar Documento',
    title: 'Título',
    issueDate: 'Fecha de emisión',
    expiryDate: 'Fecha de vencimiento',
    tapToAddPhoto: 'Toca para agregar foto del documento',
    // Profile
    account: 'Cuenta',
    editProfile: 'Editar Perfil',
    changePassword: 'Cambiar Contraseña',
    googleAccount: 'Cuenta de Google',
    connected: 'Conectado',
    appSettings: 'Configuración',
    notifications: 'Notificaciones',
    theme: 'Tema',
    language: 'Idioma',
    support: 'Soporte',
    helpSupport: 'Ayuda y Soporte',
    about: 'Acerca de',
    signOut: 'Cerrar Sesión',
    signOutConfirm: '¿Estás seguro de que quieres cerrar sesión?',
    // Password
    currentPassword: 'Contraseña Actual',
    newPassword: 'Nueva Contraseña',
    confirmPassword: 'Confirmar Nueva Contraseña',
    passwordChanged: 'Contraseña cambiada exitosamente',
    // Theme
    lightMode: 'Modo Claro',
    darkMode: 'Modo Oscuro',
    // Language
    english: 'English',
    spanish: 'Español',
    // Maintenance
    maintenance: 'Mantenimiento',
    serviceDate: 'Fecha de Servicio',
    description: 'Descripción',
    kilometers: 'Kilometraje',
    cost: 'Costo',
    notes: 'Notas',
    // Kilometers
    kilometerLog: 'Registro de Kilometraje',
    recordedAt: 'Fecha de Registro',
    readingKm: 'Lectura (km)',
    // Common
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    required: 'Requerido',
    optional: 'Opcional',
    // About
    aboutTitle: 'Acerca de Moto Tracker',
    aboutVersion: 'Versión 1.0.0',
    aboutDescription: 'Seguimiento del mantenimiento y documentos de tu moto en un solo lugar.',
    // Help
    helpTitle: 'Ayuda y Soporte',
    helpMessage: 'Para soporte, contáctanos en support@mototracker.app',
    // Profile Edit
    changePhoto: 'Cambiar Foto',
    profileUpdated: 'Perfil actualizado exitosamente',
    name: 'Nombre',
    email: 'Email',
  },
};

type TranslationKey = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('language');
      if (saved === 'en' || saved === 'es') {
        setLanguageState(saved);
      }
      setLoaded(true);
    })();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('language', lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
}
