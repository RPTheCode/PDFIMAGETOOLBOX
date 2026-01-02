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
import React, { useEffect, useState, useCallback } from 'react';
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
  InterstitialAd,
} from 'react-native-google-mobile-ads';
import { BANNER_AD_ID, INTERSTITIAL_AD_ID } from '../components/AdsMain';


console.log('🚀 Banner ID:', BANNER_AD_ID);
console.log('🚀 Interstitial ID:', INTERSTITIAL_AD_ID);

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
    return Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (e) {
    console.log('❌ Permissions Error:', e);
    return false;
  }
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const [interstitial, setInterstitial] = useState(null);
  const [toolUseCount, setToolUseCount] = useState(0);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    Toast.show({ text2: ' 👋 Welcome to the PDF and Image Tools' });

    // ✅ ONLY ONE Interstitial - NO GLOBAL
    const newInterstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID, {
      requestNonPersonalizedAdsOnly: true,
      keywords: ['pdf', 'tools'],
    });

    const unsubscribeLoaded = newInterstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setInterstitialLoaded(true);
        console.log('✅ Interstitial LOADED');
      }
    );

    const unsubscribeFailed = newInterstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.log('❌ Interstitial ERROR:', error);
        setInterstitialLoaded(false);
      }
    );

    const unsubscribeClosed = newInterstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('✅ Interstitial CLOSED');
        setInterstitialLoaded(false);
        newInterstitial.load(); // Reload
      }
    );

    newInterstitial.load();
    setInterstitial(newInterstitial);

    // ✅ Cleanup
    return () => {
      unsubscribeLoaded();
      unsubscribeFailed();
      unsubscribeClosed();
    };
  }, []);

  const showInterstitialAd = useCallback(() => {
    if (interstitialLoaded && interstitial) {
      console.log('🚀 Showing ad');
      interstitial.show();
    } else {
      console.log('❌ Ad not ready');
    }
  }, [interstitialLoaded, interstitial]);

  const handleToolPress = async (screen) => {
    const allowed = await requestPermissions();

    if (!allowed) {
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

    await AsyncStorage.setItem('denyCount', '0');
    
    const count = toolUseCount + 1;
    console.log('Tool count:', count);
    
    if (count >= 3) {
      showInterstitialAd();
      setToolUseCount(0);
    } else {
      setToolUseCount(count);
    }
    
    navigation.navigate(screen);
  };

  const data = [
    { id: '1', image: require('../assets/Image/EditPDF.png'), title: 'Edit PDF', screen: 'EditPdf' },
    { id: '2', image: require('../assets/Image/BGREMOVE.png'), title: 'Image BG Remove', screen: 'BgRemover' },
    { id: '3', image: require('../assets/Image/IMGtoPDF.png'), title: 'Image to PDF', screen: 'JpgtoPdf' },
    { id: '4', image: require('../assets/Image/PASSPORTPHOTO.png'), title: 'Passport Photo', screen: 'PassPortImage' },
    { id: '5', image: require('../assets/Image/PDFTOJPG.png'), title: 'PDF to JPG', screen: 'PdfToJpg' },
    { id: '6', image: require('../assets/Image/DOCSCANNER.png'), title: 'Doc Scanner', screen: 'DocumetScanner' },
    { id: '7', image: require('../assets/Image/RESIZEPDF.png'), title: 'Resize PDF', screen: 'ResizePdf' },
    { id: '8', image: require('../assets/Image/RESIZEIMAGE.png'), title: 'Resize Image', screen: 'ResizeImage' },
    { id: '9', image: require('../assets/Image/UNLOCKPDF.png'), title: 'Unlock PDF', screen: 'UnlockPdf' },
    { id: '10', image: require('../assets/Image/VIDEOMACKER.png'), title: 'Video Maker', screen: 'VideoMakers' },
    { id: '11', image: require('../assets/Image/LOCKPDF.png'), title: 'Protect PDF', screen: 'ProtectPdf' },
    { id: '12', image: require('../assets/Image/IMGTOTEXT.png'), title: 'Image to Text', screen: 'ImageToText' },
  ];

  return (
    <BaseContainer>
      <Header />
      <View style={styles.container}>
        <View style={styles.textMain}>
          <Text style={styles.SectionText}>Your Smart Toolbox for</Text>
          <Text style={styles.SectionText}>PDF and Image Tools</Text>
        </View>

        <View style={{ marginVertical: moderateScale(20), marginBottom: moderateScale(30) }}>
          <Text style={styles.textDescription}>
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
            <TouchableOpacity 
              onPress={() => handleToolPress(item.screen)} 
              style={styles.toolBtn}
            >
              <Image source={item.image} style={styles.toolImage} />
              <Text style={styles.toolText}>{item.title}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={BANNER_AD_ID}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => console.log('✅ Banner LOADED')}
          onAdFailedToLoad={(error) => console.log('❌ Banner ERROR:', error)}
        />
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
  container: { flex: 1, marginHorizontal: moderateScale(10) },
  textMain: { alignItems: 'center', marginTop: moderateScale(20) },
  SectionText: { textAlign: 'center', fontSize: 20, fontWeight: '800', color: Color.Black },
  textDescription: { fontSize: 14, color: Color.Black, textAlign: 'center' },
  toolBtn: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, 
    padding: 12, backgroundColor: Color.DarkBlue, marginHorizontal: 4, 
    borderRadius: 8, justifyContent: 'left' 
  },
  toolImage: { width: moderateScale(24), height: moderateScale(24) },
  toolText: { fontSize: 15, fontWeight: '900', color: Color.White },
  bannerContainer: { alignItems: 'center', marginVertical: 20 },
  permissionModal: { backgroundColor: Color.White, padding: 20, borderRadius: 10 },
  welcomeText: { fontSize: 16, textAlign: 'center', color: '#333', fontWeight: '600' },
  settingBtn: { marginTop: 20, backgroundColor: Color.DarkBlue, paddingVertical: 12, borderRadius: 8 },
  settingText: { color: Color.White, textAlign: 'center', fontWeight: '700' },
});

export default HomeScreen;











// import {
//   FlatList,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
//   PermissionsAndroid,
//   Platform,
//   Linking,
//   Image,
// } from 'react-native';
// import React, { useEffect, useState } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import BaseContainer from '../components/BaseContainer';
// import { Color, moderateScale } from '../utils/Theme';
// import { useNavigation } from '@react-navigation/native';
// import Header from '../components/Header';
// import Toast from 'react-native-toast-message';
// import Modal from 'react-native-modal';

// import {
//   BannerAd,
//   BannerAdSize,
//   TestIds,
//   AdEventType,
//   InterstitialAd,
// } from 'react-native-google-mobile-ads';


// // const INTERSTITIAL_AD_ID = 'ca-app-pub-6543570376501942/7619156981';
// // const BANNER_AD_ID = 'ca-app-pub-6543570376501942/4613719690';
// const BANNER_AD_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-6543570376501942/4613719690';
// const INTERSTITIAL_AD_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-6543570376501942/7619156981';
// console.log('Banner ID:', BANNER_AD_ID);


// const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID, {
//   keywords: ['pdf', 'tools', 'documents'],
// });


// const requestPermissions = async () => {
//   try {
//     let permissions = [];

//     if (Platform.Version >= 33) {
//       permissions = [
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
//         PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//       ];
//     } else {
//       permissions = [
//         PermissionsAndroid.PERMISSIONS.CAMERA,
//         PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
//         PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
//       ];
//     }

//     const granted = await PermissionsAndroid.requestMultiple(permissions);
//     const allGranted = Object.values(granted).every(
//       status => status === PermissionsAndroid.RESULTS.GRANTED
//     );
//     return allGranted;
//   } catch (e) {
//     console.log(e);
//     return false;
//   }
// };

// const HomeScreen = () => {
//   const navigation = useNavigation();
//   const [interstitialLoaded, setInterstitialLoaded] = useState(false);;
//   const [toolUseCount, setToolUseCount] = useState(0);
//   const [showPermissionModal, setShowPermissionModal] = useState(false);

//   useEffect(() => {
//     Toast.show({
//       text2: ' 👋 Welcome to the PDF and Image Tools',
//     });

//     const subLoaded = interstitial.addAdEventListener(
//       AdEventType.LOADED,
//       () => {
//         setInterstitialLoaded(true);
//       }
//     );

//     const subClosed = interstitial.addAdEventListener(
//       AdEventType.CLOSED,
//       () => {
//         setInterstitialLoaded(false);
//         interstitial.load();
//       }
//     );

//     interstitial.load();

//     return () => {
//       subLoaded();
//       subClosed();
//     };
//   }, []);


//   const showInterstitialAd = () => {
//     if (interstitialLoaded) {
//       interstitial.show();
//     }
//   };


//   // HANDLE TOOL PRESS WITH DENY COUNTER
//   const handleToolPress = async screen => {
//     const allowed = await requestPermissions();

//     if (!allowed) {
//       // get deny count from storage
//       let denyCount = await AsyncStorage.getItem('denyCount');
//       denyCount = denyCount ? parseInt(denyCount) + 1 : 1;

//       await AsyncStorage.setItem('denyCount', denyCount.toString());

//       if (denyCount < 3) {
//         Toast.show({ text2: 'Please allow permissions to use the tools.' });
//       } else {
//         setShowPermissionModal(true);
//       }
//       return;
//     }

//     // if permission granted → reset deny counter
//     await AsyncStorage.setItem('denyCount', '0');


//     const count = toolUseCount + 1;
//     if (count >= 3) {
//       showInterstitialAd();
//       setToolUseCount(0);
//     } else {
//       setToolUseCount(count);
//     }
//     // 🚀 THIS WAS MISSING
//     navigation.navigate(screen);

//   };

//   const data = [
//     { id: '1', image: require('../assets/Image/EditPDF.png'), title: 'Edit PDF', onPress: () => handleToolPress('EditPdf') },
//     { id: '2', image: require('../assets/Image/BGREMOVE.png'), title: 'Image BG Remove', onPress: () => handleToolPress('BgRemover') },
//     { id: '3', image: require('../assets/Image/IMGtoPDF.png'), title: 'Image to PDF', onPress: () => handleToolPress('JpgtoPdf') },
//     { id: '4', image: require('../assets/Image/PASSPORTPHOTO.png'), title: 'Passport Photo', onPress: () => handleToolPress('PassPortImage') },
//     { id: '5', image: require('../assets/Image/PDFTOJPG.png'), title: 'PDF to JPG', onPress: () => handleToolPress('PdfToJpg') },
//     { id: '6', image: require('../assets/Image/DOCSCANNER.png'), title: 'Doc Scanner', onPress: () => handleToolPress('DocumetScanner') },
//     { id: '7', image: require('../assets/Image/RESIZEPDF.png'), title: 'Resize PDF', onPress: () => handleToolPress('ResizePdf') },
//     { id: '8', image: require('../assets/Image/RESIZEIMAGE.png'), title: 'Resize Image', onPress: () => handleToolPress('ResizeImage') },
//     { id: '9', image: require('../assets/Image/UNLOCKPDF.png'), title: 'Unlock PDF', onPress: () => handleToolPress('UnlockPdf') },
//     { id: '10', image: require('../assets/Image/VIDEOMACKER.png'), title: 'Video Maker', onPress: () => handleToolPress('VideoMakers') },
//     { id: '11', image: require('../assets/Image/LOCKPDF.png'), title: 'Protect PDF', onPress: () => handleToolPress('ProtectPdf') },
//     { id: '12', image: require('../assets/Image/IMGTOTEXT.png'), title: 'Image to Text', onPress: () => handleToolPress('ImageToText') },
//   ];

//   return (
//     <BaseContainer>
//       <Header />
//       <View style={styles.cantainer}>
//         <View style={styles.textMain}>
//           <Text style={styles.SectionText} allowFontScaling={false}>Your Smart Toolbox for</Text>
//           <Text style={styles.SectionText} allowFontScaling={false}>PDF and Image Tools</Text>
//         </View>

//         <View style={{ marginVertical: moderateScale(20), marginBottom: moderateScale(30) }}>
//           <Text style={styles.textDescription} allowFontScaling={false}>
//             Handle your documents and images effortlessly — Convert, Edit, Resize, Unlock, Protect, and more.
//           </Text>
//         </View>

//         <FlatList
//           data={data}
//           keyExtractor={i => i.id}
//           numColumns={2}
//           showsVerticalScrollIndicator={false}
//           columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 10 }}
//           renderItem={({ item }) => (
//             <TouchableOpacity onPress={item.onPress} style={styles.toolBtn}>
//               <Image source={item.image} style={styles.toolImage} />
//               <Text allowFontScaling={false} style={styles.toolText}>{item.title}</Text>
//             </TouchableOpacity>
//           )}
//         />
//       </View>

//       {/* <View style={{ alignItems: 'center', }}>
//         <BannerAd unitId={BANNER_AD_ID} size={BannerAdSize.BANNER} />
//       </View> */}

//       <View style={{ alignItems: 'center', marginTop: 20 }}>
//         <BannerAd
//           unitId={BANNER_AD_ID}
//           size={BannerAdSize.BANNER}
//           requestOptions={{
//             requestNonPersonalizedAdsOnly: true,
//           }}
//           onAdFailedToLoad={(error) => {
//             console.log('Banner failed:', error);
//           }}
//         />
//       </View>

//       <Modal isVisible={showPermissionModal} onBackdropPress={() => setShowPermissionModal(false)}>
//         <View style={styles.permissionModal}>
//           <Text style={styles.welcomeText}>
//             To use this tool, please allow the required permissions in Settings.
//           </Text>

//           <TouchableOpacity
//             onPress={() => {
//               setShowPermissionModal(false);
//               Linking.openSettings();
//             }}
//             style={styles.settingBtn}
//           >
//             <Text style={styles.settingText}>Open Settings</Text>
//           </TouchableOpacity>
//         </View>
//       </Modal>
//     </BaseContainer>
//   );

// }

// const styles = StyleSheet.create({
//   cantainer: { flex: 1, marginHorizontal: moderateScale(10) },
//   textMain: { alignItems: 'center', marginTop: moderateScale(20) },
//   SectionText: { textAlign: 'center', fontSize: 20, fontWeight: 800, color: Color.Black },
//   textDescription: { fontSize: 14, color: Color.Black, textAlign: 'center' },
//   toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: Color.DarkBlue, marginHorizontal: 4, borderRadius: 8, justifyContent: 'left' },
//   toolImage: { width: moderateScale(24), height: moderateScale(24), paddingRight: 6 },
//   toolText: { fontSize: 15, fontWeight: 900, color: Color.White, textAlign: 'center', paddingRight: 4 },
//   permissionModal: { backgroundColor: Color.White, padding: 20, borderRadius: 10 },
//   welcomeText: { fontSize: 16, textAlign: 'center', color: '#333', fontWeight: '600' },
//   settingBtn: { marginTop: 20, backgroundColor: Color.DarkBlue, paddingVertical: 12, borderRadius: 8 },
//   settingText: { color: Color.White, textAlign: 'center', fontWeight: '700' },
// });


// export default HomeScreen;
