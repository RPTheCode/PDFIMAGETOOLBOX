import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
  Linking,
  Image,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BaseContainer from '../components/BaseContainer';
import { Color, moderateScale } from '../utils/Theme';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import Toast from 'react-native-toast-message';
import Modal from 'react-native-modal';

import {
  BannerAd,
  BannerAdSize,
  TestIds,
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxx/yyyy';
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
  keywords: ['pdf', 'tools', 'documents'],
});

const requestPermissions = async () => {
  try {
    let permissions = [];

    if (Platform.Version >= 33) {
      permissions = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ];
    } else {
      permissions = [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ];
    }

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    const allGranted = Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );
    return allGranted;
  } catch (e) {
    console.log(e);
    return false;
  }
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const [rewardedAdLoaded, setRewardedAdLoaded] = useState(false);
  const [toolUseCount, setToolUseCount] = useState(0);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    Toast.show({
      text2: ' 👋 Welcome to the PDF and Image Tools',
    });
    const subLoad = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedAdLoaded(true);
    });
    const subEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      setToolUseCount(0);
      rewarded.load();
    });
    const subClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedAdLoaded(false);
      setToolUseCount(0);
      rewarded.load();
    });

    rewarded.load();
    return () => {
      subLoad();
      subEarned();
      subClosed();
    };
  }, []);

  const showRewardedAd = () => {
    if (rewardedAdLoaded) rewarded.show();
    else rewarded.load();
  };

  // HANDLE TOOL PRESS WITH DENY COUNTER
  const handleToolPress = async screen => {
    const allowed = await requestPermissions();

    if (!allowed) {
      // get deny count from storage
      let denyCount = await AsyncStorage.getItem('denyCount');
      denyCount = denyCount ? parseInt(denyCount) + 1 : 1;

      await AsyncStorage.setItem('denyCount', denyCount.toString());

      if (denyCount < 3) {
        Toast.show({ text2: 'Please allow permissions to use the tools.' });
      } else {
        setShowPermissionModal(true);
      }
      return;
    }

    // if permission granted → reset deny counter
    await AsyncStorage.setItem('denyCount', '0');

    const count = toolUseCount + 1;
    if (count >= 3) {
      if (rewardedAdLoaded) showRewardedAd();
      setToolUseCount(0);
    } else {
      setToolUseCount(count);
    }

    navigation.navigate(screen);
  };

  const data = [
    { id: '1',  image:require('../assets/Image/EditPDF.png'),  title: 'Edit PDF', onPress: () => handleToolPress('EditPdf') },
    { id: '2',  image:require('../assets/Image/BGREMOVE.png'),  title: 'Image BG Remove', onPress: () => handleToolPress('BgRemover') },
    { id: '3',  image:require('../assets/Image/IMGtoPDF.png'),  title: 'Image to PDF', onPress: () => handleToolPress('JpgtoPdf') },
    { id: '4',  image:require('../assets/Image/PASSPORTPHOTO.png'),  title: 'Passport Photo', onPress: () => handleToolPress('PassPortImage') },
    { id: '5',  image:require('../assets/Image/PDFTOJPG.png'),  title: 'PDF to JPG', onPress: () => handleToolPress('PdfToJpg') },
    { id: '6',  image:require('../assets/Image/DOCSCANNER.png'),  title: 'Doc Scanner', onPress: () => handleToolPress('DocumetScanner') },
    { id: '7',  image:require('../assets/Image/RESIZEPDF.png'),  title: 'Resize PDF', onPress: () => handleToolPress('ResizePdf') },
    { id: '8',  image:require('../assets/Image/RESIZEIMAGE.png'),  title: 'Resize Image', onPress: () => handleToolPress('ResizeImage') },
    { id: '9',  image:require('../assets/Image/UNLOCKPDF.png'),  title: 'Unlock PDF', onPress: () => handleToolPress('UnlockPdf') },
    { id: '10', image:require('../assets/Image/VIDEOMACKER.png'),  title: 'Video Maker', onPress: () => handleToolPress('VideoMakers') },
    { id: '11', image:require('../assets/Image/LOCKPDF.png'),  title: 'Protect PDF', onPress: () => handleToolPress('ProtectPdf') },
    { id: '12', image:require('../assets/Image/IMGTOTEXT.png'),  title: 'Image to Text', onPress: () => handleToolPress('ImageToText') },
  ];

  return (
    <BaseContainer>
      <Header />
      <View style={styles.cantainer}>
        <View style={styles.textMain}>
          <Text style={styles.SectionText} allowFontScaling={false}>Your Smart Toolbox for</Text>
          <Text style={styles.SectionText} allowFontScaling={false}>PDF and Image Tools</Text>
        </View>

        <View style={{ marginVertical: moderateScale(20), marginBottom: moderateScale(30) }}>
          <Text style={styles.textDescription} allowFontScaling={false}>
            Handle your documents and images effortlessly — Convert, Edit, Resize, Unlock, Protect, and more.
          </Text>
        </View>

        <FlatList
          data={data}
          keyExtractor={i => i.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={item.onPress} style={styles.toolBtn}>
              <Image source={item.image} style={styles.toolImage} />
              <Text allowFontScaling={false} style={styles.toolText}>{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={{ alignItems: 'center' }}>
        <BannerAd unitId={TestIds.BANNER} size={BannerAdSize.ADAPTIVE_BANNER} />
      </View>

      <Modal isVisible={showPermissionModal} onBackdropPress={() => setShowPermissionModal(false)}>
        <View style={styles.permissionModal}>
          <Text style={styles.welcomeText}>
            To use this tool, please allow the required permissions in Settings.
          </Text>

          <TouchableOpacity
            onPress={() => {
              setShowPermissionModal(false);
              Linking.openSettings();
            }}
            style={styles.settingBtn}
          >
            <Text style={styles.settingText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </BaseContainer>
  );
};

const styles = StyleSheet.create({
  cantainer: { flex: 1, marginHorizontal: moderateScale(10) },
  textMain: { alignItems: 'center', marginTop: moderateScale(20) },
  SectionText: { textAlign: 'center', fontSize: 20, fontWeight: 800, color: Color.Black },
  textDescription: { fontSize: 14, color: Color.Black, textAlign: 'center' },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center',gap:8, padding:12, backgroundColor: Color.DarkBlue, marginHorizontal: 4, borderRadius: 8, justifyContent: 'left' },
  toolImage: { width: moderateScale(24), height: moderateScale(24), paddingRight:6 },
  toolText: { fontSize: 15, fontWeight: 900, color: Color.White, textAlign: 'center', paddingRight: 4 },
  permissionModal: { backgroundColor: Color.White, padding: 20, borderRadius: 10 },
  welcomeText: { fontSize: 16, textAlign: 'center', color: '#333', fontWeight: '600' },
  settingBtn: { marginTop: 20, backgroundColor: Color.DarkBlue, paddingVertical: 12, borderRadius: 8 },
  settingText: { color: Color.White, textAlign: 'center', fontWeight: '700' },
});

export default HomeScreen;
