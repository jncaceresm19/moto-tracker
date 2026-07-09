import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.9:3001';
const COUNTRY_KEY = '@user_country';

// Detect country from coordinates
export async function detectCountry(lat: number, lon: number): Promise<string> {
  try {
    const url = `${API_URL}/api/google/geocode?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const result = data.results[0];
      const countryComponent = result.address_components?.find((c: any) => 
        c.types.includes('country')
      );
      
      if (countryComponent) {
        const countryCode = countryComponent.short_code?.toUpperCase() || 'CL';
        await AsyncStorage.setItem(COUNTRY_KEY, countryCode);
        return countryCode;
      }
    }

    return 'CL'; // Default to Chile
  } catch (error) {
    console.log('[COUNTRY] Error detecting:', error);
    return 'CL';
  }
}

// Get stored country
export async function getStoredCountry(): Promise<string> {
  try {
    const country = await AsyncStorage.getItem(COUNTRY_KEY);
    return country || 'CL';
  } catch {
    return 'CL';
  }
}

// Get gas price message based on country
export function getGasPriceMessage(countryCode: string): string {
  switch (countryCode) {
    case 'CL':
      return 'Precios según mecanismo MEPCO (actualización semanal)';
    case 'AR':
      return 'Precios regulados por el gobierno';
    case 'PE':
      return 'Precios según OSINERGMIN';
    case 'CO':
      return 'Precios según CREG';
    case 'MX':
      return 'Precios máximos diarios (CRE)';
    default:
      return 'Precios de referencia';
  }
}
