/**
 * 统一封装所有“后端”接口。
 * 现在先用 localStorage 模拟，将来只需要把这些函数改成 fetch 后端即可。
 */

const API_BASE = 'http://localhost:3000'; // 以后接后端时修改

const USERS_KEY = 'users';
const RECORDS_KEY = 'records';
const CURRENT_USER_KEY = 'currentUser';
const TOKEN_KEY = 'token';

// 工具函数
function loadJson(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
}

// ============ 账号相关 ============

// 注册（现在本地模拟，将来改为 fetch(`${API_BASE}/api/register`, ...)）
async function apiRegister(username, password, role, adminSecret) {
  const users = loadJson(USERS_KEY, []);

  if (users.find(u => u.username === username)) {
    throw new Error('该用户名已被注册');
  }

  // 管理员专用密码在前端先简单校验一层（真实项目应完全由后端验证）
  if (role === 'admin' && adminSecret !== '1227') {
    throw new Error('管理员专用密码错误');
  }

  const user = {
    id: generateId('user'),
    username,
    password, // 真实项目中这里必须是 password_hash，由后端处理
    role,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveJson(USERS_KEY, users);

  const token = generateId('token');
  saveJson(CURRENT_USER_KEY, { id: user.id, username: user.username, role: user.role });
  localStorage.setItem(TOKEN_KEY, token);

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

// 登录
async function apiLogin(username, password) {
  const users = loadJson(USERS_KEY, []);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const token = generateId('token');
  saveJson(CURRENT_USER_KEY, { id: user.id, username: user.username, role: user.role });
  localStorage.setItem(TOKEN_KEY, token);

  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

// 获取当前登录用户
async function apiGetCurrentUser() {
  const current = loadJson(CURRENT_USER_KEY, null);
  return current;
}

// 登出
async function apiLogout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

// 注销当前账号（删除用户及其所有记录）
async function apiDeleteCurrentAccount() {
  const current = await apiGetCurrentUser();
  if (!current) throw new Error('未登录');

  // 删除用户
  let users = loadJson(USERS_KEY, []);
  users = users.filter(u => u.id !== current.id);
  saveJson(USERS_KEY, users);

  // 删除该用户的所有记录
  let records = loadJson(RECORDS_KEY, []);
  records = records.filter(r => r.userId !== current.id);
  saveJson(RECORDS_KEY, records);

  // 清除登录状态
  await apiLogout();
}

// ============ 业务记录相关（图片 / 日志 / 提问）============

/**
 * 记录统一结构：
 * {
 *   id, userId, username, type: 'image' | 'log' | 'question',
 *   contentSummary, result, createdAt
 * }
 */

async function apiUploadImage(file, description) {
  const current = await apiGetCurrentUser();
  if (!current) throw new Error('未登录');

  const records = loadJson(RECORDS_KEY, []);

  const newRecord = {
    id: generateId('rec'),
    userId: current.id,
    username: current.username,
    type: 'image',
    // 图片本身不存 localStorage，只存文件名和说明
    contentSummary: `图片：${file?.name || '未命名'}，说明：${description || '无'}`,
    // result 将来由后端返回，这里先给一个占位
    result: '（示例）已接收图片，等待后端运维分析结果返回后在此展示。',
    createdAt: new Date().toLocaleString()
  };

  records.push(newRecord);
  saveJson(RECORDS_KEY, records);

  return newRecord;
}

async function apiUploadLog(text) {
  const current = await apiGetCurrentUser();
  if (!current) throw new Error('未登录');
  if (!text || !text.trim()) throw new Error('日志内容不能为空');

  const records = loadJson(RECORDS_KEY, []);

  const newRecord = {
    id: generateId('rec'),
    userId: current.id,
    username: current.username,
    type: 'log',
    contentSummary: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
    result: '（示例）已接收日志文本，等待后端运维分析结果返回后在此展示。',
    createdAt: new Date().toLocaleString()
  };

  records.push(newRecord);
  saveJson(RECORDS_KEY, records);

  return newRecord;
}

async function apiAskQuestion(question) {
  const current = await apiGetCurrentUser();
  if (!current) throw new Error('未登录');
  if (!question || !question.trim()) throw new Error('问题内容不能为空');

  // 这里只做示例回答，真实项目应由后端 + 专家/AI 处理
  const fakeAnswer = '（示例回答）我们已收到你的问题，后端接入后，这里会显示由专家或 AI 模型生成的运维指导建议。';

  const records = loadJson(RECORDS_KEY, []);

  const newRecord = {
    id: generateId('rec'),
    userId: current.id,
    username: current.username,
    type: 'question',
    contentSummary: question.slice(0, 50) + (question.length > 50 ? '...' : ''),
    result: fakeAnswer,
    createdAt: new Date().toLocaleString()
  };

  records.push(newRecord);
  saveJson(RECORDS_KEY, records);

  return { answer: fakeAnswer, record: newRecord };
}

// 获取记录列表：普通用户看自己的；专家/管理员看全部
async function apiGetRecords() {
  const current = await apiGetCurrentUser();
  if (!current) throw new Error('未登录');

  const records = loadJson(RECORDS_KEY, []);
  if (current.role === 'user') {
    return records.filter(r => r.userId === current.id);
  }
  // expert / admin
  return records;
}

// ============ 管理员账号管理相关 ============

// 列出所有用户（仅管理员应调用，但这里先不做严格校验）
async function apiAdminListUsers() {
  const users = loadJson(USERS_KEY, []);
  return users;
}

// 更新用户（例如修改角色）
async function apiAdminUpdateUser(userId, payload) {
  const users = loadJson(USERS_KEY, []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) throw new Error('用户不存在');

  users[idx] = { ...users[idx], ...payload };
  saveJson(USERS_KEY, users);
  return users[idx];
}

// 删除用户
async function apiAdminDeleteUser(userId) {
  let users = loadJson(USERS_KEY, []);
  users = users.filter(u => u.id !== userId);
  saveJson(USERS_KEY, users);
  return true;
}

// ======= 将来接入真实后端时的参考示例（现在先注释掉） =======

/*
async function realApiLogin(username, password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('登录失败');
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  saveJson(CURRENT_USER_KEY, data.user);
  return data;
}
*/