import { cert, initializeApp } from "firebase-admin";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing");
}

const serviceAccount = JSON.parse(serviceAccountJson);

export const app = initializeApp({
    credential: cert(serviceAccount)
});