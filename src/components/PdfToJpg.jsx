

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { convert } from 'react-native-pdf-to-image';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { Color } from '../utils/Theme';
import { Dowload, OpenA, OpenB, PdfPick, ShareA, ShareB } from '../assets/Image/images';
import BaseContainer from './BaseContainer';
import ToolsHeader from './ToolsHeader';
import Toast from 'react-native-toast-message';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const PDFToImage = () => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [showDownloadBtn, setShowDownloadBtn] = useState(false);
  const [selectedAction, setSelectedAction] = useState('open'); // 'open' or 'share'


  useEffect(() => {
    initNotifications();
  }, []);

  const handleSelectPdf = async () => {
    try {
      setIsConverting(true);
      setSelectedImages([]);
      setShowDownloadBtn(false);

      const res = await pick({ type: types.pdf });
      if (!res || res.length === 0) {
        throw new Error('No file selected');
      }
      const file = res[0];
      const fileUri = file.fileCopyUri ?? file.uri;
      if (!fileUri) {
        throw new Error('No file URI returned from picker');
      }

      const destPath = `${RNFS.TemporaryDirectoryPath}/${file.name || 'temp.pdf'
        }`;

      await RNFS.copyFile(fileUri, destPath);

      // const result = await convert(`file://${destPath}`);
      const result = await convert(`file://${destPath}`, {
        dpi: 600,               // Higher DPI for print-quality images
        quality: 100,           // Max quality
        format: 'png',          // Lossless PNG format
        width: 2480,            // A4 width at 300 DPI
        height: 3508,           // A4 height at 300 DPI
      });


      setSelectedImages(result.outputFiles);
      console.log('Converted Images:', result);
      console.log('Converted Images outputFiles:', result.outputFiles);
      setShowDownloadBtn(true);
      setSelectedAction('open');
    } catch (error) {
      console.log('PDF Selection or Conversion Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot select file',
        text2: `${error.message}`,
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadImages = async () => {
    try {
      const folderPath = `${RNFS.DownloadDirectoryPath}/PDF_IMG_TOOLBOX`;
      const exists = await RNFS.exists(folderPath);
      if (!exists) await RNFS.mkdir(folderPath);
      const uris = [];

      for (let i = 0; i < selectedImages.length; i++) {
        const src = selectedImages[i];
        const fileName = `PDFANDIMAGETOOLS${Date.now()}_${i + 1}.png`;
        const dest = `${folderPath}/${fileName}`;
        await RNFS.copyFile(src, dest);
        await CameraRoll.saveAsset(`file://${dest}`, {
          type: 'photo',
          album: 'PDFIMAGETOOLBOX',
        });


        uris.push(`file://${dest}`);
        console.log('Saved Pdf to image:', dest);
      }

      await showNotification(
        'Images Downloaded',
        'Tap to open first image',
        uris[0]   // first image ka path bhejna zaroori hai
      );
      // await showNotification(
      //   'Images Download',
      //   `${uris}`,
      //   uris[0] // first image path
      // );

      setSelectedImages([]);
      setShowDownloadBtn(false);
      return uris;
    } catch (error) {
      console.log('Download Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Cannot Download file',
        text2: `${error.message}`,
      });
      return []; // return empty array on failure
    }
  };


  const openGallery = async () => {

    setSelectedAction('open');
    await handleDownloadImages();


    if (Platform.OS === 'android') {
      Linking.openURL('content://media/internal/images/media'); // opens general gallery
    } else {
      Linking.openURL('photos-redirect://'); // iOS gallery shortcut
    }
  }

  return (
    <BaseContainer>
      <ToolsHeader title={'PDF to Image'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>


      <View style={styles.container}>
        <Text style={styles.titleText}>
          Select PDF and create images in just a few clicks!
        </Text>

        <TouchableOpacity
          style={styles.selectBtn}
          onPress={handleSelectPdf}
        >
          <Image source={PdfPick} style={{ width: 24, height: 24, tintColor: Color.White }} />
          <Text style={styles.selectBtnText}> Select PDF</Text>
        </TouchableOpacity>

        {isConverting && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.loaderText}>Converting PDF to Images...</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.imageList} showsVerticalScrollIndicator={false}>
          {selectedImages.map((img, i) => (
            <Image
              key={i}
              source={{
                uri: img.startsWith('file://') ? img : `file://${img}`,
              }}
              style={styles.image}
            />
          ))}
        </ScrollView>

        {showDownloadBtn && (
          <View style={styles.bottomBar}>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: Color.Purple, width: '80%' },
              ]}
              onPress={handleDownloadImages}
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
              onPress={openGallery}
            >
              <Image source={selectedAction === 'open' ? OpenB : OpenA} style={{ width: 24, height: 24 }} />

            </TouchableOpacity>

          </View>
        )}
      </View>

    </BaseContainer>
  );
};

export default PDFToImage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Color.White, padding: 16 },
  titleText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 6,
    fontWeight: '600',
    color: Color.Black,
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
  loader: { alignItems: 'center', marginTop: 40 },
  loaderText: { marginTop: 10, fontSize: 16, color: '#555' },
  imageList: { paddingVertical: 20 },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    marginBottom: 15,
    backgroundColor: Color.White,
  },
  downloadBtn: {
    backgroundColor: Color.Purple,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadBtnText: { color: Color.White, fontSize: 16, fontWeight: 700 },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Color.White,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 7, // Android only
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalMessage: { marginHorizontal: 12, marginBottom: 16 },
  modalButton: {
    backgroundColor: Color.Purple,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  modalButtonText: {
    textAlign: 'center',
    color: Color.White,
    fontWeight: 'bold',
  },
  modalBtn: {
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    flex: 1,
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
})
