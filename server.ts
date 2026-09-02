import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import { SystemData, ImportBatch, SalesRecord, SalespersonConfig } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data folder and db file exist
function getSystemData(): SystemData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: SystemData = {
        batches: [],
        records: [],
        configs: {},
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content) as SystemData;
  } catch (err) {
    console.error('Error reading system data:', err);
    return { batches: [], records: [], configs: {} };
  }
}

function saveSystemData(data: SystemData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving system data:', err);
  }
}

// --- API ROUTES ---

// Sync full system state from authoritative client/cloud
app.post('/api/sync', (req, res) => {
  try {
    const { data } = req.body;
    if (data && Array.isArray(data.batches) && Array.isArray(data.records)) {
      saveSystemData(data);
      return res.json({ success: true, data });
    }
    return res.status(400).json({ error: '无效的数据格式' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '同步数据失败' });
  }
});

// Get all system data
app.get('/api/data', (req, res) => {
  const data = getSystemData();
  res.json(data);
});

// Import batch & records
app.post('/api/import', (req, res) => {
  try {
    const { month, fileName, records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: '没有包含有效的销售记录' });
    }

    const data = getSystemData();
    const batchId = `batch_${Date.now()}`;
    
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
          uploadedAt: new Date().toISOString(),
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
        uploadedAt: new Date().toISOString(),
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
    saveSystemData(data);

    res.json({ success: true, count: formattedRecords.length, data });
  } catch (err: any) {
    console.error('Import API error:', err);
    res.status(500).json({ error: err.message || '导入数据失败' });
  }
});

// Delete specific import batch
app.delete('/api/batches/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const data = getSystemData();

    data.batches = data.batches.filter((b) => b.id !== batchId);
    data.records = data.records.filter((r) => r.batchId !== batchId);

    saveSystemData(data);
    res.json({ success: true, batchId, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '删除导入失败' });
  }
});

// Update Single Record
app.put('/api/records/:recordId', (req, res) => {
  try {
    const { recordId } = req.params;
    const updatedFields = req.body;
    const data = getSystemData();

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

      saveSystemData(data);
      return res.json({ success: true, record: data.records[idx], data });
    } else {
      return res.status(404).json({ error: '未找到指定销售记录' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || '更新销售记录失败' });
  }
});

// Delete Single Record
app.delete('/api/records/:recordId', (req, res) => {
  try {
    const { recordId } = req.params;
    const data = getSystemData();

    const initialLength = data.records.length;
    data.records = data.records.filter((r) => r.id !== recordId);

    if (data.records.length < initialLength) {
      saveSystemData(data);
      return res.json({ success: true, recordId, data });
    } else {
      return res.status(404).json({ error: '未找到指定销售记录' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || '删除销售记录失败' });
  }
});

// Update Salesperson Config (Role, Custom New Rate, and Other Amount)
app.put('/api/salesperson-config', (req, res) => {
  try {
    const { salesperson, role, month, otherAmount, customNewRate } = req.body;
    if (!salesperson) {
      return res.status(400).json({ error: '销售人姓名不能为空' });
    }

    const data = getSystemData();
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

    saveSystemData(data);
    res.json({ success: true, config: data.configs[salesperson], data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '更新配置失败' });
  }
});

// Update / Set Admin Password
app.put('/api/auth/password', (req, res) => {
  try {
    const { passwordHash } = req.body;
    if (!passwordHash) {
      return res.status(400).json({ error: '密码哈希不能为空' });
    }
    const data = getSystemData();
    data.passwordHash = passwordHash;
    saveSystemData(data);
    res.json({ success: true, passwordHash, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '设置密码失败' });
  }
});

// Update / Set View Password
app.put('/api/auth/view-password', (req, res) => {
  try {
    const { viewPasswordHash, enabled } = req.body;
    if (!viewPasswordHash) {
      return res.status(400).json({ error: '浏览密码哈希不能为空' });
    }
    const data = getSystemData();
    data.viewPasswordHash = viewPasswordHash;
    data.viewPasswordEnabled = enabled !== undefined ? enabled : true;
    saveSystemData(data);
    res.json({ success: true, viewPasswordHash, enabled: data.viewPasswordEnabled, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '设置浏览密码失败' });
  }
});

// Reset / Clear All Data
app.post('/api/reset', (req, res) => {
  try {
    const current = getSystemData();
    const emptyData: SystemData = {
      batches: [],
      records: [],
      configs: {},
      passwordHash: current.passwordHash,
      viewPasswordHash: current.viewPasswordHash,
      viewPasswordEnabled: current.viewPasswordEnabled,
    };
    saveSystemData(emptyData);
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
