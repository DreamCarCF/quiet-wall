const $=id=>document.getElementById(id);
const native=Boolean(window.quiet);
let previewStore={photos:[],favorites:[],history:[],rotation:0,online:false,current:null};
const api=window.quiet||{
 state:async()=>previewStore,
 favorite:async id=>{previewStore.favorites=previewStore.favorites.includes(id)?previewStore.favorites.filter(x=>x!==id):[...previewStore.favorites,id];return previewStore;},
 set:async()=>{throw Error('界面预览模式：请在 Windows 桌面应用中设置壁纸');},
 download:async()=>{throw Error('请在 Windows 桌面应用中下载壁纸');},
 import:async()=>{throw Error('请在 Windows 桌面应用中导入图片');},
 search:async()=>{throw Error('Unsplash 在线图库尚未配置');},
 settings:async v=>{previewStore.rotation=v;return previewStore;},
 open:async url=>{window.open(url,'_blank','noopener');},hide:async()=>{throw Error('界面预览模式没有系统托盘');},onUpdate:()=>{},onNotice:()=>{}
};
let state,view='discover',category='全部',selected=null,heroId,onlinePhotos=[],page=1,pages=0,query='全部',busy=false,toastTimer,requestId=0;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
async function action(fn){try{return await fn();}catch(e){toast(e.message);}}
function source(p){return p.source==='builtin'?'内置原创插画':p.source==='local'?'本地图片':'Unsplash';}
function lookup(id){return [...state.photos,...onlinePhotos].find(p=>p.id===id);}
function attribution(url){const u=new URL(url);u.searchParams.set('utm_source','quiet_wall');u.searchParams.set('utm_medium','referral');return u.href;}
function openPreview(id){selected=id;const p=lookup(id);$('previewImage').src=p.url;$('previewTitle').textContent=p.title;$('previewMeta').textContent=`${p.width} × ${p.height} · ${source(p)}`;$('authorLink').textContent=p.source==='unsplash'?`Photo by ${p.author} on Unsplash ↗`:p.author;$('authorLink').disabled=p.source!=='unsplash';updateFav();$('preview').showModal();}
function updateFav(){if(selected)$('previewFavorite').textContent=state.favorites.includes(selected)?'♥ 已收藏':'♡ 收藏';}
function showHero(p){if(!p)return;heroId=p.id;$('heroImage').src=p.url;$('heroTitle').textContent=p.title;$('heroAuthor').textContent=p.source==='unsplash'?`${p.author} · Unsplash`:p.author;$('heroTag').textContent=p.source==='unsplash'?'UNSPLASH':'QUIET ORIGINALS';$('heroResolution').textContent=`${p.width} × ${p.height}`;}
function apply(s){state=s;$('favCount').textContent=s.favorites.length;$('rotation').value=String(s.rotation);$('rotationQuick').value=String(s.rotation);$('apiStatus').textContent=s.online?'在线接口已配置':'未连接 · 本地图库可正常使用';render();updateFav();}
function card(p){
 const article=document.createElement('article');article.className='card';
 const image=document.createElement('div');image.className='card-image';image.tabIndex=0;image.setAttribute('role','button');image.setAttribute('aria-label',`预览 ${p.title}`);image.onclick=()=>openPreview(p.id);image.onkeydown=e=>{if(e.target===image&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openPreview(p.id);}};
 const img=document.createElement('img');img.src=p.url;img.alt=p.title;img.loading='lazy';img.onerror=()=>{img.alt='图片加载失败，请检查网络';};image.append(img);
 const fav=document.createElement('button');fav.className='favorite'+(state.favorites.includes(p.id)?' saved':'');fav.textContent=state.favorites.includes(p.id)?'♥':'♡';fav.setAttribute('aria-label',state.favorites.includes(p.id)?'取消收藏':'收藏壁纸');fav.onclick=e=>{e.stopPropagation();action(async()=>apply(await api.favorite(p.id)));};image.append(fav);
 const badge=document.createElement('span');badge.className='badge';badge.textContent=state.current===p.id?'正在使用':source(p);image.append(badge);
 const meta=document.createElement('div');meta.className='card-meta';const text=document.createElement('div'),title=document.createElement('h3'),author=document.createElement(p.source==='unsplash'?'button':'p');title.textContent=p.title;author.textContent=p.source==='unsplash'?`${p.author} / Unsplash ↗`:p.author;if(p.source==='unsplash'){author.className='link';author.onclick=()=>action(()=>api.open(attribution(p.profile)));}text.append(title,author);const size=document.createElement('span');size.textContent=p.width>=3840?'4K':`${p.width} × ${p.height}`;meta.append(text,size);article.append(image,meta);return article;
}
function render(){
 const titles={discover:['给桌面，一点留白。','把喜欢的风景，留在每一次打开电脑的瞬间。','发现壁纸'],favorites:['把喜欢，留在眼前。','一份属于自己的风景收藏。','我的收藏'],history:['风景，来过的痕迹。','回看最近使用过的桌面壁纸。','最近使用'],local:['你的风景，自有天地。','导入自己的照片，在桌面上继续旅行。','本地图库']};
 $('heading').textContent=titles[view][0];$('subtitle').textContent=titles[view][1];$('crumb').textContent=titles[view][2];document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 $('hero').hidden=view!=='discover';$('tabs').hidden=view!=='discover';
 document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',b.dataset.category===category));
 let photos=state.photos;
 if(view==='favorites')photos=state.favorites.map(lookup).filter(Boolean);
 else if(view==='history')photos=state.history.map(x=>lookup(x.id)).filter(Boolean);
 else if(view==='local')photos=photos.filter(p=>p.source==='local');
 else if(!native)photos=photos.filter(p=>!category||category==='全部'||p.category===category);
 else photos=onlinePhotos;
 if(view!=='discover'){const q=$('search').value.trim().toLowerCase();if(q)photos=photos.filter(p=>[p.title,p.author,p.category].join(' ').toLowerCase().includes(q));}
 $('grid').replaceChildren(...photos.map(card));$('count').textContent=view==='discover'&&busy&&!photos.length?'正在寻找风景…':`${photos.length} 张壁纸`;$('empty').hidden=photos.length>0||(view==='discover'&&busy);$('emptyImport').hidden=view==='discover';$('emptyText').textContent=view==='favorites'?'点击图片右上角的爱心，收集喜欢的风景。':view==='history'?'设置过的壁纸会出现在这里。':view==='local'?'支持 JPG、PNG 和 WebP。原图会复制到应用本地目录。':view==='discover'?'没有找到对应的风景，试试其他分类或关键词。':'没有匹配的壁纸，试试其他关键词。';
 $('sourceNotice').hidden=view!=='discover';$('sourceNotice').textContent=state.online?'图片来自 Unsplash · 点击作者姓名可查看摄影师主页。自动切换会沿用当前这一组风景。':'Unsplash 暂未连接，暂时无法加载在线壁纸。';$('loadMore').hidden=!(view==='discover'&&native&&page<pages);
}
async function searchOnline(append=false){if(busy&&append)return;busy=true;const token=++requestId;const term=query;const next=append?page+1:1;if(!append){onlinePhotos=[];page=1;pages=0;}$('loadMore').disabled=true;render();try{const result=await api.search(term,next);if(token!==requestId)return;page=next;pages=result.pages;onlinePhotos=append?[...onlinePhotos,...result.photos.filter(p=>!onlinePhotos.some(x=>x.id===p.id))]:result.photos;if(!append&&onlinePhotos[0]&&view==='discover')showHero(onlinePhotos[0]);}catch(e){if(token===requestId)toast(e.message);}finally{if(token===requestId){busy=false;$('loadMore').disabled=false;render();}}}
async function set(id,button){if(!id)return;button.disabled=true;const original=button.textContent;button.textContent='正在设置…';try{apply(await api.set(id));toast('桌面已换上新的风景');}catch(e){toast(e.message);}finally{button.disabled=false;button.textContent=original;}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$('search').value='';render();});
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;$('search').value='';query=category;if(native&&state?.online)searchOnline();else render();});
$('searchForm').onsubmit=e=>{e.preventDefault();if(view==='discover'&&native&&state?.online){const text=$('search').value.trim();if(text)category='';query=text||category||'全部';searchOnline();}else render();};
$('search').oninput=()=>{if(view!=='discover')render();};
$('loadMore').onclick=()=>searchOnline(true);
async function importImages(){await action(async()=>{apply(await api.import());view='local';$('search').value='';render();});}
$('import').onclick=importImages;$('emptyImport').onclick=importImages;$('hide').onclick=()=>action(()=>api.hide());
$('settingsButton').onclick=()=>$('settings').showModal();$('closeSettings').onclick=()=>$('settings').close();$('closePreview').onclick=()=>$('preview').close();
function rotationToast(){const name={30:'30 分钟',60:'1 小时',240:'4 小时',1440:'1 天'}[state.rotation];toast(state.rotation?`已开启自动切换，每 ${name}更换一张`:'已关闭自动切换');}
async function changeRotation(value){apply(await api.settings(Number(value)));rotationToast();}
$('rotation').onchange=e=>action(()=>changeRotation(e.target.value));
$('rotationQuick').onchange=e=>action(()=>changeRotation(e.target.value));
$('visitUnsplash').onclick=()=>action(()=>api.open('https://unsplash.com/?utm_source=quiet_wall&utm_medium=referral'));
$('authorHome').onclick=()=>action(()=>api.open('https://www.ilovedsy.com/'));
$('authorLink').onclick=()=>{const p=lookup(selected);if(p.profile)action(()=>api.open(attribution(p.profile)));};
$('previewFavorite').onclick=()=>action(async()=>apply(await api.favorite(selected)));
$('previewDownload').onclick=()=>action(async()=>{const b=$('previewDownload');b.disabled=true;b.textContent='正在下载…';try{if(await api.download(selected))toast('图片已保存');}finally{b.disabled=false;b.textContent='↓ 下载';}});
$('previewSet').onclick=()=>set(selected,$('previewSet'));$('heroSet').onclick=()=>set(heroId,$('heroSet'));$('heroPreview').onclick=()=>openPreview(heroId);
api.onUpdate(apply);api.onNotice(toast);
// Offline browser preview uses the same bundled artworks, without native APIs.
if(!native){previewStore.photos=[['mountain','山色入梦','山野'],['coast','潮汐之间','海岸'],['dunes','风的形状','极简'],['forest','山林来信','山野'],['sunset','日落之后','海岸'],['moon','月白','极简']].map(([id,title,category])=>({id,title,category,author:'Quiet Studio',source:'builtin',width:3840,height:2160,url:`../assets/${id}.jpg`}));}
action(async()=>{const initial=await api.state();if(initial.topic&&document.querySelector(`[data-category="${initial.topic}"]`)){category=initial.topic;query=category;}apply(initial);if(native&&state.online)await searchOnline();else if(state.photos[0])showHero(state.photos[0]);});
