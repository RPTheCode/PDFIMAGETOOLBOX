import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
  Image,
  TouchableOpacity,
  TextInput,
  Keyboard
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import Share from 'react-native-share';
import FileViewer from 'react-native-file-viewer';
import { Color } from '../utils/Theme';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Dowload, Hide, PdfPick, Show, OpenA, OpenB, ShareA, ShareB, ImagePick } from '../assets/Image/images';
import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// Native module access
const PdfUnlock = NativeModules.PdfUnlock || global.nativePdfUnlockModule;

const UnlockPdf = () => {
  const navigation = useNavigation();
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlockedPath, setUnlockedPath] = useState('');
  const [nativeModuleAvailable, setNativeModuleAvailable] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAction, setSelectedAction] = useState('open'); // 'open' or 'share'
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    console.log('Available native modules:', Object.keys(NativeModules));
    console.log('PdfUnlock module:', NativeModules.PdfUnlock);
    // Check if the native module is available
    const isAvailable = PdfUnlock && typeof PdfUnlock.unlockPdf === 'function';
    setNativeModuleAvailable(isAvailable);
    if (!isAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Native Module Not Available',
        text2: 'The PDF unlock native module is not properly registered. Please rebuild the app.',
      });
    }
  }, []);

  useEffect(() => {
    initNotifications();  // setup notifications on mount
  }, []);

  // handle taps when app is in foreground
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.pressAction.id === 'open-file') {
        const path = detail.notification.data?.filePath;
        if (path) FileViewer.open(path);
        notifee.cancelNotification(detail.notification.id);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Pick and copy the PDF to DocumentDirectory
  const handleSelectPdf = async () => {

    if (!nativeModuleAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Native module not available. Please rebuild the app.',
      });
      return;
    }
    try {
      const res = await pick({ type: types.pdf });
      if (!res || res.length === 0) throw new Error('No file selected');
      const file = res[0];
      const fileUri = file.fileCopyUri ?? file.uri;
      if (!fileUri) throw new Error('No file URI returned');
      const fileName = file.name || 'temp.pdf';
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.copyFile(fileUri, destPath);
      const exists = await RNFS.exists(destPath);
      console.log('Copied file exists:', exists);
      setFilePath(destPath);
      setUnlockedPath('');
      setPassword(''); // Reset password when new file is selected
      setShowPasswordInput(true); // Show password input after file selection
      setIsProcessing(false); // Reset processing state after file selection
    } catch (err) {
      console.log('PDF Selection Error:', err);
      Toast.show({
        type: 'error',
        text1: 'Cannot Select file',
        text2: `${err.message || String(err)}`,
      });
      setIsProcessing(false);
    }
  };

  // Unlock PDF using native module
  const unlockPdf = async () => {
    Keyboard.dismiss(); // off keybord
    if (!filePath) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a PDF file first',
      });
      return;
    }
    if (!nativeModuleAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Native module not available. Please rebuild the app.',
      });
      return;
    }
    if (!password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter the PDF password',
      });
      return;
    }

    setLoading(true);
    setIsProcessing(true);

    try {
      const fileName = filePath.split('/').pop() || 'unlocked.pdf';
      const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName.replace('.pdf', '_unlocked.pdf')}`;
      // Use the password entered by the user
      const result = await PdfUnlock.unlockPdf(filePath, outputPath, password);
      setUnlockedPath(outputPath);
    } catch (error) {
      const errorMsg = error.message;
      console.log('Error', errorMsg);

      // Handle specific error cases
      if (error.code === 'INVALID_PASSWORD') {
        Toast.show({
          type: 'error',
          text1: 'Incorrect Password',
          text2: 'The password you entered is incorrect. Please try again.',
        });
      } else if (error.code === 'INSUFFICIENT_PERMISSION') {
        Toast.show({
          type: 'error',
          text1: 'Permission Error',
          text2: 'The provided password is the user password, not the owner password. Cannot remove encryption.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Cannot Select file',
          text2: `${errorMsg}`,
        });
      }
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };


  // 📥 DOWNLOAD
  const handleDownload = async () => {
    if (!unlockedPath) return;

    try {
      const downloadDir =
        Platform.OS === 'android'
          ? `${RNFS.ExternalStorageDirectoryPath}/Download`
          : RNFS.DocumentDirectoryPath;

      const fileName = unlockedPath.split('/').pop();
      const destPath = `${downloadDir}/${fileName}`;

      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) await RNFS.mkdir(downloadDir);

      await RNFS.copyFile(unlockedPath, destPath);
      await addFileToRecents(destPath);

      console.log('destpath', destPath)

      await showNotification(
        'PDF Download',
        `${destPath}`,
        destPath
      );

      // ✅ HIDE ALL BUTTONS AFTER DOWNLOAD
      setUnlockedPath(null);   // Bottom bar hide
      setFilePath(null);       // Selected file reset
      setPassword('');         // Reset password
      setShowPasswordInput(false); // Hide password input if needed

      return destPath;
    } catch (error) {
      console.log('Download Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to download PDF:',
        text2: `${error.message}`,
      });

    }
  };

  // 🕓 Add to Recents
  const addFileToRecents = async filePath => {
    try {
      if (RNFS.scanFile) {
        await RNFS.scanFile(filePath);
        console.log('📂 File added to Recents:', filePath);
      } else {
        console.log('⚠️ scanFile not supported');
      }
    } catch (err) {
      console.log('❌ Error scanning file:', err);
    }
  };



  const handleOpenPDF = async () => {
    setSelectedAction('open');
    const destPath = await handleDownload(); // ✅ Corrected

    try {
      const fileUri = `file://${destPath}`;
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'PDF file not found',
        });
        return;
      }

      navigation.navigate('PdfViewer', {
        uri: fileUri,
        password: password, // or currentPassword if you prefer
      });

      setPassword('');
      setFilePath(null);
      setUnlockedPath(null);
    } catch (error) {
      console.log('FileViewer Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot open file',
        text2: `${error.message}`,
      });
    }
  };


  // SHARE PDF
  const handleShare = async () => {
    setSelectedAction('share');
    const destPath = await handleDownload(); // Wait for PDF creation
    try {
      const filePath = destPath; // Prefer savedPath if available
      if (!filePath) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'No file available to share',
        });
        return;
      }

      const exists = await RNFS.exists(filePath);
      if (!exists) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'File not found',
        });
        return;
      }

      await Share.open({
        url: 'file://' + filePath,
        type: 'application/pdf',
        failOnCancel: false,
      });


      setPassword('')
      setFilePath(null),
        setUnlockedPath(null);
    } catch (error) {
      console.error('Share Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Share file',
        text2: `${error.message}`,
      });
    }
  };



  return (
    <BaseContainer>
      <ToolsHeader title={'Unlock Pdf'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>


      <View style={styles.container}>
        <Text style={styles.titleText}>Select a PDF to remove password protection</Text>
        {!nativeModuleAvailable && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Native module not available. Please rebuild the app.
            </Text>
          </View>
        )}


        <TouchableOpacity
          style={styles.selectBtn}
          onPress={handleSelectPdf}
        >
          <Image source={PdfPick} style={{ width: 24, height: 24, tintColor: Color.White }} />
          <Text style={styles.selectBtnText}>Select PDF</Text>
        </TouchableOpacity>


        {filePath ? (
          <>
            <Text style={[styles.btnText, { color: Color.Black, textAlign: 'center', marginVertical: 10 }]}>
              Selected: {filePath.split('/').pop()}
            </Text>

            {showPasswordInput && (
              <>

                <View style={styles.section}>
                  <TextInput
                    placeholder='Enter Password'
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Image
                      source={showPassword ? Show : Hide}
                      style={styles.eyeImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>


                <TouchableOpacity
                  style={[styles.btn, { marginTop: 20 }]}
                  onPress={unlockPdf}
                  disabled={loading || isProcessing}
                >
                  <Text style={styles.btnText}>Unlock Pdf</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : null}

        {(loading || isProcessing) && (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        )}

        {unlockedPath && !loading && !isProcessing && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: Color.Purple, width: '60%' },
              ]}
              onPress={handleDownload}
            >
              <>
                <Text style={styles.actionText}>Download PDF</Text>
                <Image source={Dowload} style={{ width: 24, height: 24 }} />
              </>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderWidth: selectedAction === 'open' ? 2 : 0,
                  borderColor: selectedAction === 'open' ? Color.Purple : 'transparent',
                }
              ]}
              onPress={handleOpenPDF}
            >
              <Image source={selectedAction === 'open' ? OpenB : OpenA} style={{ width: 24, height: 24 }} />

            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  borderWidth: selectedAction === 'share' ? 2 : 0,
                  borderColor: selectedAction === 'share' ? Color.Purple : 'transparent',
                }
              ]}
              onPress={handleShare}
            >
              <Image source={selectedAction === 'share' ? ShareB : ShareA} style={{ width: 24, height: 24 }} />

            </TouchableOpacity>

          </View>
        )}
      </View>

    </BaseContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: Color.White,
  },
  titleText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 6,
    fontWeight: '600',
    color: Color.Black,
  },
  btn: {
    backgroundColor: Color.Purple,
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 14,
  },
  selectBtn: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    backgroundColor: Color.Purple,
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectBtnText: { color: Color.White, fontSize: 16, fontWeight: 600 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 10,
  },
  eyeIcon: {
    // paddingHorizontal: 8,
    // marginRight: 6,
  },
  eyeImage: {
    width: 24,
    height: 24,
    tintColor: '#666',
  },
  filePath: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginVertical: 10,
  },

  loader: {
    marginVertical: 20,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 5,
  },
  bottomBar: {
    width: '100%',
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionBtn: {
    alignItems: 'center',
    backgroundColor: Color.LightGray1,
    padding: 12,
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    borderRadius: 10,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600', color: 'white',
  },

})

export default UnlockPdf;





// import React, { useEffect, useState } from 'react';
// import {
//   StyleSheet,
//   Text,
//   View,
//   Alert,
//   ActivityIndicator,
//   Platform,
//   Modal,
//   TouchableOpacity,
//   TextInput
// } from 'react-native';
// import { pick, types } from '@react-native-documents/picker';
// import RNFS from 'react-native-fs';
// import { NativeModules } from 'react-native';
// import Share from 'react-native-share';
// import FileViewer from 'react-native-file-viewer';
// import { Color } from '../utils/Theme';
// import BaseContainer from './BaseContainer';
// import ToolsHeader from './ToolsHeader';

// import { useNavigation } from '@react-navigation/native';

// // Native module access
// const PdfUnlock = NativeModules.PdfUnlock || global.nativePdfUnlockModule;

// const UnlockPdf = () => {
//   const navigation = useNavigation();
//   const [filePath, setFilePath] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState('');
//   const [unlockedPath, setUnlockedPath] = useState('');
//   const [nativeModuleAvailable, setNativeModuleAvailable] = useState(false);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [modalVisible, setModalVisible] = useState(false);
//   const [savedPath, setSavedPath] = useState('');
//   const [password, setPassword] = useState(''); // New state for password
//   const [showPasswordInput, setShowPasswordInput] = useState(false); // New state to show password input

//   useEffect(() => {
//     console.log('Available native modules:', Object.keys(NativeModules));
//     console.log('PdfUnlock module:', NativeModules.PdfUnlock);

//     // Check if the native module is available
//     const isAvailable = PdfUnlock && typeof PdfUnlock.unlockPdf === 'function';
//     setNativeModuleAvailable(isAvailable);

//     if (!isAvailable) {
//       Alert.alert(
//         'Native Module Not Available',
//         'The PDF unlock native module is not properly registered. Please rebuild the app.',
//         [{ text: 'OK' }]
//       );
//     }
//   }, []);

//   // Pick and copy the PDF to DocumentDirectory
//   const handleSelectPdf = async () => {
//     if (!nativeModuleAvailable) {
//       Alert.alert(
//         'Error',
//         'Native module not available. Please rebuild the app.'
//       );
//       return;
//     }

//     try {
//       const res = await pick({ type: types.pdf });
//       if (!res || res.length === 0) throw new Error('No file selected');

//       const file = res[0];
//       const fileUri = file.fileCopyUri ?? file.uri;
//       if (!fileUri) throw new Error('No file URI returned');

//       const fileName = file.name || 'temp.pdf';
//       const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

//       await RNFS.copyFile(fileUri, destPath);
//       const exists = await RNFS.exists(destPath);
//       console.log('Copied file exists:', exists);

//       setFilePath(destPath);
//       setResult('');
//       setUnlockedPath('');
//       setIsProcessing(true);
//       setPassword(''); // Reset password when new file is selected
//       setShowPasswordInput(true); // Show password input after file selection
//     } catch (err) {
//       console.log('PDF Selection Error:', err);
//       Alert.alert('Error', err.message || String(err));
//       setIsProcessing(false);
//     }
//   };



//   // Unlock PDF using native module
//   const unlockPdf = async () => {
//     if (!filePath) {
//       Alert.alert('Error', 'Please select a PDF file first');
//       return;
//     }
//     if (!nativeModuleAvailable) {
//       Alert.alert(
//         'Error',
//         'Native module not available. Please rebuild the app.'
//       );
//       return;
//     }
//     if (!password) {
//       Alert.alert('Error', 'Please enter the PDF password');
//       return;
//     }

//     setLoading(true);
//     setResult('');
//     setIsProcessing(true);

//     try {
//       const fileName = filePath.split('/').pop() || 'unlocked.pdf';
//       const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName.replace('.pdf', '_unlocked.pdf')}`;
//       // Use the password entered by the user
//       const result = await PdfUnlock.unlockPdf(filePath, outputPath, password);
//       setResult(result);
//       setUnlockedPath(outputPath);
//       Alert.alert('Success', 'PDF password removed successfully!');
//     } catch (error) {
//       const errorMsg = error.message;
//       setResult(`Error: ${errorMsg}`);
//       console.log('Error', errorMsg);
//       Alert.alert('Error :::', errorMsg);
//     } finally {
//       setLoading(false);
//       setIsProcessing(false);
//     }
//   };


//   // 📥 DOWNLOAD
//   const handleDownload = async () => {
//     if (!unlockedPath) return;

//     try {
//       const downloadDir =
//         Platform.OS === 'android'
//           ? `${RNFS.ExternalStorageDirectoryPath}/Download`
//           : RNFS.DocumentDirectoryPath;

//       const fileName = unlockedPath.split('/').pop();
//       const destPath = `${downloadDir}/${fileName}`;

//       const dirExists = await RNFS.exists(downloadDir);
//       if (!dirExists) await RNFS.mkdir(downloadDir);

//       await RNFS.copyFile(unlockedPath, destPath);
//       await addFileToRecents(destPath);

//       console.log('destpath', destPath)

//       setSavedPath(destPath);
//       setModalVisible(true);
//     } catch (error) {
//       console.log('Download Error:', error);
//       Alert.alert('Error', 'Failed to download PDF: ' + error.message);
//     }
//   };

//   // 🕓 Add to Recents
//   const addFileToRecents = async filePath => {
//     try {
//       if (RNFS.scanFile) {
//         await RNFS.scanFile(filePath);
//         console.log('📂 File added to Recents:', filePath);
//       } else {
//         console.log('⚠️ scanFile not supported');
//       }
//     } catch (err) {
//       console.log('❌ Error scanning file:', err);
//     }
//   };

//   // 📖 Open PDF
//   const handleOpenPDF = async () => {
//     try {
//       if (!savedPath) {
//         Alert.alert('Error', 'No saved PDF found');
//         return;
//       }

//       if (!FileViewer || !FileViewer.open) {
//         Alert.alert('Error', 'File Viewer module not available');
//         return;
//       }

//       const exists = await RNFS.exists(savedPath);
//       if (!exists) {
//         Alert.alert('Error', 'PDF file not found at: ' + savedPath);
//         return;
//       }

//       const fileUri = `file://${savedPath}`;
//       navigation.navigate('PdfViewer', { uri: fileUri });

//       // await FileViewer.open(`file://${savedPath}`, {
//       //   showOpenWithDialog: true,
//       //   showAppsSuggestions: true,
//       // });

//       setModalVisible(false);
//       setFilePath(null);
//       setUnlockedPath(null); // FIXED: was setProtectedPdfPath
//     } catch (error) {
//       console.log('FileViewer Error:', error);
//       Alert.alert('Error', error.message || 'Unable to open PDF');
//     }
//   };


//   // 📤 Share
//   const handleShare = async () => {
//     try {
//       const filePath = savedPath || unlockedPath; // Prefer savedPath if available

//       if (!filePath) {
//         Alert.alert('Error', 'No file available to share');
//         return;
//       }

//       const exists = await RNFS.exists(filePath);
//       if (!exists) {
//         Alert.alert('Error', 'File not found at: ' + filePath);
//         return;
//       }

//       await Share.open({
//         url: `file://${filePath}`,
//         type: 'application/pdf',
//         failOnCancel: false,
//       });

//       setModalVisible(false);
//       setFilePath(null);
//       setUnlockedPath(null); // FIXED: removed setProtectedPdfPath
//     } catch (error) {
//       console.error('Share Error:', error);
//       Alert.alert('Error', `Failed to share: ${error.message}`);
//     }
//   };



//   return (
//     <BaseContainer>
//       <ToolsHeader title={'Unlock Pdf'} />
//       <View style={styles.container}>
//         <Text style={styles.titleText}>Select a PDF to remove password protection</Text>

//         {!nativeModuleAvailable && (
//           <View style={styles.errorContainer}>
//             <Text style={styles.errorText}>
//               Native module not available. Please rebuild the app.
//             </Text>
//           </View>
//         )}

//         <View style={styles.buttonContainer}>
//           <TouchableOpacity style={styles.btn} onPress={handleSelectPdf}>
//             <Text style={styles.btnText}>
//               Select PDF
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {filePath ? (
//           <>
//             <Text style={[styles.btnText, { color: Color.Black, textAlign: 'center', marginVertical: 10 }]}>
//               Selected: {filePath.split('/').pop()}
//             </Text>

//               <>
//                 <TextInput
//                   placeholder='Enter Password'
//                   style={styles.input}
//                   secureTextEntry={true}
//                   value={password}
//                   onChangeText={setPassword}
//                 />

//                 <TouchableOpacity
//                   style={[styles.btn, { marginTop: 20 }]}
//                   onPress={unlockPdf}
//                   disabled={loading || isProcessing}
//                 >
//                   <Text style={styles.btnText}>Unlock Pdf</Text>
//                 </TouchableOpacity>
//               </>
//           </>
//         ) : null}

// {/*
//         {(loading || isProcessing) && (
//           <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
//         )} */}


//         {unlockedPath && !loading && !isProcessing && (

//           <TouchableOpacity
//             style={[styles.btn, { marginTop: 20 }]}
//             onPress={handleDownload}
//           >
//             <Text style={styles.btnText}>Download Pdf</Text>

//           </TouchableOpacity>
//         )}

//       </View>


//       {/* New Modal */}
//       <Modal
//         transparent
//         visible={modalVisible}
//         animationType="fade"
//         onRequestClose={() => setModalVisible(false)}
//       >
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContent}>
//             <Text style={[styles.modalTitle, { textAlign: 'left' }]}>
//               ✅ PDF Unlocked Successfully
//             </Text>
//             <Text style={{ textAlign: 'center' }}>
//               Saved to:{'\n'} {savedPath}
//             </Text>
//             <View
//               style={{
//                 width: '100%',
//                 flexDirection: 'row',
//                 justifyContent: 'space-between',
//                 padding: 14,
//               }}
//             >
//               <TouchableOpacity
//                 style={styles.modalBtn}
//                 onPress={handleOpenPDF}
//               >
//                 <Text style={styles.modalBtnText}>Open</Text>
//               </TouchableOpacity>

//               <TouchableOpacity style={styles.modalBtn} onPress={handleShare}>
//                 <Text style={styles.modalBtnText}>Share</Text>
//               </TouchableOpacity>
//             </View>
//             <TouchableOpacity
//               style={[styles.modalBtn, { backgroundColor: Color.Gray, paddingHorizontal: 40 }]}
//               onPress={() => {
//                 setModalVisible(false);
//                 setFilePath(null);
//                 setUnlockedPath(null);
//               }}
//             >
//               <Text style={styles.modalBtnText}>OK</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </BaseContainer>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 14,
//     backgroundColor: Color.White,
//   },
//   titleText: {
//     textAlign: 'center',
//     fontSize: 16,
//     marginVertical: 6,
//     fontWeight: '600',
//     color: Color.Black,
//   },
//   btn: {
//     backgroundColor: Color.Purple,
//     marginTop: 16,
//     padding: 14,
//     borderRadius: 10,
//     alignItems: 'center',
//   },
//   btnDisabled: { opacity: 0.6 },
//   btnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
//   inputRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-evenly',
//     marginTop: 14,
//   },
//   section: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     marginVertical: 6,
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     marginTop: 10,
//     height: 50,
//     fontSize: 16,
//   },
//   eyeIcon: {
//     // paddingHorizontal: 8,
//     // marginRight: 6,
//   },
//   eyeImage: {
//     width: 24,
//     height: 24,
//     tintColor: '#666',
//   },
//   filePath: {
//     fontSize: 14,
//     textAlign: 'center',
//     color: '#666',
//     marginVertical: 10,
//   },
//   modalOverlay: {
//     flex: 1,
//     marginHorizontal: 10,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContent: {
//     backgroundColor: 'white',
//     padding: 10,
//     borderRadius: 12,
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//     elevation: 7, // Android only
//   },
//   modalTitle: {
//     width: '100%',
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 8,
//   },
//   modalBtn: {
//     backgroundColor: Color.Purple,
//     padding: 8,
//     width: '45%',
//     alignItems: 'center',
//     borderRadius: 8,
//   },
//   modalBtnText: { fontSize: 16, color: 'white', fontWeight: 'bold' },
// });

// export default UnlockPdf;