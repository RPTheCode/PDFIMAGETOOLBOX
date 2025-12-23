import { StatusBar, Platform,  Text, TouchableOpacity, View, Linking,  } from 'react-native';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import StackNavigation from './src/navigation/StackNavigation';
import { Color } from './src/utils/Theme';
import NoInternetConnection from './src/components/NoInternetConnection';
import Toast, { BaseToast } from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import VersionCheck from 'react-native-version-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';

const LAST_SHOWN_VERSION_KEY = 'LAST_UPDATE_PROMPT_VERSION';

const App = () => {
    const [isUpdateVisible, setIsUpdateVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState(null);

  
  const toastConfig = {
    success: (props) => (
      <BaseToast
        {...props}
        style={{ borderLeftColor: '#4CAF50', backgroundColor: '#e8f5e9', marginTop: 10 }}
        text1Style={{ fontSize: 16, fontWeight: 'bold', color: Color.GREEN }}
        text2Style={{ fontSize: 14, color: '#388e3c' }}
      />
    ),
    error: (props) => (
      <BaseToast
        {...props}
        style={{ borderLeftColor: '#f44336', backgroundColor: '#ffebee', marginTop: 10 }}
        text1Style={{ fontSize: 18, fontWeight: 'bold', color: '#b71c1c' }}
        text2Style={{ fontSize: 14, color: '#c62828' }}
        text1NumberOfLines={3}
      />
    ),
  };


    useEffect(() => {
    if (Platform.OS !== 'android') return;

    const checkUpdate = async () => {
      try {
        const latest = await VersionCheck.getLatestVersion({
          provider: 'playStore',
        });

        const current = VersionCheck.getCurrentVersion();
        const lastPrompted = await AsyncStorage.getItem(
          LAST_SHOWN_VERSION_KEY
        );

        console.log({ current, latest, lastPrompted });

        const isNewerVersion = (latest, current) => {
          const l = latest.split('.').map(Number);
          const c = current.split('.').map(Number);

          for (let i = 0; i < Math.max(l.length, c.length); i++) {
            const lv = l[i] || 0;
            const cv = c[i] || 0;
            if (lv > cv) return true;
            if (lv < cv) return false;
          }
          return false;
        };


        if (isNewerVersion(latest, current)) {
          setLatestVersion(latest);
          setIsUpdateVisible(true);
        }

        // ✅ show modal only once per version
        // if (current !== latest) {
        //   setLatestVersion(latest);
        //   setIsUpdateVisible(true);
        // }
      } catch (e) {
        console.log('Update check failed (ignored):', e);
      }
    };

    checkUpdate();
  }, []);

    const onUpdateNow = async () => {
    await AsyncStorage.setItem(LAST_SHOWN_VERSION_KEY, latestVersion);
    Linking.openURL(
      'https://play.google.com/store/apps/details?id=com.pdfimagetoolbox&pcampaignid=web_share'
    );
    setIsUpdateVisible(false);
  };

  const onLater = async () => {
    await AsyncStorage.setItem(LAST_SHOWN_VERSION_KEY, latestVersion);
    setIsUpdateVisible(false);
  };
  

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#9C27B0' }}>
      <NoInternetConnection
        message="No Internet Connection"
        description="Connect to the internet to continue using the app."
        buttonText="Retry"
        backgroundColor="#f8f9fa"
        buttonColor="#007bff"
        onRetry={() => console.log('Retry pressed')}
      />
      <StatusBar backgroundColor="#9C27B0" barStyle="dark-content" />
      <NavigationContainer>
        <StackNavigation />
      </NavigationContainer>
      <Toast config={toastConfig} />

            {/* 🔥 UPDATE MODAL */}
      <Modal isVisible={isUpdateVisible} backdropOpacity={0.6}>
        <View
          style={{
            backgroundColor: '#fff',
            padding: 24,
            borderRadius: 10,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: Color.Primary }}>
            Update Available
          </Text>

          <Text style={{ paddingVertical: 12, color: Color.Primary }}>
            A new version is available on Play Store.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: Color.Purple,
              padding: 12,
              borderRadius: 6,
              marginBottom: 10,
            }}
            onPress={onUpdateNow}
          >
            <Text style={{ color: '#fff', textAlign: 'center' }}>
              Update Now
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onLater} style={{ paddingTop: 12 }}>
            <Text style={{ textAlign: 'center', color: '#666' }}>
              Later
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default App;




















// import { StatusBar } from 'react-native';
// import React, { useEffect } from 'react';
// import { NavigationContainer } from '@react-navigation/native';
// import StackNavigation from './src/navigation/StackNavigation';
// import { Color } from './src/utils/Theme';
// import NoInternetConnection from './src/components/NoInternetConnection';
// import Toast, { BaseToast } from 'react-native-toast-message';
// import { SafeAreaView } from 'react-native-safe-area-context';

// const App = () => {
//   useEffect(() => {
//     console.log('App mounted (no auto PDF open)');
//   }, []);

//   const toastConfig = {
//     success: (props) => (
//       <BaseToast
//         {...props}
//         style={{ borderLeftColor: '#4CAF50', backgroundColor: '#e8f5e9', marginTop: 10 }}
//         text1Style={{ fontSize: 16, fontWeight: 'bold', color: Color.GREEN }}
//         text2Style={{ fontSize: 14, color: '#388e3c' }}
//       />
//     ),
//     error: (props) => (
//       <BaseToast
//         {...props}
//         style={{ borderLeftColor: '#f44336', backgroundColor: '#ffebee', marginTop: 10 }}
//         text1Style={{ fontSize: 18, fontWeight: 'bold', color: '#b71c1c' }}
//         text2Style={{ fontSize: 14, color: '#c62828' }}
//         text1NumberOfLines={3}
//       />
//     ),
//   };

//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: '#9C27B0' }}>
//       <NoInternetConnection
//         message="No Internet Connection"
//         description="Connect to the internet to continue using the app."
//         buttonText="Retry"
//         backgroundColor="#f8f9fa"
//         buttonColor="#007bff"
//         onRetry={() => console.log('Retry pressed')}
//       />
//       <StatusBar backgroundColor="#9C27B0" barStyle="dark-content" />
//       <NavigationContainer>
//         <StackNavigation />
//       </NavigationContainer>
//       <Toast config={toastConfig} />
//     </SafeAreaView>
//   );
// };

// export default App;