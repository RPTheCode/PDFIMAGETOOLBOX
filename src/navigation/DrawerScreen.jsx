// DrawerScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { HomeIcon
    , InfoIcon, SendIcon, SplashDImage } from '../assets/Image/images';
import { Color, moderateScale } from '../utils/Theme';

const DrawerScreen = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <StatusBar backgroundColor={Color.Purple} />
            <View style={{ height: 160, justifyContent: 'center', backgroundColor: Color.Purple, }}>
                <Image source={SplashDImage} style={styles.LogoImage} />
                <Text style={styles.title}>PDF & Image Toolbox</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: moderateScale(20) }}>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => navigation.navigate('HomeScreen')}
                >
                    <Image source={HomeIcon} style={styles.MenuImage} />
                    <Text style={styles.menuText}>Home </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => navigation.navigate('FeedBackScreen')}
                >
                    <Image source={SendIcon} style={styles.MenuImage} />
                    <Text style={styles.menuText}>Feedback </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => navigation.navigate('PrivacyPolicyScreen')}
                >
                    <Image source={InfoIcon} style={styles.MenuImage} />
                    <Text style={styles.menuText}>Privacy Policy </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default DrawerScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // paddingTop: 60,
        // paddingHorizontal: 20,
        backgroundColor: Color.White,
    },
    LogoImage: {
        width: 70,
        height: 70,
        alignSelf: 'center',
        marginTop: moderateScale(20),
    },
    title: {
        textAlign: 'center',
        color: Color.White,
        fontSize: 22,
        marginBottom: 30,
        fontWeight: 500,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },

    MenuImage: {
        width: 28,
        height: 28,
        tintColor: Color.SilverGray,
    },
    menuText: {
        fontSize: 18,
        marginLeft: 15,
    },
});
