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
function interval(value) {if (![0, 30, 60, 240, 1440].includes(value)) throw Error('无效的轮换间隔'); return value;}
module.exports = {apiURL,imageURL,externalURL,interval};
