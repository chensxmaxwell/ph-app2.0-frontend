/**
 * @format
 */

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';
import { installReleaseCrashGuard } from './src/services/crash-guard';

// Release only: keep uncaught JS errors from becoming RCTFatal force-quits.
installReleaseCrashGuard();

AppRegistry.registerComponent(appName, () => App);
