import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput
} from 'react-native';
import React, { useState } from 'react';
import Header from '../components/Header';
import { Color } from '../utils/Theme';
import BaseContainer from '../components/BaseContainer';
import { DownArroW, UploadIcon } from '../assets/Image/images';
import Modal from 'react-native-modal';
// Import Firestore
import { getDatabase, ref, push, set } from 'firebase/database';
import { db, realtimeDb } from '../components/firebase';
import Toast from 'react-native-toast-message';


import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';


const FeedBackScreen = () => {
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    'Suggestion or Feedback',
  );
  const [blankFild, setBlankFild] = useState(false);

  // 👇 State for input values
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');

  const toggleModal = () => {
    setModalVisible(!isModalVisible);
  };

  const handleSelect = option => {
    setSelectedOption(option);
    toggleModal();
  };

  const handleCancel = () => {
    setEmail('');
    setFeedback('');
  };

  // // New: Submit feedback to Firestore
  const handleSubmit = async () => {
    if (!email.trim() || !feedback.trim()) {
      setBlankFild(true);
      setTimeout(() => {
        setBlankFild(false);
      }, 2000); // Auto-dismiss after 2 seconds
      return;
    }

    try {
      const feedbackRef = ref(realtimeDb, 'feedbacks'); // ✅ Use realtimeDb
      const newFeedbackRef = push(feedbackRef);
      await set(newFeedbackRef, {
        type: selectedOption,
        email,
        feedback,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Feedback submitted successfully!',
      });

      setEmail('');
      setFeedback('');
      setSelectedOption('Suggestion or Feedback');
    } catch (error) {
      console.error('Submission Error:', error);
    }
  };

  return (
    <BaseContainer>
      <Header />
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Text style={styles.selectedText}>{selectedOption}</Text>
          <TouchableOpacity onPress={toggleModal}>
            <Image source={DownArroW} style={styles.DownImage} />
          </TouchableOpacity>
        </View>

        <View>
          <TextInput
            placeholder="Enter Email ID"
            placeholderTextColor={Color.LightGray6}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Write your feedback..."
              placeholderTextColor={Color.LightGray6}
              multiline
              numberOfLines={4}
              value={feedback}
              onChangeText={setFeedback}
              style={styles.textArea}
            />

          </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
            <Text style={styles.btnText}>Submit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleCancel}>
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>


        {/* Ads Section  */}
        <View style={{ alignItems: 'center', marginTop: 40 ,}}>
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdFailedToLoad={(error) => {
              console.log('Ad Load Failed: ', error);
            }}
          />
        </View>


      </View>

      {/* Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={toggleModal}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          {['Suggestion or Feedback', 'I have an issue', 'Other'].map(item => (
            <TouchableOpacity
              key={item}
              style={styles.optionItem}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.optionText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Modal
        isVisible={blankFild}
        animationIn="slideInDown"
        animationOut="slideOutUp"
        backdropOpacity={0.3}
        onBackdropPress={() => setBlankFild(false)}
        style={{ margin: 0, marginTop: 10 }}
      >
        <View
          style={[
            styles.welcomeModal,
            { backgroundColor: Color.Red2, color: Color.White },
          ]}
        >
          <Text style={styles.welcomeText}>Fill All The Fields!</Text>
        </View>
      </Modal>


    </BaseContainer>
  );
};

export default FeedBackScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Color.White,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginBottom: 20,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '600',
    color: Color.Black,
  },
  DownImage: {
    width: 20,
    height: 20,
    tintColor: Color.Black,
  },
  input: {
    borderBottomWidth: 1,
    borderColor: Color.LightGray6,
    // marginTop: 10,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
  },
  inputWrapper: {
    // position: 'relative',
    // marginTop: 10,
  },
  textArea: {
    height: 100,
    paddingRight: 40, // ⬅️ Add right padding to leave space for icon
    borderBottomWidth: 1,
    borderColor: Color.LightGray6,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  uploadIcon: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 5,
  },

  textArea: {
    height: 100,
    textAlignVertical: 'top',
    borderBottomWidth: 1,
    borderColor: Color.LightGray6,
    marginTop: 10,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
  },
  btnRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  btn: {
    backgroundColor: Color.Purple,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: Color.White,
    fontSize: 16,
    fontWeight: '600',
  },
  modal: {
    justifyContent: 'flex-start',
    margin: 0,
    paddingTop: 100,
  },
  modalContent: {
    backgroundColor: Color.White,
    paddingVertical: 0,
    paddingHorizontal: 10,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  optionItem: {
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
    color: Color.Black,
  },
  welcomeModal: {
    flex: 1,
    alignSelf: 'center',
    backgroundColor: Color.White,
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    elevation: 4,
    shadowColor: Color.Black,
    shadowOffset: { width: 0, height: 2 },
    position: 'absolute',
    top: 10,
  },
  welcomeText: {
    color: Color.White,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
