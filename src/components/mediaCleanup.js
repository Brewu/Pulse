import cron from "node-cron";
import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

cron.schedule("*/10 * * * *", async () => {
  const now = Date.now();

  try {
    const snapshot = await db
      .collection("posts")
      .where("mediaExpiresAt", "<=", now)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        mediaUrl: null,
        mediaType: "",
        mediaExpiresAt: null,
      });
    });

    await batch.commit();
    console.log("✅ Expired media links removed");
  } catch (err) {
    console.error("❌ Media cleanup error:", err);
  }
});