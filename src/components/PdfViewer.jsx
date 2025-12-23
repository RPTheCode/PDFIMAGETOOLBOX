import { StyleSheet, View, Modal, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import React, { useEffect, useState } from 'react';
import Pdf from 'react-native-pdf';
import { useRoute } from '@react-navigation/native';
import ToolsHeader from './ToolsHeader';
import { Color } from '../utils/Theme';
import RNFS from 'react-native-fs'; // Importing react-native-fs
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Hide, Show } from '../assets/Image/images';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const PdfViewer = () => {
    const route = useRoute();
    const { uri: pdfUri, password: initialPassword } = route.params || {};

    const [pdfPassword, setPdfPassword] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [reloadPdfKey, setReloadPdfKey] = useState(0);
    const [pdfSource, setPdfSource] = useState(null);
    const [showPassword, setShowPassword] = useState(false);


    // Ensure the URI is valid and properly converted
    const getFileUri = async (uri) => {
        if (uri.startsWith("content://")) {
            // Use react-native-fs to get the real file path from content URI
            try {
                const filePath = await RNFS.copyAssetFileIOS(uri, RNFS.DocumentDirectoryPath + '/temp.pdf');
                return 'file://' + filePath;
            } catch (err) {
                console.error('Error copying file:', err);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Could not process the file.'
                });
                return null;
            }
        }
        return uri;  // If it's already a file URI, return it as is
    };

    useEffect(() => {
        if (pdfUri) {
            // Convert content URI to file URI if necessary
            getFileUri(pdfUri).then((resolvedUri) => {
                if (resolvedUri) {
                    setPdfSource({
                        uri: resolvedUri,
                        cache: true,
                    });
                    setReloadPdfKey(prev => prev + 1);  // Reload the PDF on uri change
                }
            });
        }
    }, [pdfUri]);

    const handleError = (error) => {
        const errorMsg = error?.message?.toLowerCase() || '';
        const passwordErrorKeywords = ['password required', 'incorrect password', 'invalid password', 'encrypted'];

        if (passwordErrorKeywords.some(keyword => errorMsg.includes(keyword))) {
            setShowPasswordModal(true);
            console.log('PDF is password protected, requesting password...');
        } else {
            console.error('PDF Load Error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error loading PDF',
                text2: error.message || 'An unknown error occurred.'
            });
        }
    };

    const handlePasswordSubmit = () => {
        // Trim the password inputs to avoid leading/trailing spaces causing issues
        const enteredPassword = pdfPassword.trim();
        const storedPassword = initialPassword?.trim();

        console.log('Entered Password:', enteredPassword);  // Debug log
        console.log('Stored Password:', storedPassword);    // Debug log

        // Check if the entered password matches the initial password
        if (enteredPassword === storedPassword) {

            console.log(' in true:', enteredPassword);  // Debug log
            console.log(' in true:', storedPassword);    // Debug log
            setShowPasswordModal(false);
            setPdfSource({
                uri: pdfUri,
                cache: false,  // Disable caching to force reload
                password: enteredPassword,
            });
            setReloadPdfKey(prev => prev + 1); // Force PDF reload with the new password
        } else {

            console.log(' in false:', enteredPassword);  // Debug log
            console.log(' in false:', storedPassword);    // Debug log
            Toast.show({
                type: 'error',
                text1: 'Incorrect Password',
                text2: 'The password you entered is incorrect.'
            });
        }
    };

    if (!pdfUri) {
        return (
            <View style={styles.container}>
                <ToolsHeader title="PDF Viewer" />
                <Text style={{ textAlign: 'center', marginTop: 50, color: 'red' }}>
                    Error: No PDF URI provided.
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ToolsHeader title="PDF Viewer" />

            <View style={{ alignItems: 'center' }}>
                <BannerAd
                    unitId={TestIds.BANNER}
                    size={BannerAdSize.ADAPTIVE_BANNER}
                    requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                />
            </View>

            {/* <Text style={{ padding: 5 }}>{pdfUri}</Text> */}

            {pdfSource && (
                <Pdf
                    key={reloadPdfKey}
                    source={pdfSource}
                    password={pdfSource?.password}
                    style={styles.pdf}
                    onLoadComplete={(numberOfPages) => {
                        // console.log(`✅ Loaded ${numberOfPages} pages`);
                    }}
                    onPageChanged={(page, numberOfPages) => {
                        // console.log(`📄 Page: ${page}/${numberOfPages}`);
                    }}
                    onError={handleError}
                />
            )}

            {/* Password Modal */}
            <Modal
                visible={showPasswordModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Enter PDF Password</Text>

                        <View style={styles.section}>
                            <TextInput
                                placeholder="Password"
                                style={styles.input}
                                value={pdfPassword}
                                secureTextEntry={!showPassword}
                                onChangeText={setPdfPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                            >
                                <Image
                                    source={showPassword ? Show : Hide}
                                    style={styles.eyeImage}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.submitButton} onPress={handlePasswordSubmit}>
                            <Text style={styles.submitText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default PdfViewer;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Color.White,
    },
    pdf: {
        flex: 1,
        width: '100%',
        height: '100%',
        padding: 10
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        textAlign: 'center',
    },
    section: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginVertical: 6,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
        paddingVertical: 10,
    },
    eyeIcon: {
        // paddingHorizontal: 8,
        // marginRight: 6,
    },
    eyeImage: {
        width: 24,
        height: 24,
        tintColor: '#666',
    },
    submitButton: {
        backgroundColor: Color.Purple,
        padding: 12,
        marginTop: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitText: {
        color: Color.White,
        fontSize: 16,
        fontWeight: '600',
    },
});
