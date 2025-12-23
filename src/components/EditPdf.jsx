// src/components/EditPdf.jsx
import React, { useEffect } from "react";
import { View, PermissionsAndroid, Platform, StyleSheet } from "react-native";
import WebView from "react-native-webview";
import RNFetchBlob from "rn-fetch-blob";
import RNFS from 'react-native-fs';
import BaseContainer from "./BaseContainer";
import { moderateScale } from "../utils/Theme";
import ToolsHeader from "./ToolsHeader";
import Share from 'react-native-share';
import FileViewer from "react-native-file-viewer";
import Toast from "react-native-toast-message";

import notifee, { EventType } from '@notifee/react-native';
import { initNotifications, showNotification } from './Notification';
import { useNavigation } from '@react-navigation/native';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const EditPdf = () => {

  const navigation = useNavigation();

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

  const handleDownload = async (base64Data, fileName = "modified_document.pdf") => {
    try {
      // Extract base64 data (remove data:application/pdf;base64, prefix if present)
      const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');

      const { fs } = RNFetchBlob;
      const downloads = fs.dirs.DownloadDir;
      const filePath = `${downloads}/${fileName}`;

      // Write base64 data to file
      await fs.writeFile(filePath, cleanBase64, 'base64');

      await addFileToRecents(filePath)
      // Toast.show({
      //   type: 'success',
      //   text1: 'Download Complete',
      //   text2: `File saved to: ${filePath}`
      // });

      await showNotification(
        'PDF Download',
        `${filePath}`,
        filePath
      );

      // Optional: Open the file
      // if (Platform.OS === 'android') {
      //   RNFetchBlob.android.actionViewIntent(filePath, 'application/pdf');
      // }

    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // Add this helper if not already added
  const addFileToRecents = async filePath => {
    try {
      if (RNFS.scanFile) {
        await RNFS.scanFile(filePath);
        console.log('📂 File scanned & added to Recents:', filePath);
      } else {
        console.log('⚠️ scanFile not supported in this RNFS version');
      }
    } catch (err) {
      console.log('❌ Error scanning file:', err);
    }
  };

  const handleShare = async (base64Data, fileName = "modified_document.pdf") => {
    try {
      // Clean base64 data
      const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');

      // Create temporary file path
      const { fs } = RNFetchBlob;
      const tempDir = fs.dirs.CacheDir;
      const filePath = `${tempDir}/${fileName}`;

      // Write base64 to file
      await fs.writeFile(filePath, cleanBase64, 'base64');

      await Share.open({
        url: `file://${filePath}`,
        type: 'application/pdf',
        title: 'Share PDF',
        failOnCancel: false,
      });



      // // Use React Native Share API
      // const shareOptions = {
      //   title: 'Share PDF',
      //   message: 'Check out this modified PDF document',
      //   url: `file://${filePath}`,
      //   type: 'application/pdf',
      // };

      // const result = await Share.share(shareOptions);

      // Clean up temp file after sharing (optional)
      // setTimeout(() => {
      //     fs.unlink(filePath).catch(console.error);
      // }, 5000);

    } catch (error) {
      console.error('Share error:', error);
    }
  };


  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Received message:', message.type);

      if (message.type === 'DOWNLOAD_PDF' && message.data) {
        handleDownload(message.data, message.fileName);
      } else if (message.type === 'SHARE_PDF' && message.data) {
        handleShare(message.data, message.fileName);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };


  // Inject JavaScript to override download functionality
  // Enhanced injected JavaScript
  const injectedJavaScript = `
        (function() {
            // Override download functionality
            const originalDownloadFunction = window.downloadModifiedPdf;
            
            window.downloadModifiedPdf = async function() {
                try {
                    const downloadBtn = document.getElementById("download-modified-pdf");
                    const originalText = downloadBtn.textContent;
                    downloadBtn.textContent = "Processing...";
                    downloadBtn.disabled = true;

                    const fileInput = document.getElementById("pdf-upload-input");
                    if (!fileInput.files.length) {
                        alert("No PDF file found. Please upload a PDF first.");
                        return;
                    }

                    const file = fileInput.files[0];
                    const existingPdfBytes = await readFileAsArrayBuffer(file);
                    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
                    const pages = pdfDoc.getPages();

                    for (let i = 0; i < pages.length; i++) {
                        const page = pages[i];
                        const fabricCanvas = fabricCanvases[i];
                        
                        if (!fabricCanvas) continue;

                        const fabricDataUrl = fabricCanvas.toDataURL({
                            format: "png",
                            quality: 1,
                            multiplier: 2,
                        });

                        const pngImage = await pdfDoc.embedPng(fabricDataUrl);
                        const { width, height } = page.getSize();
                        page.drawImage(pngImage, {
                            x: 0,
                            y: 0,
                            width,
                            height,
                        });
                    }

                    const pdfBytes = await pdfDoc.save();
                    const bytes = new Uint8Array(pdfBytes);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    const base64Data = 'data:application/pdf;base64,' + base64;

                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'DOWNLOAD_PDF',
                        data: base64Data,
                        fileName: "modified_" + (file.name || "document.pdf")
                    }));

                } catch (error) {
                    console.error("Error generating PDF:", error);
                    alert("Error generating PDF: " + error.message);
                } finally {
                    const downloadBtn = document.getElementById("download-modified-pdf");
                    if (downloadBtn) {
                        downloadBtn.textContent = originalText;
                        downloadBtn.disabled = false;
                    }
                }
            };

            // Share functionality
            function setupShareButton() {
                const shareBtn = document.getElementById('mobile-share-btn');
                
                if (shareBtn) {
                    shareBtn.addEventListener('click', async function() {
                        try {

                            const originalText = shareBtn.textContent;
                            shareBtn.textContent = "Processing...";
                            shareBtn.disabled = true;

                            const { PDFDocument } = PDFLib;
                            const fileInput = document.getElementById('pdf-upload-input');
                            if (!fileInput.files.length) {
                                alert('No PDF file found. Please upload a PDF first.');
                                return;
                            }

                            const file = fileInput.files[0];
                            const existingPdfBytes = await readFileAsArrayBuffer(file);
                            const pdfDoc = await PDFDocument.load(existingPdfBytes);
                            const pages = pdfDoc.getPages();

                            for (let i = 0; i < pages.length; i++) {
                                const page = pages[i];
                                const fabricCanvas = fabricCanvases[i];
                                
                                if (!fabricCanvas) continue;

                                const fabricDataUrl = fabricCanvas.toDataURL({
                                    format: "png",
                                    quality: 1,
                                    multiplier: 2,
                                });

                                const pngImage = await pdfDoc.embedPng(fabricDataUrl);
                                const { width, height } = page.getSize();
                                page.drawImage(pngImage, {
                                    x: 0,
                                    y: 0,
                                    width,
                                    height,
                                });
                            }

                            const pdfBytes = await pdfDoc.save();
                            const bytes = new Uint8Array(pdfBytes);
                            let binary = '';
                            for (let i = 0; i < bytes.byteLength; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            const base64 = btoa(binary);
                            const base64Data = 'data:application/pdf;base64,' + base64;

                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'SHARE_PDF',
                                data: base64Data,
                                fileName: "modified_" + (file.name || "document.pdf")
                            }));

                        } catch (error) {
                            console.error('Share error:', error);
                            alert('Error sharing PDF: ' + error.message);
                        } finally {
                            shareBtn.textContent = originalText;
                            shareBtn.disabled = false;
                        }
                    });
                }
            }

            // Helper function
            window.readFileAsArrayBuffer = function(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(file);
                });
            };

            // Initialize share button
            setTimeout(setupShareButton, 1000);

            console.log('All handlers injected successfully');
        })();
    `;

  return (
    <BaseContainer>
      <ToolsHeader title={'Edit PDF'} />
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>

      <View style={styles.container}>
        <WebView
          source={{ uri: "https://sridixtechnology.com/project/pdf_img_toolbox/khalid/index.html" }}
          onMessage={handleWebViewMessage}
          injectedJavaScript={injectedJavaScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="compatibility"
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView HTTP error: ', nativeEvent);
          }}
        />
      </View>
    </BaseContainer>
  );
};

export default EditPdf;


const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: moderateScale(10),
  },
  webview: {
    flex: 1,
  },
})

