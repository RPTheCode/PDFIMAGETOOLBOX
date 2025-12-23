import {
  StyleSheet, View,
  Platform,
  PermissionsAndroid,
} from 'react-native'
import React, { useRef, useState, useEffect } from 'react'
import ToolsHeader from './ToolsHeader'
import BaseContainer from './BaseContainer';
import WebView from 'react-native-webview';
import { moderateScale } from '../utils/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share'
import RNFetchBlob from 'rn-fetch-blob'
import { launchCamera, launchImageLibrary } from 'react-native-image-picker'
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { useNavigation } from '@react-navigation/native';
import FileViewer from "react-native-file-viewer";
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

const PassPortImage = () => {
  const navigation = useNavigation();
  console.log('Rendering PassPortImage component');

  const webViewRef = useRef(null)
  const [blobConversionResolvers, setBlobConversionResolvers] = useState({})

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


  // ✅ FIXED: Clean base64
  const cleanBase64 = (data) => {
    if (!data) return null
    return data.replace(/^data:image\/\w+;base64,/, '')
  }

  // ✅ FIXED: Blob conversion function (MISSING पहले)
  const convertBlobToBase64 = (blobUrl) => {
    return new Promise((resolve, reject) => {
      if (!webViewRef.current) {
        reject(new Error('WebView not ready'))
        return
      }

      const requestId = `blob_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setBlobConversionResolvers(prev => ({ ...prev, [requestId]: { resolve, reject } }))

      const jsCode = `
        fetch('${blobUrl}')
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader()
            reader.onloadend = () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "BLOB_CONVERTED",
                base64: reader.result,
                requestId: "${requestId}"
              }))
            }
            reader.readAsDataURL(blob)
          })
          .catch(err => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "BLOB_ERROR",
              error: err.message,
              requestId: "${requestId}"
            }))
          });
        true;
      `
      webViewRef.current.injectJavaScript(jsCode)

      setTimeout(() => {
        setBlobConversionResolvers(prev => {
          const updated = { ...prev }
          if (updated[requestId]) {
            updated[requestId].reject(new Error('Timeout'))
            delete updated[requestId]
          }
          return updated
        })
      }, 10000)
    })
  }

  // ✅ FIXED: Permission handler with permanent denial handling
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const storedPermission = await AsyncStorage.getItem('storagePermission')
        if (storedPermission === 'granted') return true


        let permissions = []
        if (Platform.Version >= 33) {
          permissions = [PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]
        } else {
          permissions = [
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ]
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions)
        const allGranted = Object.values(granted).every(status => status === PermissionsAndroid.RESULTS.GRANTED)

        if (allGranted) {
          await AsyncStorage.setItem('storagePermission', 'granted')
          return true
        } else {
          const permanentlyDenied = Object.entries(granted).some(
            ([_, status]) => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          )
          await AsyncStorage.setItem('storagePermission', permanentlyDenied ? 'denied_permanent' : 'denied')
          return false
        }
      } catch (err) {
        console.warn(err)
        return false
      }
    }
    return true
  }

  // ✅ Download handler (FIXED)
  const handleDownloadImage = async (data) => {
    try {
      let { downloadUrl, fileName = 'passport-photo.png' } = data;
      console.log('⬇️ Starting download...');

      if (downloadUrl.startsWith('blob:')) {
        console.log('🔄 Converting blob...');
        downloadUrl = await convertBlobToBase64(downloadUrl);
      }

      const base64Data = cleanBase64(downloadUrl);
      if (!base64Data) throw new Error('Invalid base64');

      const downloadDir = RNFetchBlob.fs.dirs.DownloadDir;
      const filePath = `${downloadDir}/${fileName}`;

      // Create Downloads directory if not exists
      const dirExists = await RNFetchBlob.fs.isDir(downloadDir);
      if (!dirExists) {
        await RNFetchBlob.fs.mkdir(downloadDir);
      }

      // Write file
      await RNFetchBlob.fs.writeFile(filePath, base64Data, 'base64');
        await CameraRoll.saveAsset(`file://${filePath}`, {
          type: 'photo',
          album: 'PDFIMAGETOOLBOX',
        });

      if (Platform.OS === 'android') {
        RNFetchBlob.android.addCompleteDownload({
          title: fileName,
          description: 'Passport photo downloaded',
          mime: 'image/png',
          path: filePath,
          showNotification: true,
        });
      }

              await showNotification(
                'Image Download',
                `${filePath}`,
                filePath
              );
      console.log('✅ Download successful:', filePath);      

    } catch (err) {
      console.log('❌ Download failed:', err);

    }
  };


  // ✅ Share handler (FIXED)
  const handleShareImage = async (data) => {
    try {
      let { downloadUrl, fileName = 'passport-photo.png' } = data
      console.log('📤 Starting share...')

      if (downloadUrl.startsWith('blob:')) {
        downloadUrl = await convertBlobToBase64(downloadUrl)
      }

      const base64Data = cleanBase64(downloadUrl)
      if (!base64Data) throw new Error('Invalid base64')

      const path = `${RNFetchBlob.fs.dirs.DownloadDir}/${fileName}`
      await RNFetchBlob.fs.writeFile(path, base64Data, 'base64')

      await Share.open({
        url: `file://${path}`,
        type: 'image/png',
        filename: fileName,
      })

    } catch (err) {
      console.log('❌ Share failed:', err)
    }
  }

  // ✅ Camera/Gallery handler (FIXED permission check)
  const handleOpenCamera = async (source = 'camera') => {
    const hasPermission = await requestPermissions()
    if (!hasPermission) {
      return
    }

    try {
      const options = {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
        saveToPhotos: false,
      }

      let response
      if (source === 'camera') {
        response = await launchCamera(options)
      } else {
        response = await launchImageLibrary(options)
      }

      if (response.didCancel || response.errorCode) return

      if (response.assets?.[0]?.base64) {
        const base64Image = `data:image/jpeg;base64,${response.assets[0].base64}`
        const jsCode = `
          if (typeof window.receiveImageFromNative === 'function') {
            window.receiveImageFromNative("${base64Image.replace(/"/g, '\\"')}")
          }
          true;
        `
        webViewRef.current?.injectJavaScript(jsCode)
      }
    } catch (error) {
      console.log('Error', error);
    }
  }

  // ✅ Message handler + blob resolver
  const onMessage = (event) => {
    console.log('📱 WebView Message:', event.nativeEvent.data)

    let data
    try {
      data = JSON.parse(event.nativeEvent.data)
    } catch (e) {
      return
    }

    // Handle blob conversion
    if (data.type === 'BLOB_CONVERTED' && data.requestId) {
      if (blobConversionResolvers[data.requestId]) {
        blobConversionResolvers[data.requestId].resolve(data.base64)
        setBlobConversionResolvers(prev => {
          const updated = { ...prev }
          delete updated[data.requestId]
          return updated
        })
      }
      return
    }

    if (data.type === 'BLOB_ERROR' && data.requestId) {
      if (blobConversionResolvers[data.requestId]) {
        blobConversionResolvers[data.requestId].reject(new Error(data.error))
        setBlobConversionResolvers(prev => {
          const updated = { ...prev }
          delete updated[data.requestId]
          return updated
        })
      }
      return
    }

    // Handle other messages
    switch (data.type) {
      case "DOWNLOAD_IMAGE": handleDownloadImage(data); break
      case "SHARE_IMAGE": handleShareImage(data); break
      case "OPEN_CAMERA": handleOpenCamera('camera'); break
      case "OPEN_GALLERY": handleOpenCamera('gallery'); break
    }
  }

  // ✅ Injected JavaScript (your existing one - PERFECT)
  const injectedJavaScript = `
    window.receiveImageFromNative = window.receiveImageFromNative || function(base64Image) {
      console.log('✅ Native image received')
      const event = new CustomEvent('nativeImageReceived', { detail: base64Image })
      document.dispatchEvent(event)
    }

    document.addEventListener("click", function(e) {
      const fileInput = e.target.closest("input[type='file']")
      if (fileInput) {
        e.preventDefault()
        e.stopPropagation()
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: fileInput.hasAttribute('capture') ? "OPEN_CAMERA" : "OPEN_GALLERY" 
        }))
        return false
      }
    })

    console.log('✅ WebView injection complete')
    true
  `


  return (
    <BaseContainer>
      <ToolsHeader title={'Passport Photo'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: "https://sridixtechnology.com/project/pdf_img_toolbox/khalid_passport_photo/" }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          injectedJavaScript={injectedJavaScript}
          startInLoadingState
        />
      </View>
    </BaseContainer>
  );
}

export default PassPortImage

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  webview: { flex: 1, backgroundColor: 'transparent' }
})

