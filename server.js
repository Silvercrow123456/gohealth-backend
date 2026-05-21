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
   (九) TTM 測驗 API (包含後台自動分組邏輯)
   ======================================================= */
app.post('/api/ttm', async (req, res) => {
  try {
    const { userId, scores } = req.body;
    
    // 1. 後端自動計算分組 (依據你的規則)
    let group = 'C'; 
    if (scores.some(s => s === 0 || s === 1)) {
      group = 'A'; // 任一題有 0 或 1 進 A 組
    } else if (scores.some(s => s === 2 || s === 3)) {
      group = 'B'; // 排除 A 之後，任一題有 2 或 3 進 B 組
    } else {
      group = 'C'; // 剩下的情況 (全部都是 4 或 5) 進 C 組
    }

    // 2. 計算總分與對應階段
    const totalScore = scores.reduce((a, b) => a + b, 0);
    let stage = '無意圖期';
    if (totalScore <= 12) stage = '無意圖期';
    else if (totalScore <= 18) stage = '準備期';
    else if (totalScore <= 24) stage = '行動期';
    else stage = '維持期';

    const ttmData = { userId, scores, totalScore, stage, group };

    // 3. 儲存至資料庫
    const savedTtm = await Ttm.findOneAndUpdate(
      { userId }, ttmData, { new: true, upsert: true }
    );

    // 4. 回傳給前端時，刻意「不回傳 group」，確保受試者看不到！
    res.json({ 
      success: true, 
      data: {
        scores: savedTtm.scores,
        totalScore: savedTtm.totalScore,
        stage: savedTtm.stage
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ttm/:userId', async (req, res) => {
  try {
    const data = await Ttm.findOne({ userId: req.params.userId });
    if (!data) return res.json({ success: true, data: null });

    // 同樣，讀取時也不要把 group 傳給前端
    res.json({ 
      success: true, 
      data: {
        scores: data.scores,
        totalScore: data.totalScore,
        stage: data.stage
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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