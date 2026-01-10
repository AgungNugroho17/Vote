const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin


admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: "https://pskpd-3df84-default-rtdb.asia-southeast1.firebasedatabase.app"
});


const db = admin.database();

/**
 * POST /vote
 * body: { token, choice }
 */
app.post("/vote", async (req, res) => {
  const { token, choice } = req.body;

  if (!token || !choice) {
    return res.status(400).json({ message: "Token dan pilihan wajib diisi" });
  }

  const tokenRef = db.ref(`tokens/${token}`);

  const snapshot = await tokenRef.once("value");

  if (!snapshot.exists()) {
    return res.status(400).json({ message: "Token tidak valid" });
  }

  if (snapshot.val().used === true) {
    return res.status(400).json({ message: "Token sudah digunakan" });
  }

  // Simpan vote
  await db.ref(`votes/${choice}`).transaction(current => (current || 0) + 1);

  // Tandai token sudah dipakai
  await tokenRef.update({ used: true });

  return res.json({ message: "Voting berhasil" });
});

app.use(express.static("public"));

// Generate random token
function generateToken(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Admin generate token
app.post("/admin/generate-token", async (req, res) => {
  const { jumlah } = req.body;

  if (!jumlah || jumlah < 1) {
    return res.status(400).json({ message: "Jumlah token tidak valid" });
  }

  const tokens = {};

  for (let i = 0; i < jumlah; i++) {
    const token = generateToken();
    tokens[token] = { used: false };
  }

  await db.ref("tokens").update(tokens);

  res.json({
    message: "Token berhasil dibuat",
    tokens: Object.keys(tokens)
  });
});

// RESET VOTING (ADMIN)
app.post("/admin/reset-voting", async (req, res) => {
  try {
    // Hapus hasil voting
    await db.ref("votes").remove();

    // Reset semua token jadi unused
    const tokensRef = db.ref("tokens");
    const snapshot = await tokensRef.once("value");

    if (snapshot.exists()) {
      const updates = {};
      snapshot.forEach(child => {
        updates[`${child.key}/used`] = false;
      });
      await tokensRef.update(updates);
    }

    res.json({ message: "Voting berhasil di-reset" });
  } catch (err) {
    res.status(500).json({ message: "Gagal reset voting" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

