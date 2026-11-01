import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Clock,
  MapPin,
  Coins,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  Lock,
  LogOut,
  Fingerprint,
  ScanFace,
  KeyRound,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  Calculator
} from 'lucide-react';
import { apiRequest, logoutSession, setAuthSession, getOfflinePendingCount, syncAllOfflineData } from '../api.js';
import { RESTAURANT_NAME, RESTAURANT_LOCATION } from '@lspot/shared';
import { useTheme } from '../context/ThemeContext.js';
import { SmartCalculator } from './SmartCalculator.js';
import { BiometricScannerModal } from './BiometricScannerModal.js';
import { BiometricCredentialRecord, loginWithBiometricSession } from '../utils/biometrics.js';
import { toast } from './Toast.js';

interface NavbarProps {
  activeShift?: any;
}

export function Navbar({ activeShift }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [timeStr, setTimeStr] = useState('');
  const [internalShift, setInternalShift] = useState<any>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Offline queue state & cloud synchronization
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Terminal Lock & PIN / Biometric state
  const [isLocked, setIsLocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [lockBiometricType, setLockBiometricType] = useState<'thumbprint' | 'face' | null>(null);

  // Self-Service Biometric Enrollment state for logged-in staff member
  const [showBiometricSelectModal, setShowBiometricSelectModal] = useState(false);
  const [selfRegisterBiometricType, setSelfRegisterBiometricType] = useState<'thumbprint' | 'face' | null>(null);

  // Self-Service Change / Reset Password Modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPasswordOrPin, setCurrentPasswordOrPin] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('lspot_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore parse errors
    }
    return {
      fullName: 'Mulenga Banda',
      username: 'manager',
      role: 'Restaurant Manager'
    };
  });

  const fetchShift = async () => {
    try {
      const shift = await apiRequest('/shifts/current');
      setInternalShift(shift);
    } catch {
      // silently ignore if offline or unauthenticated
    }
  };

  useEffect(() => {
    fetchShift();
    const handleShiftUpdated = () => fetchShift();
    const handleOpenBiometricEnrollment = () => setShowBiometricSelectModal(true);

    window.addEventListener('shiftUpdated', handleShiftUpdated);
    window.addEventListener('openBiometricRegistration', handleOpenBiometricEnrollment);
    const shiftInterval = setInterval(fetchShift, 10000);

    return () => {
      window.removeEventListener('shiftUpdated', handleShiftUpdated);
      window.removeEventListener('openBiometricRegistration', handleOpenBiometricEnrollment);
      clearInterval(shiftInterval);
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleString('en-GB', {
          timeZone: 'Africa/Lusaka',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Configurable idle timeout in minutes (default: 5 min, read from localStorage)
    let idleTimer: any = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      const configuredTimeoutMin = Number(localStorage.getItem('pos_idle_timeout_min') || '5');
      if (configuredTimeoutMin > 0) {
        idleTimer = setTimeout(() => {
          setIsLocked(true);
          setEnteredPin('');
          setPinError('Terminal locked due to inactivity. Enter PIN to resume.');
        }, configuredTimeoutMin * 60 * 1000);
      }
    };

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, []);

  // Offline queue detection, listener & automatic 10-second multi-device cloud synchronization
  useEffect(() => {
    const checkOfflineQueue = () => {
      setOfflineCount(getOfflinePendingCount());
    };
    checkOfflineQueue();

    const runBackgroundSync = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        checkOfflineQueue();
        return;
      }
      const res = await syncAllOfflineData();
      setIsOnline(res.online);
      setOfflineCount(res.remaining);
      if (res.syncedSales > 0 || res.syncedMutations > 0) {
        const totalSynced = res.syncedSales + res.syncedMutations;
        setSyncFeedback(`Auto-synced ${totalSynced} record${totalSynced === 1 ? '' : 's'}`);
        setTimeout(() => setSyncFeedback(null), 3500);
        fetchShift();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      runBackgroundSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      checkOfflineQueue();
    };

    const handleWebUpdateAvailable = () => {
      setSyncFeedback('New web update detected • Applying update...');
      setTimeout(() => {
        if (typeof (window as any).AndroidBridge?.reloadLiveCloud === 'function') {
          (window as any).AndroidBridge.reloadLiveCloud();
        } else {
          window.location.reload();
        }
      }, 1500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineQueueUpdated', checkOfflineQueue);
    window.addEventListener('lspotWebUpdateAvailable', handleWebUpdateAvailable);

    // Synchronize automatically every 10 seconds across Web & Android terminals
    const autoSyncTimer = setInterval(runBackgroundSync, 10000);
    runBackgroundSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineQueueUpdated', checkOfflineQueue);
      window.removeEventListener('lspotWebUpdateAvailable', handleWebUpdateAvailable);
      clearInterval(autoSyncTimer);
    };
  }, []);

  const handleSyncOfflineQueue = async () => {
    const pendingBefore = getOfflinePendingCount();
    setIsSyncing(true);
    setSyncFeedback(
      pendingBefore > 0 ? `Syncing ${pendingBefore} offline item(s)...` : 'Verifying cloud sync...'
    );

    try {
      const res = await syncAllOfflineData();
      setIsOnline(res.online);
      setOfflineCount(res.remaining);
      const totalSynced = res.syncedSales + res.syncedMutations;

      if (!res.online) {
        setSyncFeedback('Offline Mode: records safely queued on device');
      } else if (res.remaining === 0) {
        setSyncFeedback(
          totalSynced > 0
            ? `Cloud sync complete: ${totalSynced} synced, 0 pending`
            : 'All data synchronized with cloud'
        );
      } else {
        setSyncFeedback(`Synced ${totalSynced}; ${res.remaining} retained for retry`);
      }
      setTimeout(() => setSyncFeedback(null), 3500);
      window.dispatchEvent(new CustomEvent('shiftUpdated'));
    } catch (err: any) {
      setSyncFeedback(`Sync error: ${err.message}`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLockTerminal = () => {
    setUserMenuOpen(false);
    setIsLocked(true);
    setEnteredPin('');
    setPinError('');
  };

  const handlePinSubmit = async () => {
    if (!enteredPin) return;
    const trimmedPin = enteredPin.trim();
    try {
      const res = await apiRequest('/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({
          pin: trimmedPin
        })
      });
      if (res?.token) {
        setAuthSession(res.token, res.user);
      }
      if (res && res.user) {
        setCurrentUser(res.user);
      }
      localStorage.setItem('lspot_last_verified_pin', trimmedPin);
      setIsLocked(false);
      setEnteredPin('');
      setPinError('');
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isNetworkFailure =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        msg.includes('Offline Mode') ||
        msg.includes('Unable to reach server') ||
        msg.includes('offline') ||
        msg.includes('Offline') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed') ||
        msg.includes('status 502') ||
        msg.includes('status 503') ||
        msg.includes('status 504') ||
        msg.includes('abort');

      if (isNetworkFailure) {
        const baseOfflinePinMap: Record<string, any> = {
          '8899': {
            id: '00000000-0000-0000-0000-000000000099',
            username: 'superadmin',
            fullName: 'System Super Administrator',
            role: 'SUPER_ADMIN'
          },
          '9999': {
            id: '11111111-1111-1111-1111-111111111111',
            username: 'owner',
            fullName: 'Restaurant Owner',
            role: 'OWNER'
          },
          '1234': {
            id: '22222222-2222-2222-2222-222222222222',
            username: 'manager',
            fullName: 'Mulenga Banda (Manager)',
            role: 'MANAGER'
          },
          '1122': {
            id: '33333333-3333-3333-3333-333333333333',
            username: 'cashier',
            fullName: 'Chileshe Mwape (Cashier)',
            role: 'CASHIER'
          },
          '4433': {
            id: '44444444-4444-4444-4444-444444444444',
            username: 'chef',
            fullName: 'Chef Tembo (Head Cook)',
            role: 'CHEF'
          },
          '5566': {
            id: '55555555-5555-5555-5555-555555555555',
            username: 'bar',
            fullName: 'Bwalya Phiri (Barista / Bartender)',
            role: 'BAR'
          },
          '7788': {
            id: '66666666-6666-6666-6666-666666666666',
            username: 'waiter',
            fullName: 'Kabwe Mutale (Floor Service)',
            role: 'WAITER'
          }
        };

        // Merge locally cached staff roster
        try {
          const rawRoster = localStorage.getItem('lspot_cached_staff_roster');
          if (rawRoster) {
            const roster: any[] = JSON.parse(rawRoster);
            for (const u of roster) {
              const uPin = String(u.supervisorPin || u.pin || '').trim();
              if (uPin) {
                baseOfflinePinMap[uPin] = {
                  id: u.id,
                  username: u.username,
                  fullName: u.fullName || u.username,
                  role: u.role
                };
              }
            }
          }
        } catch {}

        const lastPin = localStorage.getItem('lspot_last_verified_pin');
        const matchedOfflineUser =
          baseOfflinePinMap[trimmedPin] || (lastPin && lastPin === trimmedPin ? currentUser : null);

        if (matchedOfflineUser) {
          setCurrentUser(matchedOfflineUser);
          setAuthSession(localStorage.getItem('lspot_auth_token') || `offline-session-${Date.now()}`, matchedOfflineUser);
          setIsLocked(false);
          setEnteredPin('');
          setPinError('');
          return;
        }
        setPinError('Invalid staff PIN code. Please try again.');
        setEnteredPin('');
        return;
      }

      setPinError(msg || 'Invalid PIN code');
      setEnteredPin('');
    }
  };

  const handleBiometricAuth = (type: 'thumbprint' | 'face' = 'thumbprint') => {
    setPinError('');
    setLockBiometricType(type);
  };

  const handleLockBiometricSuccess = async (record: BiometricCredentialRecord) => {
    setLockBiometricType(null);
    try {
      const session = await loginWithBiometricSession(record);
      setAuthSession(session.token, session.user);
      setCurrentUser(session.user);
      setIsLocked(false);
      setEnteredPin('');
      setPinError('');
    } catch (err: any) {
      setPinError(err?.message || 'Biometric unlock failed.');
    }
  };

  const handleDigitPress = (digit: string) => {
    if (enteredPin.length < 6) {
      setEnteredPin((prev) => prev + digit);
      setPinError('');
    }
  };

  const handleClearPin = () => {
    setEnteredPin('');
    setPinError('');
  };

  const handleOpenChangePasswordModal = () => {
    setUserMenuOpen(false);
    setCurrentPasswordOrPin('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setChangePasswordError(null);
    setChangePasswordSuccess(null);
    setShowChangePasswordModal(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (!currentPasswordOrPin.trim()) {
      setChangePasswordError('Please enter your current password or personal Staff PIN.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setChangePasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPasswordOrPin: currentPasswordOrPin.trim(),
          newPassword: newPasswordInput
        })
      });
      setChangePasswordSuccess('Your password has been updated successfully.');
      setCurrentPasswordOrPin('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 1300);
    } catch (err: any) {
      setCurrentPasswordOrPin('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setChangePasswordError(err?.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const effectiveShift = activeShift ?? internalShift;

  return (
    <>
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-20 sticky top-0 shadow-lg select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
            <UtensilsCrossed className="w-5 h-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                {RESTAURANT_NAME}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Enterprise POS & ERP
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500" />
              {RESTAURANT_LOCATION}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Shift Indicator */}
          {effectiveShift ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-400 shadow-sm shadow-emerald-950">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              <span>Shift Active: <strong className="text-emerald-300">{effectiveShift.cashier?.fullName || 'Cashier'}</strong></span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-800/80 rounded-lg text-xs text-amber-400">
              <Coins className="w-3.5 h-3.5" />
              <span>No Shift Open</span>
            </div>
          )}

          {/* Interactive Cloud Sync Pill */}
          <div className="flex items-center">
            <button
              onClick={handleSyncOfflineQueue}
              disabled={isSyncing}
              title={
                offlineCount > 0
                  ? `${offlineCount} sales cached locally in Manyama. Click to sync with cloud now.`
                  : isOnline
                  ? 'All local sales synchronized with cloud server.'
                  : 'Offline mode active: transactions are securely queued in local storage.'
              }
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition shadow-sm ${
                offlineCount > 0
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
                  : isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : offlineCount > 0 ? (
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
              ) : isOnline ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              )}

              <span>
                {isSyncing
                  ? 'Syncing...'
                  : offlineCount > 0
                  ? `${offlineCount} Cached`
                  : isOnline
                  ? 'Cloud Synced'
                  : 'Offline Mode'}
              </span>
            </button>
            {syncFeedback && (
              <span className="hidden lg:inline ml-2 text-[11px] text-amber-300 font-medium animate-in fade-in">
                {syncFeedback}
              </span>
            )}
          </div>

          {/* Africa/Lusaka Clock */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>{timeStr} (Lusaka)</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 transition text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Intelligent Calculator Trigger */}
          <button
            onClick={() => setShowCalculator(true)}
            title="Intelligent Restaurant Calculator"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition text-xs font-medium"
          >
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Calc</span>
          </button>

          {/* Fast Lock Screen Trigger */}
          <button
            onClick={handleLockTerminal}
            title="Lock POS Terminal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition text-xs font-medium"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* Online Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
              isOnline
                ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400'
                : 'bg-rose-950/40 border-rose-900 text-rose-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* User Profile Popover */}
          <div className="relative pl-2 border-l border-slate-800">
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-semibold text-xs shadow-sm">
                {currentUser?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'MB'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-slate-200">{currentUser?.fullName || 'Mulenga Banda'}</p>
                <p className="text-[10px] text-slate-400">{currentUser?.role || 'Restaurant Manager'}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                <div className="p-2 border-b border-slate-800 mb-1">
                  <p className="font-bold text-slate-200">{currentUser?.fullName || 'Mulenga Banda'}</p>
                  <p className="text-[10px] text-amber-400">@{currentUser?.username || 'manager'}</p>
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/80 text-[10px] text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> {currentUser?.role || 'System Administrator'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowBiometricSelectModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                    <span>Register Biometrics (Thumb/Face)</span>
                  </button>
                  <button
                    onClick={handleOpenChangePasswordModal}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Change / Reset Password</span>
                  </button>
                  <button
                    onClick={handleLockTerminal}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lock POS Terminal</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logoutSession();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-400 hover:bg-rose-950/40 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>End Session / Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Self-Service Change / Reset Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Change / Reset Password</h3>
                  <p className="text-xs text-slate-400">
                    Update password for @{currentUser?.username || 'staff'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePasswordModal(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold"
              >
                Close
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-300 font-semibold">
                {changePasswordError}
              </div>
            )}

            {changePasswordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Current Password or Personal Staff PIN
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={currentPasswordOrPin}
                  onFocus={() => {
                    setCurrentPasswordOrPin('');
                    if (changePasswordError) setChangePasswordError(null);
                  }}
                  onChange={(e) => setCurrentPasswordOrPin(e.target.value)}
                  placeholder="Enter current password or 4–6 digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onFocus={() => {
                    setNewPasswordInput('');
                    if (changePasswordError) setChangePasswordError(null);
                  }}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPasswordInput}
                  onFocus={() => {
                    setConfirmPasswordInput('');
                    if (changePasswordError) setChangePasswordError(null);
                  }}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition"
                >
                  {isChangingPassword ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS Terminal Lock Screen Overlay */}
      {isLocked && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-white tracking-tight">POS Terminal Locked</h3>
              <p className="text-xs text-slate-400 mt-1">Enter your staff PIN or scan biometric to unlock</p>
            </div>

            {/* PIN Dots */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    enteredPin.length > idx
                      ? 'bg-amber-400 border-amber-400 scale-110 shadow-md shadow-amber-400/50'
                      : 'border-slate-700 bg-slate-950'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-rose-400 font-semibold bg-rose-950/60 py-1 px-3 rounded-lg border border-rose-900">
                {pinError}
              </p>
            )}

            {/* Numeric Keypad for Touchscreen/Android */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-mono text-xl font-bold shadow transition select-none"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="py-3.5 rounded-2xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-semibold text-xs transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-mono text-xl font-bold shadow transition select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={enteredPin.length === 0}
                className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-sm shadow transition"
              >
                Enter
              </button>
            </div>

            {/* Biometric Buttons (Fingerprint & Face) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Fast Biometric Unlock</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleBiometricAuth('thumbprint')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-750 text-emerald-400 font-semibold text-xs rounded-xl border border-emerald-900/40 transition active:scale-95"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Thumbprint</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBiometricAuth('face')}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-750 text-purple-400 font-semibold text-xs rounded-xl border border-purple-900/40 transition active:scale-95"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Face Unlock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Biometric Scanner Modal for Lock Screen */}
      <BiometricScannerModal
        isOpen={lockBiometricType !== null}
        mode="authenticate"
        biometricType={lockBiometricType || 'thumbprint'}
        onSuccess={handleLockBiometricSuccess}
        onClose={() => setLockBiometricType(null)}
      />

      {/* Self-Service Biometric Enrollment Selector Modal */}
      {showBiometricSelectModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Register Biometrics</h3>
                  <p className="text-xs text-slate-400">
                    Enroll for @{currentUser?.username || 'staff'} • Fast 1s login
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBiometricSelectModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select which biometric credential you want to register for your account. You can register both:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowBiometricSelectModal(false);
                  setSelfRegisterBiometricType('thumbprint');
                }}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition space-y-2 group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-white">Thumbprint</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Hardware sensor or capacitive screen pad</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowBiometricSelectModal(false);
                  setSelfRegisterBiometricType('face');
                }}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-left transition space-y-2 group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-white">Face ID</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Front camera live facial landmark scanner</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Biometric Registration Scanner Modal */}
      <BiometricScannerModal
        isOpen={selfRegisterBiometricType !== null}
        mode="register"
        biometricType={selfRegisterBiometricType || 'thumbprint'}
        targetUser={{
          id: currentUser?.id || 'staff',
          username: currentUser?.username || 'staff',
          fullName: currentUser?.fullName || 'Staff Member'
        }}
        onSuccess={(rec) => {
          setSelfRegisterBiometricType(null);
          toast.success(
            `✓ ${selfRegisterBiometricType === 'face' ? 'Face Recognition' : 'Thumbprint'} enrolled for ${rec.fullName}!`,
            'Biometric Registered'
          );
        }}
        onClose={() => setSelfRegisterBiometricType(null)}
      />

      {/* Intelligent Restaurant Calculator Modal */}
      <SmartCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </>
  );
}
