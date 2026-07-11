const CLAVEUNICA_BASE_URL = process.env.CLAVEUNICA_BASE_URL || 'https://accounts.claveunica.gob.cl';
const CLAVEUNICA_CLIENT_ID = process.env.CLAVEUNICA_CLIENT_ID || '';
const CLAVEUNICA_CLIENT_SECRET = process.env.CLAVEUNICA_CLIENT_SECRET || '';
const CLAVEUNICA_REDIRECT_URI = process.env.CLAVEUNICA_REDIRECT_URI || '';

interface ClaveUnicaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
}

interface ClaveUnicaUserInfo {
  sub: string;
  run: string;
  name: string;
  email: string;
}

export function getClaveUnicaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLAVEUNICA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: CLAVEUNICA_REDIRECT_URI,
    scope: 'run name email',
  });

  return `${CLAVEUNICA_BASE_URL}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<ClaveUnicaTokenResponse> {
  const response = await fetch(`${CLAVEUNICA_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CLAVEUNICA_REDIRECT_URI,
      client_id: CLAVEUNICA_CLIENT_ID,
      client_secret: CLAVEUNICA_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`ClaveÚnica token exchange failed: ${response.status}`);
  }

  return response.json();
}

export async function getUserInfo(accessToken: string): Promise<ClaveUnicaUserInfo> {
  const response = await fetch(`${CLAVEUNICA_BASE_URL}/oauth2/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ClaveÚnica userinfo failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    sub: data.sub,
    run: data.run,
    name: data.name,
    email: data.email,
  };
}
