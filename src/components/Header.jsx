import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { MenuImage } from '../assets/Image/images';
import { Color } from '../utils/Theme';

const Header = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.HeaderBar}>
      <TouchableOpacity
        style={{ position: 'absolute', left: 10 }}
        onPress={() => navigation.openDrawer?.()}
      >
        <Image source={MenuImage} style={styles.MenuImage} />
      </TouchableOpacity>
      <Text style={styles.HeaderText}>PDF & Image Toolbox </Text>
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  HeaderBar: {
    height: 50,
    width: '100%',
    backgroundColor: Color.Purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  MenuImage: {
    width: 30,
    height: 30,
    tintColor: Color.White,
  },
  HeaderText: {
    fontSize: 20,
    color: Color.White,
  },
});
