import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveZone } from '../services/weatherZone';
import { getWeatherForZone } from '../services/weatherCache';
import { weatherCodeToCondition } from '../services/openWeatherMap';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

router.get('/rain-alert', authenticate, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json(createErrorResponse('INVALID_LOCATION', 'Invalid coordinates provided'));
      return;
    }

    const zone = resolveZone(lat, lon);
    if (!zone) {
      res.json({
        success: true,
        data: {
          shouldShow: false,
          minutesUntilRain: null,
          probability: 0,
          currentTemp: null,
          weatherCode: 0,
          weatherCondition: 'Desconocido',
          message: null,
          suggestion: null,
          zoneName: null,
        },
      });
      return;
    }

    const alert = await getWeatherForZone(zone);

    res.json({
      success: true,
      data: {
        ...alert,
        zoneName: zone.name,
        weatherCondition: weatherCodeToCondition(alert.weatherCode),
        message: alert.shouldShow ? `Lluvia en ~${alert.minutesUntilRain} min` : null,
        suggestion: alert.shouldShow ? 'Considera esperar o llevar equipo impermeable' : null,
      },
    });
  } catch (error) {
    console.error('[WEATHER] Error:', error);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to fetch weather data'));
  }
});

export default router;
