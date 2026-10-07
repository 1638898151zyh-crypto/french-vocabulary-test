import './textbooks-preview.jsx';
import {startPwa} from './pwa.js';
import {startNativeApp} from './native-app.js';
import './native-app.css';
import {startNativeUpdates} from './native-updates.js';
startNativeApp();
startNativeUpdates();
if(import.meta.env?.PROD)startPwa();
