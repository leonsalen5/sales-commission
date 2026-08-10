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

// Ensure initial sample data if DB is completely empty on first load
function initDefaultSampleDataIfEmpty() {
  const data = getSystemData();
  if (data.batches.length === 0) {
    const batchId = 'sample_batch_2026_07';
    const sampleBatch: ImportBatch = {
      id: batchId,
      month: '2026-07',
      fileName: '2026年7月销售记录示例.xlsx',
      uploadedAt: new Date().toISOString(),
      recordCount: 12,
      totalAmount: 168000,
    };

    const sampleRecords: SalesRecord[] = [
      {
        id: `${batchId}_1`,
        batchId,
        month: '2026-07',
        date: '2026/7/1',
        incomeName: '张小明',
        project: '少儿美术',
        type: '新',
        amount: 3800,
        salesperson: '王顾问',
        teacher: '李老师',
        notes: '标准年卡课程',
      },
      {
        id: `${batchId}_2`,
        batchId,
        month: '2026-07',
        date: '2026/7/2',
        incomeName: '李思思',
        project: '硬笔书法',
        type: '新',
        amount: 4500,
        salesperson: '王顾问',
        teacher: '陈老师',
        notes: '暑期班+硬笔套装',
      },
      {
        id: `${batchId}_3`,
        batchId,
        month: '2026-07',
        date: '2026/7/3',
        incomeName: '赵雷',
        project: '少儿英语',
        type: '续',
        amount: 8000,
        salesperson: '王顾问',
        teacher: '张老师',
        notes: '续费两年套餐',
      },
      {
        id: `${batchId}_4`,
        batchId,
        month: '2026-07',
        date: '2026/7/5',
        incomeName: '孙悟空',
        project: '夏令营集训',
        type: '集训',
        amount: 6800,
        salesperson: '王顾问',
        teacher: '李老师',
        notes: '7天闭环特训',
      },
      {
        id: `${batchId}_5`,
        batchId,
        month: '2026-07',
        date: '2026/7/6',
        incomeName: '钱七',
        project: '少儿美术',
        type: '新',
        amount: 12000,
        salesperson: '王顾问',
        teacher: '李老师',
        notes: '三年VIP班',
      },
      {
        id: `${batchId}_6`,
        batchId,
        month: '2026-07',
        date: '2026/7/8',
        incomeName: '周八',
        project: '少儿英语',
        type: '新',
        amount: 15000,
        salesperson: '王顾问',
        teacher: '张老师',
        notes: '新报高端班',
      },
      {
        id: `${batchId}_7`,
        batchId,
        month: '2026-07',
        date: '2026/7/10',
        incomeName: '吴九',
        project: '硬笔书法',
        type: '续',
        amount: 45000,
        salesperson: '王顾问',
        teacher: '陈老师',
        notes: '老学员高额续费',
      },
      {
        id: `${batchId}_8`,
        batchId,
        month: '2026-07',
        date: '2026/7/12',
        incomeName: '郑十',
        project: '少儿美术',
        type: '续',
        amount: 10000,
        salesperson: '王顾问',
        teacher: '',
        notes: '无指定老师续费',
      },
      {
        id: `${batchId}_9`,
        batchId,
        month: '2026-07',
        date: '2026/7/15',
        incomeName: '林一',
        project: '少儿英语',
        type: '新',
        amount: 22000,
        salesperson: '张顾问',
        teacher: '张老师',
        notes: '非自主招生顾问转转入',
      },
      {
        id: `${batchId}_10`,
        batchId,
        month: '2026-07',
        date: '2026/7/18',
        incomeName: '徐二',
        project: '夏令营集训',
        type: '集训',
        amount: 5000,
        salesperson: '张顾问',
        teacher: '陈老师',
        notes: '集训班学员',
      },
      {
        id: `${batchId}_11`,
        batchId,
        month: '2026-07',
        date: '2026/7/20',
        incomeName: '胡三',
        project: '少儿美术',
        type: '续',
        amount: 16000,
        salesperson: '张顾问',
        teacher: '李老师',
        notes: '续费大单',
      },
      {
        id: `${batchId}_12`,
        batchId,
        month: '2026-07',
        date: '2026/7/25',
        incomeName: '高四',
        project: '硬笔书法',
        type: '新',
        amount: 20000,
        salesperson: '张顾问',
        teacher: '陈老师',
        notes: '新报名书法全能班',
      },
    ];

    const sampleConfigs: Record<string, SalespersonConfig> = {
      王顾问: {
        salesperson: '王顾问',
        role: '普通课程顾问',
        otherAmountByMonth: { '2026-07': 500 },
      },
      张顾问: {
        salesperson: '张顾问',
        role: '非自主招生课程顾问',
        otherAmountByMonth: { '2026-07': 0 },
      },
    };

    data.batches.push(sampleBatch);
    data.records.push(...sampleRecords);
    data.configs = sampleConfigs;
    saveSystemData(data);
  }
}

initDefaultSampleDataIfEmpty();

// --- API ROUTES ---

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
    const targetMonth = month || records[0]?.month || '2026-07';

    const totalAmount = records.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);

    const newBatch: ImportBatch = {
      id: batchId,
      month: targetMonth,
      fileName: fileName || `销售记录_${targetMonth}.xlsx`,
      uploadedAt: new Date().toISOString(),
      recordCount: records.length,
      totalAmount,
    };

    const formattedRecords: SalesRecord[] = records.map((r: any, idx: number) => ({
      id: `${batchId}_${idx + 1}`,
      batchId,
      month: targetMonth,
      date: r.date || `${targetMonth}/1`,
      incomeName: r.incomeName || '未名学生',
      project: r.project || '通用课程',
      type: r.type || '新',
      amount: parseFloat(r.amount) || 0,
      salesperson: r.salesperson || '未名销售',
      teacher: r.teacher || '',
      notes: r.notes || '',
    }));

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

    data.batches.unshift(newBatch);
    data.records.unshift(...formattedRecords);
    saveSystemData(data);

    res.json({ success: true, batch: newBatch, count: formattedRecords.length, data });
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

// Update Salesperson Config (Role and Other Amount)
app.put('/api/salesperson-config', (req, res) => {
  try {
    const { salesperson, role, month, otherAmount } = req.body;
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

// Reset / Clear All Data
app.post('/api/reset', (req, res) => {
  try {
    const emptyData: SystemData = { batches: [], records: [], configs: {} };
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
