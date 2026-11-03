const {app,BrowserWindow,ipcMain,dialog,shell,Tray,Menu,nativeImage,session} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const guard = require('./guards.cjs');
let win,tray,timer,quitting=false,working=false;
const topics={'全部':'nature landscape','山野':'mountain landscape','海岸':'ocean coast','极简':'minimalist landscape'};
let state={favorites:[],history:[],photos:[],rotation:0,current:null,topic:'全部',rotationQuery:topics['全部']};
let stateFile,mediaDir;
let saveQueue=Promise.resolve();
const remote=new Map();
let feed=[],feedQuery='';
const key='PPh4eDg5vLGNv009egTasg9BK9bjcfyTGIrTPpbBDDM';
const enabled=Boolean(key.trim());
const root=path.join(__dirname,'..');
const bundled=require('./bundled.json').map(p=>({...p,path:path.join(root,'assets',p.file),source:'builtin',author:'Quiet Studio'}));
function allPhotos(){return [...bundled,...state.photos,...remote.values()];}
function photo(id){const p=allPhotos().find(x=>x.id===id);if(!p)throw Error('图片不存在，请重新加载');return p;}
function display(p){return {...p,path:undefined,url:p.path?pathToFileURL(p.path).href:p.url};}
function snapshot(){return {favorites:state.favorites,history:state.history,current:state.current,rotation:state.rotation,topic:state.topic||'全部',online:enabled,photos:[...bundled,...state.photos].map(display)};}
function save(){const data=JSON.stringify(state,null,2);saveQueue=saveQueue.catch(()=>{}).then(async()=>{await fs.writeFile(stateFile+'.tmp',data);await fs.rename(stateFile+'.tmp',stateFile);});return saveQueue;}
async function request(url){const res=await fetch(url,{headers:{Authorization:`Client-ID ${key}`,'Accept-Version':'v1'},redirect:'error',signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error(res.status===403||res.status===429?'Unsplash 请求额度已用完，请稍后再试':`Unsplash 连接失败（${res.status}）`);return res.json();}
async function search(query,page){
 if(!enabled)throw Error('Unsplash 在线图库尚未配置。可以先导入图片，或打开 Unsplash 网站选图。');
 const raw=String(query||'全部').slice(0,100);
 const mapped=(topics[raw]||raw||topics['全部']).slice(0,100);
 const pageNo=Math.min(100,Math.max(1,Number(page)||1));
 const u=new URL('https://api.unsplash.com/search/photos');u.search=new URLSearchParams({query:mapped,orientation:'landscape',per_page:'24',page:String(pageNo)});
 const data=await request(u);
 const photos=data.results.map(x=>({id:x.id,title:x.alt_description||x.description||'Untitled',author:x.user.name,profile:x.user.links.html,link:x.links.html,url:guard.imageURL(x.urls.regular),full:guard.imageURL(x.urls.full),download:guard.apiURL(x.links.download_location),width:x.width,height:x.height,source:'unsplash',category:topics[raw]?raw:'摄影'}));
 for(const p of photos)remote.set(p.id,p);
 if(pageNo===1){feed=photos;feedQuery=mapped;const topicChanged=Boolean(topics[raw]&&state.topic!==raw),queryChanged=state.rotationQuery!==mapped;state.rotationQuery=mapped;if(topics[raw])state.topic=raw;if(topicChanged||queryChanged)await save();}
 return {photos:photos.map(display),pages:data.total_pages};
}
async function rotateOnce(){
 const expected=state.rotationQuery||topics[state.topic]||topics['全部'];
 if(feed.length<2||feedQuery!==expected){const key=Object.keys(topics).find(name=>topics[name]===expected);await search(key||expected,1);}
 if(feed.length<2)throw Error('当前分类的壁纸还不够，稍后再试');
 const index=feed.findIndex(p=>p.id===state.current);
 const next=feed[(index<0?0:index+1)%feed.length];
 if(!next||next.id===state.current)throw Error('当前分类只有一张可切换的壁纸');
 return setWallpaper(next.id);
}
async function localFile(p){
 if(p.source==='builtin'){const target=path.join(mediaDir,p.id+'.jpg');await fs.writeFile(target,await fs.readFile(p.path));return target;}
 if(p.path)return p.path;
 const target=path.join(mediaDir,p.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'.jpg');
 try{await fs.access(target);return target;}catch{}
 const u=new URL(guard.imageURL(p.full));u.searchParams.set('w','3840');u.searchParams.set('fm','jpg');u.searchParams.set('q','90');
 const res=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(90000)});
 if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('图片下载失败');
 const chunks=[];let total=0;
 for await(const chunk of res.body){total+=chunk.length;if(total>60*1024*1024)throw Error('图片超过 60 MB');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);if(nativeImage.createFromBuffer(bytes).isEmpty())throw Error('图片格式无法识别');
 await fs.writeFile(target,bytes);return target;
}
async function track(p){if(p.source==='unsplash'){if(!enabled)throw Error('Unsplash 未连接');await request(guard.apiURL(p.download));}}
async function applyDesktop(local){
 if(process.platform==='win32'){
  const script=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','src','wallpaper.ps1'):path.join(__dirname,'wallpaper.ps1');
  await promisify(execFile)('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{env:{...process.env,QUIET_IMAGE:local,QUIET_BMP:path.join(mediaDir,'desktop.bmp')},windowsHide:true,timeout:30000});
  return;
 }
 if(process.platform==='darwin'){
  const lines=['on run argv','set imageFile to POSIX file (item 1 of argv)','tell application "System Events" to set picture of every desktop to imageFile','end run'];
  await promisify(execFile)('osascript',[...lines.flatMap(line=>['-e',line]),'--',local],{timeout:30000});
  return;
 }
 throw Error('设置桌面壁纸目前支持 Windows 和 macOS');
}
async function setWallpaper(id){
 if(working)throw Error('正在切换壁纸，请稍候');
 working=true;
 try{const p=photo(id);await track(p);const local=await localFile(p);
 await applyDesktop(local);
 state.current=id;state.history=[{id,at:new Date().toISOString()},...state.history.filter(x=>x.id!==id)].slice(0,100);
 if(p.source==='unsplash'&&!state.photos.some(x=>x.id===id))state.photos.push(p);
 await save();win?.webContents.send('updated',snapshot());return snapshot();
 }finally{working=false;}
}
function schedule(){clearInterval(timer);if(state.rotation)timer=setInterval(async()=>{if(working)return;try{await rotateOnce();}catch(e){win?.webContents.send('notice',e.message);}},state.rotation*60000);}
function handle(name,fn){ipcMain.handle(name,async(e,...args)=>{if(!win||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Invalid sender');try{return {ok:true,value:await fn(...args)};}catch(err){return {ok:false,error:err.message};}});}
function show(){win.show();win.focus();}
app.whenReady().then(async()=>{
 mediaDir=path.join(app.getPath('userData'),'images');stateFile=path.join(app.getPath('userData'),'state.json');await fs.mkdir(mediaDir,{recursive:true});
 try{const stored=JSON.parse(await fs.readFile(stateFile,'utf8'));if(Array.isArray(stored.photos)&&Array.isArray(stored.favorites)&&Array.isArray(stored.history))state={...state,...stored};const migrated=state.rotation===180;if(migrated)state.rotation=240;if(!topics[state.topic])state.topic='全部';if(!state.rotationQuery)state.rotationQuery=topics[state.topic];guard.interval(state.rotation);if(migrated)await save();}catch{state.rotation=0;}
 for(const p of state.photos)if(p.source==='unsplash')remote.set(p.id,p);
 win=new BrowserWindow({width:1280,height:850,minWidth:960,minHeight:660,title:'栖景 Quiet',backgroundColor:'#f7f8f6',icon:path.join(root,'assets/icon.png'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});
 handle('state',()=>snapshot());handle('search',search);
 handle('favorite',async id=>{const p=photo(id);state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];if(p.source==='unsplash'&&!state.photos.some(x=>x.id===id))state.photos.push(p);await save();return snapshot();});
 handle('set',setWallpaper);
 handle('download',async id=>{const p=photo(id);const result=await dialog.showSaveDialog(win,{defaultPath:path.join(app.getPath('downloads'),`Quiet-${p.id}${p.path?path.extname(p.path):'.jpg'}`)});if(result.canceled)return false;await track(p);await fs.copyFile(await localFile(p),result.filePath);return true;});
 handle('import',async()=>{const selected=await dialog.showOpenDialog(win,{properties:['openFile','multiSelections'],filters:[{name:'图片',extensions:['jpg','jpeg','png','webp']}]});if(selected.canceled)return snapshot();for(const file of selected.filePaths){const stat=await fs.stat(file);if(stat.size>60*1024*1024)throw Error('单张图片不能超过 60 MB');const img=nativeImage.createFromPath(file);if(img.isEmpty())throw Error('无法读取图片：'+path.basename(file));const id=randomUUID(),dest=path.join(mediaDir,id+'.png');await fs.writeFile(dest,img.toPNG());state.photos.push({id,title:path.basename(file,path.extname(file)),path:dest,source:'local',author:'本地图片',category:'我的图片',...img.getSize()});await save();}return snapshot();});
 handle('open',url=>shell.openExternal(guard.externalURL(url)));
 handle('settings',async value=>{state.rotation=guard.interval(value);await save();schedule();return snapshot();});
 handle('hide',()=>win.hide());
 tray=new Tray(nativeImage.createFromPath(path.join(root,'assets/icon.png')).resize({width:24,height:24}));tray.setToolTip('栖景 Quiet · 让桌面安静下来');
 tray.setContextMenu(Menu.buildFromTemplate([{label:'打开栖景',click:show},{label:'下一张壁纸',click:async()=>{try{await rotateOnce();}catch(e){show();win.webContents.send('notice',e.message);}}},{type:'separator'},{label:'退出',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',show);
 await win.loadFile(path.join(__dirname,'index.html'));schedule();
});
app.on('before-quit',()=>{quitting=true;clearInterval(timer);});
app.on('window-all-closed',()=>{});
const lock=app.requestSingleInstanceLock();if(!lock)app.quit();else app.on('second-instance',()=>win&&show());
