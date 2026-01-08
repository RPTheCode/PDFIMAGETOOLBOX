import { ScrollView, StyleSheet, Text, View } from 'react-native';
import React, { memo } from 'react';
import { Color } from '../utils/Theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const BaseContainer = ({ children }) => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: Color.White }}>
          {children}
        </View>
    </SafeAreaView>
  );
};

export default memo(BaseContainer);

const styles = StyleSheet.create({});
