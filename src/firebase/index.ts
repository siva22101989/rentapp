
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let firebaseApp: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
} else if (typeof window !== 'undefined') {
  firebaseApp = getApp();
  auth = getAuth(firebaseApp);
  firestore = getFirestore(firebaseApp);
}

// @ts-ignore
export { firebaseApp, auth, firestore };
