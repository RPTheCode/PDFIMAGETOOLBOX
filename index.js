/**
 * @format
 */

// 🔧 CRITICAL: Add polyfills for React Navigation v7 compatibility
if (!Array.prototype.findLast) {
  Array.prototype.findLast = function(predicate, thisArg) {
    if (this == null) {
      throw new TypeError('Array.prototype.findLast called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    const list = Object(this);
    const length = list.length >>> 0;
    
    for (let i = length - 1; i >= 0; i--) {
      const value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}

if (!Array.prototype.findLastIndex) {
  Array.prototype.findLastIndex = function(predicate, thisArg) {
    if (this == null) {
      throw new TypeError('Array.prototype.findLastIndex called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    const list = Object(this);
    const length = list.length >>> 0;
    
    for (let i = length - 1; i >= 0; i--) {
      const value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

// MUST import gesture handler FIRST, before any other imports
import 'react-native-gesture-handler';

import { AppRegistry, Linking } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { EventType } from '@notifee/react-native';
import RNFS from 'react-native-fs';

// Background notification handler (when app killed)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Killed app notification event');

  if (type === EventType.PRESS && detail.pressAction?.id === 'open-pdf') {
    const path = detail.notification?.data?.filePath;
    if (path) {
      try {
        // Convert to base64 and open in browser
        const base64 = await RNFS.readFile(path, 'base64');
        console.log('index.js file base64', base64);
        const url = `data:application/pdf;base64,${base64}`;
        console.log('index.js file url', url);
        
        await Linking.openURL(url);
      } catch (e) {
        console.log('Error opening PDF (base64 fallback):', e);
      }
    }
    await notifee.cancelNotification(detail.notification.id);
  }
});

AppRegistry.registerComponent(appName, () => App);


// /**
//  * @format
//  */
// import { AppRegistry, Linking } from 'react-native';
// import App from './App';
// import { name as appName } from './app.json';
// import notifee, { EventType } from '@notifee/react-native';
// import RNFS from 'react-native-fs';

// // Background notification handler (when app killed)
// notifee.onBackgroundEvent(async ({ type, detail }) => {
//   console.log('Killed app notification event');

//   if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
//     const path = detail.notification.data?.filePath;
//     if (path) {
//       try {
//         // Convert to base64 and open in browser
//         const base64 = await RNFS.readFile(path, 'base64');
//         console.log('index.js file base64',base64);
//         const url = `data:application/pdf;base64,${base64}`;
//         console.log('index.js file url',url);
        
//         await Linking.openURL(url);
//       } catch (e) {
//         console.log('Error opening PDF (base64 fallback):', e);
//       }
//     }
//     await notifee.cancelNotification(detail.notification.id);
//   }
// });

// AppRegistry.registerComponent(appName, () => App);




// // /**
// //  * @format
// //  */
// // import { AppRegistry, Linking } from 'react-native';
// // import App from './App';
// // import { name as appName } from './app.json';
// // import notifee, { EventType } from '@notifee/react-native';
// // import FileViewer from 'react-native-file-viewer';

// // notifee.onBackgroundEvent(async ({ type, detail }) => {
// //   if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
// //     const path = detail.notification.data?.filePath;
// //     if (path) {
// //       try {
// //         await FileViewer.open(`file://${path}`, { showOpenWithDialog: true, type: 'application/pdf' });
// //       } catch (e) {
// //         console.log('Error opening PDF (killed):', e);
// //         // Fallback: open in browser/drive
// //         try {
// //           await Linking.openURL(`file://${path}`);
// //         } catch (err) {
// //           console.log('Fallback also failed:', err);
// //         }
// //       }
// //     }
// //     await notifee.cancelNotification(detail.notification.id);
// //   }
// // });

// // AppRegistry.registerComponent(appName, () => App);



// // /**
// //  * @format
// //  */

// // import { AppRegistry } from 'react-native';
// // import App from './App';
// // import { name as appName } from './app.json';
// // import notifee, { EventType } from '@notifee/react-native';
// // import FileViewer from 'react-native-file-viewer';

// // notifee.onBackgroundEvent(async ({ type, detail }) => {
// //   if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
// //     const path = detail.notification.data?.filePath;
// //     if (path) {
// //       try {
// //         await FileViewer.open(`file://${path}`, { showOpenWithDialog: true, type: 'application/pdf' });
// //       } catch (e) {
// //         console.log('Error opening PDF (killed):', e);
// //       }
// //     }
// //     await notifee.cancelNotification(detail.notification.id);
// //   }
// // });

// // AppRegistry.registerComponent(appName, () => App);
