export interface ComunaZone {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export const CHILE_COMUNAS: ComunaZone[] = [
  // Región de Arica y Parinacota
  { id: 'arica', name: 'Arica', region: 'Arica y Parinacota', latitude: -18.4783, longitude: -70.3126 },
  { id: 'putre', name: 'Putre', region: 'Arica y Parinacota', latitude: -18.1953, longitude: -69.5586 },

  // Región de Tarapacá
  { id: 'iquique', name: 'Iquique', region: 'Tarapacá', latitude: -20.2133, longitude: -70.1503 },
  { id: 'alto_hospicio', name: 'Alto Hospicio', region: 'Tarapacá', latitude: -20.2689, longitude: -70.0969 },

  // Región de Antofagasta
  { id: 'antofagasta', name: 'Antofagasta', region: 'Antofagasta', latitude: -23.6509, longitude: -70.3975 },
  { id: 'calama', name: 'Calama', region: 'Antofagasta', latitude: -22.4566, longitude: -68.9297 },
  { id: 'tocopilla', name: 'Tocopilla', region: 'Antofagasta', latitude: -22.0923, longitude: -70.1977 },

  // Región de Atacama
  { id: 'copiapo', name: 'Copiapó', region: 'Atacama', latitude: -27.3668, longitude: -70.3323 },
  { id: 'vallenar', name: 'Vallenar', region: 'Atacama', latitude: -28.5708, longitude: -70.7578 },
  { id: 'chanaral', name: 'Chanaral', region: 'Atacama', latitude: -26.3489, longitude: -70.6210 },

  // Región de Coquimbo
  { id: 'la_serena', name: 'La Serena', region: 'Coquimbo', latitude: -29.9027, longitude: -71.2520 },
  { id: 'coquimbo', name: 'Coquimbo', region: 'Coquimbo', latitude: -29.9533, longitude: -71.3395 },
  { id: 'ovalle', name: 'Ovalle', region: 'Coquimbo', latitude: -30.5989, longitude: -71.1998 },
  { id: 'illapel', name: 'Illapel', region: 'Coquimbo', latitude: -31.6336, longitude: -71.1725 },
  { id: 'vicuna', name: 'Vicuña', region: 'Coquimbo', latitude: -30.0410, longitude: -70.7096 },

  // Región de Valparaíso
  { id: 'valparaiso', name: 'Valparaíso', region: 'Valparaíso', latitude: -33.0472, longitude: -71.6127 },
  { id: 'vina_del_mar', name: 'Viña del Mar', region: 'Valparaíso', latitude: -33.0153, longitude: -71.5500 },
  { id: 'quilpue', name: 'Quilpué', region: 'Valparaíso', latitude: -33.0475, longitude: -71.4417 },
  { id: 'villa_alemana', name: 'Villa Alemana', region: 'Valparaíso', latitude: -33.0422, longitude: -71.3731 },
  { id: 'san_antonio', name: 'San Antonio', region: 'Valparaíso', latitude: -33.5933, longitude: -71.6067 },
  { id: 'los_andes', name: 'Los Andes', region: 'Valparaíso', latitude: -32.8336, longitude: -70.5983 },
  { id: 'san_felipe', name: 'San Felipe', region: 'Valparaíso', latitude: -32.7496, longitude: -70.7248 },
  { id: 'iquique', name: 'Iquique', region: 'Tarapacá', latitude: -20.2133, longitude: -70.1503 },
  { id: 'san_esteban', name: 'San Esteban', region: 'Valparaíso', latitude: -32.8025, longitude: -70.5817 },
  { id: 'puchuncavi', name: 'Puchuncaví', region: 'Valparaíso', latitude: -32.7253, longitude: -71.4172 },
  { id: 'casablanca', name: 'Casablanca', region: 'Valparaíso', latitude: -33.3167, longitude: -71.4000 },
  { id: 'concón', name: 'Concón', region: 'Valparaíso', latitude: -32.9167, longitude: -71.5167 },
  { id: 'renaca', name: 'Reñaca', region: 'Valparaíso', latitude: -32.8333, longitude: -71.5333 },

  // Región Metropolitana de Santiago
  { id: 'santiago', name: 'Santiago', region: 'Metropolitana', latitude: -33.4489, longitude: -70.6693 },
  { id: 'providencia', name: 'Providencia', region: 'Metropolitana', latitude: -33.4258, longitude: -70.6112 },
  { id: 'las_condes', name: 'Las Condes', region: 'Metropolitana', latitude: -33.4100, longitude: -70.5650 },
  { id: 'vitacura', name: 'Vitacura', region: 'Metropolitana', latitude: -33.3833, longitude: -70.5667 },
  { id: 'ñuñoa', name: 'Ñuñoa', region: 'Metropolitana', latitude: -33.4567, longitude: -70.5967 },
  { id: 'la_reina', name: 'La Reina', region: 'Metropolitana', latitude: -33.4500, longitude: -70.5500 },
  { id: 'macul', name: 'Macul', region: 'Metropolitana', latitude: -33.4900, longitude: -70.5978 },
  { id: 'peñalolén', name: 'Peñalolén', region: 'Metropolitana', latitude: -33.4900, longitude: -70.5400 },
  { id: 'la_florida', name: 'La Florida', region: 'Metropolitana', latitude: -33.5167, longitude: -70.5967 },
  { id: 'puente_alto', name: 'Puente Alto', region: 'Metropolitana', latitude: -33.6133, longitude: -70.5758 },
  { id: 'san_miguel', name: 'San Miguel', region: 'Metropolitana', latitude: -33.4967, longitude: -70.6533 },
  { id: 'san_joaquín', name: 'San Joaquín', region: 'Metropolitana', latitude: -33.4889, longitude: -70.6283 },
  { id: 'la_pintana', name: 'La Pintana', region: 'Metropolitana', latitude: -33.5833, longitude: -70.6333 },
  { id: 'san_ramón', name: 'San Ramón', region: 'Metropolitana', latitude: -33.5333, longitude: -70.6467 },
  { id: 'la_granja', name: 'La Granja', region: 'Metropolitana', latitude: -33.5333, longitude: -70.6267 },
  { id: 'quinta_normal', name: 'Quinta Normal', region: 'Metropolitana', latitude: -33.4333, longitude: -70.6967 },
  { id: 'cerrillos', name: 'Cerrillos', region: 'Metropolitana', latitude: -33.4933, longitude: -70.7133 },
  { id: 'estación_central', name: 'Estación Central', region: 'Metropolitana', latitude: -33.4533, longitude: -70.6797 },
  { id: 'pedro_aguirre_cerda', name: 'Pedro Aguirre Cerda', region: 'Metropolitana', latitude: -33.4900, longitude: -70.6833 },
  { id: 'san_josé_de_maipo', name: 'San José de Maipo', region: 'Metropolitana', latitude: -33.6333, longitude: -70.3500 },
  { id: 'pirque', name: 'Pirque', region: 'Metropolitana', latitude: -33.6667, longitude: -70.5833 },
  { id: 'buin', name: 'Buin', region: 'Metropolitana', latitude: -33.7333, longitude: -70.7333 },
  { id: 'puente_alto', name: 'Puente Alto', region: 'Metropolitana', latitude: -33.6133, longitude: -70.5758 },
  { id: 'san_bernardo', name: 'San Bernardo', region: 'Metropolitana', latitude: -33.5933, longitude: -70.7000 },
  { id: 'calera_de_tango', name: 'Calera de Tango', region: 'Metropolitana', latitude: -33.6333, longitude: -70.7667 },
  { id: 'melipilla', name: 'Melipilla', region: 'Metropolitana', latitude: -33.6833, longitude: -71.2167 },
  { id: 'peñaflor', name: 'Peñaflor', region: 'Metropolitana', latitude: -33.6167, longitude: -70.8833 },
  { id: 'talagante', name: 'Talagante', region: 'Metropolitana', latitude: -33.6667, longitude: -70.9333 },
  { id: 'el_monte', name: 'El Monte', region: 'Metropolitana', latitude: -33.6833, longitude: -71.0000 },
  { id: 'isla_de_maipo', name: 'Isla de Maipo', region: 'Metropolitana', latitude: -33.7500, longitude: -70.9000 },
  { id: 'curacaví', name: 'Curacaví', region: 'Metropolitana', latitude: -33.4000, longitude: -71.1333 },
  { id: 'maría_pinto', name: 'María Pinto', region: 'Metropolitana', latitude: -33.5167, longitude: -71.1167 },
  { id: 'tiltil', name: 'Tiltil', region: 'Metropolitana', latitude: -33.1000, longitude: -70.9333 },
  { id: 'colina', name: 'Colina', region: 'Metropolitana', latitude: -33.2000, longitude: -70.6667 },
  { id: 'lampa', name: 'Lampa', region: 'Metropolitana', latitude: -33.2833, longitude: -70.8833 },
  { id: 'quilicura', name: 'Quilicura', region: 'Metropolitana', latitude: -33.3500, longitude: -70.7333 },
  { id: 'renca', name: 'Renca', region: 'Metropolitana', latitude: -33.4000, longitude: -70.7000 },
  { id: 'huechuraba', name: 'Huechuraba', region: 'Metropolitana', latitude: -33.3667, longitude: -70.6333 },
  { id: 'independencia', name: 'Independencia', region: 'Metropolitana', latitude: -33.4167, longitude: -70.6500 },
  { id: 'recoleta', name: 'Recoleta', region: 'Metropolitana', latitude: -33.4000, longitude: -70.6333 },
  { id: 'conchalí', name: 'Conchalí', region: 'Metropolitana', latitude: -33.3833, longitude: -70.6500 },

  // Región de O'Higgins
  { id: 'rancagua', name: 'Rancagua', region: "O'Higgins", latitude: -34.1708, longitude: -70.7404 },
  { id: 'san_fernando', name: 'San Fernando', region: "O'Higgins", latitude: -34.5833, longitude: -70.9833 },
  { id: 'san_vicente', name: 'San Vicente', region: "O'Higgins", latitude: -34.4333, longitude: -71.0833 },
  { id: 'rengo', name: 'Rengo', region: "O'Higgins", latitude: -34.4000, longitude: -70.8667 },
  { id: 'pirque', name: 'Pirque', region: "O'Higgins", latitude: -34.1667, longitude: -70.8333 },

  // Región de Maule
  { id: 'talca', name: 'Talca', region: 'Maule', latitude: -35.4264, longitude: -71.6554 },
  { id: 'curico', name: 'Curicó', region: 'Maule', latitude: -34.9828, longitude: -71.2369 },
  { id: 'linares', name: 'Linares', region: 'Maule', latitude: -35.8461, longitude: -71.5931 },
  { id: 'cauquenes', name: 'Cauquenes', region: 'Maule', latitude: -35.9667, longitude: -72.3167 },
  { id: 'constitución', name: 'Constitución', region: 'Maule', latitude: -35.3333, longitude: -72.4167 },

  // Región de Ñuble
  { id: 'chillán', name: 'Chillán', region: 'Ñuble', latitude: -36.6066, longitude: -72.1034 },
  { id: 'quirihue', name: 'Quirihue', region: 'Ñuble', latitude: -36.2833, longitude: -72.5333 },
  { id: 'san_carlos', name: 'San Carlos', region: 'Ñuble', latitude: -36.4167, longitude: -71.9500 },

  // Región del Biobío
  { id: 'concepción', name: 'Concepción', region: 'Biobío', latitude: -36.8201, longitude: -73.0444 },
  { id: 'talcahuano', name: 'Talcahuano', region: 'Biobío', latitude: -36.7167, longitude: -73.1167 },
  { id: 'los_angeles', name: 'Los Ángeles', region: 'Biobío', latitude: -37.4689, longitude: -72.3518 },
  { id: 'coronel', name: 'Coronel', region: 'Biobío', latitude: -37.0167, longitude: -73.1500 },
  { id: 'lota', name: 'Lota', region: 'Biobío', latitude: -37.0833, longitude: -73.1667 },
  { id: 'chiguayante', name: 'Chiguayante', region: 'Biobío', latitude: -36.9333, longitude: -73.0167 },
  { id: 'san_pedro_de_la_paz', name: 'San Pedro de la Paz', region: 'Biobío', latitude: -36.8500, longitude: -73.1167 },
  { id: 'penco', name: 'Penco', region: 'Biobío', latitude: -36.7333, longitude: -72.9833 },
  { id: 'tomé', name: 'Tomé', region: 'Biobío', latitude: -36.6167, longitude: -72.9500 },
  { id: 'mulchén', name: 'Mulchén', region: 'Biobío', latitude: -37.7167, longitude: -72.2333 },
  { id: 'nacimiento', name: 'Nacimiento', region: 'Biobío', latitude: -37.5000, longitude: -72.6667 },
  { id: 'cañete', name: 'Cañete', region: 'Biobío', latitude: -37.8000, longitude: -73.3833 },
  { id: 'lebu', name: 'Lebu', region: 'Biobío', latitude: -37.6167, longitude: -73.6500 },

  // Región de La Araucanía
  { id: 'temuco', name: 'Temuco', region: 'La Araucanía', latitude: -38.7359, longitude: -72.5904 },
  { id: 'padre_las_casas', name: 'Padre Las Casas', region: 'La Araucanía', latitude: -38.7667, longitude: -72.5833 },
  { id: 'angol', name: 'Angol', region: 'La Araucanía', latitude: -37.7953, longitude: -72.7082 },
  { id: 'victoria', name: 'Victoria', region: 'La Araucanía', latitude: -38.2333, longitude: -72.3333 },
  { id: 'lautaro', name: 'Lautaro', region: 'La Araucanía', latitude: -38.5167, longitude: -72.4333 },
  { id: 'nueva_imperial', name: 'Nueva Imperial', region: 'La Araucanía', latitude: -38.7333, longitude: -72.9500 },
  { id: 'pitrufquén', name: 'Pitrufquén', region: 'La Araucanía', latitude: -38.9833, longitude: -72.6333 },
  { id: 'pucón', name: 'Pucón', region: 'La Araucanía', latitude: -39.2667, longitude: -71.9667 },
  { id: 'villarrica', name: 'Villarrica', region: 'La Araucanía', latitude: -39.2833, longitude: -72.2167 },

  // Región de Los Ríos
  { id: 'valdivia', name: 'Valdivia', region: 'Los Ríos', latitude: -39.8196, longitude: -73.2452 },
  { id: 'la_unión', name: 'La Unión', region: 'Los Ríos', latitude: -40.2833, longitude: -73.0833 },
  { id: 'río_bueno', name: 'Río Bueno', region: 'Los Ríos', latitude: -40.3333, longitude: -72.9500 },

  // Región de Los Lagos
  { id: 'puerto_montt', name: 'Puerto Montt', region: 'Los Lagos', latitude: -41.4693, longitude: -72.9424 },
  { id: 'osorno', name: 'Osorno', region: 'Los Lagos', latitude: -40.5736, longitude: -73.1348 },
  { id: 'castro', name: 'Castro', region: 'Los Lagos', latitude: -42.4724, longitude: -73.7624 },
  { id: 'ancud', name: 'Ancud', region: 'Los Lagos', latitude: -41.8683, longitude: -73.8272 },
  { id: 'puerto_varas', name: 'Puerto Varas', region: 'Los Lagos', latitude: -41.3167, longitude: -72.9833 },
  { id: 'frutillar', name: 'Frutillar', region: 'Los Lagos', latitude: -41.1167, longitude: -73.0500 },
  { id: 'calbuco', name: 'Calbuco', region: 'Los Lagos', latitude: -41.7667, longitude: -73.1333 },
  { id: 'maullín', name: 'Maullín', region: 'Los Lagos', latitude: -41.6167, longitude: -73.6000 },
  { id: 'chaitén', name: 'Chaitén', region: 'Los Lagos', latitude: -42.9167, longitude: -72.7000 },
  { id: 'futaleufú', name: 'Futaleufú', region: 'Los Lagos', latitude: -43.1833, longitude: -71.8667 },
  { id: 'palena', name: 'Palena', region: 'Los Lagos', latitude: -43.6167, longitude: -71.8000 },

  // Región de Aysén
  { id: 'coyhaique', name: 'Coyhaique', region: 'Aysén', latitude: -45.5712, longitude: -72.0685 },
  { id: 'puerto_aisén', name: 'Puerto Aysén', region: 'Aysén', latitude: -45.4000, longitude: -72.7000 },
  { id: 'chile_chico', name: 'Chile Chico', region: 'Aysén', latitude: -46.5333, longitude: -71.7333 },
  { id: 'cochrane', name: 'Cochrane', region: 'Aysén', latitude: -47.2500, longitude: -72.5833 },

  // Región de Magallanes
  { id: 'punta_arenas', name: 'Punta Arenas', region: 'Magallanes', latitude: -53.1638, longitude: -70.9171 },
  { id: 'porvenir', name: 'Porvenir', region: 'Magallanes', latitude: -53.2945, longitude: -70.3658 },
  { id: 'puerto_natales', name: 'Puerto Natales', region: 'Magallanes', latitude: -51.7333, longitude: -72.4833 },
  { id: 'porvenir', name: 'Porvenir', region: 'Magallanes', latitude: -53.2945, longitude: -70.3658 },
  { id: 'cabo_de_hornos', name: 'Cabo de Hornos', region: 'Magallanes', latitude: -54.9333, longitude: -67.6167 },
];
