import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity,  } from 'react-native';
import NetInfo from "@react-native-community/netinfo";

const NoInternetConnection = ({
  visible = true,
  message = 'Please connect to the Internet to continue. Retry',
  description = 'Please check your internet connection and try again.',
  buttonText = 'Try Again',
  onRetry,
  backgroundColor = "#9C27B0",
  messageColor = '#333',
  descriptionColor = '#666',
  buttonColor = '#4a6da7',
  buttonTextColor = '#fff',
  customStyle,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      setShowModal(!connected && visible);

      // if (!connected) {
      //   Alert.alert('No Internet Connection', 'Please check your internet connection and try again.');
      // }
    });

    // Initial check
    NetInfo.fetch().then(state => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      setShowModal(!connected && visible);
      // if (!connected) {
      //   Alert.alert('No Internet Connection', 'Please check your internet connection and try again.');
      // }
    });

    return () => unsubscribe();
  }, [visible]);

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    }
    const state = await NetInfo.fetch();
    const connected = state.isConnected && state.isInternetReachable !== false;
    setIsConnected(connected);
    setShowModal(!connected && visible);

    if (!connected) {
      // Alert.alert('No Internet Connection', 'Please check your internet connection and try again.');
      console.log('No Internet Connection', 'Please check your internet connection and try again.');
      
    }
  };

  if (isConnected) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={showModal}
      onRequestClose={() => { }}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor }, customStyle]}>
          <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
          {/* <Text style={[styles.description, { color: descriptionColor }]}>
            {description}
          </Text> */}
          {/* <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonColor }]}
            onPress={handleRetry}
          >
            <Text style={[styles.buttonText, { color: buttonTextColor }]}>
              {buttonText}
            </Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  message: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default NoInternetConnection;
