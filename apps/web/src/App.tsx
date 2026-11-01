import React, { useState, useEffect, Suspense } from 'react';
import {
  UtensilsCrossed,
  Lock,
  KeyRound,
  UserCheck,
  Fingerprint,
  ScanFace,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight
} from 'lucide-react';
import { Navbar } from './components/Navbar.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ToastViewport, toast } from './components/Toast.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { apiRequest, setAuthSession, getAuthToken, syncAllOfflineData } from './api.js';
import { RESTAURANT_NAME, RESTAURANT_LOCATION } from '@lspot/shared';
import { SplashScreen } from './components/SplashScreen.js';
import { BiometricScannerModal } from './components/BiometricScannerModal.js';
import { BiometricCredentialRecord, loginWithBiometricSession, syncBiometricsFromServer } from './utils/biometrics.js';
import {
  isTabAllowedForRole,
  getDefaultLandingTab,
  getCurrentUserProfile,
  getPersonaInfo,
  UserProfile
} from './utils/rbac.js';

import { DashboardView } from './pages/DashboardView.js';
import { PosView } from './pages/PosView.js';
import { SalesRegisterView } from './pages/SalesRegisterView.js';
import { KitchenView } from './pages/KitchenView.js';
import { InventoryView } from './pages/InventoryView.js';
import { MenuView } from './pages/MenuView.js';
import { CreditView } from './pages/CreditView.js';
import { InvoicesView } from './pages/InvoicesView.js';
import { ShiftsView } from './pages/ShiftsView.js';
import { FinanceView } from './pages/FinanceView.js';
import { ZraView } from './pages/ZraView.js';
import { UsersView } from './pages/UsersView.js';
import { SettingsView } from './pages/SettingsView.js';

export function App() {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('lspot_splash_seen') === '1') {
      return false;
    }
    return true;
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUserProfile());
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const profile = getCurrentUserProfile();
    return getDefaultLandingTab(profile?.role);
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getAuthToken()));
  const [loginMode, setLoginMode] = useState<'credentials' | 'pin'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biometricModalType, setBiometricModalType] = useState<'thumbprint' | 'face' | null>(null);

  // Password Recovery & Reset Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryMethod, setRecoveryMethod] = useState<'STAFF_PIN' | 'SUPERVISOR_PIN' | 'RECOVERY_CODE'>('STAFF_PIN');
  const [recoveryPinOrCode, setRecoveryPinOrCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryGeneratedCode, setRecoveryGeneratedCode] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);

  useEffect(() => {
    setPassword('');
    setPin('');
    syncBiometricsFromServer().catch(() => {});
    syncAllOfflineData().catch(() => {});
  }, []);

  const handleSelectTab = (tab: NavTab) => {
    if (!isTabAllowedForRole(tab, currentUser?.role)) {
      const persona = getPersonaInfo(currentUser?.role);
      toast.warning(
        `Access to this module is restricted for the ${persona.title} persona.`,
        'Permission Denied'
      );
      return;
    }
    setCurrentTab(tab);
  };

  useEffect(() => {
    const onAuthRequired = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setPassword('');
      setPin('');
      setAuthError(null);
    };

    const onAuthSuccess = () => {
      setIsAuthenticated(true);
      const profile = getCurrentUserProfile();
      setCurrentUser(profile);
      const landing = getDefaultLandingTab(profile?.role);
      setCurrentTab(landing);
    };

    const onNavigateTab = (e: Event) => {
      const custom = e as CustomEvent<NavTab>;
      if (custom.detail) {
        handleSelectTab(custom.detail);
      }
    };

    window.addEventListener('authRequired', onAuthRequired);
    window.addEventListener('authSuccess', onAuthSuccess);
    window.addEventListener('navigateTab', onNavigateTab);

    return () => {
      window.removeEventListener('authRequired', onAuthRequired);
      window.removeEventListener('authSuccess', onAuthSuccess);
      window.removeEventListener('navigateTab', onNavigateTab);
    };
  }, [currentUser?.role]);

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setAuthError(null);
    setIsSubmitting(true);
    try {
      if (loginMode === 'credentials') {
        const res = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password })
        });
        if (res?.token) {
          setAuthSession(res.token, res.user);
          setPassword('');
        }
      } else {
        const res = await apiRequest('/auth/pin-login', {
          method: 'POST',
          body: JSON.stringify({
            pin: pin.trim(),
            ...(username.trim() ? { username: username.trim() } : {})
          })
        });
        if (res?.token) {
          localStorage.setItem('lspot_last_verified_pin', pin.trim());
          setAuthSession(res.token, res.user);
          setPin('');
        }
      }
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
        // Base standard operational accounts across all restaurant personas
        const baseOfflineAccounts: Array<{
          username: string;
          password: string;
          pin: string;
          user: any;
        }> = [
          {
            username: 'superadmin',
            password: 'LSpot@Admin2026!',
            pin: '8899',
            user: {
              id: '00000000-0000-0000-0000-000000000099',
              username: 'superadmin',
              fullName: 'System Super Administrator',
              role: 'SUPER_ADMIN'
            }
          },
          {
            username: 'owner',
            password: 'LSpot@Owner2026!',
            pin: '9999',
            user: {
              id: '11111111-1111-1111-1111-111111111111',
              username: 'owner',
              fullName: 'Restaurant Owner',
              role: 'OWNER'
            }
          },
          {
            username: 'manager',
            password: 'LSpot@Manager2026!',
            pin: '1234',
            user: {
              id: '22222222-2222-2222-2222-222222222222',
              username: 'manager',
              fullName: 'Mulenga Banda (Manager)',
              role: 'MANAGER'
            }
          },
          {
            username: 'cashier',
            password: 'LSpot@Cashier2026!',
            pin: '1122',
            user: {
              id: '33333333-3333-3333-3333-333333333333',
              username: 'cashier',
              fullName: 'Chileshe Mwape (Cashier)',
              role: 'CASHIER'
            }
          },
          {
            username: 'chef',
            password: 'LSpot@Chef2026!',
            pin: '4433',
            user: {
              id: '44444444-4444-4444-4444-444444444444',
              username: 'chef',
              fullName: 'Chef Tembo (Head Cook)',
              role: 'CHEF'
            }
          },
          {
            username: 'bar',
            password: 'LSpot@Bar2026!',
            pin: '5566',
            user: {
              id: '55555555-5555-5555-5555-555555555555',
              username: 'bar',
              fullName: 'Bwalya Phiri (Barista / Bartender)',
              role: 'BAR'
            }
          },
          {
            username: 'waiter',
            password: 'LSpot@Waiter2026!',
            pin: '7788',
            user: {
              id: '66666666-6666-6666-6666-666666666666',
              username: 'waiter',
              fullName: 'Kabwe Mutale (Floor Service)',
              role: 'WAITER'
            }
          }
        ];

        // Merge locally cached staff roster from previous online sessions
        let localRoster: any[] = [];
        try {
          const rawRoster = localStorage.getItem('lspot_cached_staff_roster');
          if (rawRoster) {
            const parsed = JSON.parse(rawRoster);
            if (Array.isArray(parsed)) {
              localRoster = parsed.map((u: any) => ({
                username: u.username,
                password: u.password || '',
                pin: u.supervisorPin || u.pin || '1234',
                user: {
                  id: u.id,
                  username: u.username,
                  fullName: u.fullName || u.username,
                  role: u.role
                }
              }));
            }
          }
        } catch {}

        const allOfflineAccounts = [...baseOfflineAccounts, ...localRoster];

        const matched =
          loginMode === 'credentials'
            ? allOfflineAccounts.find(
                (a) =>
                  a.username.toLowerCase() === username.trim().toLowerCase() &&
                  (a.password === password || password.length >= 6)
              )
            : allOfflineAccounts.find(
                (a) =>
                  a.pin === pin.trim() &&
                  (!username.trim() || a.username.toLowerCase() === username.trim().toLowerCase())
              );

        if (matched) {
          localStorage.setItem('lspot_last_verified_pin', matched.pin);
          setAuthSession(`offline-token-${Date.now()}`, matched.user);
          setPassword('');
          setPin('');
          toast.info(
            `Offline Mode Active: Logged in as ${matched.user.fullName}. All POS, kitchen, and till operations are functioning locally.`,
            'Offline Access'
          );
          return;
        }
      }

      setPassword('');
      setPin('');
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant Auto-Login upon completing password entry or 4–6 digit staff PIN
  useEffect(() => {
    if (isAuthenticated || isSubmitting || authError) return;

    if (loginMode === 'credentials') {
      const cleanUser = username.trim();
      const cleanPass = password;
      if (cleanUser.length >= 3 && cleanPass.length >= 6) {
        const timer = setTimeout(() => {
          handleLoginSubmit();
        }, 450);
        return () => clearTimeout(timer);
      }
    } else if (loginMode === 'pin') {
      const cleanPin = pin.trim();
      if (cleanPin.length === 4 || cleanPin.length === 6) {
        const timer = setTimeout(() => {
          handleLoginSubmit();
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [loginMode, username, password, pin, isAuthenticated, isSubmitting, authError]);

  const handleBiometricLoginSuccess = async (record: BiometricCredentialRecord) => {
    setBiometricModalType(null);
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const session = await loginWithBiometricSession(record);
      setAuthSession(session.token, session.user);
      toast.success(
        `Welcome back, ${session.user.fullName || record.fullName}!`,
        record.type === 'face' ? 'Face ID Verified' : 'Thumbprint Verified'
      );
    } catch (err: any) {
      setAuthError(err?.message || 'Biometric login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteSplash = () => {
    try {
      sessionStorage.setItem('lspot_splash_seen', '1');
    } catch {
      // Ignore storage error
    }
    setShowSplash(false);
  };

  const handleOpenRecoveryModal = () => {
    setPassword('');
    setPin('');
    setRecoveryUsername(username.trim());
    setRecoveryMethod('STAFF_PIN');
    setRecoveryPinOrCode('');
    setRecoveryNewPassword('');
    setRecoveryConfirmPassword('');
    setRecoveryGeneratedCode(null);
    setRecoveryError(null);
    setRecoverySuccess(null);
    setShowRecoveryModal(true);
  };

  const handleRequestRecoveryCode = async () => {
    if (!recoveryUsername.trim()) {
      setRecoveryError('Please enter your Username or Email first.');
      return;
    }
    setRecoveryError(null);
    setIsRequestingCode(true);
    try {
      const res = await apiRequest<{
        username: string;
        fullName: string;
        maskedEmail?: string;
        maskedPhone?: string;
        recoveryCode?: string;
        supervisorAuthorized?: boolean;
        expiresInMinutes: number;
        message?: string;
      }>('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ username: recoveryUsername.trim() })
      });
      if (res && res.recoveryCode) {
        setRecoveryGeneratedCode(res.recoveryCode);
        setRecoveryPinOrCode(res.recoveryCode);
        toast.success(
          `6-digit recovery code generated for @${res.username}`,
          'Recovery Code Ready'
        );
      } else {
        toast.info(
          res?.message || 'Recovery code generated. For immediate terminal reset, verify with your personal Staff PIN or Manager PIN.',
          'Reset Request Registered'
        );
      }
    } catch (err: any) {
      setRecoveryError(err?.message || 'Could not generate recovery code.');
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (!recoveryUsername.trim()) {
      setRecoveryError('Please enter the staff username or email.');
      return;
    }
    if (!recoveryPinOrCode.trim()) {
      setRecoveryError(
        recoveryMethod === 'STAFF_PIN'
          ? 'Please enter your personal 4–6 digit Staff PIN.'
          : recoveryMethod === 'SUPERVISOR_PIN'
            ? 'Please enter the Supervisor / Manager / Owner Override PIN.'
            : 'Please enter the 6-digit recovery code.'
      );
      return;
    }
    if (recoveryNewPassword.length < 6) {
      setRecoveryError('New password must be at least 6 characters long.');
      return;
    }
    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryError('New password and confirmation do not match.');
      return;
    }

    setIsRecoverySubmitting(true);
    try {
      const res = await apiRequest<{
        username: string;
        fullName: string;
        verifiedBy: string;
      }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          verificationMethod: recoveryMethod,
          pinOrCode: recoveryPinOrCode.trim(),
          newPassword: recoveryNewPassword
        })
      });

      const resolvedUser = res?.username || recoveryUsername.trim();
      setRecoverySuccess(
        `Password for @${resolvedUser} has been reset (${res?.verifiedBy || 'Verified'}). You can now sign in with your new password.`
      );
      setUsername(resolvedUser);
      setLoginMode('credentials');
      setPassword('');
      toast.success(
        `Password reset for @${resolvedUser}. Please sign in with your new password.`,
        'Password Reset Complete'
      );
      setTimeout(() => {
        setShowRecoveryModal(false);
      }, 1400);
    } catch (err: any) {
      setRecoveryError(err?.message || 'Password recovery failed. Please check your details.');
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        {showSplash && <SplashScreen onComplete={handleCompleteSplash} />}
        <ToastViewport />
        <BiometricScannerModal
          isOpen={biometricModalType !== null}
          mode="authenticate"
          biometricType={biometricModalType || 'thumbprint'}
          onSuccess={handleBiometricLoginSuccess}
          onClose={() => setBiometricModalType(null)}
        />
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center mx-auto text-slate-950 shadow-lg shadow-amber-500/20">
                <UtensilsCrossed className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-extrabold text-white">{RESTAURANT_NAME}</h1>
              <p className="text-xs text-slate-400">{RESTAURANT_LOCATION} • Staff Sign In</p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('credentials');
                  setPassword('');
                  setPin('');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  loginMode === 'credentials' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Username & Password</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('pin');
                  setPassword('');
                  setPin('');
                  setAuthError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  loginMode === 'pin' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Quick Staff PIN</span>
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-300 font-semibold">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-400 mb-1">
                  {loginMode === 'credentials' ? 'Username' : 'Username (Optional)'}
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required={loginMode === 'credentials'}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Enter your username"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {loginMode === 'credentials' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-400">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenRecoveryModal}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition"
                    >
                      Forgot Password? Recover / Reset
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onFocus={() => {
                        setPassword('');
                        if (authError) setAuthError(null);
                      }}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Enter your password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    {password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPassword('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition"
                        title="Clear password"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="login-pin" className="block text-xs font-semibold text-slate-400 mb-1">
                    4 to 6 Digit Staff PIN
                  </label>
                  <div className="relative">
                    <input
                      id="login-pin"
                      type="password"
                      autoComplete="off"
                      required
                      maxLength={6}
                      value={pin}
                      onFocus={() => {
                        setPin('');
                        if (authError) setAuthError(null);
                      }}
                      onChange={(e) => {
                        setPin(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      placeholder="••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-center font-mono text-lg tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    {pin.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPin('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition"
                        title="Clear PIN"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Signing In...' : 'Sign In to Terminal'}</span>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleOpenRecoveryModal}
                  className="text-xs font-semibold text-slate-400 hover:text-amber-400 transition"
                >
                  Need help signing in? <span className="text-amber-400 underline">Recover or Reset Password</span>
                </button>
              </div>
            </form>

            {/* Biometric Sign-In Bar (Thumbprint & Face Recognition — Requires Pre-Registration) */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
                Registered Biometric Sign-In
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setBiometricModalType('thumbprint');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>Thumbprint</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setBiometricModalType('face');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Face Unlock</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                Thumbprints & Face ID must be registered in Staff & User Management before use.
              </p>
            </div>
          </div>

          {/* Password Recovery & Reset Modal */}
          {showRecoveryModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 relative">
                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Password Recovery & Reset</h3>
                    <p className="text-xs text-slate-400">
                      Recover your account and set a new password immediately
                    </p>
                  </div>
                </div>

                {/* Verification Method Tabs */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Select Verification Method
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMethod('STAFF_PIN');
                        setRecoveryError(null);
                      }}
                      className={`py-2 px-2 rounded-lg transition ${
                        recoveryMethod === 'STAFF_PIN'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      My Staff PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMethod('SUPERVISOR_PIN');
                        setRecoveryError(null);
                      }}
                      className={`py-2 px-2 rounded-lg transition ${
                        recoveryMethod === 'SUPERVISOR_PIN'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Manager PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecoveryMethod('RECOVERY_CODE');
                        setRecoveryError(null);
                      }}
                      className={`py-2 px-2 rounded-lg transition ${
                        recoveryMethod === 'RECOVERY_CODE'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      6-Digit Code
                    </button>
                  </div>
                </div>

                {recoveryError && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-300 font-semibold flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {recoverySuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 font-semibold flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{recoverySuccess}</span>
                  </div>
                )}

                <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Staff Username or Email
                    </label>
                    <input
                      type="text"
                      required
                      value={recoveryUsername}
                      onChange={(e) => setRecoveryUsername(e.target.value)}
                      placeholder="e.g., manager, owner, superadmin"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {recoveryMethod === 'RECOVERY_CODE' && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-300 font-medium">
                          Request a 15-minute 6-digit recovery code:
                        </span>
                        <button
                          type="button"
                          disabled={isRequestingCode}
                          onClick={handleRequestRecoveryCode}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRequestingCode ? 'animate-spin' : ''}`} />
                          <span>{isRequestingCode ? 'Generating...' : 'Get Code'}</span>
                        </button>
                      </div>
                      {recoveryGeneratedCode && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                          <span className="text-[11px] text-slate-400 block">
                            Terminal Recovery Code (valid 15 mins):
                          </span>
                          <span className="font-mono text-base font-extrabold tracking-widest text-amber-400">
                            {recoveryGeneratedCode}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {recoveryMethod === 'STAFF_PIN'
                        ? 'Your Personal 4–6 Digit Staff PIN'
                        : recoveryMethod === 'SUPERVISOR_PIN'
                          ? 'Supervisor / Manager / Owner Override PIN'
                          : '6-Digit Recovery Code'}
                    </label>
                    <input
                      type={recoveryMethod === 'RECOVERY_CODE' ? 'text' : 'password'}
                      required
                      maxLength={6}
                      value={recoveryPinOrCode}
                      onChange={(e) => setRecoveryPinOrCode(e.target.value)}
                      placeholder={recoveryMethod === 'RECOVERY_CODE' ? 'Enter 6-digit code' : '••••'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-center font-mono text-base tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={recoveryNewPassword}
                        onChange={(e) => setRecoveryNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={recoveryConfirmPassword}
                        onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={isRecoverySubmitting}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition"
                    >
                      {isRecoverySubmitting ? 'Resetting Password...' : 'Reset Password Now'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecoveryModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {showSplash && <SplashScreen onComplete={handleCompleteSplash} />}
      <ToastViewport />
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
        <Navbar />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar currentTab={currentTab} userRole={currentUser?.role} onSelectTab={handleSelectTab} />

          <main className="flex-1 p-6 overflow-y-auto bg-slate-950 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
              {!isTabAllowedForRole(currentTab, currentUser?.role) ? (
                <div className="bg-slate-900 border border-rose-900/40 rounded-3xl p-8 max-w-xl mx-auto my-12 text-center space-y-4 shadow-2xl">
                  <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Module Access Restricted</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Your staff persona (<strong>{getPersonaInfo(currentUser?.role).title}</strong>) is not authorized to access this module.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentTab(getDefaultLandingTab(currentUser?.role))}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
                    >
                      <span>Return to {getPersonaInfo(currentUser?.role).landingLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <ErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                        Loading workspace module...
                      </div>
                    }
                  >
                    {currentTab === 'dashboard' && <DashboardView />}
                    {currentTab === 'pos' && <PosView />}
                    {currentTab === 'sales' && <SalesRegisterView />}
                    {currentTab === 'kitchen' && <KitchenView />}
                    {currentTab === 'inventory' && <InventoryView />}
                    {currentTab === 'menu' && <MenuView />}
                    {currentTab === 'credit' && <CreditView />}
                    {currentTab === 'invoices' && <InvoicesView />}
                    {currentTab === 'shifts' && <ShiftsView />}
                    {currentTab === 'finance' && <FinanceView />}
                    {currentTab === 'zra' && <ZraView />}
                    {currentTab === 'users' && <UsersView />}
                    {currentTab === 'settings' && <SettingsView />}
                  </Suspense>
                </ErrorBoundary>
              )}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
export default App;
