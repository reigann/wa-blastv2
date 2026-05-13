import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

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
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken(true);
    return { idToken, firebaseUser: result.user, mode: 'popup' };
  } catch (error) {
    const code = String(error?.code || '');
    const isPopupIssue =
      code.includes('popup') ||
      code.includes('cancelled-popup-request') ||
      code.includes('operation-not-supported-in-this-environment');

    if (!isPopupIssue) throw error;

    await signInWithRedirect(auth, googleProvider);
    return { pendingRedirect: true, mode: 'redirect' };
  }
}

export async function getGoogleRedirectSignInResult() {
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  const idToken = await result.user.getIdToken(true);
  return { idToken, firebaseUser: result.user, mode: 'redirect' };
}
