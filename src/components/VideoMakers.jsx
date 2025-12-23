// src/components/VideoMakers.jsx
import React, { use, useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import { ImagePick } from '../assets/Image/images';
import { launchImageLibrary } from 'react-native-image-picker';
import { Color } from '../utils/Theme';
import DropDownPicker from 'react-native-dropdown-picker';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import Toast from 'react-native-toast-message';
import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useNavigation } from '@react-navigation/native';
import FileViewer from "react-native-file-viewer";

const { SelectSongs, VideoMakerModule } = NativeModules;

const durationItems = Array.from({ length: 30 }, (_, i) => ({
  label: `${i + 1} seconds`,
  value: i + 1,
}));


const VideoMakers = () => {
  const navigation =  useNavigation();
  console.log('Videomacker Screen');
  const [images, setImages] = useState([]);
  const [audio, setAudio] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputPath, setOutputPath] = useState('');
  const [processingProgress, setProcessingProgress] = useState('');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(5);
  const [items, setItems] = useState(durationItems);


  
    useEffect(() => {
    initNotifications();  // setup notifications on mount
  }, []);
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

  console.log('🎬 VideoMakers rendered. Images:', images, 'Audio:', audio);

  const handleSelectImages = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 0,
        quality: 1,
      },
      response => {
        if (!response.didCancel && !response.errorCode && response.assets?.length > 0) {
          const selected = response.assets.map(asset => ({
            uri: asset.uri,
            fileName: asset.fileName,
            type: asset.type,
          }));
          console.log('✅ Images selected:', selected);
          setImages(prev => [...prev, ...selected]);

        } else {
          console.log('🚫 Image selection error:', response.errorMessage || 'User cancelled');
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Image selection failed or cancelled',
          });
        }
      }
    );
  };

  const handleSelectAudio = async () => {
    try {
      if (!SelectSongs) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'SelectSongs module not found. Please rebuild the app.',
        });
        return;
      }

      console.log('🎵 Calling SelectSongs.pickAudio()...');
      const result = await SelectSongs.pickAudio();
      console.log('🎵 SelectSongs result:', result);

      if (result && result.uri) {
        let audioPath = result.uri;

        if (audioPath.startsWith('content://')) {
          console.log('🎵 Content URI detected, copying to cache...');
          const fileName = result.name || `audio_${Date.now()}.mp3`;
          const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

          try {
            await RNFS.copyFile(audioPath, destPath);
            audioPath = destPath;
            console.log('🎵 Audio copied to:', audioPath);
          } catch (copyError) {
            console.error('🎵 Error copying audio:', copyError);
            console.log('🎵 Error copying audio:', copyError);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to copy audio file',
            });
            return;
          }
        }

        audioPath = audioPath.replace('file://', '');

        const exists = await RNFS.exists(audioPath);
        if (!exists) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Audio file not accessible',
          });
          return;
        }

        setAudio({
          uri: audioPath,
          fileName: result.name || 'audio.mp3',
          type: 'audio/*',
        });

      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Invalid audio file returned',
        });
      }
      setValue(15); // Set default duration to 30 seconds when audio is selected
    } catch (err) {
      if (err.message === 'CANCELLED' || err.code === 'CANCELLED') {
        console.log('🎵 User cancelled audio selection');
      } else {
        console.error('🎵 Audio selection error:', err);
        console.log('🎵 Audio selection error:', err);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: err.message || 'Failed to select audio',
        });
      }
    }
  };

  const handleMakeVideo = async () => {
    setIsProcessing(true);

    if (images.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select at least one image',
      });
      return;
    }

    if (!VideoMakerModule) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Native module not found. Please rebuild the app.',
      });
      return;
    }

    setOutputPath('');
    setProcessingProgress('Preparing images...');

    try {


      const totalDurationSeconds = Number(value) || 30;
      const useAudio = audio !== null;

      console.log('🎬 Video creation started');
      console.log('📸 Images:', images.length);
      console.log('🎵 Audio:', useAudio ? 'YES' : 'NO');
      console.log('⏱️ Total Duration:', totalDurationSeconds, 'seconds');

      if (images.length === 1) {
        // SINGLE IMAGE
        if (useAudio) {
          setProcessingProgress('Creating video with background music...');
          console.log('🎬 Creating single image video WITH audio');
        } else {
          setProcessingProgress('Creating video from image...');
          console.log('🎬 Creating single image video WITHOUT audio');
        }

        const imagePath = images[0].uri.replace('file://', '');

        let videoPath;
        if (useAudio) {
          videoPath = await VideoMakerModule.convertImageToVideoWithAudio(
            imagePath,
            audio.uri,
            totalDurationSeconds
          );
        } else {
          videoPath = await VideoMakerModule.convertImageToVideo(
            imagePath,
            totalDurationSeconds
          );
        }

        console.log('✅ Video created at:', videoPath);

        if (videoPath) {
          const exists = await RNFS.exists(videoPath);
          if (exists) {
            const fileInfo = await RNFS.stat(videoPath);
            console.log('📹 Video file size:', fileInfo.size, 'bytes');
            setOutputPath('file://' + videoPath);
            // Toast.show({
            //   type: 'success',
            //   text1: 'Success',
            //   text2: useAudio ? 'Video created with background music! 🎵' : 'Video created successfully! 🎬',
            // });
          } else {
            throw new Error('Video file not found at expected path');
          }
        } else {
          throw new Error('Video creation returned empty path');
        }
      } else {
        // MULTIPLE IMAGES - FIXED: Use total duration directly
        if (useAudio) {
          setProcessingProgress(`Creating slideshow from ${images.length} images with music...`);
          console.log('🎬 Creating multi-image slideshow WITH audio');
        } else {
          setProcessingProgress(`Creating video from ${images.length} images...`);
          console.log('🎬 Creating multi-image video WITHOUT audio');
        }

        const imagePaths = images.map(img => img.uri.replace('file://', ''));
        console.log('Image Paths:', imagePaths);

        let videoPath;
        if (useAudio) {
          // Pass TOTAL duration, not per-image duration
          videoPath = await VideoMakerModule.convertImagesToVideoWithAudio(
            imagePaths,
            audio.uri,
            totalDurationSeconds  // CHANGED: Pass total duration instead of per-image
          );
        } else {
          // Pass TOTAL duration, not per-image duration
          videoPath = await VideoMakerModule.convertImagesToVideo(
            imagePaths,
            totalDurationSeconds  // CHANGED: Pass total duration instead of per-image
          );
        }

        console.log('✅ Video created at:', videoPath);

        if (videoPath) {
          const exists = await RNFS.exists(videoPath);
          if (exists) {
            const fileInfo = await RNFS.stat(videoPath);
            console.log('📹 Video file size:', fileInfo.size, 'bytes');
            setOutputPath('file://' + videoPath);
            // Toast.show({
            //   type: 'success',
            //   text1: 'Success',
            //   text2: useAudio
            //     ? `Slideshow created with ${images.length} images and background music! 🎵`
            //     : `Video created from ${images.length} images! Total duration: ${totalDurationSeconds}s 🎬`,
            // });
          } else {
            throw new Error('Video file not found at expected path');
          }
        } else {
          throw new Error('Video creation returned empty path');
        }
      }
    } catch (e) {
      console.log('💥 Video creation exception:', e);
      console.error('💥 Error details:', e);
      Toast.show({
        type: 'error',
        text1: 'Video Creation Failed',
        text2: `Error: ${e.message}`,
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
  };


  const handleDownloadVideo = async () => {
    if (!outputPath) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No video available to download. Please create a video first.',
      });
      return;
    }

    try {
      const folderPath = `${RNFS.DownloadDirectoryPath}/PDF_IMG_TOOLBOX`;
      const exists = await RNFS.exists(folderPath);
      if (!exists) {
        await RNFS.mkdir(folderPath);
      }

      const fileName = `video_${Date.now()}.mp4`;
      const dest = `${folderPath}/${fileName}`;
      const src = outputPath.startsWith('file://') ? outputPath.slice(7) : outputPath;

      console.log('📥 Copying video from:', src);
      console.log('📥 Copying video to:', dest);

      await RNFS.copyFile(src, dest);
       await CameraRoll.saveAsset(dest, { type: 'video', album: 'PDF_IMG_TOOLBOX' });

   await showNotification(
         'Image Downloaded',
         'Tap to open in Gallery',
         dest   // ← path send karna
       );

      setAudio(null);
      setImages([]);
      setOutputPath('');
    } catch (error) {
      console.error('💾 Download error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save video: ' + error.message,
      });
    }
  };




  const handleRemoveAudio = () => {
    setAudio(null);
    Toast.show({ type: 'info', text1: 'Audio Removed', text2: 'Background music removed' });
  };

  return (
    <BaseContainer style={{ flex: 1 }}>
      <ToolsHeader title="Video Maker" />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        onTouchStart={Keyboard.dismiss}
      >
        <View style={styles.container}>
          <Text style={styles.titleText}>Create Video with Images & Music!</Text>

          {/* Image selection */}
          {images.length === 0 ? (
            <TouchableOpacity style={styles.selectBtn} onPress={handleSelectImages}>
              <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
              <Text style={styles.selectBtnText}>Select Images</Text>
            </TouchableOpacity>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageScrollContainer}
              >
                {images.map((item, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri: item.uri }} style={styles.imageThumb} resizeMode="cover" />
                    <View style={styles.imageNumber}>
                      <Text style={styles.imageNumberText}>{index + 1}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

            </>
          )}

          {/* Audio Selection */}
          <View style={styles.audioSection}>
            {!audio ? (
              <TouchableOpacity style={styles.audioBtn} onPress={handleSelectAudio}>
                <Text style={styles.audioBtnText}>🎧 Add Background Music</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.audioSelectedBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioSelectedLabel}>Background Music:</Text>
                  <Text style={styles.audioSelectedText} numberOfLines={1}>
                    🎵 {audio.fileName}
                  </Text>
                  {/* <Text>{audio.size}</Text> can not show now fix this */}
                </View>
                <TouchableOpacity onPress={handleRemoveAudio} style={styles.audioRemoveBtn}>
                  <Text style={styles.audioRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {images && audio && (
            <>
              {/* Duration dropdown */}
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownLabel}>Select Video Duration:</Text>
                <DropDownPicker
                  open={open}
                  value={value}
                  items={items}
                  setOpen={setOpen}
                  setValue={setValue}
                  setItems={setItems}
                  listMode="MODAL"
                  style={styles.dropdown}
                  placeholder="Select duration"
                  placeholderStyle={styles.dropdownPlaceholder}
                  dropDownContainerStyle={styles.dropdownMenu}
                  disabled={isProcessing}
                />
              </View>

              {/* Make Video Button */}
              <TouchableOpacity
                style={[styles.makeVideoBtn, isProcessing && styles.disabledBtn]}
                onPress={handleMakeVideo}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  // <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={Color.Purple} size="large" />
                  //  </View> 
                ) : (
                  <Text style={styles.makeVideoBtnText}>
                    🎬 Make Video {audio ? 'with Music 🎵' : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Processing Progress */}
          {isProcessing && processingProgress && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>⏳ {processingProgress}</Text>
              <Text style={styles.processingSubText}>Please wait, this may take a moment...</Text>
            </View>
          )}

          {/* Video Output */}
          {outputPath && (
            <>
              <View style={styles.videoContainer}>
                <Text style={styles.videoLabel}>Preview:</Text>
                <Video
                  key={outputPath}
                  source={{ uri: outputPath }}
                  style={styles.videoPlayer}
                  resizeMode="contain"
                  controls
                  repeat
                  paused={false}
                  onError={e => console.error('Video playback error:', e)}
                />
              </View>

              <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadVideo}>
                <Text style={styles.downloadBtnText}>📥 Download Video</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      <Toast />
    </BaseContainer>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: Color.White, padding: 16 },
  titleText: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: Color.Black, marginBottom: 20 },
  durationInfo: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  durationInfoText: { color: '#0D47A1', fontSize: 14, fontWeight: '600' },
  durationHighlight: { color: '#E65100', fontWeight: '700' },
  durationInfoSubText: { color: '#1565C0', fontSize: 12, marginTop: 4 },
  selectBtn: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    backgroundColor: Color.Purple,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
  addMoreBtn: { backgroundColor: '#6C63FF', marginTop: 10, marginRight: 8 },
  clearBtn: { backgroundColor: '#FF6B6B', marginTop: 10, marginLeft: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  imageScrollContainer: { marginTop: 20, paddingHorizontal: 5 },
  imageContainer: { position: 'relative', marginRight: 10 },
  imageThumb: { width: 150, height: 200, borderRadius: 10, borderWidth: 2, borderColor: Color.LightGray },
  imageNumber: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 29, 217, 0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNumberText: { color: Color.White, fontSize: 14, fontWeight: 'bold' },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: { color: Color.White, fontSize: 20, fontWeight: 'bold' },
  audioSection: { marginTop: 20 },
  audioBtn: { backgroundColor: '#03A9F4', padding: 14, borderRadius: 10, alignItems: 'center' },
  audioBtnText: { color: Color.White, fontWeight: '600', fontSize: 15 },
  audioSelectedBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#03A9F4',
  },
  audioSelectedLabel: { fontSize: 12, color: '#01579B', fontWeight: '600', marginBottom: 4 },
  audioSelectedText: { fontSize: 14, color: '#0277BD', fontWeight: '500' },
  audioRemoveBtn: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  audioRemoveText: { color: Color.White, fontSize: 18, fontWeight: 'bold' },
  dropdownContainer: { marginTop: 20 },
  dropdownLabel: { fontSize: 14, fontWeight: '600', color: Color.Black, marginBottom: 10 },
  dropdown: { borderColor: Color.Purple, borderWidth: 2 },
  dropdownPlaceholder: { color: Color.Gray },
  dropdownMenu: { borderColor: Color.Purple },
  makeVideoBtn: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  makeVideoBtnText: { color: Color.White, fontSize: 18, fontWeight: '700' },
  disabledBtn: { backgroundColor: '#BDBDBD', opacity: 0.6 },
  processingContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  processingText: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#E65100', marginBottom: 8 },
  processingSubText: { textAlign: 'center', fontSize: 13, color: '#F57C00', fontStyle: 'italic' },
  videoContainer: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: Color.Purple,
  },
  videoLabel: { fontSize: 16, fontWeight: '600', color: Color.Black, marginBottom: 10, paddingHorizontal: 4 },
  videoPlayer: { width: '100%', height: 250, backgroundColor: '#000' },
  downloadBtn: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  downloadBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
});

export default VideoMakers;















// // src/components/VideoMakers.jsx
// import React, { useState } from 'react';
// import {
//   Image,
//   Keyboard,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   ActivityIndicator,
//   NativeModules,
// } from 'react-native';
// import BaseContainer from './BaseContainer';
// import ToolsHeader from './ToolsHeader';
// import { ImagePick } from '../assets/Image/images';
// import { launchImageLibrary } from 'react-native-image-picker';
// import { Color } from '../utils/Theme';
// import DropDownPicker from 'react-native-dropdown-picker';
// import RNFS from 'react-native-fs';
// import { CameraRoll } from '@react-native-camera-roll/camera-roll';
// import Video from 'react-native-video';
// import Toast from 'react-native-toast-message';
// import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// const { SelectSongs, VideoMakerModule } = NativeModules;

// const durationItems = Array.from({ length: 60 }, (_, i) => ({
//   label: `${i + 1} seconds`,
//   value: i + 1,
// }));


// const VideoMakers = () => {
//   console.log('Videomacker Screen');
//   const [images, setImages] = useState([]);
//   const [audio, setAudio] = useState(null);
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [outputPath, setOutputPath] = useState('');
//   const [processingProgress, setProcessingProgress] = useState('');
//   const [open, setOpen] = useState(false);
//   const [value, setValue] = useState(5);
//   const [items, setItems] = useState(durationItems);

//   console.log('🎬 VideoMakers rendered. Images:', images, 'Audio:', audio);

//   const handleSelectImages = () => {
//     launchImageLibrary(
//       {
//         mediaType: 'photo',
//         selectionLimit: 0,
//         quality: 1,
//       },
//       response => {
//         if (!response.didCancel && !response.errorCode && response.assets?.length > 0) {
//           const selected = response.assets.map(asset => ({
//             uri: asset.uri,
//             fileName: asset.fileName,
//             type: asset.type,
//           }));
//           console.log('✅ Images selected:', selected);
//           setImages(prev => [...prev, ...selected]);
//         } else {
//           console.log('🚫 Image selection error:', response.errorMessage || 'User cancelled');
//           Toast.show({
//             type: 'error',
//             text1: 'Error',
//             text2: 'Image selection failed or cancelled',
//           });
//         }
//       }
//     );
//   };

//   const handleSelectAudio = async () => {
//     try {
//       if (!SelectSongs) {
//         Toast.show({
//           type: 'error',
//           text1: 'Error',
//           text2: 'SelectSongs module not found. Please rebuild the app.',
//         });
//         return;
//       }

//       console.log('🎵 Calling SelectSongs.pickAudio()...');
//       const result = await SelectSongs.pickAudio();
//       console.log('🎵 SelectSongs result:', result);

//       if (result && result.uri) {
//         let audioPath = result.uri;

//         if (audioPath.startsWith('content://')) {
//           console.log('🎵 Content URI detected, copying to cache...');
//           const fileName = result.name || `audio_${Date.now()}.mp3`;
//           const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

//           try {
//             await RNFS.copyFile(audioPath, destPath);
//             audioPath = destPath;
//             console.log('🎵 Audio copied to:', audioPath);
//           } catch (copyError) {
//             console.error('🎵 Error copying audio:', copyError);
//             Toast.show({
//               type: 'error',
//               text1: 'Error',
//               text2: 'Failed to copy audio file',
//             });
//             return;
//           }
//         }

//         audioPath = audioPath.replace('file://', '');

//         const exists = await RNFS.exists(audioPath);
//         if (!exists) {
//           Toast.show({
//             type: 'error',
//             text1: 'Error',
//             text2: 'Audio file not accessible',
//           });
//           return;
//         }

//         setAudio({
//           uri: audioPath,
//           fileName: result.name || 'audio.mp3',
//           type: 'audio/*',
//         });

//       } else {
//         Toast.show({
//           type: 'error',
//           text1: 'Error',
//           text2: 'Invalid audio file returned',
//         });
//       }
//     } catch (err) {
//       if (err.message === 'CANCELLED' || err.code === 'CANCELLED') {
//         console.log('🎵 User cancelled audio selection');
//       } else {
//         console.error('🎵 Audio selection error:', err);
//         Toast.show({
//           type: 'error',
//           text1: 'Error',
//           text2: err.message || 'Failed to select audio',
//         });
//       }
//     }
//   };

//   const handleMakeVideo = async () => {
//     setIsProcessing(true);

//     if (images.length === 0) {
//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: 'Please select at least one image',
//       });
//       return;
//     }

//     if (!VideoMakerModule) {
//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: 'Native module not found. Please rebuild the app.',
//       });
//       return;
//     }

//     setOutputPath('');
//     setProcessingProgress('Preparing images...');

//     try {


//       const totalDurationSeconds = Number(value) || 30;
//       const useAudio = audio !== null;

//       console.log('🎬 Video creation started');
//       console.log('📸 Images:', images.length);
//       console.log('🎵 Audio:', useAudio ? 'YES' : 'NO');
//       console.log('⏱️ Total Duration:', totalDurationSeconds, 'seconds');

//       if (images.length === 1) {
//         // SINGLE IMAGE
//         if (useAudio) {
//           setProcessingProgress('Creating video with background music...');
//           console.log('🎬 Creating single image video WITH audio');
//         } else {
//           setProcessingProgress('Creating video from image...');
//           console.log('🎬 Creating single image video WITHOUT audio');
//         }

//         const imagePath = images[0].uri.replace('file://', '');

//         let videoPath;
//         if (useAudio) {
//           videoPath = await VideoMakerModule.convertImageToVideoWithAudio(
//             imagePath,
//             audio.uri,
//             totalDurationSeconds
//           );
//         } else {
//           videoPath = await VideoMakerModule.convertImageToVideo(
//             imagePath,
//             totalDurationSeconds
//           );
//         }

//         console.log('✅ Video created at:', videoPath);

//         if (videoPath) {
//           const exists = await RNFS.exists(videoPath);
//           if (exists) {
//             const fileInfo = await RNFS.stat(videoPath);
//             console.log('📹 Video file size:', fileInfo.size, 'bytes');
//             setOutputPath('file://' + videoPath);
//             Toast.show({
//               type: 'success',
//               text1: 'Success',
//               text2: useAudio ? 'Video created with background music! 🎵' : 'Video created successfully! 🎬',
//             });
//           } else {
//             throw new Error('Video file not found at expected path');
//           }
//         } else {
//           throw new Error('Video creation returned empty path');
//         }
//       } else {
//         // MULTIPLE IMAGES - FIXED: Use total duration directly
//         if (useAudio) {
//           setProcessingProgress(`Creating slideshow from ${images.length} images with music...`);
//           console.log('🎬 Creating multi-image slideshow WITH audio');
//         } else {
//           setProcessingProgress(`Creating video from ${images.length} images...`);
//           console.log('🎬 Creating multi-image video WITHOUT audio');
//         }

//         const imagePaths = images.map(img => img.uri.replace('file://', ''));
//         console.log('Image Paths:', imagePaths);

//         let videoPath;
//         if (useAudio) {
//           // Pass TOTAL duration, not per-image duration
//           videoPath = await VideoMakerModule.convertImagesToVideoWithAudio(
//             imagePaths,
//             audio.uri,
//             totalDurationSeconds // CHANGED: Pass total duration instead of per-image
//           );
//         } else {
//           // Pass TOTAL duration, not per-image duration
//           videoPath = await VideoMakerModule.convertImagesToVideo(
//             imagePaths,
//             totalDurationSeconds // CHANGED: Pass total duration instead of per-image
//           );
//         }

//         console.log('✅ Video created at:', videoPath);

//         if (videoPath) {
//           const exists = await RNFS.exists(videoPath);
//           if (exists) {
//             const fileInfo = await RNFS.stat(videoPath);
//             console.log('📹 Video file size:', fileInfo.size, 'bytes');
//             setOutputPath('file://' + videoPath);
//             Toast.show({
//               type: 'success',
//               text1: 'Success',
//               text2: useAudio
//                 ? `Slideshow created with ${images.length} images and background music! 🎵`
//                 : `Video created from ${images.length} images! Total duration: ${totalDurationSeconds}s 🎬`,
//             });
//           } else {
//             throw new Error('Video file not found at expected path');
//           }
//         } else {
//           throw new Error('Video creation returned empty path');
//         }
//       }
//     } catch (e) {
//       console.log('💥 Video creation exception:', e);
//       console.error('💥 Error details:', e);
//       Toast.show({
//         type: 'error',
//         text1: 'Video Creation Failed',
//         text2: `Error: ${e.message}`,
//       });
//     } finally {
//       setIsProcessing(false);
//       setProcessingProgress('');
//     }
//   };

//   const handleDownloadVideo = async () => {
//     if (!outputPath) {
//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: 'No video available to download. Please create a video first.',
//       });
//       return;
//     }

//     try {
//       const folderPath = `${RNFS.DownloadDirectoryPath}/PDF_IMG_TOOLBOX`;
//       const exists = await RNFS.exists(folderPath);
//       if (!exists) {
//         await RNFS.mkdir(folderPath);
//       }

//       const fileName = `video_${Date.now()}.mp4`;
//       const dest = `${folderPath}/${fileName}`;
//       const src = outputPath.startsWith('file://') ? outputPath.slice(7) : outputPath;

//       console.log('📥 Copying video from:', src);
//       console.log('📥 Copying video to:', dest);

//       await RNFS.copyFile(src, dest);
//       await CameraRoll.save(dest, { type: 'video', album: 'PDF_IMG_TOOLBOX' });

//       Toast.show({
//         type: 'success',
//         text1: 'Download Complete',
//         text2: 'Video saved to gallery! 📥',
//       });
//       setAudio(null);
//       setImages([]);
//       setOutputPath('');
//     } catch (error) {
//       console.error('💾 Download error:', error);
//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: 'Failed to save video: ' + error.message,
//       });
//     }
//   };

//   const handleRemoveAudio = () => {
//     setAudio(null);
//     Toast.show({ type: 'info', text1: 'Audio Removed', text2: 'Background music removed' });
//   };

//   return (
//     <BaseContainer style={{ flex: 1 }}>
//       <ToolsHeader title="Video Maker" />
//       <View style={{ alignItems: 'center' }}>
//         <BannerAd
//           unitId={TestIds.BANNER}
//           size={BannerAdSize.ADAPTIVE_BANNER}
//           requestOptions={{ requestNonPersonalizedAdsOnly: true }}
//         />
//       </View>

//       <ScrollView
//         contentContainerStyle={{ paddingBottom: 40 }}
//         showsVerticalScrollIndicator={false}
//         onTouchStart={Keyboard.dismiss}
//       >
//         <View style={styles.container}>
//           <Text style={styles.titleText}>Create Video with Images & Music!</Text>

//           {/* Image selection */}
//           {images.length === 0 ? (
//             <TouchableOpacity style={styles.selectBtn} onPress={handleSelectImages}>
//               <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
//               <Text style={styles.selectBtnText}>Select Images</Text>
//             </TouchableOpacity>
//           ) : (
//             <>
//               <ScrollView
//                 horizontal
//                 showsHorizontalScrollIndicator={false}
//                 contentContainerStyle={styles.imageScrollContainer}
//               >
//                 {images.map((item, index) => (
//                   <View key={index} style={styles.imageContainer}>
//                     <Image source={{ uri: item.uri }} style={styles.imageThumb} resizeMode="cover" />
//                     <View style={styles.imageNumber}>
//                       <Text style={styles.imageNumberText}>{index + 1}</Text>
//                     </View>
//                     <TouchableOpacity
//                       onPress={() => setImages(prev => prev.filter((_, i) => i !== index))}
//                       style={styles.removeBtn}
//                     >
//                       <Text style={styles.removeBtnText}>✕</Text>
//                     </TouchableOpacity>
//                   </View>
//                 ))}
//               </ScrollView>

//             </>
//           )}

//           {/* Audio Selection */}
//           <View style={styles.audioSection}>
//             {!audio ? (
//               <TouchableOpacity style={styles.audioBtn} onPress={handleSelectAudio}>
//                 <Text style={styles.audioBtnText}>🎧 Add Background Music</Text>
//               </TouchableOpacity>
//             ) : (
//               <View style={styles.audioSelectedBox}>
//                 <View style={{ flex: 1 }}>
//                   <Text style={styles.audioSelectedLabel}>Background Music:</Text>
//                   <Text style={styles.audioSelectedText} numberOfLines={1}>
//                     🎵 {audio.fileName}
//                   </Text>
//                 </View>
//                 <TouchableOpacity onPress={handleRemoveAudio} style={styles.audioRemoveBtn}>
//                   <Text style={styles.audioRemoveText}>✕</Text>
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>

//           {images && audio && (
//             <>
//               {/* Duration dropdown */}
//               <View style={styles.dropdownContainer}>
//                 <Text style={styles.dropdownLabel}>Select Video Duration:</Text>
//                 <DropDownPicker
//                   open={open}
//                   value={value}
//                   items={items}
//                   setOpen={setOpen}
//                   setValue={setValue}
//                   setItems={setItems}
//                   listMode="MODAL"
//                   style={styles.dropdown}
//                   placeholder="Select duration"
//                   placeholderStyle={styles.dropdownPlaceholder}
//                   dropDownContainerStyle={styles.dropdownMenu}
//                   disabled={isProcessing}
//                 />
//               </View>

//               {/* Make Video Button */}

//               <TouchableOpacity
//                 style={[styles.makeVideoBtn, isProcessing && styles.disabledBtn]}
//                 onPress={handleMakeVideo}
//                 disabled={isProcessing}
//               >
//                 {isProcessing ? (
//                   <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
//                     <ActivityIndicator color={Color.Purple} size="large" />
//                   </View>
//                 ) : (
//                   <Text style={styles.makeVideoBtnText}>
//                     🎬 Make Video {audio ? 'with Music 🎵' : ''}
//                   </Text>
//                 )}
//               </TouchableOpacity>
//             </>

//           )}

//           {/* Processing Progress */}
//           {isProcessing && processingProgress && (
//             <View style={styles.processingContainer}>
//               <Text style={styles.processingText}>⏳ {processingProgress}</Text>
//               <Text style={styles.processingSubText}>Please wait, this may take a moment...</Text>
//             </View>
//           )}

//           {/* Video Output */}
//           {outputPath && (
//             <>
//               <View style={styles.videoContainer}>
//                 <Text style={styles.videoLabel}>Preview:</Text>
//                 <Video
//                   key={outputPath}
//                   source={{ uri: outputPath }}
//                   style={styles.videoPlayer}
//                   resizeMode="contain"
//                   controls
//                   repeat
//                   paused={false}
//                   onError={e => console.error('Video playback error:', e)}
//                 />
//               </View>

//               <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadVideo}>
//                 <Text style={styles.downloadBtnText}>📥 Download Video</Text>
//               </TouchableOpacity>
//             </>
//           )}
//         </View>
//       </ScrollView>
//       <Toast />
//     </BaseContainer>
//   );
// };

// const styles = StyleSheet.create({
//   container: { backgroundColor: Color.White, padding: 16 },
//   titleText: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: Color.Black, marginBottom: 20 },
//   durationInfo: {
//     backgroundColor: '#E3F2FD',
//     padding: 12,
//     borderRadius: 8,
//     marginBottom: 16,
//     borderLeftWidth: 4,
//     borderLeftColor: '#2196F3',
//   },
//   durationInfoText: { color: '#0D47A1', fontSize: 14, fontWeight: '600' },
//   durationHighlight: { color: '#E65100', fontWeight: '700' },
//   durationInfoSubText: { color: '#1565C0', fontSize: 12, marginTop: 4 },
//   selectBtn: {
//     flexDirection: 'row',
//     gap: 10,
//     justifyContent: 'center',
//     backgroundColor: Color.Purple,
//     padding: 14,
//     borderRadius: 10,
//     alignItems: 'center',
//   },
//   selectBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
//   addMoreBtn: { backgroundColor: '#6C63FF', marginTop: 10, marginRight: 8 },
//   clearBtn: { backgroundColor: '#FF6B6B', marginTop: 10, marginLeft: 8 },
//   buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
//   imageScrollContainer: { marginTop: 20, paddingHorizontal: 5 },
//   imageContainer: { position: 'relative', marginRight: 10 },
//   imageThumb: { width: 150, height: 200, borderRadius: 10, borderWidth: 2, borderColor: Color.LightGray },
//   imageNumber: {
//     position: 'absolute',
//     bottom: 10,
//     left: 10,
//     backgroundColor: 'rgba(15, 29, 217, 0.7)',
//     borderRadius: 15,
//     width: 30,
//     height: 30,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   imageNumberText: { color: Color.White, fontSize: 14, fontWeight: 'bold' },
//   removeBtn: {
//     position: 'absolute',
//     top: 10,
//     right: 10,
//     backgroundColor: 'rgba(255, 0, 0, 0.9)',
//     borderRadius: 20,
//     width: 36,
//     height: 36,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   removeBtnText: { color: Color.White, fontSize: 20, fontWeight: 'bold' },
//   audioSection: { marginTop: 20 },
//   audioBtn: { backgroundColor: '#03A9F4', padding: 14, borderRadius: 10, alignItems: 'center' },
//   audioBtnText: { color: Color.White, fontWeight: '600', fontSize: 15 },
//   audioSelectedBox: {
//     backgroundColor: '#E3F2FD',
//     padding: 12,
//     borderRadius: 10,
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderLeftWidth: 4,
//     borderLeftColor: '#03A9F4',
//   },
//   audioSelectedLabel: { fontSize: 12, color: '#01579B', fontWeight: '600', marginBottom: 4 },
//   audioSelectedText: { fontSize: 14, color: '#0277BD', fontWeight: '500' },
//   audioRemoveBtn: {
//     backgroundColor: 'rgba(255, 0, 0, 0.8)',
//     borderRadius: 15,
//     width: 30,
//     height: 30,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginLeft: 10,
//   },
//   audioRemoveText: { color: Color.White, fontSize: 18, fontWeight: 'bold' },
//   dropdownContainer: { marginTop: 20 },
//   dropdownLabel: { fontSize: 14, fontWeight: '600', color: Color.Black, marginBottom: 10 },
//   dropdown: { borderColor: Color.Purple, borderWidth: 2 },
//   dropdownPlaceholder: { color: Color.Gray },
//   dropdownMenu: { borderColor: Color.Purple },
//   makeVideoBtn: {
//     flexDirection: 'row',
//     gap: 10,
//     justifyContent: 'center',
//     backgroundColor: '#FF6B6B',
//     marginTop: 24,
//     padding: 16,
//     borderRadius: 12,
//     alignItems: 'center',
//     shadowColor: '#FF6B6B',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   makeVideoBtnText: { color: Color.White, fontSize: 18, fontWeight: '700' },
//   disabledBtn: { backgroundColor: '#BDBDBD', opacity: 0.6 },
//   processingContainer: {
//     marginTop: 20,
//     padding: 16,
//     backgroundColor: '#FFF3E0',
//     borderRadius: 10,
//     borderLeftWidth: 4,
//     borderLeftColor: '#FF9800',
//   },
//   processingText: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#E65100', marginBottom: 8 },
//   processingSubText: { textAlign: 'center', fontSize: 13, color: '#F57C00', fontStyle: 'italic' },
//   videoContainer: {
//     marginTop: 24,
//     borderRadius: 12,
//     overflow: 'hidden',
//     backgroundColor: '#000',
//     borderWidth: 2,
//     borderColor: Color.Purple,
//   },
//   videoLabel: { fontSize: 16, fontWeight: '600', color: Color.Black, marginBottom: 10, paddingHorizontal: 4 },
//   videoPlayer: { width: '100%', height: 250, backgroundColor: '#000' },
//   downloadBtn: {
//     flexDirection: 'row',
//     gap: 10,
//     justifyContent: 'center',
//     backgroundColor: '#4CAF50',
//     marginTop: 20,
//     padding: 14,
//     borderRadius: 10,
//     alignItems: 'center',
//     shadowColor: '#4CAF50',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   downloadBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
// });

// export default VideoMakers;