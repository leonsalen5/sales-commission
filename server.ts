import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { SystemData, ImportBatch, SalesRecord, SalespersonConfig } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Initialize Firestore on Node.js server side
let serverDb: any = null;
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    const serverApp = getApps().length > 0 ? getApp() : initializeApp(config, 'backend_server_app');
    serverDb = initializeFirestore(
      serverApp,
      { experimentalAutoDetectLongPolling: true },
      config.firestoreDatabaseId || undefined
    );
    console.log('Server-side Firestore initialized successfully.');
  } catch (err) {
    console.warn('Failed to initialize server-side Firestore:', err);
  }
}

// Helper for precise timestamps accurate to seconds
function formatTimestampToSeconds(d?: Date | number | string): string {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getNowPrecise() {
  const now = new Date();
  return {
    formatted: formatTimestampToSeconds(now),
    timestamp: Math.floor(now.getTime() / 1000),
    iso: now.toISOString(),
  };
}

// Local disk cache fallback
function getLocalDiskData(): SystemData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const now = getNowPrecise();
      const initial: SystemData = {
        batches: [],
        records: [],
        configs: {},
        passwordHash: '615ed7fb1504b0c724a296d7a69e6c7b2f9ea2c57c1d8206c5afdf392ebdfd25',
        viewPasswordHash: '9800a8677d99e5f6968d7357e44006388b09d3b6a8676d0f930fbaa63d02330d',
        viewPasswordEnabled: true,
        lastImportTime: '',
        lastImportTimestamp: 0,
        updatedAt: now.iso,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as SystemData;

    // Ensure lastImportTime and lastImportTimestamp are populated accurately to seconds
    if (!parsed.lastImportTime && parsed.batches && parsed.batches.length > 0) {
      const sortedBatches = [...parsed.batches].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const latestBatch = sortedBatches[0];
      parsed.lastImportTime = formatTimestampToSeconds(latestBatch.uploadedAt);
      parsed.lastImportTimestamp = Math.floor(new Date(latestBatch.uploadedAt).getTime() / 1000);
    }

    return parsed;
  } catch (err) {
    console.error('Error reading system data from disk:', err);
    return { batches: [], records: [], configs: {}, viewPasswordEnabled: true };
  }
}

function saveLocalDiskData(data: SystemData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving system data to disk:', err);
  }
}

// Authoritative data fetcher (disk cache primary for instant Safari/mobile response, Firestore sync)
async function getSystemDataAsync(): Promise<SystemData> {
  const diskData = getLocalDiskData();

  // If local disk already has populated data, return immediately for instant response (<5ms)
  if (diskData && (diskData.records?.length > 0 || diskData.batches?.length > 0)) {
    return diskData;
  }

  // If disk is empty, attempt to hydrate from Firestore cloud backup
  if (serverDb) {
    try {
      const docRef = doc(serverDb, 'system', 'app_state');
      const snap = await Promise.race([
        getDoc(docRef),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);

      if (snap && snap.exists && snap.exists()) {
        const cloudData = snap.data() as SystemData;
        if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
          if (cloudData.records.length > 0 || cloudData.batches.length > 0) {
            if (!cloudData.lastImportTime && cloudData.batches.length > 0) {
              const latest = [...cloudData.batches].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
              cloudData.lastImportTime = formatTimestampToSeconds(latest.uploadedAt);
              cloudData.lastImportTimestamp = Math.floor(new Date(latest.uploadedAt).getTime() / 1000);
            }
            saveLocalDiskData(cloudData);
            return cloudData;
          }
        }
      }
    } catch (err) {
      // Fallback cleanly to disk data
    }
  }
  return diskData;
}

// Authoritative data saver (writes to disk AND Firestore)
async function saveSystemDataAsync(data: SystemData) {
  saveLocalDiskData(data);
  if (serverDb) {
    try {
      const docRef = doc(serverDb, 'system', 'app_state');
      const sanitizedData: SystemData = {
        batches: data.batches || [],
        records: data.records || [],
        configs: data.configs || {},
        passwordHash: data.passwordHash || '',
        viewPasswordHash: data.viewPasswordHash || '',
        viewPasswordEnabled: data.viewPasswordEnabled !== undefined ? data.viewPasswordEnabled : true,
        updatedAt: data.updatedAt || new Date().toISOString(),
        lastImportTime: data.lastImportTime || '',
        lastImportTimestamp: data.lastImportTimestamp || 0,
      };
      // Fire and forget or background await to prevent hanging HTTP responses
      setDoc(docRef, sanitizedData).catch((err) => {
        console.error('Server Firestore async setDoc failed:', err);
      });
    } catch (err) {
      console.error('Server Firestore write failed:', err);
    }
  }
}

// --- API ROUTES ---

// Middleware or helper to verify role is not browse-only
function checkNotViewRole(req: express.Request, res: express.Response): boolean {
  const role = req.headers['x-auth-role'] || (req.body && req.body.authRole);
  if (role === 'view') {
    res.status(403).json({
      error: '浏览模式下禁止向服务器端同步或修改数据',
      code: 'FORBIDDEN_VIEW_MODE',
    });
    return false;
  }
  return true;
}

// Lightweight server status for fast conflict checks & polling
app.get('/api/status', async (req, res) => {
  try {
    const data = await getSystemDataAsync();
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.json({
      lastImportTime: data.lastImportTime || '',
      lastImportTimestamp: data.lastImportTimestamp || 0,
      updatedAt: data.updatedAt || '',
      batchesCount: data.batches?.length || 0,
      recordsCount: data.records?.length || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: '获取服务器状态失败' });
  }
});

// Sync full system state from authoritative client/cloud
app.post('/api/sync', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;

    const { data: incomingData, force, clientLastImportTimestamp } = req.body;
    if (!incomingData || !Array.isArray(incomingData.batches) || !Array.isArray(incomingData.records)) {
      return res.status(400).json({ error: '无效的数据格式' });
    }

    const currentServerData = await getSystemDataAsync();
    const serverTs = currentServerData.lastImportTimestamp || (currentServerData.lastImportTime ? Math.floor(new Date(currentServerData.lastImportTime).getTime() / 1000) : 0);
    const clientTs = clientLastImportTimestamp || incomingData.lastImportTimestamp || (incomingData.lastImportTime ? Math.floor(new Date(incomingData.lastImportTime).getTime() / 1000) : 0);

    // If server has newer data and this is not a force overwrite from administrator:
    if (!force && serverTs > clientTs && (currentServerData.batches?.length > 0 || currentServerData.records?.length > 0)) {
      return res.status(409).json({
        conflict: true,
        message: '服务器端数据更新，请选择需要保留的数据',
        serverLastImportTime: currentServerData.lastImportTime,
        serverLastImportTimestamp: serverTs,
        serverBatchesCount: currentServerData.batches?.length || 0,
        serverRecordsCount: currentServerData.records?.length || 0,
        serverData: currentServerData,
      });
    }

    const now = getNowPrecise();
    const finalData: SystemData = {
      ...incomingData,
      lastImportTime: incomingData.lastImportTime || now.formatted,
      lastImportTimestamp: incomingData.lastImportTimestamp || now.timestamp,
      updatedAt: now.iso,
    };

    await saveSystemDataAsync(finalData);
    return res.json({
      success: true,
      data: finalData,
      lastImportTime: finalData.lastImportTime,
      lastImportTimestamp: finalData.lastImportTimestamp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '同步数据失败' });
  }
});

// Get all system data with no-cache headers for Safari / iOS compatibility
app.get('/api/data', async (req, res) => {
  try {
    const data = await getSystemDataAsync();
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: '获取数据失败' });
  }
});

// Import batch & records with server timestamp recorded to seconds
app.post('/api/import', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;

    const { month, fileName, records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: '没有包含有效的销售记录' });
    }

    const data = await getSystemDataAsync();
    const batchId = `batch_${Date.now()}`;
    const now = getNowPrecise();
    
    // Collect all distinct months from records
    const monthsInRecords = Array.from(new Set(records.map((r: any) => r.month))).filter(Boolean);
    const isMultiMonth = monthsInRecords.length > 1;

    const totalAmount = records.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);

    const newBatches: ImportBatch[] = [];
    if (isMultiMonth) {
      monthsInRecords.forEach((m: any, idx: number) => {
        const recsInMonth = records.filter((r: any) => r.month === m);
        newBatches.push({
          id: `${batchId}_m_${idx + 1}`,
          month: m,
          fileName: fileName ? `${fileName} (${m})` : `销售记录_${m}.xlsx`,
          uploadedAt: now.formatted,
          uploadedTimestamp: now.timestamp,
          recordCount: recsInMonth.length,
          totalAmount: recsInMonth.reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0),
        });
      });
    } else {
      const targetMonth = month || records[0]?.month || '2026-07';
      newBatches.push({
        id: batchId,
        month: targetMonth,
        fileName: fileName || `销售记录_${targetMonth}.xlsx`,
        uploadedAt: now.formatted,
        uploadedTimestamp: now.timestamp,
        recordCount: records.length,
        totalAmount,
      });
    }

    const formattedRecords: SalesRecord[] = records.map((r: any, idx: number) => {
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
        amount: parseFloat(r.amount) || 0,
        salesperson: r.salesperson || '未名销售',
        teacher: r.teacher || '',
        notes: r.notes || '',
      };
    });

    // Check if salesperson exists in config, if not set default role
    formattedRecords.forEach((r) => {
      const sp = r.salesperson?.trim();
      if (sp && !data.configs[sp]) {
        data.configs[sp] = {
          salesperson: sp,
          role: '普通课程顾问',
          otherAmountByMonth: {},
        };
      }
    });

    data.batches.unshift(...newBatches);
    data.records.unshift(...formattedRecords);
    data.lastImportTime = now.formatted;
    data.lastImportTimestamp = now.timestamp;
    data.updatedAt = now.iso;

    await saveSystemDataAsync(data);

    res.json({
      success: true,
      count: formattedRecords.length,
      data,
      lastImportTime: now.formatted,
      lastImportTimestamp: now.timestamp,
    });
  } catch (err: any) {
    console.error('Import API error:', err);
    res.status(500).json({ error: err.message || '导入数据失败' });
  }
});

// Delete specific import batch
app.delete('/api/batches/:batchId', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { batchId } = req.params;
    const data = await getSystemDataAsync();

    data.batches = data.batches.filter((b) => b.id !== batchId);
    data.records = data.records.filter((r) => r.batchId !== batchId);
    data.updatedAt = new Date().toISOString();

    await saveSystemDataAsync(data);
    res.json({ success: true, batchId, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '删除导入失败' });
  }
});

// Update Single Record
app.put('/api/records/:recordId', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { recordId } = req.params;
    const updatedFields = req.body;
    const data = await getSystemDataAsync();

    const idx = data.records.findIndex((r) => r.id === recordId);
    if (idx !== -1) {
      data.records[idx] = {
        ...data.records[idx],
        ...updatedFields,
        amount: typeof updatedFields.amount === 'number' ? updatedFields.amount : parseFloat(updatedFields.amount) || data.records[idx].amount,
      };

      // Ensure salesperson config exists if salesperson changed
      const sp = data.records[idx].salesperson?.trim();
      if (sp && !data.configs[sp]) {
        data.configs[sp] = {
          salesperson: sp,
          role: '普通课程顾问',
          otherAmountByMonth: {},
        };
      }

      data.updatedAt = new Date().toISOString();
      await saveSystemDataAsync(data);
      return res.json({ success: true, record: data.records[idx], data });
    } else {
      return res.status(404).json({ error: '未找到指定销售记录' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || '更新销售记录失败' });
  }
});

// Delete Single Record
app.delete('/api/records/:recordId', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { recordId } = req.params;
    const data = await getSystemDataAsync();

    const initialLength = data.records.length;
    data.records = data.records.filter((r) => r.id !== recordId);

    if (data.records.length < initialLength) {
      data.updatedAt = new Date().toISOString();
      await saveSystemDataAsync(data);
      return res.json({ success: true, recordId, data });
    } else {
      return res.status(404).json({ error: '未找到指定销售记录' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || '删除销售记录失败' });
  }
});

// Update Salesperson Config (Role, Custom New Rate, and Other Amount)
app.put('/api/salesperson-config', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { salesperson, role, month, otherAmount, customNewRate } = req.body;
    if (!salesperson) {
      return res.status(400).json({ error: '销售人姓名不能为空' });
    }

    const data = await getSystemDataAsync();
    if (!data.configs[salesperson]) {
      data.configs[salesperson] = {
        salesperson,
        role: role || '普通课程顾问',
        otherAmountByMonth: {},
      };
    }

    if (role) {
      data.configs[salesperson].role = role;
    }

    if (customNewRate === null) {
      delete data.configs[salesperson].customNewRate;
    } else if (typeof customNewRate === 'number' && !isNaN(customNewRate)) {
      data.configs[salesperson].customNewRate = customNewRate;
    }

    if (month && typeof otherAmount === 'number') {
      if (!data.configs[salesperson].otherAmountByMonth) {
        data.configs[salesperson].otherAmountByMonth = {};
      }
      data.configs[salesperson].otherAmountByMonth![month] = otherAmount;
    }

    data.updatedAt = new Date().toISOString();
    await saveSystemDataAsync(data);
    res.json({ success: true, config: data.configs[salesperson], data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '更新配置失败' });
  }
});

// Update / Set Admin Password
app.put('/api/auth/password', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { passwordHash } = req.body;
    if (!passwordHash) {
      return res.status(400).json({ error: '密码哈希不能为空' });
    }
    const data = await getSystemDataAsync();
    data.passwordHash = passwordHash;
    data.updatedAt = new Date().toISOString();
    await saveSystemDataAsync(data);
    res.json({ success: true, passwordHash, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '设置密码失败' });
  }
});

// Update / Set View Password
app.put('/api/auth/view-password', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const { viewPasswordHash, enabled } = req.body;
    if (!viewPasswordHash) {
      return res.status(400).json({ error: '浏览密码哈希不能为空' });
    }
    const data = await getSystemDataAsync();
    data.viewPasswordHash = viewPasswordHash;
    data.viewPasswordEnabled = enabled !== undefined ? enabled : true;
    data.updatedAt = new Date().toISOString();
    await saveSystemDataAsync(data);
    res.json({ success: true, viewPasswordHash, enabled: data.viewPasswordEnabled, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '设置浏览密码失败' });
  }
});

// Reset / Clear All Data
app.post('/api/reset', async (req, res) => {
  try {
    if (!checkNotViewRole(req, res)) return;
    const current = await getSystemDataAsync();
    const emptyData: SystemData = {
      batches: [],
      records: [],
      configs: {},
      passwordHash: current.passwordHash,
      viewPasswordHash: current.viewPasswordHash,
      viewPasswordEnabled: current.viewPasswordEnabled,
      lastImportTime: '',
      lastImportTimestamp: 0,
      updatedAt: new Date().toISOString(),
    };
    await saveSystemDataAsync(emptyData);
    res.json({ success: true, data: emptyData });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '重置数据失败' });
  }
});

// Download Sample Excel Template
app.get('/api/sample-excel', (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
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

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, '销售记录');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="培训学校销售记录模板.xlsx"');
    res.send(buf);
  } catch (err: any) {
    res.status(500).send('生成模板文件失败');
  }
});

// START SERVER / VITE MIDDLEWARE
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
