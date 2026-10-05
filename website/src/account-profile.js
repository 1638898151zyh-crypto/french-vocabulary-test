export const MAX_AVATAR_FILE=5*1024*1024;
export const MAX_AVATAR_BYTES=256*1024;
export function profileName(value){
  const name=String(value||'').trim();
  if(!name||Array.from(name).length>40||/[\u0000-\u001f\u007f]/.test(name))throw Error('请输入 1–40 个字的昵称。');
  return name;
}
export function avatarUrl(user){
  const value=user?.pictureUrl;
  if(typeof value!=='string')return '';
  if(/^\/api\/avatar\/[a-f0-9-]+\.(webp|png|jpg)$/i.test(value))return value;
  try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}
}
export async function prepareAvatar(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片。');
  if(file.size>MAX_AVATAR_FILE)throw Error('图片超过 5 MB，请选择较小的图片。');
  let image;
  try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('无法读取这张图片，请换一张。');}
  try{
    if(!image.width||!image.height)throw Error('图片尺寸无效。');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器暂时无法处理图片。');
    const side=Math.min(image.width,image.height);
    ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));
    if(!blob||blob.size>MAX_AVATAR_BYTES)throw Error('图片处理失败，请换一张图片。');
    return blob;
  }finally{image.close();}
}
export async function uploadAvatar(blob,fetcher=fetch){
  const response=await fetcher('/api/avatar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':blob.type},body:blob});
  let result;try{result=await response.json();}catch{throw Error('头像上传未完成，请稍后重试。');}
  if(!response.ok)throw Error(result.error||'头像上传未完成，请稍后重试。');
  if(!/^\/api\/avatar\/[a-f0-9-]+\.(webp|png|jpg)$/i.test(result.url||''))throw Error('头像地址无效，请重试。');
  return result.url;
}
export async function saveProfile({name,picture,file,uploaded},identity,fetcher=fetch){
  const full_name=profileName(name),data={full_name};
  if(file)data.avatar_url=uploaded||await uploadAvatar(file,fetcher);
  else if(picture!==undefined)data.avatar_url=picture;
  return identity.updateUser({data});
}
