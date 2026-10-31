import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Edit2,
  Trash2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  ScanFace,
  Fingerprint,
  Smartphone,
  ShieldAlert,
  Search,
  Check,
  ToggleLeft,
  ToggleRight,
  Sliders
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { toast } from '../components/Toast.js';
import { UserRole } from '@lspot/shared';
import {
  registerBiometric,
  getUserBiometrics,
  removeUserBiometric,
  BiometricCredentialRecord,
  isBiometricsSupported
} from '../utils/biometrics.js';

interface StaffUser {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  supervisorPin?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export function UsersView() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  // Biometric status & registration state
  const [userBiometrics, setUserBiometrics] = useState<BiometricCredentialRecord[]>([]);
  const [biometricStatusMsg, setBiometricStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [isRegisteringBiometric, setIsRegisteringBiometric] = useState<'thumbprint' | 'face' | null>(null);
  const [biometricsHardwareAvailable, setBiometricsHardwareAvailable] = useState<boolean>(true);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+260 97 ');
  const [role, setRole] = useState<string>(UserRole.CASHIER);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  // User-Specific Granular Permissions / Rights State
  const [customRights, setCustomRights] = useState({
    canVoidSale: false,
    canGiveDiscount: false,
    canIssueCredit: false,
    canDeleteRecord: false,
    canAuditStock: false,
    canEditMenu: false,
    canManageUsers: false
  });

  // Supervisor Override Simulation
  const [showOverrideTester, setShowOverrideTester] = useState(false);
  const [testPin, setTestPin] = useState('');
  const [overrideResult, setOverrideResult] = useState<any>(null);

  // Tab State: Directory vs Role Privileges Matrix
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix'>('directory');
  const [permissionsSavedMsg, setPermissionsSavedMsg] = useState(false);
  const [rolesList, setRolesList] = useState<any[]>([
    {
      id: UserRole.OWNER,
      name: 'Owner / Executive Director',
      rights: {
        canVoidSale: true,
        canGiveDiscount: true,
        canIssueCredit: true,
        canDeleteRecord: true,
        canAuditStock: true,
        canEditMenu: true,
        canManageUsers: true
      }
    },
    {
      id: UserRole.MANAGER,
      name: 'Restaurant Manager',
      rights: {
        canVoidSale: true,
        canGiveDiscount: true,
        canIssueCredit: true,
        canDeleteRecord: true,
        canAuditStock: true,
        canEditMenu: true,
        canManageUsers: true
      }
    },
    {
      id: UserRole.ACCOUNTANT,
      name: 'Accountant (Finance & AR)',
      rights: {
        canVoidSale: false,
        canGiveDiscount: true,
        canIssueCredit: true,
        canDeleteRecord: false,
        canAuditStock: true,
        canEditMenu: false,
        canManageUsers: false
      }
    },
    {
      id: UserRole.CASHIER,
      name: 'POS Cashier & Till',
      rights: {
        canVoidSale: false,
        canGiveDiscount: false,
        canIssueCredit: true,
        canDeleteRecord: false,
        canAuditStock: false,
        canEditMenu: false,
        canManageUsers: false
      }
    },
    {
      id: UserRole.CHEF,
      name: 'Kitchen Chef / Cook',
      rights: {
        canVoidSale: false,
        canGiveDiscount: false,
        canIssueCredit: false,
        canDeleteRecord: false,
        canAuditStock: true,
        canEditMenu: false,
        canManageUsers: false
      }
    },
    {
      id: UserRole.STOREKEEPER,
      name: 'Inventory Storekeeper',
      rights: {
        canVoidSale: false,
        canGiveDiscount: false,
        canIssueCredit: false,
        canDeleteRecord: false,
        canAuditStock: true,
        canEditMenu: false,
        canManageUsers: false
      }
    }
  ]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/users');
      if (data) setUsers(data);
    } catch (e: any) {
      console.warn('Network error loading users:', e);
      setUsers((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDefaultRights = (roleCode: string) => {
    const matched = rolesList.find((r) => r.id === roleCode);
    if (matched) return { ...matched.rights };
    return {
      canVoidSale: [UserRole.MANAGER, UserRole.OWNER].includes(roleCode as any),
      canGiveDiscount: [UserRole.MANAGER, UserRole.OWNER, UserRole.ACCOUNTANT].includes(roleCode as any),
      canIssueCredit: [UserRole.MANAGER, UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.CASHIER].includes(roleCode as any),
      canDeleteRecord: [UserRole.MANAGER, UserRole.OWNER].includes(roleCode as any),
      canAuditStock: [UserRole.MANAGER, UserRole.OWNER, UserRole.STOREKEEPER, UserRole.CHEF].includes(roleCode as any),
      canEditMenu: [UserRole.MANAGER, UserRole.OWNER].includes(roleCode as any),
      canManageUsers: [UserRole.OWNER].includes(roleCode as any)
    };
  };

  useEffect(() => {
    isBiometricsSupported().then((res) => {
      setBiometricsHardwareAvailable(res.supported);
    });
  }, []);

  const loadBiometricsForUser = (userId: string) => {
    const list = getUserBiometrics(userId);
    setUserBiometrics(list);
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPhone('+260 97 ');
    setRole(UserRole.CASHIER);
    setSupervisorPin('');
    setPassword('lspot1234');
    setIsActive(true);
    setCustomRights(getRoleDefaultRights(UserRole.CASHIER));
    setUserBiometrics([]);
    setBiometricStatusMsg(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (u: StaffUser) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsername(u.username);
    setEmail(u.email || '');
    setPhone(u.phone || '+260 97 ');
    setRole(u.role);
    setSupervisorPin('');
    setPassword('');
    setIsActive(u.isActive);
    setBiometricStatusMsg(null);

    // Load registered WebAuthn biometrics
    loadBiometricsForUser(u.id);

    // Retrieve saved user-level permissions from localStorage or compute from role
    const savedUserRightsKey = `lspot_user_rights_${u.id}`;
    const storedRights = localStorage.getItem(savedUserRightsKey);
    if (storedRights) {
      try {
        setCustomRights(JSON.parse(storedRights));
      } catch {
        setCustomRights(getRoleDefaultRights(u.role));
      }
    } else {
      setCustomRights(getRoleDefaultRights(u.role));
    }

    setShowAddModal(true);
  };

  const handleRegisterBiometric = async (type: 'thumbprint' | 'face') => {
    if (!editingUser) {
      toast.warning('Please save the staff profile first before registering biometrics.', 'Save Profile First');
      return;
    }

    setIsRegisteringBiometric(type);
    setBiometricStatusMsg({ text: `Prompting system sensor for ${type === 'face' ? 'Face recognition' : 'Thumbprint'}...` });

    try {
      await registerBiometric(editingUser.id, editingUser.username, editingUser.fullName, type);
      loadBiometricsForUser(editingUser.id);
      setBiometricStatusMsg({
        text: `✓ ${type === 'face' ? 'Face ID' : 'Thumbprint'} successfully registered and linked!`
      });
      setTimeout(() => setBiometricStatusMsg(null), 4000);
    } catch (err: any) {
      console.warn('Biometric registration error:', err);
      const isCancelled = err.name === 'NotAllowedError';
      setBiometricStatusMsg({
        error: true,
        text: isCancelled
          ? 'Sensor request was cancelled or timed out.'
          : err.message || 'Hardware biometric registration failed.'
      });
    } finally {
      setIsRegisteringBiometric(null);
    }
  };

  const handleRemoveBiometric = (type: 'thumbprint' | 'face') => {
    if (!editingUser) return;
    if (window.confirm(`Remove registered ${type === 'face' ? 'Face ID' : 'Thumbprint'} for ${editingUser.fullName}?`)) {
      removeUserBiometric(editingUser.id, type);
      loadBiometricsForUser(editingUser.id);
      setBiometricStatusMsg({ text: `Removed ${type} registration.` });
      setTimeout(() => setBiometricStatusMsg(null), 3000);
    }
  };

  const handleSaveUser = async () => {
    if (!fullName || !username) {
      toast.warning('Full name and username are required.', 'Missing Credentials');
      return;
    }
    if (supervisorPin && !/^\d{4,6}$/.test(supervisorPin)) {
      toast.warning('Supervisor / Login PIN must be 4 to 6 numeric digits.', 'Invalid PIN Format');
      return;
    }

    try {
      if (editingUser) {
        await apiRequest(`/auth/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            fullName,
            email,
            phone,
            role,
            ...(supervisorPin ? { supervisorPin } : {}),
            password: password || undefined,
            isActive
          })
        });
        // Save user-specific granular permissions
        localStorage.setItem(`lspot_user_rights_${editingUser.id}`, JSON.stringify(customRights));
        toast.success(`User profile and permissions for ${fullName} updated.`, 'Staff Profile Updated');
      } else {
        const createdUser = await apiRequest('/auth/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            username,
            email,
            phone,
            role,
            supervisorPin: supervisorPin || null,
            password: password || 'lspot1234',
            isActive
          })
        });
        if (createdUser?.id) {
          localStorage.setItem(`lspot_user_rights_${createdUser.id}`, JSON.stringify(customRights));
        }
        toast.success(`Staff account @${username} created and permissions configured.`, 'Staff Account Created');
      }
      setShowAddModal(false);
      loadUsers();
    } catch (err: any) {
      toast.critical(`Save failed: ${err.message}`, 'Staff Save Error');
    }
  };

  const handleDeleteUser = async (u: StaffUser) => {
    const isSelf = u.username === 'manager' || u.role === UserRole.OWNER;
    const confirmMsg = isSelf
      ? `Warning: "${u.fullName}" is an Executive/Owner account. Are you sure you want to deactivate or remove this profile?`
      : `Are you sure you want to delete or deactivate staff member "${u.fullName}" (@${u.username})? If this user has sales or shift history, they will be archived safely.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/auth/users/${u.id}`, { method: 'DELETE' });
      toast.info(`Staff member "${u.fullName}" removed or archived safely.`, 'Staff Member Archived');
      setShowAddModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      // Offline fallback state removal
      setUsers((prev) => prev.filter((user) => user.id !== u.id));
      toast.info(`Staff record "${u.fullName}" removed locally.`, 'Local Record Removed');
      setShowAddModal(false);
      setEditingUser(null);
    }
  };

  const handleTestSupervisorOverride = async () => {
    if (!testPin) return;
    try {
      const res = await apiRequest('/auth/supervisor-override', {
        method: 'POST',
        body: JSON.stringify({ pin: testPin })
      });
      setOverrideResult({ success: true, supervisor: res });
    } catch (err: any) {
      setOverrideResult({ success: false, message: err.message || 'Invalid PIN' });
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case UserRole.SUPER_ADMIN:
      case UserRole.OWNER:
        return 'bg-purple-950/80 text-purple-300 border border-purple-800/80';
      case UserRole.MANAGER:
        return 'bg-amber-950/80 text-amber-300 border border-amber-800/80';
      case UserRole.ACCOUNTANT:
        return 'bg-blue-950/80 text-blue-300 border border-blue-800/80';
      case UserRole.CHEF:
        return 'bg-rose-950/80 text-rose-300 border border-rose-800/80';
      default:
        return 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80';
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'fullName',
      header: 'Staff Member',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-400">
            {u.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-slate-100 block">{u.fullName}</span>
            <span className="text-xs text-slate-400 font-mono">@{u.username}</span>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Assigned Role & Rights',
      render: (u) => {
        const getPrivilegeCount = (r: string) => {
          switch (r) {
            case UserRole.SUPER_ADMIN:
            case UserRole.OWNER:
              return 'Full Executive Rights (7/7)';
            case UserRole.MANAGER:
              return 'Supervisor Override & Ops (6/7)';
            case UserRole.ACCOUNTANT:
              return 'AR, Credit & Ledgers (4/7)';
            case UserRole.STOREKEEPER:
              return 'Inventory & Wastage (2/7)';
            case UserRole.CHEF:
              return 'Kitchen Ticket Access (1/7)';
            default:
              return 'POS Orders & Shift Till (2/7)';
          }
        };

        return (
          <div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${getRoleBadge(u.role)}`}>
              {u.role.replace('_', ' ')}
            </span>
            <span className="block text-[11px] text-slate-400 mt-1 font-mono">
              {getPrivilegeCount(u.role)}
            </span>
          </div>
        );
      }
    },
    {
      key: 'supervisorPin',
      header: 'Quick PIN & Override',
      render: (u) =>
        u.supervisorPin ? (
          <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>•••• ({u.supervisorPin.length}-digit active)</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 italic">No PIN assigned</span>
        )
    },
    {
      key: 'biometrics',
      header: 'Biometric Credentials',
      render: (u) => {
        const bios = getUserBiometrics(u.id);
        const hasThumb = bios.some((b) => b.type === 'thumbprint');
        const hasFace = bios.some((b) => b.type === 'face');
        if (!hasThumb && !hasFace) {
          return <span className="text-xs text-slate-500 italic">None enrolled</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {hasThumb && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Thumbprint Registered">
                <Fingerprint className="w-3 h-3" />
                <span>Thumb</span>
              </span>
            )}
            {hasFace && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Face Recognition Registered">
                <ScanFace className="w-3 h-3" />
                <span>Face</span>
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'phone',
      header: 'Phone / Contact',
      render: (u) => <span className="font-mono text-xs text-slate-300">{u.phone || u.email || '—'}</span>
    },
    {
      key: 'isActive',
      header: 'Terminal Status',
      render: (u) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            u.isActive
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
          {u.isActive ? 'Active Staff' : 'Suspended'}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(u);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            title="Edit Profile, Role & PIN"
          >
            <Edit2 className="w-3 h-3 text-amber-400" />
            <span>Edit</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteUser(u);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-semibold rounded-xl transition"
            title="Archive or Delete Staff Member"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-white">Staff & User Management</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Enterprise RBAC & Biometrics
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Role permissions, terminal lock codes, supervisor overrides, and mobile Android biometric keys.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Tab Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'directory'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Directory</span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Roles & Permissions Matrix</span>
            </button>
          </div>

          <button
            onClick={() => setShowOverrideTester(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Test Supervisor Override</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Security & Mobile Biometric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">Quick PIN Access</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Fast numeric PIN codes allow cashiers and kitchen staff to log in in under 2 seconds on shared touchscreens.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">Biometric Login (Android)</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Native fingerprint and Face Unlock are supported on handheld Android devices via WebAuthn biometric sensors.
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">Supervisor Override Audit</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Restricted actions like price discounts, voiding sales, and opening tills require a Manager or Owner PIN.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area: Directory vs Permissions Matrix */}
      {activeTab === 'directory' ? (
        <EnterpriseTable
          columns={columns}
          data={users}
          title="Restaurant Personnel Directory"
          searchPlaceholder="Search staff by name, username or phone..."
          isLoading={isLoading}
          onRowClick={(row) => handleOpenEdit(row)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Staff Roles & Operating Privileges Matrix</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure operational permissions across till operations, discount authorizations, customer credit approvals, and administrative rights.
              </p>
            </div>
            {permissionsSavedMsg && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Check className="w-4 h-4 text-emerald-400" /> Privileges Updated & Saved
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-bold">Staff Role</th>
                  <th className="px-4 py-3 font-semibold text-center">Void Sales</th>
                  <th className="px-4 py-3 font-semibold text-center">Give Discounts</th>
                  <th className="px-4 py-3 font-semibold text-center">Issue Credit</th>
                  <th className="px-4 py-3 font-semibold text-center">Delete Records</th>
                  <th className="px-4 py-3 font-semibold text-center">Stock Audit</th>
                  <th className="px-4 py-3 font-semibold text-center">Edit Menu</th>
                  <th className="px-4 py-3 font-semibold text-center">User Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rolesList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5 font-bold text-white">
                      <div>
                        {r.name}
                        <span className="block text-[11px] font-mono text-amber-400 font-semibold">{r.id}</span>
                      </div>
                    </td>
                    {[
                      'canVoidSale',
                      'canGiveDiscount',
                      'canIssueCredit',
                      'canDeleteRecord',
                      'canAuditStock',
                      'canEditMenu',
                      'canManageUsers'
                    ].map((rightKey) => {
                      const isAllowed = r.rights[rightKey];
                      return (
                        <td key={rightKey} className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setRolesList((prev) =>
                                prev.map((item) =>
                                  item.id === r.id
                                    ? {
                                        ...item,
                                        rights: { ...item.rights, [rightKey]: !item.rights[rightKey] }
                                      }
                                    : item
                                )
                              );
                              setPermissionsSavedMsg(true);
                              setTimeout(() => setPermissionsSavedMsg(false), 2500);
                            }}
                            className={`p-2 rounded-xl transition ${
                              isAllowed
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title={`Toggle ${rightKey} for ${r.name}`}
                          >
                            {isAllowed ? <Check className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  {editingUser ? 'Edit Staff Profile & Credentials' : 'Register New Staff Member'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure role privileges, password, and fast-access PIN</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kondwani Zimba"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!!editingUser}
                    placeholder="e.g. kzimba"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Role & Privileges</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setRole(newRole);
                      setCustomRights(getRoleDefaultRights(newRole));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={UserRole.CASHIER}>Cashier (POS & Till Only)</option>
                    <option value={UserRole.CHEF}>Chef (Kitchen Register Only)</option>
                    <option value={UserRole.ACCOUNTANT}>Accountant (Finance & AR)</option>
                    <option value={UserRole.STOREKEEPER}>Storekeeper (Stock Only)</option>
                    <option value={UserRole.MANAGER}>Restaurant Manager (Full Operations)</option>
                    <option value={UserRole.OWNER}>Owner / Executive Director</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Supervisor / Quick PIN (4-6 Digits)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder="e.g. 1234"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono text-emerald-600 dark:text-emerald-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    {editingUser ? 'Reset Password (optional)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to retain' : 'Default: lspot1234'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@lspot.zm"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Hardware Biometrics Registration (Thumbprint & Face Recognition) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-purple-400 flex items-center gap-1.5">
                      <Fingerprint className="w-4 h-4 text-purple-400" /> Fast Biometric Credentials (Hardware Sensors)
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Enroll employee thumbprint or facial recognition using device biometric sensor for sub-second POS unlocking.
                    </p>
                  </div>
                  {biometricsHardwareAvailable ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                      Hardware Sensor Ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-500 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      HTTPS / WebAuthn Required
                    </span>
                  )}
                </div>

                {biometricStatusMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      biometricStatusMsg.error
                        ? 'bg-rose-950/80 border border-rose-900 text-rose-300'
                        : 'bg-emerald-950/80 border border-emerald-900 text-emerald-300'
                    }`}
                  >
                    {biometricStatusMsg.error ? (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                    )}
                    <span>{biometricStatusMsg.text}</span>
                  </div>
                )}

                {!editingUser ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Save profile first</p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                      Please save this new staff profile before binding thumbprint or face biometric hardware keys.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Thumbprint Registration Card */}
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                          <Fingerprint className="w-4 h-4 text-emerald-400" />
                          <span>Thumbprint</span>
                        </div>
                        {userBiometrics.some((b) => b.type === 'thumbprint') ? (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Not set</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isRegisteringBiometric !== null}
                          onClick={() => handleRegisterBiometric('thumbprint')}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                          <span>
                            {isRegisteringBiometric === 'thumbprint'
                              ? 'Scanning...'
                              : userBiometrics.some((b) => b.type === 'thumbprint')
                              ? 'Re-scan Thumb'
                              : 'Register Thumb'}
                          </span>
                        </button>
                        {userBiometrics.some((b) => b.type === 'thumbprint') && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBiometric('thumbprint')}
                            className="py-1.5 px-2 bg-slate-800 hover:bg-rose-900 hover:text-white text-slate-400 text-xs rounded-lg transition"
                            title="Remove registered thumbprint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Face Unlock Registration Card */}
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                          <ScanFace className="w-4 h-4 text-purple-400" />
                          <span>Face Recognition</span>
                        </div>
                        {userBiometrics.some((b) => b.type === 'face') ? (
                          <span className="text-[10px] font-bold text-purple-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Not set</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isRegisteringBiometric !== null}
                          onClick={() => handleRegisterBiometric('face')}
                          className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition active:scale-95 flex items-center justify-center gap-1 shadow-sm"
                        >
                          <ScanFace className="w-3.5 h-3.5" />
                          <span>
                            {isRegisteringBiometric === 'face'
                              ? 'Scanning...'
                              : userBiometrics.some((b) => b.type === 'face')
                              ? 'Re-scan Face'
                              : 'Register Face'}
                          </span>
                        </button>
                        {userBiometrics.some((b) => b.type === 'face') && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBiometric('face')}
                            className="py-1.5 px-2 bg-slate-800 hover:bg-rose-900 hover:text-white text-slate-400 text-xs rounded-lg transition"
                            title="Remove registered face"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Role Permissions & Operational Rights - Interactive Customization */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-amber-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-500" /> User Operating Privileges & Permissions
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Tap any switch below to grant or revoke specific operational capabilities for this user
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomRights(getRoleDefaultRights(role))}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                    title="Reset to role matrix defaults"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'canVoidSale', label: 'Void Sales & Cancel Line Items', desc: 'Allows cashier or manager to void placed orders' },
                    { key: 'canGiveDiscount', label: 'Give Discounts & Price Overrides', desc: 'Can apply promotional discounts to cart' },
                    { key: 'canIssueCredit', label: 'Issue Customer Credit (AR)', desc: 'Can charge sales to corporate credit accounts' },
                    { key: 'canDeleteRecord', label: 'Archive & Delete System Records', desc: 'Permission to soft-delete data' },
                    { key: 'canAuditStock', label: 'Perform Stock Counts & Wastage', desc: 'Access to inventory counts and write-offs' },
                    { key: 'canEditMenu', label: 'Edit Menu Dishes & Prices', desc: 'Can update recipe costs and selling prices' },
                    { key: 'canManageUsers', label: 'User Admin & Supervisor Roles', desc: 'Can create staff accounts and assign PINs' }
                  ].map((perm) => {
                    const isAllowed = (customRights as any)[perm.key];
                    return (
                      <div
                        key={perm.key}
                        onClick={() =>
                          setCustomRights((prev) => ({
                            ...prev,
                            [perm.key]: !(prev as any)[perm.key]
                          }))
                        }
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition select-none ${
                          isAllowed
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex-1 pr-1">
                          <span className="font-bold text-[11px] block leading-snug">{perm.label}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 line-clamp-1">{perm.desc}</span>
                        </div>
                        <button
                          type="button"
                          className={`text-xl shrink-0 transition ${isAllowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}
                        >
                          {isAllowed ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                />
                <label htmlFor="activeCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account is active and authorized for POS terminal access
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              {editingUser && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(editingUser)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>Delete User</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
              >
                {editingUser ? 'Update Staff Member' : 'Save New Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Override Tester Modal */}
      {showOverrideTester && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-extrabold text-lg text-white">Supervisor Override</h3>
              <p className="text-xs text-slate-400 mt-1">Enter Manager or Owner PIN to verify authorization</p>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                maxLength={6}
                value={testPin}
                onChange={(e) => setTestPin(e.target.value)}
                placeholder="Enter 4-digit PIN"
                className="w-full text-center text-2xl font-mono font-black tracking-widest bg-slate-950 border border-slate-800 rounded-2xl py-3 focus:outline-none focus:border-amber-500 text-amber-400"
              />

              {overrideResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    overrideResult.success
                      ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                  }`}
                >
                  {overrideResult.success ? (
                    <div className="space-y-1">
                      <p className="flex items-center justify-center gap-1.5 font-bold">
                        <Check className="w-4 h-4 text-emerald-400" /> Override Approved!
                      </p>
                      <p className="text-slate-300">
                        Authorized By: <strong>{overrideResult.supervisor.fullName}</strong> ({overrideResult.supervisor.role})
                      </p>
                    </div>
                  ) : (
                    <p>{overrideResult.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideTester(false);
                  setTestPin('');
                  setOverrideResult(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleTestSupervisorOverride}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md"
              >
                Verify PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
