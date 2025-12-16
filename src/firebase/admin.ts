
import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
}

const decodedServiceAccount = JSON.parse(Buffer.from(serviceAccount, 'base64').toString('utf-8'));

let adminApp: admin.app.App;

function getAdminApp(): admin.app.App {
    if (!admin.apps.length) {
        adminApp = admin.initializeApp({
            credential: admin.credential.cert(decodedServiceAccount)
        });
    } else {
        adminApp = admin.app();
    }
    return adminApp;
}

function getAdminDb(): admin.firestore.Firestore {
    const app = getAdminApp();
    return admin.firestore(app);
}

export { getAdminApp, getAdminDb };
