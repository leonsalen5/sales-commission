import * as XLSX from 'xlsx';
import { SystemData, ImportBatch, SalesRecord, SalespersonRole, SalespersonConfig } from '../types';

const LOCAL_STORAGE_KEY = 'TRAINING_SCHOOL_COMMISSION_DATA_V1';

/**
 * 格式化时间精确到秒 (YYYY-MM-DD HH:mm:ss)
 */
export function formatTimestampToSeconds(ts?: number | string | Date): string {
  const d = ts ? new Date(ts) : new Date();
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取当前Unix秒数时间戳
 */
export function getCurrentTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 智能合并两个 SystemData 数据集（本地与服务器冲突时供管理员选择）
 */
export function mergeSystemDatasets(localData: SystemData, serverData: SystemData): SystemData {
  // 1. 合并批次（以 batch.id 为键，避免重复）
  const batchMap = new Map<string, ImportBatch>();
  (serverData.batches || []).forEach((b) => batchMap.set(b.id, b));
  (localData.batches || []).forEach((b) => {
    if (!batchMap.has(b.id)) {
      batchMap.set(b.id, b);
    }
  });
  const mergedBatches = Array.from(batchMap.values()).sort((a, b) => {
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });

  // 2. 合并销售记录（以 record.id 为键，去重）
  const recordMap = new Map<string, SalesRecord>();
  (serverData.records || []).forEach((r) => recordMap.set(r.id, r));
  (localData.records || []).forEach((r) => {
    if (!recordMap.has(r.id)) {
      recordMap.set(r.id, r);
    }
  });
  const mergedRecords = Array.from(recordMap.values());

  // 3. 合并人员配置
  const mergedConfigs: Record<string, SalespersonConfig> = {
    ...(serverData.configs || {}),
  };
  Object.entries(localData.configs || {}).forEach(([sp, localCfg]) => {
    if (!mergedConfigs[sp]) {
      mergedConfigs[sp] = localCfg;
    } else {
      mergedConfigs[sp] = {
        ...mergedConfigs[sp],
        role: localCfg.role || mergedConfigs[sp].role,
        customNewRate: localCfg.customNewRate !== undefined ? localCfg.customNewRate : mergedConfigs[sp].customNewRate,
        otherAmountByMonth: {
          ...(mergedConfigs[sp].otherAmountByMonth || {}),
          ...(localCfg.otherAmountByMonth || {}),
        },
      };
    }
  });

  const nowFormatted = formatTimestampToSeconds();
  const nowTs = getCurrentTimestampSeconds();

  const mergedData: SystemData = {
    batches: mergedBatches,
    records: mergedRecords,
    configs: mergedConfigs,
    passwordHash: serverData.passwordHash || localData.passwordHash,
    viewPasswordHash: serverData.viewPasswordHash || localData.viewPasswordHash,
    viewPasswordEnabled: serverData.viewPasswordEnabled !== undefined ? serverData.viewPasswordEnabled : localData.viewPasswordEnabled,
    updatedAt: new Date().toISOString(),
    lastImportTime: nowFormatted,
    lastImportTimestamp: nowTs,
  };

  saveLocalSystemData(mergedData);
  return mergedData;
}

export const EMPTY_SYSTEM_DATA: SystemData = {
  batches: [],
  records: [],
  configs: {},
  viewPasswordEnabled: true,
};

export function getLocalSystemData(): SystemData {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.batches) && Array.isArray(parsed.records)) {
        return parsed as SystemData;
      }
    }
  } catch (err) {
    console.error('Failed to read from localStorage:', err);
  }
  return EMPTY_SYSTEM_DATA;
}

export function saveLocalSystemData(data: SystemData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Client-side Excel Template Generator
export function generateAndDownloadSampleExcel() {
  const sampleRows = [
    {
      日期: '2026/7/1',
      收入: '张小明',
      项目: '少儿美术',
      类型: '新',
      金额: 3800,
      销售人: '王顾问',
      老师: '李老师',
      备注: '标准年卡课程',
    },
    {
      日期: '2026/7/2',
      收入: '李思思',
      项目: '硬笔书法',
      类型: '新',
      金额: 4500,
      销售人: '王顾问',
      老师: '陈老师',
      备注: '暑期班+硬笔套装',
    },
    {
      日期: '2026/7/3',
      收入: '赵雷',
      项目: '少儿英语',
      类型: '续',
      金额: 8000,
      销售人: '王顾问',
      老师: '张老师',
      备注: '续费两年套餐',
    },
    {
      日期: '2026/7/5',
      收入: '孙悟空',
      项目: '夏令营集训',
      类型: '集训',
      金额: 6800,
      销售人: '王顾问',
      老师: '李老师',
      备注: '7天闭环特训',
    },
    {
      日期: '2026/7/6',
      收入: '钱七',
      项目: '少儿美术',
      类型: '新',
      金额: 12000,
      销售人: '王顾问',
      老师: '李老师',
      备注: '三年VIP班',
    },
    {
      日期: '2026/7/10',
      收入: '吴九',
      项目: '硬笔书法',
      类型: '续',
      金额: 45000,
      销售人: '王顾问',
      老师: '陈老师',
      备注: '老学员高额续费',
    },
    {
      日期: '2026/7/12',
      收入: '郑十',
      项目: '少儿美术',
      类型: '续',
      金额: 10000,
      销售人: '王顾问',
      老师: '',
      备注: '无指定老师续费',
    },
    {
      日期: '2026/7/15',
      收入: '林一',
      项目: '少儿英语',
      类型: '新',
      金额: 22000,
      销售人: '张顾问',
      老师: '张老师',
      备注: '非自主招生顾问招收',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, '销售记录');

  XLSX.writeFile(wb, '培训学校销售记录模板.xlsx');
}

// Local Import Handler
export function processLocalImport(
  month: string,
  fileName: string,
  records: SalesRecord[],
  baseDataParam?: SystemData
): SystemData {
  const currentData = baseDataParam || getLocalSystemData();
  const batchId = `batch_${Date.now()}`;
  
  // If the existing data only has the demo sample batch, remove sample batch and records
  const isOnlySample = currentData.batches.length === 1 && currentData.batches[0].id.startsWith('sample_');
  const existingBatches = isOnlySample ? [] : currentData.batches;
  const existingRecords = isOnlySample ? [] : currentData.records;

  // Collect all distinct months from records
  const monthsInRecords = Array.from(new Set(records.map((r) => r.month))).filter(Boolean);
  const isMultiMonth = monthsInRecords.length > 1;

  const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
  const nowFormatted = formatTimestampToSeconds();
  const nowTs = getCurrentTimestampSeconds();

  const newBatches: ImportBatch[] = [];
  if (isMultiMonth) {
    monthsInRecords.forEach((m, idx) => {
      const recsInMonth = records.filter((r) => r.month === m);
      newBatches.push({
        id: `${batchId}_m_${idx + 1}`,
        month: m,
        fileName: fileName ? `${fileName} (${m})` : `销售记录_${m}.xlsx`,
        uploadedAt: nowFormatted,
        uploadedTimestamp: nowTs,
        recordCount: recsInMonth.length,
        totalAmount: recsInMonth.reduce((s, r) => s + (r.amount || 0), 0),
      });
    });
  } else {
    const targetMonth = month || records[0]?.month || '2026-07';
    newBatches.push({
      id: batchId,
      month: targetMonth,
      fileName: fileName || `销售记录_${targetMonth}.xlsx`,
      uploadedAt: nowFormatted,
      uploadedTimestamp: nowTs,
      recordCount: records.length,
      totalAmount,
    });
  }

  const formattedRecords: SalesRecord[] = records.map((r, idx) => {
    const rMonth = r.month || month || '2026-07';
    const rBatchId = isMultiMonth
      ? `${batchId}_m_${Math.max(0, monthsInRecords.indexOf(rMonth)) + 1}`
      : batchId;
    return {
      id: `${batchId}_${idx + 1}`,
      batchId: rBatchId,
      month: rMonth,
      date: r.date || `${rMonth}/1`,
      incomeName: r.incomeName || '未名学生',
      project: r.project || '通用课程',
      type: r.type || '新',
      amount: r.amount || 0,
      salesperson: r.salesperson || '未名销售',
      teacher: r.teacher || '',
      notes: r.notes || '',
      customSalesCommissionRate: r.customSalesCommissionRate,
      customTeacherCommissionRate: r.customTeacherCommissionRate,
    };
  });

  // Maintain sales configs
  formattedRecords.forEach((r) => {
    const sp = r.salesperson?.trim();
    if (sp && !currentData.configs[sp]) {
      currentData.configs[sp] = {
        salesperson: sp,
        role: '普通课程顾问',
        otherAmountByMonth: {},
      };
    }
  });

  const updatedData: SystemData = {
    ...currentData,
    batches: [...newBatches, ...existingBatches],
    records: [...formattedRecords, ...existingRecords],
    configs: { ...currentData.configs },
    updatedAt: new Date().toISOString(),
    lastImportTime: nowFormatted,
    lastImportTimestamp: nowTs,
  };

  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Delete Batch
export function processLocalDeleteBatch(
  batchId: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    batches: baseData.batches.filter((b) => b.id !== batchId),
    records: baseData.records.filter((r) => r.batchId !== batchId),
    configs: { ...baseData.configs },
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Update Record
export function processLocalUpdateRecord(
  updatedRecord: SalesRecord,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedRecords = baseData.records.map((r) =>
    r.id === updatedRecord.id ? updatedRecord : r
  );
  const updatedData: SystemData = {
    ...baseData,
    records: updatedRecords,
  };

  // Ensure salesperson config exists
  const sp = updatedRecord.salesperson?.trim();
  if (sp && !updatedData.configs[sp]) {
    updatedData.configs[sp] = {
      salesperson: sp,
      role: '普通课程顾问',
      otherAmountByMonth: {},
    };
  }

  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Delete Record
export function processLocalDeleteRecord(
  recordId: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedRecords = baseData.records.filter((r) => r.id !== recordId);
  const updatedData: SystemData = {
    ...baseData,
    records: updatedRecords,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Update Config
export function processLocalUpdateConfig(
  salesperson: string,
  role?: SalespersonRole,
  month?: string,
  otherAmount?: number,
  customNewRate?: number | null,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const configs = { ...baseData.configs };

  if (!configs[salesperson]) {
    configs[salesperson] = {
      salesperson,
      role: role || '普通课程顾问',
      otherAmountByMonth: {},
    };
  } else {
    configs[salesperson] = { ...configs[salesperson] };
  }

  if (role) {
    configs[salesperson].role = role;
  }

  if (customNewRate === null) {
    delete configs[salesperson].customNewRate;
  } else if (typeof customNewRate === 'number' && !isNaN(customNewRate)) {
    configs[salesperson].customNewRate = customNewRate;
  }

  if (month && typeof otherAmount === 'number') {
    if (!configs[salesperson].otherAmountByMonth) {
      configs[salesperson].otherAmountByMonth = {};
    }
    configs[salesperson].otherAmountByMonth = {
      ...configs[salesperson].otherAmountByMonth,
      [month]: otherAmount,
    };
  }

  const updatedData: SystemData = {
    ...baseData,
    configs,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Set / Update Admin Password
export function processLocalSetPassword(
  passwordHash: string,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    passwordHash,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Set / Update View Password
export function processLocalSetViewPassword(
  viewPasswordHash: string,
  enabled: boolean = true,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    viewPasswordHash,
    viewPasswordEnabled: enabled,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Toggle View Password Protection
export function processLocalToggleViewPassword(
  enabled: boolean,
  currentData?: SystemData
): SystemData {
  const baseData = currentData || getLocalSystemData();
  const updatedData: SystemData = {
    ...baseData,
    viewPasswordEnabled: enabled,
  };
  saveLocalSystemData(updatedData);
  return updatedData;
}

// Local Reset Data
export function processLocalResetData(currentData?: SystemData): SystemData {
  const baseData = currentData || getLocalSystemData();
  const emptyData: SystemData = {
    batches: [],
    records: [],
    configs: {},
    passwordHash: baseData.passwordHash,
    viewPasswordHash: baseData.viewPasswordHash,
    viewPasswordEnabled: baseData.viewPasswordEnabled,
  };
  saveLocalSystemData(emptyData);
  return emptyData;
}
