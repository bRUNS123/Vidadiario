const admin = require('firebase-admin');

// Trying to initialize without explicit credentials. 
// If the user has default credentials set up, this might work.
try {
  admin.initializeApp();
} catch (e) {
  console.log("Initialize error:", e.message);
}

const db = admin.firestore();

async function run() {
  try {
    const user = await admin.auth().getUserByEmail('bfrancosentis@gmail.com');
    const uid = user.uid;
    console.log("Found user UID:", uid);

    let count = 0;
    for (const col of ['registros', 'categorias', 'aliasMappings']) {
      const snap = await db.collection(col).get();
      const batch = db.batch();
      let batchCount = 0;
      snap.forEach(d => {
        if (!d.data().userId) {
          batch.update(d.ref, { userId: uid });
          batchCount++;
          count++;
        }
      });
      if (batchCount > 0) {
        await batch.commit();
      }
    }
    console.log(`Migration complete. Updated ${count} documents.`);
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();
