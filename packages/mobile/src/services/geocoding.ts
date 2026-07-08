import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_API_KEY = 'AIzaSyAhtFaikZpXvYPWiZVItv12D520Nno_xqk';

// Reverse geocode coordinates to address
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    // Check cache first
    const cacheKey = `geocode_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      const result = data.results[0];
      // Get short address (street name + number)
      const address = result.formatted_address || '';
      
      // Extract street name from address components
      const streetComponent = result.address_components?.find((c: any) => 
        c.types.includes('route') || c.types.includes('street_number')
      );
      
      let shortAddress = '';
      if (streetComponent) {
        shortAddress = streetComponent.long_name || streetComponent.short_name;
      }
      
      // If no street, use locality or sublocality
      if (!shortAddress) {
        const locality = result.address_components?.find((c: any) => 
          c.types.includes('sublocality') || c.types.includes('locality')
        );
        if (locality) {
          shortAddress = locality.long_name;
        }
      }
      
      // Fallback to formatted address
      const finalAddress = shortAddress || address.split(',').slice(0, 2).join(',');
      
      // Cache for 7 days
      await AsyncStorage.setItem(cacheKey, finalAddress);
      
      return finalAddress;
    }

    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (error) {
    console.log('[GEOCODE] Error:', error);
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
