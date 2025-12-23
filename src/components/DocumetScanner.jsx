import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Image, Platform, TouchableOpacity } from 'react-native';
import ToolsHeader from './ToolsHeader';
import BaseContainer from './BaseContainer';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import Share from 'react-native-share';
import { Color } from '../utils/Theme';
import { Dowload, ImagePick, OpenA, OpenB, ShareA, ShareB } from '../assets/Image/images';
import Toast from 'react-native-toast-message';
import { initNotifications, showNotification } from './Notification';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const DocumetScanner = () => {
  const [scannedImages, setScannedImages] = useState([]);
  const [selectedAction, setSelectedAction] = useState('open');
  const [downloadedPaths, setDownloadedPaths] = useState([]);

  useEffect(() => {
    initNotifications();
  }, []);

  const onScanDocument = async () => {
    try {
      const result = await DocumentScanner.scanDocument();
      if (result?.scannedImages?.length) {
        setScannedImages(result.scannedImages);
        setDownloadedPaths([]); // reset on new scan
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'No Documents Scan',
        });
      }
      setSelectedAction('open');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message,
      });
    }
  };

  // Save scanned images to device storage
  const downloadAllDocuments = async () => {
    if (!scannedImages.length) {
      Toast.show({
        type: 'error',
        text1: 'No scanned documents',
        text2: 'Please scan documents first.',
      });
      return [];
    }
    try {
      let paths = [];
      for (let i = 0; i < scannedImages.length; i++) {
        const imageUri = scannedImages[i];
        const fileName = `scanned_doc_${i + 1}.jpg`;
        const destPath =
          Platform.OS === 'android'
            ? `${RNFS.CachesDirectoryPath}/${fileName}`
            : `${RNFS.DocumentDirectoryPath}/${fileName}`;
        
        await RNFS.copyFile(imageUri, destPath);
        await CameraRoll.saveAsset(destPath, {
          type: 'photo',
          album: 'PDFIMAGETOOLBOX',
        });
        await showNotification(
          `Document ${i + 1} Downloaded`,
          'Tap to open in Gallery',
          destPath
        );
        paths.push(`file://${destPath}`);
      }
      setDownloadedPaths(paths);

      setScannedImages('')
      return paths;
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: err.message,
      });
      return [];
    }
  };

  const handleOpen = async () => {
    setSelectedAction('open');

    if (!downloadedPaths.length) {
      // Download if not already downloaded
      const paths = await downloadAllDocuments();
      if (!paths.length) {
        // Download failed or no files
        return;
      }
    }

    try {
      // Open the first downloaded document
      await FileViewer.open(downloadedPaths[0]);
      setScannedImages([])
      setDownloadedPaths([])
    } catch (error) {
      console.log('Cannot open file:', error.message);
    }
  };


  const handleShare = async () => {
    setSelectedAction('share');

    let pathsToShare = [...downloadedPaths];

    if (!pathsToShare.length) {
      // Download if not already downloaded and use the returned paths immediately
      const paths = await downloadAllDocuments();
      if (!paths.length) {
        Toast.show({
          type: 'error',
          text1: 'Nothing to Share',
          text2: 'No scanned documents available. Please scan and download first.',
        });
        return;
      }
      pathsToShare = paths;
    }

    try {
      await Share.open({
        url: pathsToShare[0],
        type: 'image/jpeg',
        failOnCancel: false,
      });
      setScannedImages([]);
      setDownloadedPaths([]);
    } catch (error) {
      if (error?.message !== 'User did not share') {
        Toast.show({
          type: 'error',
          text1: 'Share Failed',
          text2: error.message || 'Something went wrong while sharing.',
        });
      }
    }
  };


  return (
    <BaseContainer>
      <ToolsHeader title={'Documents Scanner'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <ScrollView>
        <View style={styles.container}>
          <Text style={styles.titleText}>
            Scan Documents on just click!
          </Text>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={onScanDocument}
          >
            <Image source={ImagePick} style={{ width: 24, height: 24, tintColor: Color.White }} />
            <Text style={styles.selectBtnText}>Select Images</Text>
          </TouchableOpacity>
          {scannedImages.length > 0 && (
            <View style={styles.imageContainer}>
              <View style={styles.documentBox}>
                {scannedImages.map((img, index) => (
                  <Image
                    source={{ uri: img }}
                    style={styles.scannedImage}
                    resizeMode="contain"
                    key={index}
                  />
                ))}
                <View style={styles.bottomBar}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: Color.Purple, width: '60%' },
                    ]}
                    onPress={downloadAllDocuments}
                  >
                    <>
                      <Text style={styles.selectBtnText}>Download</Text>
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
            </View>
          )}
        </View>
      </ScrollView>
    </BaseContainer>
  );
};

export default DocumetScanner;

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
  selectBtnText: { color: Color.White, fontSize: 16, fontWeight: '600' },
  titleText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 6,
    fontWeight: '600',
    color: Color.Black,
  },
  imageContainer: {
    marginTop: 20,
  },
  documentBox: {
    marginBottom: 20,
    borderRadius: 5,
  },
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
  scannedImage: {
    width: '100%',
    height: 400,
    marginBottom: 10,
  },
});


