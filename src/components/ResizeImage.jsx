// ResizeImage.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Image as RNImage,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import FileViewer from "react-native-file-viewer";
import Slider from '@react-native-community/slider';
import { Image as CompressorImage } from 'react-native-compressor';
import RNFS from 'react-native-fs';
import CheckBox from '@react-native-community/checkbox';
import Share from 'react-native-share';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import { Color } from '../utils/Theme';
import Toast from 'react-native-toast-message';
import { Dowload, ImagePick, OpenA, OpenB, ShareA, ShareB } from '../assets/Image/images';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const ResizeImage = () => {
  const [srcUri, setSrcUri] = useState(null);
  const [percent, setPercent] = useState(80);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [destUri, setDestUri] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [resizeMode, setResizeMode] = useState('slider'); // 'slider' or 'width'
  const [lockAspect, setLockAspect] = useState(true);
  const [sizeUnit, setSizeUnit] = useState('KB'); // default KB
  const [targetSize, setTargetSize] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const scrollViewRef = useRef(null);
  const [selectedAction, setSelectedAction] = useState('open'); // "open" | "share" | null



  useEffect(() => {
    initNotifications();
  }, []);


  const handleSelect = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (res.didCancel || res.errorCode || !res.assets?.length) return;
    setSrcUri(res.assets[0].uri);
    setDestUri(null);
    setCustomHeight('');
    setCustomWidth('');
    setTargetSize('')
    setSizeUnit('KB');
    setResizeMode('slider');
    setSelectedAction('open')
  };

  const handleCompress = async () => {
    Keyboard.dismiss();
    if (!srcUri) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an image first.',
      });
      return;
    }

    setProcessing(true);

    setTimeout(() => {
      scrollToBottom()
    }, 100);


    try {
      const input = srcUri.startsWith("file://") ? srcUri : `file://${srcUri}`;
      let result;

      if (resizeMode === "slider") {
        // % compression
        const qualityNum = percent / 100;
        result = await CompressorImage.compress(input, {
          compressionMethod: "manual",
          quality: qualityNum,
        });
      } else {
        if (
          (customWidth && !isNaN(customWidth)) ||
          (customHeight && !isNaN(customHeight))
        ) {
          // ✅ Dimension resize
          result = await CompressorImage.compress(input, {
            compressionMethod: "auto",
            maxWidth: customWidth ? Number(customWidth) : undefined,
            maxHeight: customHeight ? Number(customHeight) : undefined,
          });
        } else if (targetSize && !isNaN(targetSize)) {
          // ✅ Target Size Resize (KB / MB)
          let targetBytes = null;

          if (sizeUnit === "KB") {
            targetBytes = Number(targetSize) * 1024;
          } else if (sizeUnit === "MB") {
            targetBytes = Number(targetSize) * 1024 * 1024;
          }

          // original size
          const fileStat = await RNFS.stat(input.replace(/^file:\/\//, ""));
          const originalSize = fileStat.size;

          if (originalSize <= targetBytes) {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Image is already smaller than target size',
            });
            setDestUri(input);
            setProcessing(false);
            return;
          }

          // ✅ original dimensions lena
          await new Promise((resolve, reject) => {
            RNImage.getSize(
              srcUri,
              async (width, height) => {
                // scale factor (size ratio)
                const scale = Math.sqrt(targetBytes / originalSize);

                const newWidth = Math.max(1, Math.floor(width * scale));
                const newHeight = Math.max(1, Math.floor(height * scale));

                console.log(
                  "Original Size:",
                  (originalSize / 1024).toFixed(2),
                  "KB"
                );
                console.log("Target Size:", targetSize, sizeUnit);
                console.log("New Dimensions:", newWidth, "x", newHeight);

                result = await CompressorImage.compress(input, {
                  maxWidth: newWidth,
                  maxHeight: newHeight,
                  quality: 0.8,
                });

                resolve();
              },
              (err) => reject(err)
            );
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: "Please enter dimensions or target size",
          });
          setProcessing(false);
          return;
        }
      }

      // ✅ Normalize URI
      const finalUri = result.startsWith("file://") ? result : `file://${result}`;
      setDestUri(finalUri);

      // ✅ final size check
      const fileStat = await RNFS.stat(finalUri.replace(/^file:\/\//, ""));
      const finalSizeKB = (fileStat.size / 1024).toFixed(2);
      const finalSizeMB = (fileStat.size / (1024 * 1024)).toFixed(2);

      console.log("Final Size:", finalSizeKB, "KB", finalSizeMB, "MB");

      setCustomHeight('');
      setCustomWidth('');
      setSizeUnit('KB');
      setTargetSize('');
    } catch (err) {
      console.log("Compression Failed", err.message || err);
      Toast.show({
        type: 'error',
        text1: 'Compression Failed',
        text2: err.message || 'Unknown error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleWidthChange = val => {
    if (lockAspect) {
      setCustomWidth(val);
      if (val !== '') {
        setCustomHeight(''); // ✅ height ko reset karo agar width change hua
      }
    } else {
      setCustomWidth(val);
    }
  };

  const handleHeightChange = val => {
    if (lockAspect) {
      setCustomHeight(val);
      if (val !== '') {
        setCustomWidth(''); // ✅ width ko reset karo agar height change hua
      }
    } else {
      setCustomHeight(val);
    }
  };


  const handleDownload = async () => {
    if (!destUri) return null;
    try {
      const folder = `${RNFS.DownloadDirectoryPath}/PDFANDIMGTOOLBOX`;
      const exists = await RNFS.exists(folder);
      if (!exists) await RNFS.mkdir(folder);
      const filename = `IMG_${Date.now()}.jpg`;
      const destPath = `${folder}/${filename}`;
      const srcPath = destUri.replace(/^file:\/\//, '');
      await RNFS.copyFile(srcPath, destPath);
      await CameraRoll.saveAsset(`file://${destPath}`, {
        type: 'photo',
        album: 'PDFIMAGETOOLBOX',
      });
      console.log('download path', filename, folder, exists, destPath, srcPath);
      const uri = `file://${destPath}`;
      setImageUri(uri);


      await showNotification(
        'Image Downloaded',
        'Tap to open in Gallery',
        uri   // ← path send karna
      );


      setSrcUri(null);
      setDestUri(null);
      setImageUri(null);
      setCustomHeight('');
      setCustomWidth('');
      setPercent(80);
      setTargetSize('');
      setSizeUnit('KB');

      return { path: uri, fileName: filename }; // Fixed: using defined uri
    } catch (error) {
      console.log('Download Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Download file',
        text2: `${error.message}`,
      });
      return null;
    }
  };

  const handleOpen = async () => {
    setSelectedAction('open');

    // Always use the current destUri if available
    if (!destUri) {
      Toast.show({
        type: 'error',
        text1: 'No image available',
        text2: 'Please compress an image first.',
      });
      return;
    }

    let uri = imageUri;
    if (!uri) {
      // Download the image first if not already downloaded
      const result = await handleDownload();
      if (!result) return;
      uri = result.path;
    }

    try {
      await FileViewer.open(uri);

      setDestUri(null);
      setSrcUri(null);
      setImageUri(null);
      setCustomHeight('');
      setCustomWidth('');
      setPercent(80);
      setTargetSize('');
      setSizeUnit('KB');
    } catch (error) {
      console.log('File Open Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Open file',
        text2: `${error.message}`,
      });
    }
  }

  const handleShare = async () => {
    setSelectedAction('share');

    // Always use the current destUri if available
    if (!destUri) {
      Toast.show({
        type: 'error',
        text1: 'No image available',
        text2: 'Please compress an image first.',
      });
      return;
    }

    let uri = imageUri;
    if (!uri) {
      // Download the image first if not already downloaded
      const result = await handleDownload();
      if (!result) return;
      uri = result.path;
    }

    try {
      await Share.open({
        url: uri,
        type: 'image/jpeg',
        failOnCancel: false,
      });
      setDestUri(null);
      setSrcUri(null);
      setImageUri(null);
      setCustomHeight('');
      setCustomWidth('');
      setPercent(80);
      setTargetSize('');
      setSizeUnit('KB');
    } catch (error) {
      console.log('Share Error:', error);
      if (error?.message !== 'User did not share') {
        Toast.show({
          type: 'error',
          text1: 'Share Failed',
          text2: error.message || 'Something went wrong while sharing.',
        });
      }
    }
  };


  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };


  return (
    <BaseContainer>
      <ToolsHeader title={'Resize Image'} />
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
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          keyboardShouldPersistTaps="handled"
        >

          <View style={styles.container}>
            {/* <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"> */}

            <Text style={styles.titleText}>
              Select Image and Resize using percentage or custom dimensions
            </Text>

            <TouchableOpacity
              style={styles.selectBtn}
              onPress={handleSelect}
            >
              <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
              <Text style={styles.selectBtnText}>Select Images</Text>
            </TouchableOpacity>

            {srcUri && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: srcUri }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              </View>
            )}

            {srcUri && (
              <>
                <View style={styles.optionToggle}>
                  <TouchableOpacity
                    onPress={() => setResizeMode('slider')}
                    style={[
                      styles.toggleBtn,
                      resizeMode === 'slider' && styles.activeToggle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        resizeMode === 'slider' && styles.activeToggleText,
                      ]}
                    >
                      By % Quality
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setResizeMode('width')}
                    style={[
                      styles.toggleBtn,
                      resizeMode === 'width' && styles.activeToggle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        resizeMode === 'width' && styles.activeToggleText,
                      ]}
                    >
                      By Size
                    </Text>
                  </TouchableOpacity>
                </View>

                {resizeMode === 'slider' ? (
                  <>
                    <Slider
                      style={styles.slider}
                      minimumValue={10}
                      maximumValue={100}
                      step={1}
                      value={percent}
                      onValueChange={value => setPercent(value)}
                      minimumTrackTintColor={Color.Purple}
                      maximumTrackTintColor="#ccc"
                    />
                    <Text style={styles.sliderLabel}>Quality: {percent}%</Text>
                  </>
                ) : (
                  <View>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <CheckBox
                        label="Lock aspect ratio (enter only one)"
                        onValueChange={() => {
                          setLockAspect(!lockAspect);
                          setCustomWidth('');
                          setCustomHeight('');
                        }}
                        value={lockAspect}
                        checkedCheckBoxColor="green" // ✔ tick ka color
                        uncheckedCheckBoxColor="gray"
                      />

                      <Text>
                        Lock Aspect Ratio
                      </Text>
                    </TouchableOpacity>
                    <View
                      style={{
                        flex: 1,
                        marginTop: 14,
                        flexDirection: 'row',
                        justifyContent: 'space-evenly',
                      }}
                    >

                      <TextInput
                        placeholder="Enter width px"
                        value={customWidth}
                        onChangeText={handleWidthChange}
                        keyboardType="numeric"
                        style={styles.input}
                        onFocus={scrollToBottom}
                        returnKeyType="done"
                      />
                      <TextInput
                        placeholder="Enter height px"
                        value={customHeight}
                        onChangeText={handleHeightChange}
                        keyboardType="numeric"
                        style={styles.input}
                        onFocus={scrollToBottom}
                        returnKeyType="done"
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 14,
                      }}
                    >
                      <TextInput
                        placeholder="Enter Target file size"
                        value={targetSize}
                        onChangeText={val => setTargetSize(val)}
                        keyboardType="numeric"
                        style={[styles.input, { width: '100%', }]}
                        onFocus={scrollToBottom}
                        returnKeyType="done"
                      />

                      <TouchableOpacity
                        style={{
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderRadius: 12,
                          borderColor: '#ccc',
                          padding: 12,
                        }}
                        onPress={() => setSizeUnit(!sizeUnit)}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: Color.Purple,
                          }}
                        >
                          {sizeUnit ? 'KB' : 'MB'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btn, processing && styles.btnDisabled]}
                  onPress={handleCompress}
                  disabled={processing}
                  keyboardShouldPersistTaps="handled"
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>Compress</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {destUri && (
              <View>
                <Image
                  source={{ uri: destUri }}
                  style={styles.preview}
                  resizeMode="contain"
                />

                <View style={styles.bottomBar}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: Color.Purple, width: '60%' },
                    ]}
                    onPress={handleDownload}
                  >
                    <>
                      <Text style={styles.actionText}>Download Image</Text>
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
                    onPress={handleOpen}
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
              </View>
            )}

            {/* </ScrollView> */}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </BaseContainer>
  );
};

export default ResizeImage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 14,
    paddingBottom: 10,
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
  btnDisabled: { opacity: 0.6, marginTop: 16 },
  btnText: { color: Color.White, fontSize: 16, fontWeight: 600 },
  slider: {
    marginTop: 18,
  },
  label: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  preview: {
    width: 300,
    height: 300,
    alignSelf: 'center',
    marginVertical: 16,
  },
  modalBox: {
    backgroundColor: Color.White,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalMsg: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  modalBtn: {
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    flex: 1,
  },
  modalBtnText: { textAlign: 'center', color: Color.White, fontWeight: '600' },

  optionToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 10,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  activeToggle: {
    backgroundColor: Color.Purple,
  },
  activeToggleText: {
    color: Color.White,
  },
  toggleText: {
    fontWeight: '600',
    color: Color.Black,
  },
  input: {
    width: '45%',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  sliderLabel: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
    color: '#333',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    marginRight: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
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
});
