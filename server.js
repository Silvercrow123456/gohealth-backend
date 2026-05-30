require('dotenv').config(); // 載入 .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// 引入資料庫模型
const Glucose = require('./models/Glucose');
const Biochem = require('./models/Biochem');
const Reminder = require('./models/Reminder');
const { ConsultMsg, Reservation } = require('./models/Consult');
const Medication = require('./models/Medication');
const Stats = require('./models/Stats');
const nodemailer = require('nodemailer');
const Ttm = require('./models/Ttm'); 
const RctGroup = require('./models/RctGroup');
const RctState = require('./models/RctState');
const xlsx = require('xlsx');

const app = express();

// Middleware (中介軟體)
app.use(cors()); // 允許跨域請求
app.use(express.json()); // 允許解析 JSON 格式的請求內容

// ==========================================
// 連線 MongoDB Atlas
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ 成功連線至 MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB 連線失敗:', err));

// ==========================================
// API 路由設計 (Routes)
// ==========================================

// 測試 API 是否正常
app.get('/', (req, res) => {
  res.send('穩糖圈 go Health 後端 API 運作中！');
});

// 1. [新增] 血糖紀錄 (POST /api/glucose)
app.post('/api/glucose', async (req, res) => {
  try {
    const { userId, value, measuredAt, note } = req.body;
    
    // 建立新資料
    const newGlucose = new Glucose({
      userId,
      value,
      measuredAt,
      note
    });

    // 儲存到 MongoDB
    const savedGlucose = await newGlucose.save();
    res.status(201).json({ success: true, data: savedGlucose });
  } catch (error) {
    res.status(500).json({ success: false, message: '儲存失敗', error: error.message });
  }
});

// 2. [讀取] 取得某個使用者的所有血糖紀錄 (GET /api/glucose/:userId)
app.get('/api/glucose/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // 尋找該 userId 的紀錄，並依照量測時間倒序排列 (最新的在前面)
    const logs = await Glucose.find({ userId }).sort({ measuredAt: -1 });
    
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: '讀取失敗', error: error.message });
  }
});

// 3. [刪除] 刪除單筆血糖紀錄 (DELETE /api/glucose/:id)
app.delete('/api/glucose/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Glucose.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: '刪除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '刪除失敗', error: error.message });
  }
});

/* =======================================================
   (三) 生理數值 API (Upsert: 更新或新增)
   ======================================================= */
app.get('/api/biochem/:userId', async (req, res) => {
  const data = await Biochem.findOne({ userId: req.params.userId });
  res.json({ success: true, data: data || {} });
});
app.post('/api/biochem', async (req, res) => {
  // 使用 findOneAndUpdate，若不存在則新增 (upsert: true)
  const data = await Biochem.findOneAndUpdate({ userId: req.body.userId }, req.body, { new: true, upsert: true });
  res.json({ success: true, data });
});
app.delete('/api/biochem/:userId', async (req, res) => {
  await Biochem.findOneAndDelete({ userId: req.params.userId });
  res.json({ success: true });
});

/* =======================================================
   (四) 專業諮詢與預約 API
   ======================================================= */
// 留言板
app.get('/api/consults/:userId', async (req, res) => {
  const msgs = await ConsultMsg.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  res.json({ success: true, data: msgs });
});
app.post('/api/consults', async (req, res) => {
  const newMsg = await new ConsultMsg(req.body).save();
  res.json({ success: true, data: newMsg });
});
app.delete('/api/consults/:userId', async (req, res) => {
  await ConsultMsg.deleteMany({ userId: req.params.userId });
  res.json({ success: true });
});
// 預約設定
app.get('/api/reservation/:userId', async (req, res) => {
  const data = await Reservation.findOne({ userId: req.params.userId });
  res.json({ success: true, data: data || null });
});
app.post('/api/reservation', async (req, res) => {
  const data = await Reservation.findOneAndUpdate({ userId: req.body.userId }, req.body, { new: true, upsert: true });
  res.json({ success: true, data });
});

/* =======================================================
   (五) 提醒設定 API
   ======================================================= */
app.get('/api/reminders/:userId', async (req, res) => {
  const data = await Reminder.findOne({ userId: req.params.userId });
  res.json({ success: true, data: data || {} });
});
app.post('/api/reminders', async (req, res) => {
  const data = await Reminder.findOneAndUpdate({ userId: req.body.userId }, req.body, { new: true, upsert: true });
  res.json({ success: true, data });
});

/* =======================================================
   (六) 用藥設定 API (同步更新：先刪除舊的再寫入新的)
   ======================================================= */
app.get('/api/meds/:userId', async (req, res) => {
  const meds = await Medication.find({ userId: req.params.userId });
  res.json({ success: true, data: meds });
});
app.post('/api/meds/sync', async (req, res) => {
  const { userId, meds } = req.body;
  await Medication.deleteMany({ userId }); // 清除舊清單
  
  // 為每筆藥物補上 userId
  const medsToInsert = meds.map(m => ({ ...m, userId }));
  if (medsToInsert.length > 0) {
    await Medication.insertMany(medsToInsert);
  }
  res.json({ success: true });
});
app.delete('/api/meds/:userId', async (req, res) => {
  await Medication.deleteMany({ userId: req.params.userId });
  res.json({ success: true });
});
/* =======================================================
   (七) 使用統計 API
   ======================================================= */
app.post('/api/stats', async (req, res) => {
  try {
    const { userId } = req.body;
    await Stats.findOneAndUpdate({ userId }, req.body, { new: true, upsert: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats/:userId', async (req, res) => {
  try {
    const data = await Stats.findOne({ userId: req.params.userId });
    res.json({ success: true, data: data || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
/* =======================================================
   (八) 發送 Email API
   ======================================================= */
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    // 設定寄信的帳號與密碼 (從環境變數讀取)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // 你的公用 Gmail
        pass: process.env.EMAIL_PASS  // 剛剛申請的 16 字元密碼
      }
    });

    const mailOptions = {
      from: `"穩糖圈系統" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: '信件發送成功' });
  } catch (error) {
    console.error('寄信失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
/* =======================================================
   (九) TTM 測驗與 RCT 獨立分組 API
   ======================================================= */
app.post('/api/ttm', async (req, res) => {
  try {
    const { userId, scores } = req.body;
    
    // 1. 計算原本的分數與階段
    let group = 'C'; 
    if (scores.some(s => s === 0 || s === 1)) group = 'A';
    else if (scores.some(s => s === 2 || s === 3)) group = 'B';
    
    const totalScore = scores.reduce((a, b) => a + b, 0);
    let stage = '無意圖期';
    if (totalScore <= 12) stage = '無意圖期';
    else if (totalScore <= 18) stage = '準備期';
    else if (totalScore <= 24) stage = '行動期';
    else stage = '維持期';

    // 2. 儲存 TTM 到 Ttm Collection (這裏只存 ABC 組，不存 RCT)
    const ttmData = { userId, scores, totalScore, stage, group };
    const savedTtm = await Ttm.findOneAndUpdate(
      { userId }, ttmData, { new: true, upsert: true }
    );

    // 3. 🟢 獨立處理 RCT 分組 (Block Randomization, Block size = 4)
    let existingRct = await RctGroup.findOne({ userId });
    let assignedGroup = '';

    if (existingRct) {
      // 情況 A：已經分過組的病患，沿用舊分組
      assignedGroup = existingRct.assignedGroup; 
    } else {
      // 情況 B：新病患，需要進行隨機分派
      
      // B-1. 從資料庫叫出目前的「區塊狀態」
      let state = await RctState.findOne({ key: 'block_4' });
      if (!state) state = new RctState({ key: 'block_4', sequence: [] });

      // B-2. 如果目前的區塊被發光了（陣列為空），就隨機生成一個新的區塊！
      if (state.sequence.length === 0) {
        const blocks = [
          ['control', 'control', 'experimental', 'experimental'],
          ['control', 'experimental', 'control', 'experimental'],
          ['control', 'experimental', 'experimental', 'control'],
          ['experimental', 'control', 'control', 'experimental'],
          ['experimental', 'control', 'experimental', 'control'],
          ['experimental', 'experimental', 'control', 'control']
        ];
        const randomIndex = Math.floor(Math.random() * blocks.length);
        state.sequence = blocks[randomIndex]; 
        console.log('📦 產生新區塊:', state.sequence); // 你可以在後端終端機看到這次抽到哪一組
      }

      // B-3. 從陣列的第一個拿出一個分組，並從陣列中刪除它
      assignedGroup = state.sequence.shift();

      // B-4. 將剩餘的陣列存回資料庫，等待下一個病患
      await state.save();
      
      // B-5. 將這個病患的分組結果寫入獨立的資料庫，保持雙盲
      await new RctGroup({ userId, assignedGroup }).save();
    }

    // 回傳時，把 TTM 分數和 RCT 分組一起丟給前端，但資料庫裡它們是分開的！
    res.json({ 
      success: true, 
      data: {
        scores: savedTtm.scores,
        totalScore: savedTtm.totalScore,
        stage: savedTtm.stage,
        rctGroup: assignedGroup 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 前端重新整理時，需要同時抓取 TTM 和 RCT 資料
app.get('/api/ttm/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 平行去兩個不同的 Collection 抓資料
    let [ttmData, rctData] = await Promise.all([
      Ttm.findOne({ userId }),
      RctGroup.findOne({ userId })
    ]);

    // 如果連 TTM 測驗都沒做過，直接回傳 null 讓前端去考試
    if (!ttmData) return res.json({ success: true, data: null });

    // 🟢 補救措施：如果是舊帳號（有 TTM 紀錄，但從來沒被分過組），在此自動幫他補分組！
    if (!rctData) {
      let state = await RctState.findOne({ key: 'block_4' });
      if (!state) state = new RctState({ key: 'block_4', sequence: [] });

      if (state.sequence.length === 0) {
        const blocks = [
          ['control', 'control', 'experimental', 'experimental'],
          ['control', 'experimental', 'control', 'experimental'],
          ['control', 'experimental', 'experimental', 'control'],
          ['experimental', 'control', 'control', 'experimental'],
          ['experimental', 'control', 'experimental', 'control'],
          ['experimental', 'experimental', 'control', 'control']
        ];
        const randomIndex = Math.floor(Math.random() * blocks.length);
        state.sequence = blocks[randomIndex]; 
        console.log('📦 產生新區塊 (補救舊帳號用):', state.sequence);
      }

      const assignedGroup = state.sequence.shift();
      await state.save();
      
      // 寫入 RctGroup 資料庫
      rctData = await new RctGroup({ userId, assignedGroup }).save();
      console.log(`📦 舊帳號 ${userId} 補分組成功:`, assignedGroup);
    }

    res.json({ 
      success: true, 
      data: {
        scores: ttmData.scores,
        totalScore: ttmData.totalScore,
        stage: ttmData.stage,
        rctGroup: rctData.assignedGroup // 回傳確定的分組
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
/* =======================================================
   (十) 研究人員專用：匯出全資料庫 Excel API
   ======================================================= */
app.get('/api/export-excel', async (req, res) => {
  try {
    // 1. 從各個 Collection 抓取所有資料
    const rctGroups = await RctGroup.find().lean();
    const ttms = await Ttm.find().lean();
    const biochems = await Biochem.find().lean();
    const stats = await Stats.find().lean();
    const glucoses = await Glucose.find().sort({ measuredAt: 1 }).lean(); // 依時間排序

    // 2. 製作「第一頁：病患總表 (Summary)」
    const summaryData = rctGroups.map(rct => {
      const uId = rct.userId;
      const ttm = ttms.find(t => t.userId === uId) || {};
      const bio = biochems.find(b => b.userId === uId) || {};
      const st = stats.find(s => s.userId === uId) || {};
      
      // 計算該病患的血糖統計
      const userGlucoses = glucoses.filter(g => g.userId === uId);
      const countGlu = userGlucoses.length;
      let avgGlu = '';
      if (countGlu > 0) {
        const sum = userGlucoses.reduce((a, b) => a + b.value, 0);
        avgGlu = (sum / countGlu).toFixed(1); // 算平均值到小數點第一位
      }

      return {
        '病患帳號 (userId)': uId,
        '實驗分組': rct.assignedGroup === 'experimental' ? '實驗組 (Experimental)' : '控制組 (Control)',
        'TTM 總分': ttm.totalScore || '',
        'TTM 階段': ttm.stage || '',
        'TTM ABC分組': ttm.group || '',
        '總使用時間(秒)': st.totalUsedSec || 0,
        '衛教觀看(秒)': st.eduWatchSec || 0,
        '留言次數': st.countMsg || 0,
        '血糖測量總次數': countGlu,
        '平均血糖值': avgGlu,
        '性別': bio.sex === 'male' ? '男' : (bio.sex === 'female' ? '女' : ''),
        '身高(cm)': bio.height || '',
        '體重(kg)': bio.weight || '',
        'HbA1c(%)': bio.hba1c || '',
        'Creatinine': bio.creatinine || '',
        'TC': bio.tc || '',
        'TG': bio.tg || '',
        'LDL': bio.ldl || ''
      };
    });

    // 3. 製作「第二頁：血糖原始數據 (Raw Glucose)」
    const glucoseData = glucoses.map(g => ({
      '病患帳號 (userId)': g.userId,
      '量測時間': new Date(g.measuredAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      '血糖數值 (mg/dL)': g.value
    }));

    // 4. 產生 Excel 檔案
    const wb = xlsx.utils.book_new(); // 建立新活頁簿
    
    // 把資料轉成 Sheet 並塞進活頁簿
    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    const wsGlucose = xlsx.utils.json_to_sheet(glucoseData);
    xlsx.utils.book_append_sheet(wb, wsSummary, '病患總表 (Summary)');
    xlsx.utils.book_append_sheet(wb, wsGlucose, '血糖原始數據 (Glucose)');

    // 5. 轉換成 Buffer 並設定 HTTP Header 讓瀏覽器下載
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // 設定下載的檔名 (加上今天日期)
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="goHealth_Research_Data_${today}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(buffer);
  } catch (error) {
    console.error('匯出失敗:', error);
    res.status(500).send('匯出 Excel 時發生錯誤');
  }
});

// ==========================================
// 啟動伺服器 (相容本機端與 Vercel Serverless)
// ==========================================
// 如果是本機端開發，才啟動 app.listen
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 伺服器已啟動，請前往 http://localhost:${PORT}`);
  });
}

// 將 app 匯出，讓 Vercel 可以接管它
module.exports = app;