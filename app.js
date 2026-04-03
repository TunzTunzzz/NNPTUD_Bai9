var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
let mongoose = require('mongoose')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Kết nối MongoDB ─────────────────────────────────────────────────────────
// Tắt buffer: lỗi DB trả về ngay (400/500) thay vì treo 10s rồi crash
mongoose.set('bufferCommands', false);

mongoose.connect('mongodb+srv://namcutevll78_db_user:Tunz@test.slilyur.mongodb.net/NNPTUD-C6', {
  serverSelectionTimeoutMS: 5000,  // timeout nhanh hơn (5s)
}).catch(function (err) {
  console.error('[MongoDB] Khong the ket noi ban dau:', err.message);
});

mongoose.connection.on('connected', function () {
  console.log('[MongoDB] Ket noi thanh cong');
});
mongoose.connection.on('disconnected', function () {
  console.log('[MongoDB] Mat ket noi');
});
mongoose.connection.on('error', function (err) {
  // Bắt tất cả lỗi từ mongoose connection — KHÔNG để lên process
  console.error('[MongoDB] Loi:', err.message);
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/', require('./routes/index'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/carts', require('./routes/carts'));
app.use('/api/v1/upload', require('./routes/upload'));
app.use('/api/v1/messages', require('./routes/messages'));
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.send(err.message);
});

// ─── Bắt lỗi toàn cục — tránh crash server ───────────────────────────────────
process.on('unhandledRejection', function (reason) {
  console.error('[UnhandledRejection]', reason?.message || reason);
});

process.on('uncaughtException', function (err) {
  console.error('[UncaughtException]', err.message);
  // KHÔNG gọi process.exit() — giữ server tiếp tục chạy
});

module.exports = app;