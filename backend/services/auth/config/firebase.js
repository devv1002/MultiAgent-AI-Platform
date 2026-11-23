import { cert, initializeApp, getApps } from "firebase-admin/app";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount;

const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (rawJson) {
    try {
        serviceAccount = typeof rawJson === "object" ? rawJson : JSON.parse(rawJson);
    } catch (err) {
        try {
            // Handle double-escaped JSON strings from environment variable injection
            serviceAccount = JSON.parse(JSON.parse(JSON.stringify(rawJson)));
        } catch {
            throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON: ${err.message}`);
        }
    }
} else {
    // Fallback to local serviceAccountKey.json if present
    const localKeyPath = path.resolve(__dirname, "../serviceAccountKey.json");
    if (fs.existsSync(localKeyPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf-8"));
    } else {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing");
    }
}

// Avoid re-initialization if already initialized
export const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    credential: cert(serviceAccount)
});
