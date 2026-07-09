import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.9:3001';

// Reverse geocode coordinates to address
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    // Check cache first
    const cacheKey = `geocode_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;

    const url = `${API_URL}/api/google/geocode?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    const data = await response.json();

    console.log('[GEOCODE] Response:', data.status, data.results?.length);

    if (data.status === 'OK' && data.results?.length > 0) {
      const result = data.results[0];
      
      // Get all address components
      const components = result.address_components || [];
      
      // Find street name
      const route = components.find((c: any) => c.types.includes('route'));
      // Find street number
      const streetNumber = components.find((c: any) => c.types.includes('street_number'));
      // Find locality/city
      const locality = components.find((c: any) => 
        c.types.includes('sublocality') || c.types.includes('locality')
      );
      
      // Build address parts
      let parts: string[] = [];
      
      // Street: "Calle Albatros 16"
      if (route) {
        let street = route.long_name || route.short_name;
        if (streetNumber) {
          street += ' ' + (streetNumber.long_name || streetNumber.short_name);
        }
        parts.push(street);
      }
      
      // City: "Viña"
      if (locality) {
        parts.push(locality.long_name);
      }
      
      // If we have parts, join them
      if (parts.length > 0) {
        const finalAddress = parts.join(', ');
        await AsyncStorage.setItem(cacheKey, finalAddress);
        return finalAddress;
      }
      
      // Fallback: use formatted_address but clean it up
      const formattedAddress = result.formatted_address || '';
      // Take first two parts separated by comma
      const cleanAddress = formattedAddress.split(',').slice(0, 2).join(',').trim();
      
      if (cleanAddress && cleanAddress !== formattedAddress) {
        await AsyncStorage.setItem(cacheKey, cleanAddress);
        return cleanAddress;
      }
    }

    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error) {
    console.log('[GEOCODE] Error:', error);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
