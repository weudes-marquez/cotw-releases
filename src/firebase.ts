import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
// TODO: Implement proper credential management for Electron apps
const firebaseConfig = {
    apiKey: "AIzaSyBi5XD0ldgzafUIJHL53gdAEli5KWtKvxA",
    authDomain: "cotw-pin-planner.firebaseapp.com",
    projectId: "cotw-pin-planner",
    storageBucket: "cotw-pin-planner.firebasestorage.app",
    messagingSenderId: "667768990763",
    appId: "1:667768990763:web:02c5c514cbfff3da820e6e",
    measurementId: "G-H76274ZQNM"
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore (simplified - no persistent cache for Electron compatibility)
export const db = getFirestore(app);
