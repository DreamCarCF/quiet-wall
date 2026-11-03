const fs = require('node:fs/promises');
const path = require('node:path');

function loadEnv(file) {
  let text = '';
  try { text = require('node:fs').readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[name]) process.env[name] = value;
  }
}

function emptyStore() { return {devices: {}, feedback: [], downloads: {}}; }

async function readStore(file) {
  try { return {...emptyStore(), ...JSON.parse(await fs.readFile(file, 'utf8'))}; }
  catch { return emptyStore(); }
}

async function writeStore(file, store) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.rename(tmp, file);
}

function photoId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw Object.assign(Error('无效的图片'), {status: 400});
  return id;
}

function clip(value, max) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }

function applyUsage(store, body, place) {
  const deviceId = String(body.deviceId || '');
  const sessionId = String(body.sessionId || '');
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw Object.assign(Error('无效的设备'), {status: 400});
  const elapsed = Math.max(0, Math.min(24 * 60 * 60, Number(body.elapsedSec) || 0));
  const now = new Date().toISOString();
  const device = store.devices[deviceId] || {id: deviceId, firstSeen: now, durationSec: 0, sessionCount: 0, lastElapsed: 0, lastSessionId: ''};
  if (device.lastSessionId !== sessionId) {
    device.lastSessionId = sessionId;
    device.lastElapsed = 0;
    device.sessionCount += 1;
  }
  const delta = Math.min(300, Math.max(0, elapsed - device.lastElapsed));
  device.lastElapsed = Math.max(device.lastElapsed, elapsed);
  device.durationSec += delta;
  device.lastSeen = now;
  device.platform = clip(body.platform, 20);
  device.arch = clip(body.arch, 20);
  device.osVersion = clip(body.osVersion, 40);
  device.cpu = clip(body.cpu, 120);
  device.memoryGb = Math.max(0, Math.min(1024, Number(body.memoryGb) || 0));
  device.appVersion = clip(body.appVersion, 20);
  device.locale = clip(body.locale, 20);
  device.country = place.country || device.country || '';
  device.region = place.region || device.region || '';
  device.city = place.city || device.city || '';
  device.ip = place.ip || device.ip || '';
  store.devices[deviceId] = device;
  return device;
}

function addFeedback(store, body, place) {
  const message = clip(body.message, 2000);
  if (message.length < 2) throw Object.assign(Error('请至少写两个字'), {status: 400});
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    at: new Date().toISOString(),
    deviceId: /^[0-9a-f-]{36}$/i.test(String(body.deviceId || '')) ? String(body.deviceId) : '',
    message,
    contact: clip(body.contact, 120),
    city: place.city || '',
    country: place.country || '',
    platform: clip(body.platform, 20)
  };
  store.feedback.unshift(item);
  store.feedback = store.feedback.slice(0, 500);
  return item;
}

function rememberDownload(store, id, location) {
  if (typeof location === 'string' && location.startsWith('https://api.unsplash.com/photos/')) store.downloads[id] = location;
  const ids = Object.keys(store.downloads);
  if (ids.length > 2000) for (const old of ids.slice(0, ids.length - 2000)) delete store.downloads[old];
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = forwarded || req.socket.remoteAddress || '';
  return raw.replace(/^::ffff:/, '');
}

function privateIp(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
}

module.exports = {loadEnv, readStore, writeStore, photoId, applyUsage, addFeedback, rememberDownload, clientIp, privateIp};
