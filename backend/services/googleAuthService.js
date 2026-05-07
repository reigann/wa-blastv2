const crypto = require('crypto');
const { admin, getFirestore, getFirebaseApp } = require('./firebaseAdmin');

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function upsertUserFromIdentity({ googleId, email, displayName, pictureUrl }) {
  const db = getFirestore();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error('Google account does not provide an email');
  }

  const allowlistDoc = await db.collection('email_allowlist').doc(normalizedEmail).get();
  if (!allowlistDoc.exists) {
    throw new Error(`Email ${normalizedEmail} is not in the allowlist`);
  }

  const usersRef = db.collection('users');
  let userDoc = null;

  if (googleId) {
    const byGoogle = await usersRef.where('google_id', '==', googleId).limit(1).get();
    if (!byGoogle.empty) userDoc = byGoogle.docs[0];
  }

  if (!userDoc) {
    const byEmail = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
    if (!byEmail.empty) userDoc = byEmail.docs[0];
  }

  const now = admin.firestore.Timestamp.now();

  if (userDoc) {
    await userDoc.ref.update({
      name: displayName || userDoc.data()?.name || '',
      google_id: googleId || userDoc.data()?.google_id || null,
      picture_url: pictureUrl || userDoc.data()?.picture_url || null,
      is_allowed: true,
      last_login: now,
      updated_at: now,
    });

    const updated = (await userDoc.ref.get()).data();
    return { id: userDoc.id, ...updated };
  }

  const created = {
    email: normalizedEmail,
    name: displayName || '',
    google_id: googleId || null,
    picture_url: pictureUrl || null,
    is_allowed: true,
    last_login: now,
    created_at: now,
    updated_at: now,
  };

  const ref = await usersRef.add(created);
  return { id: ref.id, ...created };
}

async function findOrCreateUser(profile) {
  const googleId = profile.id;
  const displayName = profile.displayName || '';
  const email = normalizeEmail(profile.email);
  const pictureUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
  return upsertUserFromIdentity({ googleId, email, displayName, pictureUrl });
}

async function createSessionToken(userId) {
  const db = getFirestore();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.collection('sessions').doc(token).set({
    token,
    user_id: userId,
    expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
    created_at: admin.firestore.Timestamp.now(),
  });

  return { token, expiresAt };
}

async function signInWithFirebaseIdToken(idToken) {
  if (!idToken) throw new Error('idToken is required');
  getFirebaseApp();
  const decoded = await admin.auth().verifyIdToken(idToken, true);

  if (!decoded.email || !decoded.email_verified) {
    throw new Error('Google email is not verified');
  }

  const user = await upsertUserFromIdentity({
    googleId: decoded.uid,
    email: decoded.email,
    displayName: decoded.name || decoded.email,
    pictureUrl: decoded.picture || null,
  });

  const sessionData = await createSessionToken(user.id);
  return { user, sessionData };
}

async function getSessionWithUser(token) {
  if (!token) return null;
  const db = getFirestore();

  const sessionDoc = await db.collection('sessions').doc(token).get();
  if (!sessionDoc.exists) return null;

  const session = sessionDoc.data();
  const expiresAt = session.expires_at?.toDate ? session.expires_at.toDate() : null;
  if (!expiresAt || expiresAt <= new Date()) {
    await sessionDoc.ref.delete();
    return null;
  }

  const userDoc = await db.collection('users').doc(String(session.user_id)).get();
  if (!userDoc.exists) return null;

  const user = userDoc.data();
  return {
    token,
    userId: userDoc.id,
    user: {
      id: userDoc.id,
      email: user.email,
      name: user.name,
      picture_url: user.picture_url || null,
      google_id: user.google_id || null,
      is_allowed: !!user.is_allowed,
    },
  };
}

async function invalidateSession(token) {
  if (!token) return;
  const db = getFirestore();
  await db.collection('sessions').doc(token).delete();
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

async function addEmailToAllowlist(email, addedBy = null) {
  const db = getFirestore();
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('Invalid email');

  const ref = db.collection('email_allowlist').doc(normalized);
  const existing = await ref.get();
  if (existing.exists) return false;

  await ref.set({ email: normalized, added_by: addedBy || 'system', created_at: admin.firestore.Timestamp.now() });
  return true;
}

async function removeEmailFromAllowlist(email) {
  const db = getFirestore();
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const ref = db.collection('email_allowlist').doc(normalized);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

async function getAllAllowedEmails() {
  const db = getFirestore();
  const snap = await db.collection('email_allowlist').orderBy('created_at', 'desc').get();
  return snap.docs.map((d) => d.data());
}

module.exports = {
  findOrCreateUser,
  createSessionToken,
  signInWithFirebaseIdToken,
  getSessionWithUser,
  invalidateSession,
  extractBearerToken,
  addEmailToAllowlist,
  removeEmailFromAllowlist,
  getAllAllowedEmails,
};
