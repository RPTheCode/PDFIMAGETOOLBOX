import { StyleSheet, View } from "react-native";
import React, { useEffect } from "react";
import ToolsHeader from "./ToolsHeader";
import BaseContainer from "./BaseContainer";
import WebView from "react-native-webview";
import RNFS from "react-native-fs";
import FileViewer from "react-native-file-viewer";
import Share from "react-native-share";
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { useNavigation } from '@react-navigation/native';

import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const injectedJavaScript = `true;`;

const BgRemover = () => {
  const navigation = useNavigation();
  console.log('Rendering BgRemover component');

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

  const handleWebViewMessage = async (event) => {
    console.log('called funtion');

    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "download") {
        const filePath = `${RNFS.DownloadDirectoryPath}/${msg.filename}`;
        await RNFS.writeFile(filePath, msg.data, "base64");
        console.log("✅ SAVED IMAGE:", filePath);

        await CameraRoll.saveAsset(`file://${filePath}`, {
          type: 'photo',
          album: 'PDFIMAGETOOLBOX',
        });

        await showNotification(
          'Image Download',
          `${filePath}`,
          filePath
        );

      }

      if (msg.type === "share") {
        const path = `${RNFS.CachesDirectoryPath}/${msg.filename}`;

        // Save file temporarily for sharing
        await RNFS.writeFile(path, msg.data, "base64");
        console.log("✅ SHARE READY PATH:", path);

        // Open Native Share Sheet
        await Share.open({
          title: "Share Image",
          url: `file://${path}`,
          type: "image/png",
        });
      }

    } catch (err) {
      console.warn("Message error:", err);
    }
  };

  return (
    <BaseContainer>
      <ToolsHeader title={"Background Remove"} />

      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <View style={styles.container}>
        <WebView
          source={{ uri: "https://sridixtechnology.com/project/pdf_img_toolbox/khalid_bg_remover/" }}
          onMessage={handleWebViewMessage}
          injectedJavaScript={injectedJavaScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="compatibility"
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}

          scalesPageToFit={false}
          automaticallyAdjustContentInsets={false}
          androidHardwareAccelerationDisabled={false}
          setSupportZoom={false}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}

          onError={(e) => console.warn("WebView error", e.nativeEvent)}
          onHttpError={(e) => console.warn("HTTP error", e.nativeEvent)}
        />
      </View>
    </BaseContainer>
  );
};

export default BgRemover;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 10,
  },
});



