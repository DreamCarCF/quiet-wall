const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const r=await ipcRenderer.invoke(name,...args);if(!r.ok)throw Error(r.error);return r.value;};
contextBridge.exposeInMainWorld('quiet',{
 state:()=>invoke('state'),search:(q,p)=>invoke('search',q,p),favorite:id=>invoke('favorite',id),set:id=>invoke('set',id),download:id=>invoke('download',id),import:()=>invoke('import'),open:url=>invoke('open',url),settings:value=>invoke('settings',value),feedback:(message,contact)=>invoke('feedback',message,contact),hide:()=>invoke('hide'),
 onUpdate:fn=>ipcRenderer.on('updated',(_e,value)=>fn(value)),onNotice:fn=>ipcRenderer.on('notice',(_e,value)=>fn(value))
});
