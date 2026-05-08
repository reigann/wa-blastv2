import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBZSLXNR1UscI7MhUb8WNE3fBeyM3qU0P4",
  authDomain: "whatsappblaster-c2d77.firebaseapp.com",
  projectId: "whatsappblaster-c2d77",
  storageBucket: "whatsappblaster-c2d77.firebasestorage.app",
  messagingSenderId: "1046972650630",
  appId: "1:1046972650630:web:1b7c1703519f59661f2d07",
  measurementId: "G-T5YZHZXGQK"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogleFirebase() {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken(true);
  return { idToken, firebaseUser: result.user };
}
