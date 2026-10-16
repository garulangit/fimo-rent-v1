import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

export const ROLE_PERMISSIONS = Object.freeze({
  superadmin: ['*'],
  admin: [
    'dashboard.view', 'masterBus.view', 'masterBus.edit',
    'branding.view', 'branding.create', 'branding.edit', 'branding.import',
    'booking.view', 'booking.create', 'booking.edit',
    'revenue.view', 'administration.view', 'administration.upload',
    'surat.view', 'surat.create',
    'pricelist.view', 'pricelist.edit', 'masterData.view', 'masterData.edit',
    'users.view',
  ],
  operator: [
    'dashboard.view', 'masterBus.view',
    'branding.view', 'branding.create', 'branding.edit', 'branding.import',
    'booking.view', 'booking.create', 'booking.edit', 'revenue.view',
    'administration.view', 'administration.upload',
    'surat.view', 'surat.create',
  ],
  viewer: [
    'dashboard.view', 'masterBus.view', 'branding.view', 'booking.view',
    'revenue.view', 'administration.view', 'surat.view',
  ],
});

export function getRolePermissions(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

let accessContext = {
  uid: '',
  role: 'viewer',
  active: false,
  permissions: [],
  status: 'uninitialized',
};

export async function loadAccessContext(db, user) {
  accessContext = {
    uid: user.uid,
    role: 'viewer',
    active: false,
    permissions: [],
    status: 'loading',
  };
  if (typeof window !== 'undefined') {
    window.__accessContext = accessContext;
    window.can = can;
  }

  const snapshot = await getDoc(doc(db, 'userRoles', user.uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  const roles = Object.keys(ROLE_PERMISSIONS);
  const validRole = roles.includes(data.role);
  const validActiveState = data.active === undefined || data.active === true;
  let status = 'active';
  if (!snapshot.exists()) {
    status = 'missing-role';
  } else if (!validRole) {
    status = 'invalid-role';
  } else if (data.active === false) {
    status = 'inactive';
  } else if (!validActiveState) {
    status = 'invalid-status';
  }

  accessContext = {
    uid: user.uid,
    role: validRole ? data.role : 'viewer',
    active: status === 'active',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    status,
  };
  if (typeof window !== 'undefined') {
    window.__accessContext = accessContext;
    window.can = can;
  }
  return accessContext;
}

export function clearAccessContext() {
  accessContext = {
    uid: '',
    role: 'viewer',
    active: false,
    permissions: [],
    status: 'uninitialized',
  };
  if (typeof window !== 'undefined') {
    window.__accessContext = accessContext;
    window.can = can;
  }
}

export function can(permission) {
  if (!accessContext.active) return false;
  const permissions = ROLE_PERMISSIONS[accessContext.role] || [];
  return permissions.includes('*')
    || permissions.includes(permission)
    || accessContext.permissions.includes(permission);
}

export function getAccessContext() {
  return accessContext;
}
