import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const config=JSON.parse(readFileSync(new URL('../app-config.json',import.meta.url),'utf8'));
const apk=new URL(`../../.netlify/releases/android-${config.appVersion}/Franmotest-${config.appVersion}-Android.apk`,import.meta.url);
const manifest={schema:1,packageId:config.packageId,versionName:config.appVersion,versionCode:config.appVersionCode,
 apkUrl:`https://github.com/Alain-0721/french-vocabulary-test/releases/download/v${config.appVersion}/Franmotest-${config.appVersion}-Android.apk`,
 sha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),size:statSync(apk).size,
 notes:'优化手机顺序、布局和章节主题选择菜单；词库统计底部新增上一个/下一个 Part 与主题切换。'};
writeFileSync(new URL('../../website/public/android-update.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(`Android update metadata ready: ${manifest.versionName}, build ${manifest.versionCode}`);
