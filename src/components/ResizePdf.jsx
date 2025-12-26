// src/components/ResizePdf.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import { Color } from '../utils/Theme';
import Share from 'react-native-share';
import { NativeModules } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
const { PdfResizer, PdfCompressor } = NativeModules; // Add PdfCompressor
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Dowload, OpenA, OpenB, PdfPick, ShareA, ShareB } from '../assets/Image/images';

import notifee, { EventType } from '@notifee/react-native';
import FileViewer from 'react-native-file-viewer';
import { initNotifications, showNotification } from './Notification';

const ResizeImage = () => {
  console.log('ResizePdf.jsx');
  const navigation = useNavigation();
  const [filePath, setFilePath] = useState('');
  const [width, setWidth] = useState('595'); // default A4 width
  const [height, setHeight] = useState('842'); // default A4 height
  const [loading, setLoading] = useState(false);
  const [resizedPdfPath, setResizedPdfPath] = useState(null);
  const [savedPath, setSavedPath] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('medium');

  const [selectedAction, setSelectedAction] = useState('open'); // "open" | "share" | null
  const [compressionInfo, setCompressionInfo] = useState(null);


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

  // Pick a PDF file
  // const handleSelectPdf = async () => {

  //   try {
  //     const res = await pick({ type: types.pdf });
  //     if (!res || res.length === 0) throw new Error('No file selected');
  //     const file = res[0];
  //     const fileUri = file.fileCopyUri ?? file.uri;
  //     if (!fileUri) throw new Error('No file URI returned');
  //     const fileName = file.name || 'temp.pdf';
  //     const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
  //     console.log('Source URI:', fileUri);
  //     console.log('Destination path:', destPath);
  //     await RNFS.copyFile(fileUri, destPath);
  //     // Verify file exists
  //     const exists = await RNFS.exists(destPath);
  //     console.log('File exists after copy:', exists);

  //     setFilePath(destPath);
  //     setResizedPdfPath(null);
  //     setSelectedQuality('medium'); // Reset quality selection
  //   } catch (err) {
  //     console.log('PDF Selection Error:', err);
  //     Toast.show({
  //       type: 'error',
  //       text1: 'Error',
  //       text2: err.message || String(err),
  //     });
  //   }
  // };

  // Pick a PDF file
  const handleSelectPdf = async () => {
    try {
      const res = await pick({ type: types.pdf });

      console.log('========== PDF PICK RESULT ==========');
      console.log('Raw response:', res);

      if (!res || res.length === 0) throw new Error('No file selected');

      const file = res[0];

      // console.log('----- Selected File Details -----');
      // console.log('Name:', file.name);
      // console.log('Size:', file.size);
      // console.log('URI:', file.uri);
      // console.log('File Copy URI:', file.fileCopyUri);
      // console.log('Type:', file.type);
      // console.log('File Object:', JSON.stringify(file, null, 2));

      const fileUri = file.fileCopyUri ?? file.uri;
      if (!fileUri) throw new Error('No file URI returned');

      const fileName = file.name || 'temp.pdf';
      const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      console.log('Source URI:', fileUri);
      console.log('Destination Path:', destPath);

      await RNFS.copyFile(fileUri, destPath);

      const exists = await RNFS.exists(destPath);
      console.log('File exists after copy:', exists);
      console.log('Final Stored Path:', destPath);

      console.log('====================================');

      setFilePath(destPath);
      setResizedPdfPath(null);
      // Reset quality and dimensions defaults (Medium: 900x900) to avoid NaN crash
      setSelectedQuality('medium');
      setWidth('900');
      setHeight('900');
    } catch (err) {
      console.log('PDF Selection Error:', err);

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || String(err),
      });
    }
  };


  // Handle quality selection
  const handleQualitySelect = (quality, w, h) => {
    setSelectedQuality(quality);
    setWidth(w.toString());
    setHeight(h.toString());
  };

  // Resize PDF
  const handleResize = async () => {


    if (!filePath) return null;
    setLoading(true);
    try {
      const safeOutputPath = `${RNFS.CachesDirectoryPath}/resized_${Date.now()}.pdf`;
      console.log('Input file path:', filePath);
      console.log('Output path:', safeOutputPath);
      console.log('Quality:', selectedQuality);

      // Use new PdfResizer module (Robust, Native-based)
      const result = await PdfResizer.compressPdf(
        filePath,
        selectedQuality || 'medium',
        safeOutputPath
      );

      console.log('Result Data', result);
      console.log('Result type:', typeof result);

      // Check if result is an object and has the expected properties
      if (result && typeof result === 'object') {
        console.log('Result keys:', Object.keys(result));
        // The native module returns an object with 'filePath' property
        if (result.filePath) {
          setResizedPdfPath(result.filePath);
          setCompressionInfo({
            originalSize: result.originalSize,
            compressedSize: result.size,
            ratio: result.compressionRatio
          });
          console.log('result file path', result.filePath);

        } else {
          console.error('Result object missing filePath:', result);
          throw new Error('Resize failed: Invalid response - missing filePath');
        }
      } else {
        console.error('Invalid result type:', typeof result, result);
        throw new Error('Resize failed: Invalid response received');
      }
    } catch (error) {
      console.error('PDF resize failed:', error || error.message);

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `${error.message || String(error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Save resized PDF to Downloads
  const handleDownload = async () => {
    console.log('download', resizedPdfPath);
    if (!resizedPdfPath) return null;
    try {
      const folderPath = `${RNFS.DownloadDirectoryPath}/PDF_IMG_TOOLBOX`;
      if (!(await RNFS.exists(folderPath))) await RNFS.mkdir(folderPath);
      const fileName = resizedPdfPath.split('/').pop();
      const destPath = `${folderPath}/${fileName}`;
      console.log('Copying from:', resizedPdfPath);
      console.log('Copying to:', destPath);

      await RNFS.copyFile(resizedPdfPath, destPath);
      // Then add to Recents
      await addFileToRecents(destPath);
      setSavedPath(destPath);

      await showNotification(
        'PDF Download',
        `${destPath}`,
        destPath
      );

      setFilePath('');
      setHeight('');
      setWidth('');
      setResizedPdfPath('');
      setSelectedQuality('medium');
      return destPath; // <--- IMPORTANT
    } catch (error) {
      console.error('Download failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: "PDF can't be downloaded",
      });
    }
  };

  const getFileName = path => path?.split('/').pop() || '';

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCompressionRatioText = () => {
    if (!compressionInfo) return '';
    return `${compressionInfo.ratio.toFixed(1)}%`;
  };

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

  const handleOpenPDF = async () => {
    setSelectedAction('open');
    let pathToOpen = savedPath;

    // Download first if not already saved
    if (!pathToOpen) {
      pathToOpen = await handleDownload();
      if (!pathToOpen) return;
    }

    try {
      const exists = await RNFS.exists(pathToOpen);
      if (!exists) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: `PDF file not found at: ${pathToOpen}`,
        });
        return;
      }

      const fileUri = `file://${pathToOpen}`;
      navigation.navigate('PdfViewer', { uri: fileUri });

      // Reset states if needed
      setFilePath(null);
      setHeight(null);
      setWidth(null);
      setResizedPdfPath(null);
      setSelectedQuality('medium');
      setSavedPath(null);
      // setSavedPath(pathToOpen); // <-- ENSURE IT SAVES FOR NEXT TIME
    } catch (error) {
      console.log('FileViewer Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Unable to open PDF',
      });
    }
  };

  // SHARE PDF
  const handleShare = async () => {
    setSelectedAction('share');
    let pathToShare = savedPath || resizedPdfPath;

    if (!pathToShare) {
      pathToShare = await handleDownload();
      if (!pathToShare) return;
    }
    try {
      const filePath = savedPath || resizedPdfPath; // Prefer savedPath if available
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
      // Reset states if needed
      setFilePath(null);
      setHeight(null);
      setWidth(null);
      setResizedPdfPath(null);
      setSelectedQuality('medium');
      setSavedPath(null);
    } catch (error) {
      console.error('Share Error:', error);
    }
  };

  return (
    <BaseContainer>
      <ToolsHeader title={'Resize PDF'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.titleText}>
            Select PDF and choose quality (Low, Medium, High)
          </Text>

          <TouchableOpacity
            style={styles.selectBtn}
            onPress={handleSelectPdf}
          >
            <Image source={PdfPick} style={{ width: 24, height: 24, tintColor: Color.White }} />
            <Text style={styles.selectBtnText}> {filePath ? 'Change PDF' : 'Select PDF'}</Text>
          </TouchableOpacity>

          {filePath && (
            <Text style={styles.filePath}>Selected: {getFileName(filePath)}</Text>
          )}
          {filePath && (
            <>
              <Text style={styles.qualityTitle}>Select Quality:</Text>
              <View style={styles.qualityRow}>
                <TouchableOpacity
                  style={[
                    styles.qualityBtn,
                    selectedQuality === 'low' && styles.selectedQualityBtn
                  ]}
                  onPress={() => handleQualitySelect('low', 600, 600)}
                >
                  <Text style={[
                    styles.qualityBtnText,
                    selectedQuality === 'low' && styles.selectedQualityText
                  ]}>
                    Low Quality
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qualityBtn,
                    selectedQuality === 'medium' && styles.selectedQualityBtn
                  ]}
                  onPress={() => handleQualitySelect('medium', 900, 900)}
                >
                  <Text style={[
                    styles.qualityBtnText,
                    selectedQuality === 'medium' && styles.selectedQualityText
                  ]}>
                    Medium Quality
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qualityBtn,
                    selectedQuality === 'high' && styles.selectedQualityBtn
                  ]}
                  onPress={() => handleQualitySelect('high', 1200, 1200)}
                >
                  <Text style={[
                    styles.qualityBtnText,
                    selectedQuality === 'high' && styles.selectedQualityText
                  ]}>
                    High Quality
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleResize}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Color.White} />
                ) : (
                  <Text style={styles.btnText}>Resize PDF</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          {resizedPdfPath && (
            <>
              {compressionInfo && (
                <View style={styles.compressionInfo}>
                  <Text style={styles.compressionTitle}>Compression Results:</Text>
                  <Text style={styles.compressionText}>
                    Original: {formatFileSize(compressionInfo.originalSize)}
                  </Text>
                  <Text style={styles.compressionText}>
                    Compressed: {formatFileSize(compressionInfo.compressedSize)}
                  </Text>
                  <Text style={styles.compressionText}>
                    Reduced by: {getCompressionRatioText()}
                  </Text>
                </View>
              )}
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
            </>
          )}
        </ScrollView>
      </View>

    </BaseContainer>
  );
};

export default ResizeImage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    backgroundColor: Color.White,
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
  qualityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Color.Black,
    marginTop: 16,
    marginBottom: 8,
  },
  customSizeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Color.Black,
    marginTop: 16,
    marginBottom: 8,
  },
  qualityRow: {
    // flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  qualityBtn: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    marginVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    // width: '30%',
  },
  selectedQualityBtn: {
    backgroundColor: Color.Purple,
    borderWidth: 2,
    borderColor: Color.Black1
  },
  qualityBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: Color.Black,
  },
  qualityBtnTextDes: {
    fontSize: 14,
    fontWeight: '600',
    color: Color.White,
  },
  selectedQualityText: {
    color: Color.White,
  },
  qualitySubText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  input: {
    width: '100%',

    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
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
  compressionInfo: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  compressionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  compressionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
});


