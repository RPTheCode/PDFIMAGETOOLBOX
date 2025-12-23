// firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // ✅ Add this

const firebaseConfig = {
  apiKey: "AIzaSyDgDm-u5xIJf3vo9CHAwd9dxu9KZmr4Grc",
  authDomain: "pdf-and-image-toolbox-129a2.firebaseapp.com",
  databaseURL: "https://pdf-and-image-toolbox-129a2-default-rtdb.firebaseio.com", // ✅ REQUIRED
  projectId: "pdf-and-image-toolbox-129a2",
  storageBucket: "pdf-and-image-toolbox-129a2.appspot.com", // ✅ fix typo from `.app` to `.com`
  messagingSenderId: "648434221202",
  appId: "1:648434221202:android:200d3ca35462eb33a5a64b",
};

const app = initializeApp(firebaseConfig);
const realtimeDb = getDatabase(app); // ✅ Create Realtime Database instance

export { realtimeDb }; // ✅ Export it

