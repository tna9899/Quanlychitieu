const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(__dirname));

// Đọc dữ liệu từ file JSON
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// Ghi dữ liệu vào file JSON
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Lấy danh sách chi tiêu
app.get('/api/transactions', (req, res) => {
    res.json(readData());
});

// Thêm một giao dịch mới
app.post('/api/transactions', (req, res) => {
    const transactions = readData();
    const newTransaction = {
        id: Date.now(),
        date: req.body.date,
        type: req.body.type, // 'thu' hoặc 'chi'
        category: req.body.category,
        amount: parseInt(req.body.amount),
        note: req.body.note
    };
    transactions.push(newTransaction);
    writeData(transactions);
    res.json({ success: true, data: newTransaction });
});

// Xóa một giao dịch
app.delete('/api/transactions/:id', (req, res) => {
    let transactions = readData();
    transactions = transactions.filter(t => t.id !== parseInt(req.params.id));
    writeData(transactions);
    res.json({ success: true });
});

// Khởi động server lắng nghe ở tất cả địa chỉ IP trong mạng (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy. Truy cập tại: http://localhost:${PORT}`);
});