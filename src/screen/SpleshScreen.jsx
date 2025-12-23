
import { Image, StyleSheet, Text, View } from 'react-native'
import React, { useEffect } from 'react'
import BaseContainer from '../components/BaseContainer'
import { Color, DEVICE_STYLES } from '../utils/Theme'
import { SplashDImage } from '../assets/Image/images'
import { useNavigation } from '@react-navigation/native';

const SpleshScreen = () => {
    const navigation = useNavigation();

    useEffect(() => {
        const checkLoginStatus = async () => {
            try {
                navigation.replace('DrawerNavigation');
            } catch (error) {
                console.error('Error checking login status:', error);
            }
        };

        const timer = setTimeout(() => {
            checkLoginStatus();
        }, 2000);

        return () => clearTimeout(timer);
    }, [navigation]);


    return (
        <BaseContainer>
            <View style={styles.container}>
                <Image resizeMode="contain" source={SplashDImage} style={styles.image} />
                <Text style={{ color: Color.White, fontSize: 20, fontWeight: 'bold', marginTop:10,}}>PDF & Image Toolbox</Text>
            </View>
        </BaseContainer>
    )
}

export default SpleshScreen

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Color.Purple,
    },
    image: {
        height: DEVICE_STYLES.SCREEN_WIDTH * 0.45,
        width: DEVICE_STYLES.SCREEN_HEIGHT * 0.6,
        alignSelf: 'center',
    },
})




// import { Image, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
// import React, { useEffect, useState } from 'react';
// import BaseContainer from '../components/BaseContainer';
// import { Color, DEVICE_STYLES } from '../utils/Theme';
// import { SplashDImage } from '../assets/Image/images';
// import { useNavigation } from '@react-navigation/native';
// import NetInfo from '@react-native-community/netinfo';

// const SpleshScreen = () => {
//     const navigation = useNavigation();
//     const [isChecking, setIsChecking] = useState(true);
//     const [isConnected, setIsConnected] = useState(true);

//     const checkInternetAndNavigate = async () => {
    
//         const state = await NetInfo.fetch();


//         //     navigation.replace('DrawerNavigation');
//     };

//     useEffect(() => {
//         const timer = setTimeout(() => {
//             checkInternetAndNavigate();
//         }, 2000); // Splash delay

//         return () => clearTimeout(timer);
//     }, [navigation]);

//     if (isChecking) {
//         // While checking internet
//         return (
//             <BaseContainer>
//                 <View style={styles.container}>
//                     <Image resizeMode="contain" source={SplashDImage} style={styles.image} />
//                     <Text style={styles.title}>PDF & Image Toolbox</Text>
//                     <ActivityIndicator color={Color.White} size="large" style={{ marginTop: 20 }} />
//                 </View>
//             </BaseContainer>
//         );
//     }

//     if (!isConnected) {
//         // No internet → Stop Splash & show retry
//         return (
//             <BaseContainer>
//                 <View style={styles.container}>
//                     <Image resizeMode="contain" source={SplashDImage} style={styles.image} />
//                     <Text style={styles.title}>PDF & Image Toolbox</Text>
//                     <Text style={styles.subtitle}>Please connect to the internet to continue.</Text>
//                     <TouchableOpacity
//                         style={styles.retryButton}
//                         onPress={checkInternetAndNavigate}
//                     >
//                         <Text style={styles.retryText}>Retry</Text>
//                     </TouchableOpacity>
//                 </View>
//             </BaseContainer>
//         );
//     }

//     // If internet available, this won't render (because navigation.replace() will trigger)
//     return null;
// };

// export default SpleshScreen;

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         backgroundColor: Color.Purple,
//         padding: 20,
//     },
//     image: {
//         height: DEVICE_STYLES.SCREEN_WIDTH * 0.55,
//         width: DEVICE_STYLES.SCREEN_HEIGHT * 0.9,
//         alignSelf: 'center',
//         marginBottom: 20,
//     },
//     title: {
//         color: Color.White,
//         fontSize: 22,
//         fontWeight: 'bold',
//         textAlign: 'center',
//         marginBottom: 10,
//     },
//     subtitle: {
//         color: '#eee',
//         fontSize: 16,
//         textAlign: 'center',
//         marginBottom: 20,
//     },
//     retryButton: {
//         backgroundColor: '#fff',
//         paddingHorizontal: 20,
//         paddingVertical: 10,
//         borderRadius: 8,
//     },
//     retryText: {
//         color: Color.Purple,
//         fontWeight: 'bold',
//         fontSize: 16,
//     },
// });
