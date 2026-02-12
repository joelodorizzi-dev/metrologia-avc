import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAg9GvmuwCZIQIwPY38aMc-enGU547kSgE",
  authDomain: "metrocal-2c77d.firebaseapp.com",
  projectId: "metrocal-2c77d",
  storageBucket: "metrocal-2c77d.firebasestorage.app",
  messagingSenderId: "950124715973",
  appId: "1:950124715973:web:529e22b60bce439601b5ac",
  measurementId: "G-09FQCSDZ6P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database and auth
export const db = getFirestore(app);
export const auth = getAuth(app);