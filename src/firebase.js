// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth,RecaptchaVerifier } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAddfMRR_V1vVSrKcmcy9KSuokDCdIqbtg",
  authDomain: "pulse-ef17b.firebaseapp.com",
  projectId: "pulse-ef17b",
  storageBucket: "pulse-ef17b.appspot.com",
  messagingSenderId: "606252054069",
  appId: "1:606252054069:web:bd7677c65d191d72e1a37c",
  measurementId: "G-JTMTCQE70P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);    // optional
const auth = getAuth(app);              // <-- add this
const db = getFirestore(app);           // <-- add this

// Export auth and db so other files can import them
export { auth, db };