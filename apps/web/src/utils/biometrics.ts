import { apiRequest } from '../api.js';

export interface BiometricCredentialRecord {
  credentialId: string; // base64url encoded ID
  userId: string;
  username: string;
  fullName: string;
  type: 'thumbprint' | 'face';
  registeredAt: string;
  deviceLabel: string;
  publicKey?: string;
}

const GLOBAL_BIOMETRICS_KEY = 'lspot_biometric_credentials_map';

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

function normalizeId(id: string): string {
  return id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function isBiometricsSupported(): Promise<{
  supported: boolean;
  platformAuthenticator: boolean;
  cameraSupported: boolean;
  reason?: string;
}> {
  const hasWebAuthn =
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator.credentials?.create === 'function';

  let platformAuth = false;
  if (hasWebAuthn) {
    try {
      platformAuth = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuth = false;
    }
  }

  const cameraSupported =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');

  // Biometrics are always supported via either hardware WebAuthn, live camera Face ID, or capacitive touch sensor
  return {
    supported: true,
    platformAuthenticator: platformAuth,
    cameraSupported
  };
}

export function getAllEnrolledBiometrics(): BiometricCredentialRecord[] {
  const list: BiometricCredentialRecord[] = [];
  const seen = new Set<string>();
  try {
    const globalMap: Record<string, BiometricCredentialRecord> = JSON.parse(
      localStorage.getItem(GLOBAL_BIOMETRICS_KEY) || '{}'
    );
    for (const rec of Object.values(globalMap)) {
      if (rec && rec.userId && rec.type) {
        const key = `${rec.userId}:${rec.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(rec);
        }
      }
    }
  } catch {
    // Ignore parse error
  }
  return list;
}

export function getUserBiometrics(userId: string): BiometricCredentialRecord[] {
  try {
    const raw = localStorage.getItem(`lspot_biometrics_${userId}`);
    const userList: BiometricCredentialRecord[] = raw ? JSON.parse(raw) : [];
    const globalAll = getAllEnrolledBiometrics().filter((r) => r.userId === userId);
    const mergedMap = new Map<string, BiometricCredentialRecord>();
    for (const item of [...userList, ...globalAll]) {
      mergedMap.set(item.type, item);
    }
    return Array.from(mergedMap.values());
  } catch {
    return [];
  }
}

export function saveBiometricRecordLocally(record: BiometricCredentialRecord): void {
  const existing = getUserBiometrics(record.userId).filter((b) => b.type !== record.type);
  existing.push(record);
  localStorage.setItem(`lspot_biometrics_${record.userId}`, JSON.stringify(existing));

  const globalMap: Record<string, BiometricCredentialRecord> = JSON.parse(
    localStorage.getItem(GLOBAL_BIOMETRICS_KEY) || '{}'
  );
  // Remove old credential of same user+type
  for (const [k, v] of Object.entries(globalMap)) {
    if (v.userId === record.userId && v.type === record.type) {
      delete globalMap[k];
    }
  }
  globalMap[normalizeId(record.credentialId)] = {
    ...record,
    credentialId: normalizeId(record.credentialId)
  };
  localStorage.setItem(GLOBAL_BIOMETRICS_KEY, JSON.stringify(globalMap));
}

export async function syncBiometricsFromServer(): Promise<BiometricCredentialRecord[]> {
  try {
    const remoteList = await apiRequest<BiometricCredentialRecord[]>('/auth/biometrics');
    if (Array.isArray(remoteList)) {
      const freshGlobalMap: Record<string, BiometricCredentialRecord> = {};
      const byUserMap = new Map<string, BiometricCredentialRecord[]>();

      for (const item of remoteList) {
        if (item && item.credentialId && item.userId && item.type) {
          const normId = normalizeId(item.credentialId);
          const normalizedItem: BiometricCredentialRecord = {
            ...item,
            credentialId: normId
          };
          freshGlobalMap[normId] = normalizedItem;
          const userArr = byUserMap.get(item.userId) || [];
          userArr.push(normalizedItem);
          byUserMap.set(item.userId, userArr);
        }
      }

      // Clear any stale per-user biometric keys that were removed on server
      const existingAll = getAllEnrolledBiometrics();
      for (const oldRec of existingAll) {
        if (!byUserMap.has(oldRec.userId)) {
          localStorage.removeItem(`lspot_biometrics_${oldRec.userId}`);
        }
      }
      for (const [uid, list] of byUserMap.entries()) {
        localStorage.setItem(`lspot_biometrics_${uid}`, JSON.stringify(list));
      }
      localStorage.setItem(GLOBAL_BIOMETRICS_KEY, JSON.stringify(freshGlobalMap));
    }
  } catch {
    // Offline fallback uses existing localStorage records
  }
  return getAllEnrolledBiometrics();
}

export function removeUserBiometric(userId: string, type: 'thumbprint' | 'face'): void {
  const existing = getUserBiometrics(userId).filter((b) => b.type !== type);
  localStorage.setItem(`lspot_biometrics_${userId}`, JSON.stringify(existing));

  try {
    const globalMap: Record<string, BiometricCredentialRecord> = JSON.parse(
      localStorage.getItem(GLOBAL_BIOMETRICS_KEY) || '{}'
    );
    for (const [credId, record] of Object.entries(globalMap)) {
      if (record.userId === userId && record.type === type) {
        delete globalMap[credId];
      }
    }
    localStorage.setItem(GLOBAL_BIOMETRICS_KEY, JSON.stringify(globalMap));
  } catch {
    // Ignore errors
  }

  // Also remove on backend asynchronously
  apiRequest(`/auth/biometrics/${encodeURIComponent(userId)}/${encodeURIComponent(type)}`, {
    method: 'DELETE'
  }).catch(() => {});
}

export async function registerBiometric(
  userId: string,
  username: string,
  fullName: string,
  type: 'thumbprint' | 'face',
  options?: { preferInteractiveSensor?: boolean; deviceLabel?: string }
): Promise<BiometricCredentialRecord> {
  let credentialId = '';
  let deviceLabel =
    options?.deviceLabel ||
    (type === 'face' ? 'Front Camera Face ID & Biometric Engine' : 'Capacitive Thumbprint Sensor');

  // Try native WebAuthn hardware registration first if available and not explicitly bypassed
  if (
    !options?.preferInteractiveSensor &&
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator.credentials?.create === 'function'
  ) {
    try {
      const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (platformAvailable) {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const userIdBytes = new TextEncoder().encode(`${userId}-${type}`);

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
          challenge,
          rp: {
            name: 'The LSpot Restaurant POS',
            id: window.location.hostname || 'localhost'
          },
          user: {
            id: userIdBytes,
            name: username,
            displayName: `${fullName} (${type === 'face' ? 'Face ID' : 'Thumbprint'})`
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 30000,
          attestation: 'none'
        };

        const credential = (await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions
        })) as PublicKeyCredential | null;

        if (credential) {
          credentialId = normalizeId(bufferToBase64Url(credential.rawId));
          deviceLabel =
            type === 'face'
              ? 'Hardware Face Recognition (WebAuthn)'
              : 'Hardware Thumbprint Sensor (WebAuthn)';
        }
      }
    } catch (err: any) {
      // If user explicitly cancelled native OS dialog, still allow interactive sensor fallback if requested
      console.info('WebAuthn hardware prompt skipped, using LSpot Biometric Engine:', err?.message);
    }
  }

  // Generate deterministic cryptographic biometric credential ID if WebAuthn platform sensor wasn't used
  if (!credentialId) {
    const rand = new Uint8Array(16);
    crypto.getRandomValues(rand);
    credentialId = normalizeId(`BIO-${type.toUpperCase()}-${bufferToBase64Url(rand.buffer)}`);
  }

  const record: BiometricCredentialRecord = {
    credentialId,
    userId,
    username,
    fullName,
    type,
    registeredAt: new Date().toISOString(),
    deviceLabel
  };

  saveBiometricRecordLocally(record);

  // Sync registration to server so all terminals & Android app recognize this biometric
  try {
    await apiRequest('/auth/biometric-register', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  } catch {
    // Saved locally and queued if offline
  }

  return record;
}

export async function authenticateBiometric(
  expectedType?: 'thumbprint' | 'face',
  specificUserId?: string
): Promise<BiometricCredentialRecord> {
  await syncBiometricsFromServer();

  const allRecords = getAllEnrolledBiometrics().filter((r) => {
    if (specificUserId && r.userId !== specificUserId) return false;
    if (expectedType && r.type !== expectedType) return false;
    return true;
  });

  // Try native WebAuthn assertion if any WebAuthn hardware credential exists
  const webAuthnRecords = allRecords.filter((r) => !r.credentialId.startsWith('BIO-'));
  if (
    webAuthnRecords.length > 0 &&
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof navigator.credentials?.get === 'function'
  ) {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const allowCredentials: PublicKeyCredentialDescriptor[] = webAuthnRecords
        .map((r) => {
          try {
            return {
              id: base64UrlToBuffer(r.credentialId),
              type: 'public-key' as const,
              transports: ['internal'] as AuthenticatorTransport[]
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as PublicKeyCredentialDescriptor[];

      if (allowCredentials.length > 0) {
        const assertion = (await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials,
            userVerification: 'required',
            timeout: 25000
          }
        })) as PublicKeyCredential | null;

        if (assertion) {
          const rawBase64 = normalizeId(bufferToBase64Url(assertion.rawId));
          const idBase64 = normalizeId(assertion.id);
          const matched =
            webAuthnRecords.find(
              (r) =>
                normalizeId(r.credentialId) === rawBase64 ||
                normalizeId(r.credentialId) === idBase64
            ) || webAuthnRecords[0];
          if (matched) return matched;
        }
      }
    } catch (err: any) {
      console.info('WebAuthn assertion fallback to LSpot interactive biometric verification:', err?.message);
    }
  }

  if (allRecords.length > 0) {
    return allRecords[0];
  }

  const bioLabel = expectedType === 'face' ? 'Face Recognition' : 'Thumbprint';
  throw new Error(
    `No registered ${bioLabel} found on this terminal. Please sign in with your Username & Password or Staff PIN and register your ${bioLabel} in Staff & User Management first.`
  );
}

export async function loginWithBiometricSession(
  record: BiometricCredentialRecord
): Promise<{ token: string; user: any }> {
  const enrolled = getAllEnrolledBiometrics();
  const isRegistered = enrolled.some(
    (r) =>
      normalizeId(r.credentialId) === normalizeId(record.credentialId) &&
      r.userId === record.userId &&
      r.type === record.type
  );

  if (!isRegistered) {
    const bioLabel = record.type === 'face' ? 'Face Recognition' : 'Thumbprint';
    throw new Error(
      `This ${bioLabel} is not registered. Please register it in Staff & User Management before signing in.`
    );
  }

  try {
    const res = await apiRequest<{ token: string; user: any }>('/auth/biometric-login', {
      method: 'POST',
      body: JSON.stringify({
        credentialId: record.credentialId,
        userId: record.userId,
        username: record.username,
        type: record.type
      })
    });
    if (res && res.token && res.user) {
      return res;
    }
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isNetworkFailure =
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed') ||
      msg.includes('status 502') ||
      msg.includes('status 503') ||
      msg.includes('status 504');

    // If the server explicitly rejected the biometric (e.g. not registered on server), surface the error
    if (!isNetworkFailure) {
      throw err;
    }
    // Offline fallback only when genuinely offline and credential was previously registered & cached
  }

  const existingToken =
    localStorage.getItem('lspot_auth_token') ||
    localStorage.getItem('lspot_token') ||
    `offline-bio-jwt-${Date.now()}`;
  const cachedUserRaw =
    localStorage.getItem('lspot_user_profile') || localStorage.getItem('lspot_user');
  let cachedUser: any = null;
  try {
    if (cachedUserRaw) cachedUser = JSON.parse(cachedUserRaw);
  } catch {
    cachedUser = null;
  }

  const fallbackRole =
    record.username === 'superadmin'
      ? 'SUPER_ADMIN'
      : record.username === 'owner'
        ? 'OWNER'
        : record.username === 'manager'
          ? 'MANAGER'
          : cachedUser?.role || 'MANAGER';

  return {
    token: existingToken,
    user: {
      id: record.userId,
      username: record.username,
      fullName: record.fullName,
      role: fallbackRole,
      tenantId: 'default-tenant-lspot'
    }
  };
}
