// The Android build ships these same learning screens and banks inside the APK.
// Its HTTPS origin is served by WebViewAssetLoader, with only API paths online.
export const isNativeApp=import.meta.env?.VITE_NATIVE_APP==='true';
export function saveNativeText(filename,content,type){
  if(!isNativeApp)return false;
  if(!globalThis.FranmotestNative?.saveText)throw Error('无法打开文件保存窗口，请重启应用后重试。');
  globalThis.FranmotestNative.saveText(filename,String(content),type.split(';')[0]);
  return true;
}
export function startNativeApp(){
  if(!isNativeApp)return;
  document.documentElement.dataset.nativeApp='true';
  window.franmotestBack=()=>{
    const dialog=document.querySelector('[aria-modal="true"]');
    if(dialog){const close=dialog.querySelector('button[aria-label^="关闭"]');if(close&&!close.disabled)close.click();return true;}
    const menu=document.querySelector('.choice-dropdown,.dp-switch-menu,.ac-popover');
    if(menu){const target=menu.matches('.choice-dropdown')?menu.querySelector('[aria-selected=true]')||menu:document.activeElement||document;target.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;}
    return false;
  };
  const appearance=()=>globalThis.FranmotestNative?.setDark?.(document.documentElement.dataset.previewTheme==='dark'||document.documentElement.dataset.theme==='dark');
  new MutationObserver(appearance).observe(document.documentElement,{attributes:true,attributeFilter:['data-preview-theme','data-theme']});appearance();
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    if(!link||link.hasAttribute('download'))return;
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&!url.pathname.startsWith('/.netlify/')&&!link.hasAttribute('data-external'))return;
    if(['https:','mailto:'].includes(url.protocol)&&globalThis.FranmotestNative?.openExternal){event.preventDefault();globalThis.FranmotestNative.openExternal(url.href);}
  });
}
