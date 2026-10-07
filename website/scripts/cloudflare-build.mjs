import {build} from 'esbuild';
export function cloudflareBuild(){return {
 name:'franmotest-cloudflare',apply:'build',
 async generateBundle(){
  const result=await build({entryPoints:['cloudflare/worker.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',minify:true});
  this.emitFile({type:'asset',fileName:'_worker.js',source:result.outputFiles[0].text});
  this.emitFile({type:'asset',fileName:'_routes.json',source:JSON.stringify({version:1,include:['/api/*'],exclude:[]})});
  this.emitFile({type:'asset',fileName:'_headers',source:'/api/*\n  Cache-Control: no-store\n/android-update.json\n  Cache-Control: no-store\n/sw.js\n  Cache-Control: no-cache\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n'});
 }
};}
