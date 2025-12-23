

import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ScrollView, PermissionsAndroid, Platform,
  KeyboardAvoidingView, Keyboard, Linking
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { createPdf } from 'react-native-images-to-pdf';
import { Color } from '../utils/Theme';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import Share from 'react-native-share';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Delete, Dowload, ImagePick, OpenA, OpenB, ShareA, ShareB } from '../assets/Image/images';
import notifee, { EventType } from '@notifee/react-native';
import { getContentUri, imageOpenNotification, initNotifications, showNotification } from './Notification';
import FileViewer from 'react-native-file-viewer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

// Helper: Generate content:// URI for Android


const JpgToPdf = () => {
  const navigation = useNavigation();
  const [images, setImages] = useState([]);
  const [selectedAction, setSelectedAction] = useState('open');

  useEffect(() => {
    initNotifications();
    imageOpenNotification();
  }, []);

  // Handle foreground notification click
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
        const path = detail.notification.data?.filePath;
        if (path) {
          try {

            if (Platform.OS === 'android') {

              try {
                await FileViewer.open(`file://${path}`);
              } catch (error) {

                const contentUri = await getContentUri(path);
                await Linking.openURL(contentUri);
              }

            } else {
              await Linking.openURL(`file://${path}`);
            }

          } catch (err) {
            console.error('Error opening PDF:', err);
          }
        }
        notifee.cancelNotification(detail.notification.id);
      }
    });

    // Handle background notification click
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS && detail.pressAction.id === 'open-pdf') {
        const path = detail.notification.data?.filePath;
        if (path) {
          try {
            try {
              await FileViewer.open(`file://${path}`);
            } catch (error) {
              console.log('error 82 jpg to pdf', error);

              const uri = await getContentUri(path);
              await Linking.openURL(uri);
            }
          } catch (err) {
            console.error('Error opening PDF in background:', err);
          }
        }
        await notifee.cancelNotification(detail.notification.id);
      }
    });

    return unsubscribe;
  }, [navigation]);



  const handleSelectImages = async () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 }, response => {
      if (!response.didCancel && !response.errorCode) {
        const selected = response.assets.map(asset => ({
          uri: asset.uri,
          fileName: asset.fileName,
        }));
        setImages(prev => [...prev, ...selected]);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Image selection cancelled' });


      }
    });
  };

  const addFileToRecents = async filePath => RNFS.scanFile && RNFS.scanFile(filePath);

  const handleDownloadPdf = async () => {
    if (!images.length) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please select images' });
      return null;
    }
    try {
      const folder = `${RNFS.DownloadDirectoryPath}/PDF_IMG_TOOLBOX`;
      if (!(await RNFS.exists(folder))) await RNFS.mkdir(folder);
      const base = `PDFANDIMAGETOOLBOX_${Date.now()}`;
      let fileName = `${base}.pdf`, path = `${folder}/${fileName}`, cnt = 1;
      while (await RNFS.exists(path)) {
        fileName = `${base}_${cnt}.pdf`;
        path = `${folder}/${fileName}`;
        cnt++;
      }
      const pages = images.map(img => ({
        imagePath: img.uri.startsWith('file://') ? img.uri : `file://${img.uri}`,
        // imageFit: 'contain', width: 595, height: 842, backgroundColor: '#FFF',
        imageFit: 'contain', width: 1240, height: 1754, backgroundColor: '#FFF',
      }));
      const savedPath = await createPdf({ pages, outputPath: path });
      await addFileToRecents(savedPath);

      await AsyncStorage.setItem('lastGeneratedPDF', savedPath); // <-- Store path here
      // await showNotification('PDF Created', `${fileName}`, savedPath);
      await showNotification(
        'PDF Created',
        'Tap to open PDF',
        savedPath,
        'pdf'
      );

      setImages([]);
      return { path: savedPath, fileName };
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Cannot create PDF', text2: error.message });
      return null;
    }
  };

  const handleOpenPDF = async () => {
    setSelectedAction('open');
    const result = await handleDownloadPdf();
    if (result && await RNFS.exists(result.path)) {
      navigation.navigate('PdfViewer', { uri: `file://${result.path}` });
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: 'File not found' });
    }
  };

  const handleShare = async () => {
    setSelectedAction('share');
    const result = await handleDownloadPdf();
    if (result && await RNFS.exists(result.path)) {
      const cache = `${RNFS.CachesDirectoryPath}/${result.fileName}`;
      await RNFS.copyFile(result.path, cache);
      await Share.open({ title: result.fileName, url: `file://${cache}`, type: 'application/pdf' });
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: 'File not found' });
    }
  };

  const deleteImage = idx => setImages(prev => prev.filter((_, i) => i !== idx));

  return (
    <BaseContainer style={{ flex: 1 }}>
      <ToolsHeader title="Image to Pdf" />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} onTouchStart={() => Keyboard.dismiss()}>
          <View style={styles.container}>
            <Text style={styles.titleText}>Create your PDF—select multiple images and make a PDF in clicks!</Text>
            {images.length === 0 && (
              <TouchableOpacity style={styles.selectBtn} onPress={handleSelectImages}>
                <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
                <Text style={styles.selectBtnText}>Select Images</Text>
              </TouchableOpacity>
            )}
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.image} />
                  <TouchableOpacity onPress={() => deleteImage(idx)} style={styles.deleteIcon}>
                    <Image source={Delete} style={{ width: 20, height: 20 }} />
                  </TouchableOpacity>
                  <Text style={styles.counterText}>{idx + 1}/{images.length}</Text>
                </View>
              ))}
            </View>
            {images.length > 0 && (
              <View style={styles.bottomBar}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Color.Purple, width: '60%' }]} onPress={handleDownloadPdf}>
                  <Text style={styles.actionText}>Download PDF</Text>
                  <Image source={Dowload} style={{ width: 24, height: 24 }} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, selectedAction === 'open' && styles.selected]} onPress={handleOpenPDF}>
                  <Image source={selectedAction === 'open' ? OpenB : OpenA} style={{ width: 24, height: 24 }} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, selectedAction === 'share' && styles.selected]} onPress={handleShare}>
                  <Image source={selectedAction === 'share' ? ShareB : ShareA} style={{ width: 24, height: 24 }} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BaseContainer>
  );
};

export default JpgToPdf;

const styles = StyleSheet.create({
  container: { backgroundColor: Color.White, padding: 16 },
  titleText: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: Color.Black },
  selectBtn: { flexDirection: 'row', gap: 10, justifyContent: 'center', backgroundColor: Color.Purple, marginTop: 18, padding: 14, borderRadius: 10, alignItems: 'center' },
  selectBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
  imageWrapper: { flex: 1, width: '90%', marginBottom: 12 },
  image: { width: 290, height: 350, resizeMode: 'contain', backgroundColor: '#fff', borderWidth: 1 },
  deleteIcon: { position: 'absolute', top: 8, right: 8, zIndex: 1, width: 24, height: 24, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  counterText: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', color: Color.White, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 14, fontWeight: '600' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', backgroundColor: Color.LightGray1, padding: 12, gap: 10, flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 10 },
  actionText: { fontSize: 16, fontWeight: '600', color: 'white' },
  selected: { borderWidth: 2, borderColor: Color.Purple },
});
