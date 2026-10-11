import { SystemData, SalesRecord, SalespersonRole } from '../types';

function getAuthRoleHeader(): Record<string, string> {
  const role = sessionStorage.getItem('auth_role') || 'manager';
  return { 'x-auth-role': role };
}

/**
 * Fetch authoritative SystemData from server with aggressive anti-cache parameters
 */
export async function apiFetchData(): Promise<SystemData> {
  const res = await fetch(`/api/data?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
  if (!res.ok) throw new Error('获取数据失败');
  return res.json();
}

/**
 * Import newly uploaded Excel records atomically into the server database
 */
export async function apiImportData(
  month: string,
  fileName: string,
  records: SalesRecord[]
): Promise<SystemData> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRoleHeader(),
    },
    body: JSON.stringify({ month, fileName, records }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '导入失败');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Delete an import batch and all its records atomically on the server
 */
export async function apiDeleteBatch(batchId: string): Promise<SystemData> {
  const res = await fetch(`/api/batches/${encodeURIComponent(batchId)}`, {
    method: 'DELETE',
    headers: getAuthRoleHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '删除批次失败');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Update a single sales record atomically on the server
 */
export async function apiUpdateRecord(record: SalesRecord): Promise<SystemData> {
  const res = await fetch(`/api/records/${encodeURIComponent(record.id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRoleHeader(),
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新销售记录失败');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Delete a single sales record atomically on the server
 */
export async function apiDeleteRecord(recordId: string): Promise<SystemData> {
  const res = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: getAuthRoleHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '删除销售记录失败');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Update salesperson configuration (role, custom rate, other amount) on the server
 */
export async function apiUpdateConfig(params: {
  salesperson: string;
  role?: SalespersonRole;
  month?: string;
  otherAmount?: number;
  customNewRate?: number | null;
}): Promise<SystemData> {
  const res = await fetch('/api/salesperson-config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRoleHeader(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '更新配置失败');
  }
  const json = await res.json();
  return json.data;
}

/**
 * Update admin master password on the server
 */
export async function apiSetPassword(passwordHash: string): Promise<SystemData> {
  const res = await fetch('/api/auth/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRoleHeader(),
    },
    body: JSON.stringify({ passwordHash }),
  });
  if (!res.ok) throw new Error('设置密码失败');
  const json = await res.json();
  return json.data;
}

/**
 * Update visitor browsing password on the server
 */
export async function apiSetViewPassword(
  viewPasswordHash: string,
  enabled: boolean = true
): Promise<SystemData> {
  const res = await fetch('/api/auth/view-password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthRoleHeader(),
    },
    body: JSON.stringify({ viewPasswordHash, enabled }),
  });
  if (!res.ok) throw new Error('设置浏览密码失败');
  const json = await res.json();
  return json.data;
}

/**
 * Reset and clear all data on the server
 */
export async function apiResetData(): Promise<SystemData> {
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: getAuthRoleHeader(),
  });
  if (!res.ok) throw new Error('重置数据失败');
  const json = await res.json();
  return json.data;
}
