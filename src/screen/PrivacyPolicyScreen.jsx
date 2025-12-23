import { StyleSheet, View } from 'react-native';
import React from 'react';
import { WebView } from 'react-native-webview'; // Make sure this import is correct
import Header from '../components/Header';

const PrivacyPolicyScreen = () => {
  return (
    <View style={styles.container}>
       <Header title="Privacy Policy" />
      <WebView
        source={{ uri: 'https://sridixtechnology.com/project/pdf_img_toolbox/khalid/privacy-policy.html' }}
        style={styles.webview}
      />
    </View>
  );
};

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1, // takes full screen
  },
  webview: {
    flex: 1, // makes WebView fill the parent container
  },
});





// import { StyleSheet, Text, View, ScrollView, Linking } from 'react-native';
// import React from 'react';
// import Header from '../components/Header';
// import { Color } from '../utils/Theme'; // Optional: if you're using a theme
// import BaseContainer from '../components/BaseContainer';

// const PrivacyPolicyScreen = () => {
//   return (
//     <BaseContainer>
//       <View style={styles.container}>
//         <Header title="Privacy Policy" />

//         <ScrollView
//           contentContainerStyle={styles.content}
//           showsVerticalScrollIndicator={false}
//         >
//           <Text style={styles.title}>Privacy Policy</Text>

//           <Text style={styles.paragraph}>
//             Md Khalid Raza Ansari Tech built the PDF and Image Toolbox app as an
//             Ad-Supported app. This service is provided at no cost and is
//             intended for use as is.
//           </Text>

//           <Text style={styles.paragraph}>
//             This page informs users regarding our policies on the collection,
//             use, and disclosure of personal information.
//           </Text>

//           <Text style={styles.section}>Information Collection</Text>
//           <Text style={styles.paragraph}>
//             We do not collect or store any personal data from the PDF or image
//             tools used in the app. All processing is done locally on your
//             device.
//           </Text>
//           <Text style={styles.paragraph}>
//             We may collect some basic information like your email address if you
//             contact us for feedback or support. This data is stored securely and
//             only used to improve our services.
//           </Text>

//           <Text style={styles.section}>Third-Party Services</Text>
//           <Text style={styles.paragraph}>
//             The app uses third-party services that may collect information for
//             analytics or ads:
//           </Text>
//           <Text style={styles.bullet}>• Google Play Services</Text>
//           <Text style={styles.bullet}>
//             • AdMob (Open App Ads, Banner Ads, Interstitial Ads)
//           </Text>
//           <Text style={styles.bullet}>• Firebase Analytics</Text>
//           <Text style={styles.bullet}>• Firebase Crashlytics</Text>
//           <Text style={styles.bullet}>
//             • Firebase Realtime Database (for feedback only)
//           </Text>

//           <Text style={styles.section}>Ads</Text>
//           <Text style={styles.paragraph}>
//             We display AdMob ads in the form of:
//           </Text>
//           <Text style={styles.bullet}>• App Open Ads</Text>
//           <Text style={styles.bullet}>• Banner Ads</Text>
//           <Text style={styles.bullet}>• Interstitial Ads</Text>
//           <Text style={styles.paragraph}>
//             These may use device data for showing personalized ads.
//           </Text>

//           <Text style={styles.section}>Log Data</Text>
//           <Text style={styles.paragraph}>
//             In case of errors, data such as device name, OS version, and crash
//             logs may be collected to improve app performance.
//           </Text>

//           <Text style={styles.section}>Cookies</Text>
//           <Text style={styles.paragraph}>
//             We don’t use cookies, but third-party services may use them.
//           </Text>

//           <Text style={styles.section}>Security</Text>
//           <Text style={styles.paragraph}>
//             We take precautions to protect your data, but no method is 100%
//             secure.
//           </Text>

//           <Text style={styles.section}>Changes</Text>
//           <Text style={styles.paragraph}>
//             We may update this Privacy Policy from time to time. You are advised
//             to check this page for any changes.
//           </Text>

//           <Text style={styles.section}>Contact</Text>

//           <Text style={styles.paragraph}>
//             If you have questions, contact use
//             <View style={{ flexDirection: 'row' }}>
//               <Text>at: 📧</Text>
//               <Text
//                 style={styles.link}
//                 onPress={() =>
//                   Linking.openURL('mailto:pdfandimagetoolbox@gmail.com')
//                 }
//               >
//                 pdfandimagetoolbox@gmail.com
//               </Text>
//             </View>
//           </Text>

//           <Text style={styles.section}>Effective Date:</Text>
//           <Text style={styles.paragraph}>24 July 2025</Text>
//         </ScrollView>
//       </View>
//     </BaseContainer>
//   );
// };

// export default PrivacyPolicyScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Color.White,
//   },
//   content: {
//     padding: 20,
//     paddingBottom: 20,
//     // marginBottom: 60,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: 'bold',
//     marginBottom: 12,
//     color: Color.Black,
//   },
//   section: {
//     fontSize: 18,
//     fontWeight: '600',
//     marginTop: 20,
//     marginBottom: 8,
//     color: Color.Blue2, // Optional: blue section title
//   },
//   paragraph: {
//     fontSize: 15,
//     lineHeight: 22,
//     marginBottom: 12,
//     color: '#333',
//   },
//   bullet: {
//     fontSize: 15,
//     lineHeight: 22,
//     marginLeft: 10,
//     marginBottom: 5,
//     color: '#444',
//   },
//   link: {
//     color: Color.Blue2,
//     textDecorationLine: 'underline',
//   },
// });
