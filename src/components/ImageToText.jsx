

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Pressable
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';
import { Color } from '../utils/Theme';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import { CameraPick, CopyA, CopyB, Delete, Dowload, ImagePick, OpenA, OpenB, ShareA, ShareB } from '../assets/Image/images';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { setShouldAnimateExitingForTag } from 'react-native-reanimated/lib/typescript/core';
import notifee, { EventType } from '@notifee/react-native';
import FileViewer from 'react-native-file-viewer';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const ImageToText = () => {
  const navigation = useNavigation();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [text, setText] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const [selectedAction, setSelectedAction] = useState('copy');
  const scrollViewRef = useRef(null);
  const [txtFilePath, setTxtFilePath] = useState(null);


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
  }, []);


  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // First check if we already have permission granted
        const storedPermission = await AsyncStorage.getItem('storagePermission');
        if (storedPermission === 'granted') {
          return true;
        }

        // If permission was previously denied, check if we should ask again
        if (storedPermission === 'denied') {
          // You could implement a counter here to limit how often you ask
          // Or you could show a dialog directing the user to app settings
        }

        let permissions = [];
        if (Platform.Version >= 33) {
          // Android 13+ (API 33 and above)
          permissions = [
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          ];
        } else {
          // Android 12 and below
          permissions = [
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ];
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED,
        );

        // Store permission status in AsyncStorage
        if (allGranted) {
          await AsyncStorage.setItem('storagePermission', 'granted');
        } else {
          // Check if any permission was permanently denied
          const permanentlyDenied = Object.entries(granted).some(
            ([permission, status]) => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          );

          await AsyncStorage.setItem('storagePermission', 'denied');
        }

        return allGranted;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };


  const handleSelectImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    launchImageLibrary({ mediaType: 'photo' }, response => {
      if (response.assets && response.assets[0].uri) {
        const uri = response.assets[0].uri;
        setSelectedImage({ uri });
        setShowDownload(false);
        performTextRecognition(uri);
      }
    });
    setSelectedAction('copy');
  };

  const handleOpenCamera = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    launchCamera({ mediaType: 'photo' }, response => {
      if (response.assets && response.assets[0].uri) {
        const uri = response.assets[0].uri;
        setSelectedImage({ uri });
        setShowDownload(false);
        performTextRecognition(uri);
      }
    });
  };


  const performTextRecognition = async uri => {
    setIsConverting(true);
    try {
      const result = await TextRecognition.recognize(uri);
      setText(result.text);
      console.log('OCR result', result);

      if (!result.text) {
        Toast.show({
          type: 'error',
          text1: 'cannot Fatch Text',
          text2: 'No text was recognized in the image! select another image.',
        });
        setIsConverting(false);
        setSelectedImage(null);
        setText('');
        return;
      }

      setShowDownload(true);
      Toast.show({
        type: 'success',
        text1: '✅ OCR Successful',
        text2: 'Text recognized successfully!',
      });

    } catch (error) {
      console.error(error);
      setText('Error recognizing text');
    }
    setIsConverting(false);
  };


  const handleGenerateTextTxt = async () => {
    if (!text || text.trim() === '') {
      Toast.show({
        type: 'error',
        text1: 'Cannot Find Text',
        text2: 'No text available to create TXT file.',
      });
      return;
    }

    try {

      const folderPath = `${RNFS.DownloadDirectoryPath}`;
      const folderExists = await RNFS.exists(folderPath);
      if (!folderExists) await RNFS.mkdir(folderPath);

      // 🔥 Use timestamp to make filename unique
      const timestamp = Date.now();
      const fileName = `MyTextPDF_${timestamp}.txt`;
      const content = text;
      const path = `${folderPath}/${fileName}`;

      await RNFS.writeFile(path, content, 'utf8');
      setTxtFilePath(path); // ✅ Save path for sharing


      // ✅ Add to Recents
      await addFileToRecents(path);

      await showNotification(
        'PDF Download',
        `${path}`,
        path
      );

      console.log('TXT File Path:', path);

      setShowDownload(false);

      setSelectedAction('copy');
      setSelectedImage(null);
      setText('');
      return path;
    } catch (error) {
      console.error('TXT file creation error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Create file',
        text2: `${error.message}`,
      });
    }
  };

  // 📌 Helper function to add file in Android Recents
  const addFileToRecents = async filePath => {
    try {
      if (RNFS.scanFile) {
        // await RNFS.scanFile([{ path: filePath }]);
        await RNFS.scanFile(filePath);
        console.log('📂 File scanned & added to Recents:', filePath);
      } else {
        console.log('⚠️ scanFile not supported in this RNFS version');
      }
    } catch (err) {
      console.log('❌ Error scanning file:', err);
    }
  };


  const handleShareTxt = async () => {
    setSelectedAction('share');
    try {
      let filePathToShare = txtFilePath;

      // ⛔ If no file or the file doesn't exist
      if (!filePathToShare || !(await RNFS.exists(filePathToShare))) {
        console.log('No TXT file found, generating one...');
        const generatedPath = await handleGenerateTextTxt();

        // ✅ Update the file path if generated successfully
        if (!generatedPath || !(await RNFS.exists(generatedPath))) {
          throw new Error('TXT file not available for sharing');
        }

        filePathToShare = generatedPath;
      }

      console.log('Sharing TXT file at:', filePathToShare);

      await Share.open({
        title: 'Share Text File',
        url: `file://${filePathToShare}`,
        type: 'text/plain',
        message: '',
      });

      filePathToShare = null; // Clear after sharing
      setTxtFilePath(null);
      setSelectedAction('copy');
      setSelectedImage(null);
      setText('');
      setShowDownload(false);
    } catch (error) {
      console.error('Share TXT Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Share Failed',
        text2: `${error.message}`,
      });
    }
  };





  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <BaseContainer>
      <ToolsHeader title={'Image to Text'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} // adjust if header overlaps
      >
        <ScrollView ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 50 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <Text style={styles.titleText}>📸 Select or Capture Image for OCR</Text>

            {!showDownload && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  justifyContent: 'space-evenly',
                }}
              >
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={handleSelectImage}
                >
                  <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
                  <Text style={styles.selectBtnText}>Select Images</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={handleOpenCamera}
                >
                  <Image source={CameraPick} style={{ width: 24, height: 24, tintColor: Color.White }} />
                  <Text style={styles.selectBtnText}>Open Camera</Text>
                </TouchableOpacity>
              </View>
            )}

            {isConverting && (
              <ActivityIndicator
                size="large"
                color={Color.Purple}
                style={{ marginTop: 20 }}
              />
            )}

            {selectedImage && !isConverting && (
              <ScrollView
                contentContainerStyle={styles.a4Container}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.previewImage} // Make sure to define this style
                  resizeMode="contain"
                />
                {/* <Text style={styles.ocrText}>{text}</Text> */}
                <TextInput
                  style={styles.editableText}
                  multiline
                  value={text}
                  onChangeText={setText} // ✅ allow editing
                  textAlignVertical="top"
                />
              </ScrollView>
            )}

            {showDownload && (
              <View>

                <View style={styles.bottomBar}>


                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: Color.Purple, width: '60%' },
                    ]}
                    onPress={handleGenerateTextTxt}
                  >
                    <>
                      <Text style={styles.actionText}>Download File</Text>
                      <Image source={Dowload} style={{ width: 24, height: 24 }} />
                    </>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderWidth: selectedAction === 'copy' ? 2 : 0,
                        borderColor: selectedAction === 'copy' ? Color.Purple : 'transparent',
                      }
                    ]}
                    onPress={() => {
                      Clipboard.setString(text);
                      Toast.show({
                        type: 'success',
                        text1: 'Text Copied',
                        text2: 'The text has been copied to clipboard.',
                      });
                    }}
                  >
                    <Image source={selectedAction === 'copy' ? CopyB : CopyA} style={{ width: 24, height: 24 }} />

                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderWidth: selectedAction === 'share' ? 2 : 0,
                        borderColor: selectedAction === 'share' ? Color.Purple : 'transparent',
                      }
                    ]}
                    onPress={handleShareTxt}
                  >
                    <Image source={selectedAction === 'share' ? ShareB : ShareA} style={{ width: 24, height: 24 }} />

                  </TouchableOpacity>

                </View>
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </BaseContainer>
  );
};

export default ImageToText;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: Color.White,
  },
  titleText: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: Color.Black,
    marginVertical: 20,
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
  btn: {
    backgroundColor: Color.Purple,
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: Color.White,
    fontSize: 18,
    fontWeight: 600,
  },
  previewImage: {
    width: '100%',
    height: 300,
    marginVertical: 10,
  },
  a4Container: {
    flexGrow: 1,
    marginTop: 20,
    padding: 20,
    backgroundColor: Color.White,
    // minHeight: 842,
  },
  ocrText: {
    fontSize: 16,
    color: Color.LightGray5,
    lineHeight: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: Color.LightGray2,
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  downloadBtn: {
    width: '45%',
    backgroundColor: Color.Purple,
    padding: 14,
    marginTop: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: Color.White,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBox: {
    backgroundColor: Color.White,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMsg: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalText: { fontSize: 16, color: 'white', fontWeight: 'bold' },
  modalBtn: {
    backgroundColor: Color.Purple,
    padding: 8,
    width: '45%',
    alignItems: 'center',
    borderRadius: 8,
  },

  modalBtnText: { textAlign: 'center', color: Color.White, fontWeight: '600' },

  bottomBar: {
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
  copyBtn: {
    width: ' 45%',
    alignItems: 'center',
    backgroundColor: Color.Purple,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: {
    color: Color.White,
    fontWeight: '600',
    fontSize: 16,
  },
  editableText: {
    fontSize: 16,
    color: Color.Black,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: Color.LightGray2,
    borderRadius: 8,
    padding: 10,
    minHeight: 200,
    marginTop: 10,
  },
});

