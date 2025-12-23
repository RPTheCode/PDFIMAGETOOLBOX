// Notification.js
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform, Linking, NativeModules } from 'react-native';
import FileViewer from 'react-native-file-viewer';

// Get content:// URI
export const getContentUri = async (filePath) => {
  if (Platform.OS === 'android') {
    try {
      // Path se 'file://' hatao aur pure absolute file system path do
      const purePath = filePath.startsWith('file://') ? filePath.slice(7) : filePath;
      // Native module me bas actual file system path do, na ki content:// prefix
      const contentUri = await NativeModules.FileProviderModule?.getUriForFile(purePath);
      return contentUri || `content://${purePath}`;
    } catch (err) {
      // Fallback mein file:// prefix sahi lagta hai
      return `file://${filePath}`;
    }
  }
  return `file://${filePath}`;
};

// Init notifications
export const initNotifications = async () => {
  await notifee.requestPermission();
  await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
  });
};

// Show notification
export const showNotification = async (title, body, filePath, type = 'pdf') => {
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: 'default',
      smallIcon: 'ic_launcher',
      pressAction: { id: 'open-file' },
    },
    data: { filePath, type },
  });
};

// Common open function
// const openFile = async (fileUri, fileType) => {
//   try {
//     if (fileType === 'image') {
//       const contentUri = await getContentUri(fileUri.replace('file://', ''));
//       if (await Linking.canOpenURL(contentUri)) {
//         await Linking.openURL(contentUri);
//       }
//     } else {
//       // PDF ke liye full path zaruri hai
//       // fileUri poora absolute path hona chahiye, jaisa ke above savedPath me aata hai
//       // await FileViewer.open(fileUri.replace('file://', ''));
//       try {
//         await FileViewer.open(path);
//       } catch (e) {
//         const uri = await getContentUri(path);
//         await Linking.openURL(uri);
//       }
//     }
//   } catch (error) {
//     console.log('openFile error:', error);
//   }
// };

const openFile = async (fileUri, fileType) => {
  try {
    if (fileType === 'image') {
      const contentUri = await getContentUri(fileUri.replace('file://', ''));
      if (await Linking.canOpenURL(contentUri)) {
        await Linking.openURL(contentUri);
      }
    } else {
      // PDF file ke liye FileViewer se koshish karo
      await FileViewer.open(fileUri.replace('file://', ''));
    }
  } catch (error) {
    console.log("FileViewer failed, fallback error:", error);
    // fallback me content URI ke through Linking ka use karo
    try {
      const contentUri = await getContentUri(fileUri.replace('file://', ''));
      if (await Linking.canOpenURL(contentUri)) {
        await Linking.openURL(contentUri);
      } else {
        console.log("Cannot open fallback URI:", contentUri);
      }
    } catch (fallbackError) {
      console.log("Fallback method error:", fallbackError);
    }
  }
};



// Notification press handler
export const imageOpenNotification = async () => {
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.pressAction.id === 'open-file') {
    const path = detail.notification.data?.filePath;
    if (!path) return;
    console.log('Opening PDF:', path);

    try {
      await FileViewer.open(path.startsWith('file://') ? path : `file://${path}`, { showOpenWithDialog: true });
    } catch (error) {
      console.log('FileViewer failed, trying fallback:', error);
      const uri = await getContentUri(path);
      if (await Linking.canOpenURL(uri)) {
        await Linking.openURL(uri);
      } else {
        await Linking.openFile(uri)
        console.log('Cannot open fallback URI:', uri);
      }
    }
    await notifee.cancelNotification(detail.notification.id);
  }
});


  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS && detail.pressAction.id === 'open-file') {
      const path = detail.notification.data?.filePath;
      const fileType = detail.notification.data?.type || 'pdf';
      if (path) {
        const fileUri = path.startsWith('file://') ? path : `file://${path}`;
        await openFile(fileUri, fileType);
      }
      await notifee.cancelNotification(detail.notification.id);
    }
  });
};

export const PressNotification = () => {
  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
      const path = detail.notification.data?.filePath;
      if (path) {
        try {
          await FileViewer.open(
            path.startsWith('file://') ? path : `file://${path}`,
          );
        } catch (error) {
          const contentUri = await getContentUri(path);
          if (await Linking.canOpenURL(contentUri)) {
            await Linking.openURL(contentUri);
          }
        }
      }
      await notifee.cancelNotification(detail.notification.id);
    }
  });
};

// import notifee, { AndroidImportance , EventType} from '@notifee/react-native';
// import { Platform, Linking, NativeModules } from 'react-native';
// import FileViewer from 'react-native-file-viewer';

// // ✅ Convert to content:// URI (Android)
// export const getContentUri = async (filePath) => {
//   if (Platform.OS === 'android') {
//     try {
//       if (NativeModules.FileProviderModule?.getUriForFile) {
//         return await NativeModules.FileProviderModule.getUriForFile(filePath);
//       }
//       return `file://${filePath}`;
//     } catch (e) {
//       console.log('getContentUri error:', e);
//       return `file://${filePath}`;
//     }
//   }
//   return `file://${filePath}`;
// };

// // ✅ Init
// export const initNotifications = async () => {
//   await notifee.requestPermission();
//   await notifee.createChannel({
//     id: 'default',
//     name: 'Default Channel',
//     importance: AndroidImportance.HIGH,
//   });
// };

// // ✅ Show Notification
// export const showNotification = async (title, body, filePath, type = 'pdf') => {
//   await notifee.displayNotification({
//     title,
//     body,
//     android: {
//       channelId: 'default',
//       smallIcon: 'ic_launcher',
//       pressAction: { id: 'open-file' },
//     },
//     data: { filePath, type },
//   });
// };

// // ✅ Handle tap (foreground/background)
// export const handleNotificationPress = async (detail) => {
//   const path = detail.notification.data?.filePath;
//   if (!path) return;

//   try {
//     if (Platform.OS === 'android') {
//       try {
//         // First try FileViewer
//         await FileViewer.open(path.startsWith('file://') ? path : `file://${path}`);
//       } catch (error) {
//         console.log('FileViewer failed, fallback:', error);
//         const uri = await getContentUri(path);
//         await Linking.openURL(uri);
//       }
//     } else {
//       await Linking.openURL(`file://${path}`);
//     }
//   } catch (err) {
//     console.log('Error opening file from notification:', err);
//   }
//   await notifee.cancelNotification(detail.notification.id);
// };

// // ✅ Common open function
// const openFile = async (fileUri, fileType) => {
//   try {
//     if (fileType === 'image') {
//       // ✅ Always open images in Gallery
//       const contentUri = await getContentUri(fileUri.replace('file://', ''));
//       if (await Linking.canOpenURL(contentUri)) {
//         await Linking.openURL(contentUri);
//       } else {
//         console.log("Gallery cannot open:", contentUri);
//       }
//     } else {
//       // ✅ PDF open with FileViewer
//       await FileViewer.open(fileUri.replace('file://', ''));
//     }
//   } catch (error) {
//     console.log("openFile error:", error);
//   }
// };

// // ✅ Notification press handler (foreground + background)
// export const imageOpenNotification = async () => {
//   console.log("📢 Notification listener started");

//   // Foreground
//   notifee.onForegroundEvent(async ({ type, detail }) => {
//     if (type === EventType.PRESS && detail.pressAction.id === 'open-file') {
//       const path = detail.notification.data?.filePath;
//       const fileType = detail.notification.data?.fileType || 'pdf';

//       if (path) {
//         const fileUri = path.startsWith('file://') ? path : `file://${path}`;
//         await openFile(fileUri, fileType);
//       }

//       await notifee.cancelNotification(detail.notification.id);
//     }
//   });

//   // Background
//   notifee.onBackgroundEvent(async ({ type, detail }) => {
//     if (type === EventType.PRESS && detail.pressAction.id === 'open-file') {
//       const path = detail.notification.data?.filePath;
//       const fileType = detail.notification.data?.fileType || 'pdf';

//       if (path) {
//         const fileUri = path.startsWith('file://') ? path : `file://${path}`;
//         await openFile(fileUri, fileType);
//       }

//       await notifee.cancelNotification(detail.notification.id);
//     }
//   });
// };

// // Notification.js
// import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
// import { PermissionsAndroid, Platform } from 'react-native';
// import { navigationRef } from '../navigation/Rootnavigation';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// export const getContentUri = async (filePath) => {
//   if (Platform.OS === 'android') {
//     try {
//       const contentUri = await NativeModules.FileProviderModule?.getUriForFile(filePath);
//       return contentUri || `content://${filePath}`;
//     } catch (e) {
//       console.log("getContentUri error:", e);
//       return `file://${filePath}`;
//     }
//   }
//   return `file://${filePath}`;
// };

// // Initialize notification channel and permissions
// export const initNotifications = async () => {
//   if (Platform.OS === 'android' && Platform.Version >= 33) {
//     await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//     );
//   }

//   await notifee.createChannel({
//     id: 'default',
//     name: 'Default Channel',
//     importance: AndroidImportance.HIGH,
//   });
// };

// // Show a notification for a created PDF with a tap action
// export const showNotification = async (title, body, filePath) => {
//   await notifee.displayNotification({
//     title,
//     body,
//     android: {
//       channelId: 'default',
//       smallIcon: 'ic_launcher', // ensure this exists in your Android resources
//       pressAction: { id: 'open-pdf' },
//     },
//     data: { filePath },
//   });
// };

// // Notification tap handle karna
// export const PressNotification = () => {
//   console.log('Killed app call this function PressNotification');

//   notifee.onForegroundEvent(async ({ type, detail }) => {
//     if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
//       const path = detail.notification.data?.filePath;
//       if (path) {
//         const fileUri = `file://${path}`;

//         // Pehle FileViewer se try karo
//         try {
//           await FileViewer.open(fileUri);
//         } catch (error) {
//           console.log('FileViewer failed, trying fallback:', error);

//           // Fallback: content URI ke saath Linking
//           try {
//             const contentUri = await getContentUri(fileUri);
//             if (await Linking.canOpenURL(contentUri)) {
//               await Linking.openURL(contentUri);
//             } else {
//               console.log('Cannot open file via Linking:', contentUri);
//             }
//           } catch (err) {
//             console.log('Fallback also failed:', err);
//           }
//         }
//       }

//       // Notification cancel kar do
//       await notifee.cancelNotification(detail.notification.id);
//     }
//   });

//   console.log('PressNotification listener active');
// };

// // Notification.js
// import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
// import { PermissionsAndroid, Platform } from 'react-native';
// import { navigationRef } from '../navigation/Rootnavigation';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import FileViewer from 'react-native-file-viewer';

// // Initialize notification channel and permissions
// export const initNotifications = async () => {
//   if (Platform.OS === 'android' && Platform.Version >= 33) {
//     await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//     );
//   }

//   await notifee.createChannel({
//     id: 'default',
//     name: 'Default Channel',
//     importance: AndroidImportance.HIGH,
//   });
// };

// // Show a notification for a created PDF with a tap action
// export const showNotification = async (title, body, filePath) => {
//   await notifee.displayNotification({
//     title,
//     body,
//     android: {
//       channelId: 'default',
//       smallIcon: 'ic_launcher', // ensure this exists in your Android resources
//       pressAction: { id: 'open-pdf' },
//     },
//     data: { filePath },
//   });
// };

// // Handle taps when the app is backgrounded or closed
// export const PressNotification = () => {
//   console.log('call press notification funciton');

//   notifee.onBackgroundEvent(async ({ type, detail }) => {
//     if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
//       const path = detail.notification.data?.filePath;
//       if (path) {
//         try {
//           // Open the file using device's default viewer (without opening app screen)
//           await FileViewer.open(`file://${path}`, {
//             showOpenWithDialog: true,
//           });
//         } catch (error) {
//           console.log('Failed to open file:', error);
//         }
//       }

//       // Cancel the notification after pressing
//       await notifee.cancelNotification(detail.notification.id);
//     }
//   });
// };
