import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import HomeScreen from '../screen/HomeScreen';
import FeedBackScreen from '../screen/FeedBackScreen';
import PrivacyPolicyScreen from '../screen/PrivacyPolicyScreen';
import DrawerScreen from './DrawerScreen';
import { createDrawerNavigator } from '@react-navigation/drawer';

const Drawer = createDrawerNavigator();
const DrawerNavigation = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <DrawerScreen {...props} />} // <-- custom drawer
      screenOptions={{
        headerShown: false, // show top bar with menu
      }}
    >
      <Drawer.Screen name="HomeScreen" component={HomeScreen} />
      <Drawer.Screen name="FeedBackScreen" component={FeedBackScreen} />
      <Drawer.Screen
        name="PrivacyPolicyScreen"
        component={PrivacyPolicyScreen}
      />
      <Drawer.Screen name="DrawerScreen" component={DrawerScreen} />
    </Drawer.Navigator>
  );
};

export default DrawerNavigation;

const styles = StyleSheet.create({});
