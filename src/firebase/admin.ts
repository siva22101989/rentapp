import admin from 'firebase-admin';

let app: admin.app.App;

function getAdminApp() {
    if (admin.apps.length) {
        return admin.app();
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
    }

    const decodedServiceAccount = JSON.parse(Buffer.from(serviceAccount, 'base64').toString('utf-8'));

    app = admin.initializeApp({
        credential: admin.credential.cert(decodedServiceAccount)
    });
    return app;
}


function getAdminDb() {
    return getAdminApp().firestore();
}

export { getAdminApp, getAdminDb };
