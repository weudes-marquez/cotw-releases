// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import path from 'path';

let initError: Error | null = null;

if (!admin.apps.length) {
    try {
        let serviceAccount: ServiceAccount | undefined;

        // 1. Tenta usar variáveis de ambiente (Prioridade, funciona em Dev e Prod)
        if (process.env.FIREBASE_ADMIN_PRIVATE_KEY && process.env.FIREBASE_ADMIN_CLIENT_EMAIL) {
            console.log("[Firebase Admin] Initializing with environment variables.");
            serviceAccount = {
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            };
        }
        // 2. Se não houver variáveis, tenta carregar do arquivo (Fallback)
        else if (process.env.FIREBASE_ADMIN_CREDENTIAL_PATH) {
            console.log("[Firebase Admin] Loading credentials from file path.");
            const credentialPath = path.resolve(process.cwd(), process.env.FIREBASE_ADMIN_CREDENTIAL_PATH);
            serviceAccount = require(credentialPath);
        }

        if (!serviceAccount) {
            throw new Error("Nenhuma credencial do Firebase encontrada. Defina FIREBASE_ADMIN_PRIVATE_KEY/CLIENT_EMAIL ou FIREBASE_ADMIN_CREDENTIAL_PATH no .env.local");
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });

        console.log(`[Firebase Admin] SDK initialized successfully for project: ${admin.app().options.projectId}`);

    } catch (error: any) {
        console.error("[Firebase Admin] CRITICAL ERROR during initialization:", error.message);
        initError = error;
    }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminStorage = admin.apps.length ? admin.storage() : null;
export const FieldValue = admin.apps.length ? admin.firestore.FieldValue : null;
export const adminApp = admin.apps.length ? admin.app() : null;
export { initError };
