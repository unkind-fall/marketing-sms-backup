interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface GoogleFilesResponse {
  files: GoogleFile[];
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: credentials.token_uri,
    iat: now,
    exp,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Import the private key
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

export async function listXmlFiles(
  credentials: ServiceAccountCredentials,
  folderId: string
): Promise<GoogleFile[]> {
  const accessToken = await getAccessToken(credentials);

  const query = `'${folderId}' in parents and mimeType='text/xml' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime)`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${error}`);
  }

  const data = (await response.json()) as GoogleFilesResponse;
  return data.files || [];
}

export async function downloadFile(
  credentials: ServiceAccountCredentials,
  fileId: string
): Promise<string> {
  const accessToken = await getAccessToken(credentials);

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to download file: ${error}`);
  }

  return response.text();
}

export async function getLatestXmlFromDrive(
  credentialsJson: string,
  folderId: string
): Promise<{ content: string; fileName: string } | null> {
  const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;

  const files = await listXmlFiles(credentials, folderId);

  if (files.length === 0) {
    return null;
  }

  // Get the most recently modified file
  const latestFile = files[0];
  const content = await downloadFile(credentials, latestFile.id);

  return {
    content,
    fileName: latestFile.name,
  };
}
