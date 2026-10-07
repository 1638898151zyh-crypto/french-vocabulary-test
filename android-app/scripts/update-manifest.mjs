import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const config=JSON.parse(readFileSync(new URL('../app-config.json',import.meta.url),'utf8'));
const apk=new URL(`../../.netlify/releases/android-${config.appVersion}/Franmotest-${config.appVersion}-Android.apk`,import.meta.url);
const manifest={schema:1,packageId:config.packageId,versionName:config.appVersion,versionCode:config.appVersionCode,
 apkUrl:`https://github.com/Alain-0721/french-vocabulary-test/releases/download/v${config.appVersion}/Franmotest-${config.appVersion}-Android.apk`,
 sha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),size:statSync(apk).size,
 notes:'Part 选择菜单去掉搜索框，打开后直接滚动选择，不自动弹出手机键盘；保留主题和词汇搜索。'};
writeFileSync(new URL('../../website/public/android-update.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(`Android update metadata ready: ${manifest.versionName}, build ${manifest.versionCode}`);
