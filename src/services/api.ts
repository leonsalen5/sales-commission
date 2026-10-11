import { SystemData, SalesRecord, SalespersonRole } from '../types';
import {
  fetchAuthoritativeData,
  firestoreImportData,
  firestoreDeleteBatch,
  firestoreUpdateRecord,
  firestoreDeleteRecord,
  firestoreUpdateConfig,
  firestoreSetPassword,
  firestoreSetViewPassword,
  firestoreResetData,
} from '../utils/firebaseStorage';

function getAuthRoleHeader(): Record<string, string> {
  const role = sessionStorage.getItem('auth_role') || 'manager';
  return { 'x-auth-role': role };
}

function isStaticHosting(): boolean {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host.includes('github.io') || host.includes('pages.dev');
  }
  return false;
}

/**
 * Fetch authoritative SystemData from server or direct Firestore
 */
export async function apiFetchData(): Promise<SystemData> {
  const data = await fetchAuthoritativeData();
  if (!data) throw new Error('无法连接到服务器或云端数据库');
  return data;
}

/**
 * Import newly uploaded Excel records atomically.
 * Tries server /api/import if available; seamlessly falls back to Firestore atomic transaction on static host (e.g. GitHub Pages).
 */
export async function apiImportData(
  month: string,
  fileName: string,
  records: SalesRecord[]
): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const role = sessionStorage.getItem('auth_role') || 'manager';
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-role': role === 'view' ? 'manager' : role,
        },
        body: JSON.stringify({ month, fileName, records }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      // If 404 or 405 (static server like GitHub Pages), fallback to Firestore transaction
      if (res.status === 404 || res.status === 405) {
        return await firestoreImportData(month, fileName, records);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `导入数据失败 (HTTP ${res.status})`);
    } catch (err: any) {
      if (err.message && !err.message.includes('HTTP')) {
        // Network fetch error, fallback to direct Firestore
        return await firestoreImportData(month, fileName, records);
      }
      throw err;
    }
  }

  // Running on GitHub Pages
  return await firestoreImportData(month, fileName, records);
}

/**
 * Delete an import batch and all its records atomically
 */
export async function apiDeleteBatch(batchId: string): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}`, {
        method: 'DELETE',
        headers: getAuthRoleHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreDeleteBatch(batchId);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '删除批次失败');
    } catch (err: any) {
      if (err.message && !err.message.includes('HTTP')) {
        return await firestoreDeleteBatch(batchId);
      }
      throw err;
    }
  }

  return await firestoreDeleteBatch(batchId);
}

/**
 * Update a single sales record atomically
 */
export async function apiUpdateRecord(record: SalesRecord): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(record.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthRoleHeader(),
        },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreUpdateRecord(record);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '更新销售记录失败');
    } catch (err: any) {
      if (err.message && !err.message.includes('HTTP')) {
        return await firestoreUpdateRecord(record);
      }
      throw err;
    }
  }

  return await firestoreUpdateRecord(record);
}

/**
 * Delete a single sales record atomically
 */
export async function apiDeleteRecord(recordId: string): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
        headers: getAuthRoleHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreDeleteRecord(recordId);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '删除销售记录失败');
    } catch (err: any) {
      if (err.message && !err.message.includes('HTTP')) {
        return await firestoreDeleteRecord(recordId);
      }
      throw err;
    }
  }

  return await firestoreDeleteRecord(recordId);
}

/**
 * Update salesperson configuration atomically
 */
export async function apiUpdateConfig(params: {
  salesperson: string;
  role?: SalespersonRole;
  month?: string;
  otherAmount?: number;
  customNewRate?: number | null;
}): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch('/api/salesperson-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthRoleHeader(),
        },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreUpdateConfig(params);
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '更新配置失败');
    } catch (err: any) {
      if (err.message && !err.message.includes('HTTP')) {
        return await firestoreUpdateConfig(params);
      }
      throw err;
    }
  }

  return await firestoreUpdateConfig(params);
}

/**
 * Update admin master password atomically
 */
export async function apiSetPassword(passwordHash: string): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthRoleHeader(),
        },
        body: JSON.stringify({ passwordHash }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreSetPassword(passwordHash);
      }
    } catch (err) {
      return await firestoreSetPassword(passwordHash);
    }
  }

  return await firestoreSetPassword(passwordHash);
}

/**
 * Update visitor browsing password atomically
 */
export async function apiSetViewPassword(
  viewPasswordHash: string,
  enabled: boolean = true
): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch('/api/auth/view-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthRoleHeader(),
        },
        body: JSON.stringify({ viewPasswordHash, enabled }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreSetViewPassword(viewPasswordHash, enabled);
      }
    } catch (err) {
      return await firestoreSetViewPassword(viewPasswordHash, enabled);
    }
  }

  return await firestoreSetViewPassword(viewPasswordHash, enabled);
}

/**
 * Reset and clear all data atomically
 */
export async function apiResetData(): Promise<SystemData> {
  if (!isStaticHosting()) {
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: getAuthRoleHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
      if (res.status === 404 || res.status === 405) {
        return await firestoreResetData();
      }
    } catch (err) {
      return await firestoreResetData();
    }
  }

  return await firestoreResetData();
}
