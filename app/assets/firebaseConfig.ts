import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyCfc9K9-5cMzDwgjon0HdeBbFd69YPCiXE",
  authDomain: "ttp-moko.firebaseapp.com",
  projectId: "ttp-moko",
  storageBucket: "ttp-moko.firebasestorage.app",
  messagingSenderId: "528679727466",
  appId: "1:528679727466:web:e9fc691753d5613bef7513"
};

export const app = initializeApp(firebaseConfig);