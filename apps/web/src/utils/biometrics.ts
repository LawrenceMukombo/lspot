// WebAuthn Helper for Hardware/Platform Biometrics (Fingerprint/Thumbprint, Windows Hello, Face ID, Android Biometrics)

export interface BiometricCredentialRecord {
  credentialId: string; // base64url encoded
  rawId: string;
  type: 'thumbprint' | 'face' | 'platform';
  createdAt: string;
  deviceLabel: string;
}

/**
 * Check if the current browser and platform support WebAuthn and platform biometrics.
 */
export async function isBiometricsSupported(): Promise<{ supported: boolean; platformAuthenticator: boolean; reason?: string }> {
  if (typeof window === 'undefined') {
    return { supported: false, platformAuthenticator: false, reason: 'SSR environment' };
  }

  if (!window.PublicKeyCredential) {
    return {
      supported: false,
      platformAuthenticator: false,
      reason: 'WebAuthn is not supported on this browser/environment. Use PIN or HTTPS.'
    };
  }

  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return {
      supported: true,
      platformAuthenticator: isAvailable,
      reason: isAvailable ? undefined : 'No platform biometric sensor detected (device requires fingerprint or camera authentication configured).'
    };
  } catch (err: any) {
    return {
      supported: true,
      platformAuthenticator: false,
      reason: err?.message || 'Platform authenticator query failed'
    };
  }
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Registers biometric authentication (Thumbprint or Face) for a given staff member using real browser WebAuthn API.
 */
export async function registerBiometric(
  userId: string,
  userName: string,
  userFullName: string,
  biometricType: 'thumbprint' | 'face' = 'thumbprint'
): Promise<BiometricCredentialRecord> {
  const check = await isBiometricsSupported();
  if (!check.supported) {
    throw new Error(check.reason || 'Biometric WebAuthn hardware API not available');
  }

  // Random challenge
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // User ID as bytes
  const userIdBytes = new TextEncoder().encode(userId);

  const creationOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'Little Spot POS Terminal',
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname
      },
      user: {
        id: userIdBytes,
        name: userName,
        displayName: `${userFullName} (${biometricType === 'face' ? 'Face ID' : 'Thumbprint'})`
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in fingerprint or face camera
        userVerification: 'required', // Mandate fingerprint or face scan
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  };

  const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric registration was aborted or not provided by user');
  }

  const credentialRecord: BiometricCredentialRecord = {
    credentialId: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: biometricType,
    createdAt: new Date().toISOString(),
    deviceLabel: navigator.userAgent.includes('Android')
      ? 'Android Handheld POS'
      : navigator.userAgent.includes('Windows')
      ? 'Windows POS Terminal'
      : navigator.userAgent.includes('Mac')
      ? 'Apple TouchID/FaceID'
      : 'POS Hardware Terminal'
  };

  // Store in user-specific and system local registry
  const userRegistryKey = `lspot_biometrics_${userId}`;
  const existingRecords: BiometricCredentialRecord[] = JSON.parse(localStorage.getItem(userRegistryKey) || '[]');
  
  // Replace or add
  const updated = existingRecords.filter((r) => r.type !== biometricType);
  updated.push(credentialRecord);
  localStorage.setItem(userRegistryKey, JSON.stringify(updated));

  // Global lookup table mapping credentialId -> { userId, userName, userFullName, type }
  const globalKey = 'lspot_biometrics_credentials_map';
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  globalMap[credential.id] = {
    userId,
    userName,
    userFullName,
    type: biometricType,
    createdAt: credentialRecord.createdAt
  };
  localStorage.setItem(globalKey, JSON.stringify(globalMap));

  return credentialRecord;
}

/**
 * Authenticates the user via biometric sensor (Fingerprint or Face).
 * Returns the matched staff user profile if successful.
 */
export async function authenticateBiometric(
  allowedUserId?: string,
  expectedType?: 'thumbprint' | 'face'
): Promise<{ success: boolean; userId: string; userName: string; userFullName: string; type: string }> {
  const check = await isBiometricsSupported();
  if (!check.supported) {
    throw new Error(check.reason || 'WebAuthn sensor not supported');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // Retrieve registered credentials
  const globalKey = 'lspot_biometrics_credentials_map';
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');
  const registeredCredIds = Object.keys(globalMap);

  let allowCredentials: PublicKeyCredentialDescriptor[] | undefined = undefined;

  if (allowedUserId) {
    const userRegistryKey = `lspot_biometrics_${allowedUserId}`;
    const userRecords: BiometricCredentialRecord[] = JSON.parse(localStorage.getItem(userRegistryKey) || '[]');
    const filtered = expectedType ? userRecords.filter((r) => r.type === expectedType) : userRecords;
    if (filtered.length === 0) {
      throw new Error(`No ${expectedType || 'biometric'} registered for this user on this device. Please register first.`);
    }
    allowCredentials = filtered.map((r) => ({
      id: base64UrlToBuffer(r.rawId),
      type: 'public-key'
    }));
  } else if (registeredCredIds.length > 0) {
    // If not restricted to a specific user, allow any registered staff on this terminal
    allowCredentials = registeredCredIds
      .filter((id) => !expectedType || globalMap[id].type === expectedType)
      .map((id) => {
        try {
          return {
            id: base64UrlToBuffer(id),
            type: 'public-key' as const
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as PublicKeyCredentialDescriptor[];
  }

  const requestOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      timeout: 60000,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      userVerification: 'required',
      allowCredentials: allowCredentials && allowCredentials.length > 0 ? allowCredentials : undefined
    }
  };

  const assertion = (await navigator.credentials.get(requestOptions)) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Biometric scan cancelled or verification failed.');
  }

  const match = globalMap[assertion.id];
  if (match) {
    return {
      success: true,
      userId: match.userId,
      userName: match.userName,
      userFullName: match.userFullName,
      type: match.type
    };
  }

  // Fallback: If matched credentials allowCredentials
  if (allowedUserId) {
    return {
      success: true,
      userId: allowedUserId,
      userName: 'staff',
      userFullName: 'Authorized Staff',
      type: expectedType || 'biometric'
    };
  }

  throw new Error('Biometric recognized but credential is not linked to an active staff account on this terminal.');
}

/**
 * Get registered biometrics for a given user.
 */
export function getUserBiometrics(userId: string): BiometricCredentialRecord[] {
  try {
    return JSON.parse(localStorage.getItem(`lspot_biometrics_${userId}`) || '[]');
  } catch {
    return [];
  }
}

/**
 * Remove registered biometric for a user.
 */
export function removeUserBiometric(userId: string, type?: 'thumbprint' | 'face') {
  const userRegistryKey = `lspot_biometrics_${userId}`;
  const records: BiometricCredentialRecord[] = JSON.parse(localStorage.getItem(userRegistryKey) || '[]');
  
  const globalKey = 'lspot_biometrics_credentials_map';
  const globalMap = JSON.parse(localStorage.getItem(globalKey) || '{}');

  const remaining = records.filter((r) => {
    if (!type || r.type === type) {
      delete globalMap[r.credentialId];
      return false;
    }
    return true;
  });

  localStorage.setItem(userRegistryKey, JSON.stringify(remaining));
  localStorage.setItem(globalKey, JSON.stringify(globalMap));
}
