

import { StyleSheet, Image, Text, View, TextInput, ActivityIndicator, TouchableOpacity, Platform, Keyboard } from 'react-native'
import React, { useEffect, useState } from 'react'
import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs'
import { NativeModules } from 'react-native'
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import { Color } from '../utils/Theme';
import FileViewer from 'react-native-file-viewer';
import Share from 'react-native-share';
import { Dowload, Hide, PdfPick, Show, OpenA, OpenB, ShareA, ShareB } from '../assets/Image/images';
const { PdfPassword } = NativeModules;

import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const ProtectPdf = () => {

  const navigation = useNavigation();
  const [filePath, setFilePath] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [protectedPdfPath, setProtectedPdfPath] = useState(null)
  const [selectedAction, setSelectedAction] = useState('open'); // "open" | "share" | null
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);



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


  // Pick a PDF file - using the provided function
  const handleSelectPdf = async () => {
    try {
      const res = await pick({ type: types.pdf });
      if (!res || res.length === 0) throw new Error('No file selected');
      const file = res[0];
      const fileUri = file.fileCopyUri ?? file.uri;
      if (!fileUri) throw new Error('No file URI returned');
      const fileName = file.name || 'temp.pdf';
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      console.log('Source URI:', fileUri);
      console.log('Destination path:', destPath);
      await RNFS.copyFile(fileUri, destPath);
      // Verify file exists
      const exists = await RNFS.exists(destPath);
      console.log('File exists after copy:', exists);
      setFilePath(destPath);
      setProtectedPdfPath(null);
      setShowPassword(false)
      setPassword('')
      setConfirmPassword('')
      setShowConfirmPassword(false)
      setSelectedAction('open')
    } catch (err) {
      console.log('PDF Selection Error:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'File Viewer module not available',
      });
    }
  }

  const getFileName = path => path?.split('/').pop() || '';

  // PDF protect karne ka function using PdfPassword
  const protectPdf = async () => {
    Keyboard.dismiss();
    // Validation check
    if (!filePath) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please Select a PDF file first',
      });
      return
    }
    if (!password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a password',
      });
      return
    }
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Passwords do not match',
      });
      return
    }
    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Password should at least 6 characters long!',
      });
      return
    }

    setLoading(true);
    setShowPassword(false)
    setShowConfirmPassword(false)

    try {
      const fileName = filePath.split('/').pop().replace('.pdf', '_protected.pdf');
      const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      console.log('Applying password protection using native module...');
      const result = await PdfPassword.addPasswordProtection({
        inputPath: filePath,
        outputPath,
        password,
        permissions: { printing: false, copying: false } // Optional
      });
      console.log('add Password on pdf', result, password);

      if (result) {
        setProtectedPdfPath(result);
        console.log('PDF has been password protected successfully!');

      } else {
        throw new Error('Failed to protect PDF');
      }
    } catch (error) {
      console.log('PDF Protection Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Protect Pdf',
        text2: `${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Protected PDF download karne ka function
  const handleDownloadPdf = async () => {
    if (!protectedPdfPath) return

    try {
      // Create a directory in the device's external storage
      let downloadDir;
      if (Platform.OS === 'android') {
        downloadDir = `${RNFS.ExternalStorageDirectoryPath}/Download`;
      } else {
        downloadDir = `${RNFS.DocumentDirectoryPath}`;
      }

      const fileName = filePath.split('/').pop().replace('.pdf', '.pdf');
      const destPath = `${downloadDir}/${`protected_${fileName}`}`;

      // Check if directory exists, if not create it
      const dirExists = await RNFS.exists(downloadDir);
      if (!dirExists) {
        await RNFS.mkdir(downloadDir);
      }

      // Copy the protected PDF to the download directory
      await RNFS.copyFile(protectedPdfPath, destPath);
      // Add file to Recents after download
      await addFileToRecents(destPath);

      await showNotification(
        'PDF Download',
        `${destPath}`,
        destPath
      );

      setFilePath(null)
      setPassword('')
      setConfirmPassword('')
      return destPath;
    } catch (error) {
      console.log('Download Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Protect Pdf',
        text2: `${error.message}`,
      });
    }
  }

  // Add this helper if not already added
  const addFileToRecents = async filePath => {
    try {
      if (RNFS.scanFile) {
        await RNFS.scanFile(filePath);
        console.log('📂 File scanned & added to Recents:', filePath);
      } else {
        console.log('⚠️ scanFile not supported in this RNFS version');
      }
    } catch (err) {
      console.log('❌ Error scanning file:', err);
    }
  };

  // OPEN PDF
  const handleOpenPDF = async () => {
    setSelectedAction('open');

    // Directly get the path from download function
    const destPath = await handleDownloadPdf();

    try {
      if (!destPath) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'PDF download failed',
        });
        return;
      }

      const fileUri = `file://${destPath}`;
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Pdf file not found',
        });
        return;
      }

      const currentPassword = password; // Store password before reset
      console.log('Navigating with password:', currentPassword);

      navigation.navigate('PdfViewer', {
        uri: fileUri,
        password: currentPassword,
      });

      // Reset after navigation
      setProtectedPdfPath(null);
      setFilePath(null);
      setPassword('');
      setConfirmPassword('');


    } catch (error) {
      console.log('FileViewer Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot open file',
        text2: `${error.message}`,
      });
    }
  };

  const handleShare = async () => {
    setSelectedAction('share');
    const destPath = await handleDownloadPdf(); // Wait for PDF creation
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


      setPassword(null)
      setConfirmPassword(null)
      setFilePath(null),
        setProtectedPdfPath(null);
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
      <ToolsHeader title={'Protect Pdf'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <View style={styles.container}>
        <Text style={styles.titleText}>PDF Password Protector</Text>

        {/* PDF Selection */}
        <TouchableOpacity style={styles.btn} onPress={handleSelectPdf}>
          <Image source={PdfPick} style={{ width: 26, height: 26 }} />
          <Text style={styles.btnText}> Select PDF </Text>
        </TouchableOpacity>
        {filePath && (
          <>
            <Text style={styles.filePath}>Selected: {getFileName(filePath)}</Text>


            <View style={{ width: '100%', }}>
              <View style={styles.section}>
                <TextInput
                  placeholder="Enter password"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#999"
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

              {/* Confirm Password Input */}
              <View style={styles.section}>
                <TextInput
                  placeholder="Confirm password"
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Image
                    source={showConfirmPassword ? Show : Hide}
                    style={styles.eyeImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={protectPdf}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Protect PDF</Text>
                )}
              </TouchableOpacity>
            </View>


            {protectedPdfPath && (
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: Color.Purple, width: '60%' },
                  ]}
                  onPress={handleDownloadPdf}
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
          </>
        )}
      </View>

    </BaseContainer>
  )
}

export default ProtectPdf

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
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
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
  bottomBar: {
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