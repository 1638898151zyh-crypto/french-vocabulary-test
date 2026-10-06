import './textbooks-preview.jsx';
import {startPwa} from './pwa.js';
import {startNativeApp} from './native-app.js';
startNativeApp();
if(import.meta.env?.PROD)startPwa();
