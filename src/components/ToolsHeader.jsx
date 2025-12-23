import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Color } from '../utils/Theme';
import { LeftArrow } from '../assets/Image/images';

const ToolsHeader = ({ title }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
      >
        <Image source={LeftArrow} style={styles.backArrow} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
};

export default ToolsHeader;

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.Purple,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 30,
    marginRight: 12,
  },
  backArrow: {
    color: 'white',
    fontSize: 22,
  },
  headerTitle: {
    flex: 1,
    marginRight: 30,
    textAlign: 'left',
    color: Color.White,
    fontSize: 20,
    fontWeight: 800,
  },
});
