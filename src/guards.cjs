const {URL} = require('node:url');
function httpsHost(value, hosts) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || !hosts.includes(u.hostname) || u.username || u.password || (u.port && u.port !== '443')) throw Error('不受支持的链接');
  return u;
}
function apiURL(value) {
  const u = httpsHost(value, ['api.unsplash.com']);
  if (!/^\/photos\/[^/]+\/download$/.test(u.pathname)) throw Error('无效的下载统计地址');
  return u.href;
}
function imageURL(value) {return httpsHost(value, ['images.unsplash.com', 'plus.unsplash.com']).href;}
function externalURL(value) {return httpsHost(value, ['unsplash.com', 'help.unsplash.com', 'www.ilovedsy.com']).href;}
function serviceURL(base, path) {
  const root = base.endsWith('/') ? base : base + '/';
  const rel = String(path || '').replace(/^\//, '');
  if (!rel || rel.includes('..') || rel.includes('\\') || rel.startsWith('//')) throw Error('不受支持的链接');
  if (!/^api\/(health|search|track|usage|feedback)(\?|$)/.test(rel)) throw Error('不受支持的链接');
  const u = new URL(rel, root);
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  const official = u.hostname === 'www.ilovedsy.com' || u.hostname === 'ilovedsy.com';
  if (u.username || u.password || !u.href.startsWith(root)) throw Error('不受支持的链接');
  if (local && u.protocol === 'http:') return u.href;
  if (official && u.protocol === 'https:' && (!u.port || u.port === '443')) return u.href;
  throw Error('不受支持的链接');
}
function interval(value) {if (![0, 30, 60, 240, 1440].includes(value)) throw Error('无效的轮换间隔'); return value;}
module.exports = {apiURL,imageURL,externalURL,serviceURL,interval};
