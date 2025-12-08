
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore }from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB5-XstMS7j6pTn0kOLlAi_FMZnVIWyazc",
  authDomain: "vocal-byte-457809-n2.firebaseapp.com",
  projectId: "vocal-byte-457809-n2",
  storageBucket: "vocal-byte-457809-n2.appspot.com",
  messagingSenderId: "555929754101",
  appId: "1:555929754101:web:a7a9a7343aadd5323f28bc",
  measurementId: "G-FZJBY78WBF"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth, firebaseConfig };
