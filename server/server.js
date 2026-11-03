const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {URL} = require('node:url');
const lib = require('./lib.cjs');

const root = __dirname;
lib.loadEnv(path.join(root, '.env'));
const port = Number(process.env.PORT || 8787);
const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminSecret = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');
const storeFile = path.join(root, 'data', 'store.json');
const places = new Map();
let writing = Promise.resolve();

function update(fn) {
  const run = writing.then(async () => {
    const store = await lib.readStore(storeFile);
    const result = await fn(store);
    await lib.writeStore(storeFile, store);
    return result;
  });
  writing = run.then(() => {}, () => {});
  return run;
}

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 32 * 1024) { reject(Object.assign(Error('内容过大'), {status: 413})); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(Error('请求格式不正确'), {status: 400})); }
    });
    req.on('error', reject);
  });
}

async function unsplash(pathname, search, redirect = 'follow') {
  if (!unsplashKey) throw Object.assign(Error('服务器还没有配置 Unsplash Access Key'), {status: 503});
  const url = new URL('https://api.unsplash.com' + pathname);
  if (search) url.search = search;
  const res = await fetch(url, {redirect, headers: {Authorization: `Client-ID ${unsplashKey}`, 'Accept-Version': 'v1'}, signal: AbortSignal.timeout(20000)});
  if (redirect === 'manual') {
    if (res.status >= 400) throw Object.assign(Error('Unsplash 下载统计失败'), {status: 502});
    return {};
  }
  if (!res.ok) throw Object.assign(Error(res.status === 403 || res.status === 429 ? 'Unsplash 请求额度已用完，请稍后再试' : `Unsplash 连接失败（${res.status}）`), {status: 502});
  return res.json();
}

function photo(item, category) {
  return {
    id: item.id,
    title: item.alt_description || item.description || 'Untitled',
    author: item.user?.name || 'Unsplash',
    profile: item.user?.links?.html || '',
    link: item.links?.html || '',
    url: item.urls?.regular || '',
    full: item.urls?.full || '',
    width: item.width,
    height: item.height,
    source: 'unsplash',
    category: category || '摄影'
  };
}

async function locate(ip) {
  if (!ip || lib.privateIp(ip)) return {ip, country: '本地', region: '', city: '本机'};
  if (places.has(ip)) return places.get(ip);
  let place = {ip, country: '', region: '', city: ''};
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {signal: AbortSignal.timeout(5000)});
    const data = await res.json();
    if (data.success) place = {ip, country: data.country || '', region: data.region || '', city: data.city || ''};
  } catch { /* 地区查不到时仍记录设备和时长 */ }
  places.set(ip, place);
  return place;
}

function sign(exp) {
  const payload = String(exp);
  const mac = crypto.createHmac('sha256', adminSecret).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

function adminOk(req) {
  const cookie = String(req.headers.cookie || '');
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('quiet_admin='))?.slice('quiet_admin='.length);
  if (!token) return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', adminSecret).update(exp).digest('hex');
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}

function duration(seconds) {
  const total = Math.round(seconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分`;
}

function page(title, body) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
  body{margin:0;font-family:"Segoe UI","Microsoft YaHei",sans-serif;background:#f7f8f6;color:#243028}main{max-width:1100px;margin:auto;padding:32px 20px}h1{font-weight:500}a{color:#3f5d48}table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden}th,td{padding:12px;border-bottom:1px solid #e6ebe3;text-align:left;font-size:13px;vertical-align:top}th{font-size:12px;color:#6d7b70}form,section{background:white;border-radius:12px;padding:20px;margin:16px 0}.cards{display:flex;gap:12px;flex-wrap:wrap}.card{background:white;border-radius:12px;padding:16px 18px;min-width:140px}.card b{display:block;font-size:22px;font-weight:500}input,button{font:inherit}input{border:1px solid #d5dfd4;border-radius:8px;padding:10px;width:min(320px,100%)}button{background:#405b49;color:white;border:0;border-radius:8px;padding:10px 16px;cursor:pointer}.muted{color:#7d8b80;font-size:13px}
  </style></head><body><main>${body}</main></body></html>`;
}

function loginPage(error) {
  return page('栖景后台', `<h1>栖景后台</h1><p class="muted">只供作者查看使用情况和反馈。</p><form method="post" action="/admin/login"><p>${error ? `<span class="muted">${escape(error)}</span><br>` : ''}<input name="password" type="password" placeholder="管理密码" autofocus></p><button>进入</button></form>`);
}

function dashboard(store) {
  const devices = Object.values(store.devices).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
  const active = devices.filter(device => Date.now() - Date.parse(device.lastSeen) < 10 * 60 * 1000).length;
  const rows = devices.map(device => `<tr><td><code>${escape(device.id.slice(0, 8))}</code><div class="muted">${escape(device.locale || '')} · v${escape(device.appVersion || '')}</div></td><td>${escape([device.country, device.region, device.city].filter(Boolean).join(' · ') || '未知')}<div class="muted">${escape(device.ip || '')}</div></td><td>${escape(device.platform)} ${escape(device.arch)} ${escape(device.osVersion)}<div class="muted">${escape(device.cpu || '')} · ${escape(device.memoryGb || 0)} GB</div></td><td>${duration(device.durationSec)}<div class="muted">${device.sessionCount || 0} 次打开</div></td><td>${escape(device.firstSeen || '').slice(0, 16).replace('T', ' ')}<div class="muted">最近 ${escape(device.lastSeen || '').slice(0, 16).replace('T', ' ')}</div></td></tr>`).join('');
  const notes = store.feedback.map(item => `<tr><td>${escape(item.at).slice(0, 16).replace('T', ' ')}</td><td>${escape(item.message)}</td><td>${escape(item.contact || '未留')}<div class="muted">${escape(item.city || '')} · ${escape(item.platform || '')}</div></td></tr>`).join('');
  return page('栖景后台', `<h1>栖景 Quiet</h1><div class="cards"><div class="card"><b>${devices.length}</b><span class="muted">使用过的设备</span></div><div class="card"><b>${active}</b><span class="muted">近 10 分钟在线</span></div><div class="card"><b>${store.feedback.length}</b><span class="muted">收到的反馈</span></div></div><h2>设备</h2><table><tr><th>设备</th><th>位置</th><th>电脑</th><th>使用时长</th><th>时间</th></tr>${rows || '<tr><td colspan="5">还没有使用记录</td></tr>'}</table><h2>意见反馈</h2><table><tr><th>时间</th><th>内容</th><th>联系方式</th></tr>${notes || '<tr><td colspan="3">还没有反馈</td></tr>'}</table><p><a href="/admin/logout">退出</a></p>`);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, {ok: true, unsplash: Boolean(unsplashKey)});
  if (req.method === 'GET' && url.pathname === '/api/search') {
    const query = String(url.searchParams.get('query') || 'landscape').slice(0, 100);
    const pageNo = Math.min(100, Math.max(1, Number(url.searchParams.get('page')) || 1));
    const category = String(url.searchParams.get('category') || '').slice(0, 20);
    const data = await unsplash('/search/photos', new URLSearchParams({query, orientation: 'landscape', per_page: '24', page: String(pageNo)}));
    const photos = (data.results || []).map(item => photo(item, category));
    await update(store => { for (const item of data.results || []) lib.rememberDownload(store, item.id, item.links?.download_location); });
    return send(res, 200, {photos, pages: data.total_pages || 0});
  }
  if (req.method === 'POST' && url.pathname === '/api/track') {
    const body = await readBody(req);
    const id = lib.photoId(body.id);
    const store = await lib.readStore(storeFile);
    const location = new URL(store.downloads[id] || `https://api.unsplash.com/photos/${id}/download`);
    await unsplash(location.pathname + location.search, null, 'manual');
    return send(res, 200, {ok: true});
  }
  if (req.method === 'POST' && url.pathname === '/api/usage') {
    const body = await readBody(req);
    const place = await locate(lib.clientIp(req));
    await update(store => lib.applyUsage(store, body, place));
    return send(res, 200, {ok: true});
  }
  if (req.method === 'POST' && url.pathname === '/api/feedback') {
    const body = await readBody(req);
    const place = await locate(lib.clientIp(req));
    await update(store => lib.addFeedback(store, body, place));
    return send(res, 200, {ok: true});
  }
  if (req.method === 'GET' && url.pathname === '/admin') return send(res, 200, adminOk(req) ? dashboard(await lib.readStore(storeFile)) : loginPage());
  if (req.method === 'POST' && url.pathname === '/admin/login') {
    const raw = await new Promise(resolve => { const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); });
    const password = new URLSearchParams(raw).get('password') || '';
    if (!adminPassword || password !== adminPassword) return send(res, 401, loginPage('密码不正确'));
    return send(res, 303, '', {'Set-Cookie': `quiet_admin=${sign(Date.now() + 7 * 24 * 3600 * 1000)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`, Location: '/admin'});
  }
  if (req.method === 'GET' && url.pathname === '/admin/logout') return send(res, 303, '', {'Set-Cookie': 'quiet_admin=; HttpOnly; Path=/; Max-Age=0', Location: '/admin'});
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '')) return send(res, 200, page('栖景服务', '<h1>栖景服务正在运行</h1><p class="muted">应用通过这个服务获取图片、上报使用情况并提交反馈。</p>'));
  send(res, 404, {error: '没有这个接口'});
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => send(res, error.status || 500, {error: error.message || '服务器错误'}));
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`栖景后台 http://127.0.0.1:${port}/admin`);
    if (!unsplashKey) console.log('尚未配置 UNSPLASH_ACCESS_KEY，在线图片不可用');
    if (!adminPassword) console.log('尚未配置 ADMIN_PASSWORD，后台无法登录');
  });
}

module.exports = {server};
