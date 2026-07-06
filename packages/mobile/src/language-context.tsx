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
    // Motorcycle Detail
    motorcycleDetail: 'Motorcycle Detail',
    maintenanceRecords: 'Maintenance Records',
    kilometerHistory: 'Kilometer History',
    sections: 'Sections',
    editMotorcycle: 'Edit Motorcycle',
    motorcycleNotFound: 'Motorcycle not found',
    failedToLoad: 'Failed to load motorcycle',
    motorcycleUpdated: 'Motorcycle updated',
    failedToUpdate: 'Failed to update',
    deleteMotorcycle: 'Delete Motorcycle',
    deleteConfirm: 'This action cannot be undone.',
    failedToDelete: 'Failed to delete',
    // Maintenance Screen
    addRecord: 'Add Record',
    noRecords: 'No maintenance records yet',
    noRecordsSub: 'Tap + to log maintenance',
    newRecord: 'New Record',
    editRecord: 'Edit Record',
    recordSaved: 'Record saved',
    recordUpdated: 'Record updated',
    failedToCreate: 'Failed to create',
    deleteRecord: 'Delete Record',
    // Type labels
    oilChange: 'Oil Change',
    tireChange: 'Tire Change',
    brakeCheck: 'Brake Check',
    sparkPlugs: 'Spark Plugs',
    technicalReview: 'Technical Review',
    circulationPermit: 'Circulation Permit',
    insurance: 'Insurance',
    registration: 'Registration',
    other: 'Other',
    // Documents Screen
    addDocument: 'Add Document',
    noDocuments: 'No documents yet',
    noDocumentsSub: 'Tap + to add a document',
    newDocument: 'New Document',
    editDocument: 'Edit Document',
    documentSaved: 'Document saved',
    documentUpdated: 'Document updated',
    deleteDocument: 'Delete Document',
    addDocumentPhoto: 'Add Document Photo',
    chooseOption: 'Choose an option',
    takePhoto: 'Take Photo',
    chooseFromGallery: 'Choose from Gallery',
    permissionNeeded: 'Permission needed',
    permissionMessage: 'Please grant camera permission.',
    title: 'Title',
    issueDate: 'Issue date',
    expiryDate: 'Expiry date',
    tapToAddPhoto: 'Tap to add document photo',
    saveAll: 'Save All',
    saveAsPdf: 'Save as PDF',
    download: 'Download',
    share: 'Share',
    done: 'Done',
    noDocumentAttached: 'No document attached',
    tapToView: 'Tap to view',
    issued: 'Issued',
    expires: 'Expires',
    valid: 'Valid',
    expiring: 'Expiring',
    expired: 'Expired',
    noPhotos: 'No photos',
    noPhotosSub: 'No documents with photos to save.',
    failedToSave: 'Failed to save',
    failedToShare: 'Failed to share',
    // Kilometers Screen
    addEntry: 'Add Entry',
    noEntries: 'No kilometer entries yet',
    noEntriesSub: 'Tap + to record mileage',
    newReading: 'New Reading',
    editReading: 'Edit Reading',
    readingSaved: 'Reading saved',
    readingUpdated: 'Reading updated',
    deleteEntry: 'Delete Entry',
    selectDate: 'Select date',
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
    helpMessage: 'For support, contact us at jdevlabs.cl@gmail.com',
    // Profile Edit
    changePhoto: 'Change Photo',
    profileUpdated: 'Profile updated successfully',
    name: 'Name',
    email: 'Email',
    camera: 'Camera',
    gallery: 'Gallery',
    cameraPermission: 'Camera permission is required',
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
    // Motorcycle Detail
    motorcycleDetail: 'Detalle de Moto',
    maintenanceRecords: 'Registros de Mantenimiento',
    kilometerHistory: 'Historial de Kilometraje',
    sections: 'Secciones',
    editMotorcycle: 'Editar Moto',
    motorcycleNotFound: 'Moto no encontrada',
    failedToLoad: 'Error al cargar moto',
    motorcycleUpdated: 'Moto actualizada',
    failedToUpdate: 'Error al actualizar',
    deleteMotorcycle: 'Eliminar Moto',
    deleteConfirm: 'Esta acción no se puede deshacer.',
    failedToDelete: 'Error al eliminar',
    // Maintenance Screen
    addRecord: 'Agregar Registro',
    noRecords: 'Aún no hay registros de mantenimiento',
    noRecordsSub: 'Toca + para registrar mantenimiento',
    newRecord: 'Nuevo Registro',
    editRecord: 'Editar Registro',
    recordSaved: 'Registro guardado',
    recordUpdated: 'Registro actualizado',
    failedToCreate: 'Error al crear',
    deleteRecord: 'Eliminar Registro',
    // Type labels
    oilChange: 'Cambio de Aceite',
    tireChange: 'Cambio de Cubiertas',
    brakeCheck: 'Revisión de Frenos',
    sparkPlugs: 'Bujías',
    technicalReview: 'Revisión Técnica',
    circulationPermit: 'Permiso de Circulación',
    insurance: 'Seguro',
    registration: 'Registro',
    other: 'Otro',
    // Documents Screen
    addDocument: 'Agregar Documento',
    noDocuments: 'Aún no hay documentos',
    noDocumentsSub: 'Toca + para agregar un documento',
    newDocument: 'Nuevo Documento',
    editDocument: 'Editar Documento',
    documentSaved: 'Documento guardado',
    documentUpdated: 'Documento actualizado',
    deleteDocument: 'Eliminar Documento',
    addDocumentPhoto: 'Agregar Foto de Documento',
    chooseOption: 'Elige una opción',
    takePhoto: 'Tomar Foto',
    chooseFromGallery: 'Elegir de Galería',
    permissionNeeded: 'Permiso requerido',
    permissionMessage: 'Por favor concede permiso de cámara.',
    issueDate: 'Fecha de emisión',
    expiryDate: 'Fecha de vencimiento',
    tapToAddPhoto: 'Toca para agregar foto del documento',
    saveAll: 'Guardar Todo',
    saveAsPdf: 'Guardar como PDF',
    download: 'Descargar',
    share: 'Compartir',
    done: 'Listo',
    noDocumentAttached: 'Sin documento adjunto',
    tapToView: 'Toca para ver',
    issued: 'Emitido',
    expires: 'Vence',
    valid: 'Válido',
    expiring: 'Por vencer',
    expired: 'Vencido',
    noPhotos: 'Sin fotos',
    noPhotosSub: 'No hay documentos con fotos para guardar.',
    failedToSave: 'Error al guardar',
    failedToShare: 'Error al compartir',
    // Kilometers Screen
    addEntry: 'Agregar Entrada',
    noEntries: 'Aún no hay entradas de kilometraje',
    noEntriesSub: 'Toca + para registrar lectura',
    newReading: 'Nueva Lectura',
    editReading: 'Editar Lectura',
    readingSaved: 'Lectura guardada',
    readingUpdated: 'Lectura actualizada',
    deleteEntry: 'Eliminar Entrada',
    selectDate: 'Seleccionar fecha',
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
    helpMessage: 'Para soporte, contáctanos en jdevlabs.cl@gmail.com',
    // Profile Edit
    changePhoto: 'Cambiar Foto',
    profileUpdated: 'Perfil actualizado exitosamente',
    name: 'Nombre',
    email: 'Email',
    camera: 'Cámara',
    gallery: 'Galería',
    cameraPermission: 'Se requiere permiso de cámara',
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
