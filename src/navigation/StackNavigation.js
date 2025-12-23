import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SpleshScreen from '../screen/SpleshScreen';
import DrawerNavigation from './DrawerNavigation';
import ToolsHeader from '../components/ToolsHeader';
import JpgToPdf from '../components/JpgtoPdf';
import EditPdf from '../components/EditPdf';
import PdfToJpg from '../components/PdfToJpg';
import BgRemover from '../components/BgRemover';
import ResizeImage from '../components/ResizeImage';
import ResizePdf from '../components/ResizePdf';
import ImageToText from '../components/ImageToText';
import UnlockPdf from '../components/UnlockPdf';
import ProtectPdf from '../components/ProtectPdf';
import PdfViewer from '../components/PdfViewer';
import PassPortImage from '../components/PassPortImage';
import DocumetScanner from '../components/DocumetScanner';
import VideoMakers from '../components/VideoMakers';

const Stack = createNativeStackNavigator();
const StackNavigation = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="SpleshScreen"
    >
      <Stack.Screen name="SpleshScreen" component={SpleshScreen} />
      <Stack.Screen name="DrawerNavigation" component={DrawerNavigation} />

      <Stack.Screen name="ToolsHeader" component={ToolsHeader} />

      <Stack.Screen name="JpgtoPdf" component={JpgToPdf} />
      <Stack.Screen name="EditPdf" component={EditPdf} />
      <Stack.Screen name="PdfToJpg" component={PdfToJpg} />
      <Stack.Screen name="BgRemover" component={BgRemover} />
      <Stack.Screen name="PassPortImage" component={PassPortImage} />
      
      <Stack.Screen name="ResizeImage" component={ResizeImage} />
      <Stack.Screen name="ResizePdf" component={ResizePdf} />
      <Stack.Screen name="ImageToText" component={ImageToText} />
      <Stack.Screen name="UnlockPdf" component={UnlockPdf} />
      <Stack.Screen name="ProtectPdf" component={ProtectPdf} />
      <Stack.Screen name="DocumetScanner" component={DocumetScanner} />
      <Stack.Screen name="VideoMakers" component={VideoMakers} />
      
      <Stack.Screen name="PdfViewer" component={PdfViewer} />
    </Stack.Navigator>
  );
};

export default StackNavigation;

const styles = StyleSheet.create({});
