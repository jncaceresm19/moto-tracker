export async function checkTechnicalReview(plate: string): Promise<{ vigente: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.prt.cl/consulta/resultado?patente=${plate}`, {
      headers: {
        'User-Agent': 'MotoTracker/1.0 (contacto@moto-tracker.cl)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { vigente: false, error: 'SERVICE_UNAVAILABLE' };
    }

    const html = await response.text();
    const vigenteMatch = html.match(/(?:VIGENTE|vigente|Vigente)/);

    return { vigente: !!vigenteMatch };
  } catch (error) {
    console.error('[VEHICLE_CHECK] prt.cl error:', error);
    return { vigente: false, error: 'SERVICE_UNAVAILABLE' };
  }
}

export async function checkTheftHistory(plate: string): Promise<{ encargo: boolean; error?: string }> {
  try {
    const response = await fetch(`https://www.encargoporrobovehiculos.cl/consulta?patente=${plate}`, {
      headers: {
        'User-Agent': 'MotoTracker/1.0 (contacto@moto-tracker.cl)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { encargo: false, error: 'SERVICE_UNAVAILABLE' };
    }

    const html = await response.text();
    const encargoMatch = html.match(/(?:ENCARGO|encargo|Encargo)/);

    return { encargo: !!encargoMatch };
  } catch (error) {
    console.error('[VEHICLE_CHECK] encargoporrobo error:', error);
    return { encargo: false, error: 'SERVICE_UNAVAILABLE' };
  }
}
