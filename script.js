// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, push, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAlh7f9dqy7upgGLwDmXf-K_PMco7zVUMo",
    authDomain: "why-city-offical.firebaseapp.com",
    databaseURL: "https://why-city-offical-default-rtdb.firebaseio.com",
    projectId: "why-city-offical",
    storageBucket: "why-city-offical.firebasestorage.app",
    messagingSenderId: "563885956896",
    appId: "1:563885956896:web:2218f699c675f0acb0c145",
    measurementId: "G-DLFZE9MGYM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

// UI Elements
const authModal = document.getElementById('auth-modal');
const profileModal = document.getElementById('profile-modal');
const editModal = document.getElementById('edit-modal');
const applicationModal = document.getElementById('application-modal');
const loginBtn = document.getElementById('loginBtn');
const heroRegBtn = document.getElementById('heroRegBtn');
const profileBtn = document.getElementById('profileBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userNav = document.getElementById('user-nav');
const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('#auth-modal .auth-form');
const toast = document.getElementById("toast");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const logoutBtnProfile = document.getElementById('logoutBtnProfile');

// Toast Function
function showToast(message, isError = false) {
    toast.innerText = message;
    toast.style.borderLeftColor = isError ? '#e74c3c' : '#2ecc71';
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// Loading State Helper
function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerHTML = '<div class="spinner"></div> Folyamatban...';
        btn.disabled = true;
    } else {
        btn.innerText = btn.dataset.originalText || 'Küldés';
        btn.disabled = false;
    }
}

// Modal Logic
function openModal(viewId) {
    if (viewId === 'profile') {
        profileModal.classList.add('active');
        // Populate Profile Data
        const user = auth.currentUser;
        if (user) {
            const userRef = ref(db, 'users/' + user.uid);
            get(userRef).then(async (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    
                    // RP ID Logic - Generate if missing
                    if (!data.rpId) {
                        const newRpId = await generateUniqueRpId();
                        set(ref(db, 'users/' + user.uid + '/rpId'), newRpId);
                        document.getElementById('profile-rp-id').innerText = newRpId;
                    } else {
                        document.getElementById('profile-rp-id').innerText = data.rpId;
                    }

                    // Populate Fields
                    document.getElementById('profile-email').innerText = data.email || user.email;
                    document.getElementById('profile-status').innerText = data.statusText || "Épp a városban";
                    document.getElementById('profile-faction').innerText = data.faction || "Civil";
                    document.getElementById('profile-reputation').innerText = data.reputation || "0";
                    
                    if (data.createdAt) document.getElementById('profile-reg-date').innerText = new Date(data.createdAt).toLocaleDateString();
                    if (data.lastLogin) document.getElementById('profile-last-login').innerText = new Date(data.lastLogin).toLocaleDateString();
                    if (data.playstyle) document.getElementById('playstyle-select').value = data.playstyle;
                }
            });
        }
    } else if (viewId === 'edit') {
        editModal.classList.add('active');
    } else if (viewId === 'application') {
        applicationModal.classList.add('active');
        // Biztosítjuk, hogy az űrlap látható legyen
        document.getElementById('faction-application-form').classList.add('active');
    } else {
        authModal.classList.add('active');
        // Switch to requested tab
        tabs.forEach(t => {
            if(t.dataset.target === viewId) t.click();
        });
    }
}

if(loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('login-view'); });
if(heroRegBtn) heroRegBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('register-view'); });
if(profileBtn) profileBtn.addEventListener('click', (e) => { e.preventDefault(); openModal('profile'); });

// Close Modals
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal-overlay').classList.remove('active');
    });
});
window.addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active'); });

// Tab Switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
    });
});

// Auth Switch Links
document.getElementById('switch-to-reg').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.auth-tab[data-target="register-view"]').click();
});

document.getElementById('switch-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.auth-tab[data-target="login-view"]').click();
});

// Google Login
const googleProvider = new GoogleAuthProvider();
document.getElementById('google-login-btn').addEventListener('click', async (e) => {
    const btn = e.target;
    setLoading(btn, true);
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // Ellenőrizzük, hogy létezik-e már az adatbázisban
        const snapshot = await get(ref(db, 'users/' + user.uid));

        if (!snapshot.exists()) {
            const newRpId = await generateUniqueRpId();
            await set(ref(db, 'users/' + user.uid), {
                email: user.email,
                username: user.displayName || user.email.split('@')[0],
                rpId: newRpId,
                role: 'user',
                job: 'Civil',
                banned: false,
                createdAt: Date.now(),
                lastLogin: Date.now()
            });
        } else {
            // Update last login
            await set(ref(db, 'users/' + user.uid + '/lastLogin'), Date.now());
        }

        showToast("Sikeres Google bejelentkezés!");
        authModal.classList.remove('active');
    } catch (error) {
        console.error("Google login error:", error);
        let msg = "Hiba: " + error.message;
        if (error.message.includes("Index not defined")) msg = "Rendszerhiba: Hiányzó adatbázis index (rpId).";
        showToast(msg, true);
    } finally {
        setLoading(btn, false);
    }
});

// 3.1 Auth Logic + RTDB Save
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateUniqueRpId() {
    let unique = false;
    let id = "";
    while(!unique) {
        id = 'WC-' + Math.floor(10000 + Math.random() * 90000);
        const q = query(ref(db, 'users'), orderByChild('rpId'), equalTo(id));
        const snapshot = await get(q);
        if (!snapshot.exists()) unique = true;
    }
    return id;
}

document.getElementById('register-view').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (password.length < 6) {
        showToast("A jelszónak legalább 6 karakternek kell lennie!", true);
        return;
    }

    setLoading(btn, true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const passwordHash = await hashPassword(password);
        const newRpId = await generateUniqueRpId();

        // Save to Realtime Database
        await set(ref(db, 'users/' + user.uid), {
            email: email,
            phone: phone,
            username: email.split('@')[0],
            passwordHash: passwordHash,
            rpId: newRpId,
            role: 'user',
            job: 'Civil',
            banned: false,
            createdAt: Date.now(),
            lastLogin: Date.now()
        });

        showToast("Sikeres regisztráció!");
        authModal.classList.remove('active');
    } catch (error) {
        console.error("Registration error:", error);
        let msg = "Hiba: " + error.message;
        if (error.code === 'auth/email-already-in-use') msg = "Ez az email cím már regisztrálva van.";
        if (error.code === 'auth/invalid-email') msg = "Érvénytelen email cím.";
        if (error.code === 'auth/weak-password') msg = "A jelszó túl gyenge (min. 6 karakter).";
        if (error.message.includes("Index not defined")) msg = "Rendszerhiba: Hiányzó adatbázis index (rpId).";
        showToast(msg, true);
    } finally {
        setLoading(btn, false);
    }
});

document.getElementById('login-view').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type="submit"]');

    setLoading(btn, true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Update last login
        const user = userCredential.user;
        await set(ref(db, 'users/' + user.uid + '/lastLogin'), Date.now());

        showToast("Sikeres bejelentkezés!");
        authModal.classList.remove('active');
    } catch (error) {
        showToast("Hibás email vagy jelszó!", true);
    } finally {
        setLoading(btn, false);
    }
});

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        if(loginBtn) loginBtn.style.display = 'none'; // Hide login btn
        if(userNav) userNav.style.display = 'flex'; // Show user nav group
        console.log("User logged in:", user.uid);

        // Check Admin Role
        get(ref(db, 'users/' + user.uid)).then((snapshot) => {
            const data = snapshot.val();
            if (data && (data.role === 'admin' || data.role === 'superadmin')) {
                const adminBtn = document.getElementById('adminBtn');
                if(adminBtn) adminBtn.style.display = 'inline-block';
            }
        }).catch((error) => {
            console.warn("Adatbázis olvasási hiba (Valószínűleg hiányzó Rules):", error);
        });
    } else {
        if(loginBtn) loginBtn.style.display = 'inline-block';
        if(userNav) userNav.style.display = 'none';
        if(document.getElementById('adminBtn')) document.getElementById('adminBtn').style.display = 'none';
    }
});

if(logoutBtn) logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        showToast("Kijelentkezve.");
        profileModal.classList.remove('active'); // Close profile if open
    });
});

if(logoutBtnProfile) logoutBtnProfile.addEventListener('click', () => {
    signOut(auth).then(() => {
        showToast("Kijelentkezve.");
        profileModal.classList.remove('active');
    });
});

// Profile Actions
document.getElementById('editProfileBtn').addEventListener('click', () => {
    profileModal.classList.remove('active');
    openModal('edit');
});

// Status Edit
document.getElementById('editStatusBtn').addEventListener('click', () => {
    const currentStatus = document.getElementById('profile-status').innerText;
    const newStatus = prompt("Állítsd be az új státuszod:", currentStatus);
    if (newStatus && newStatus !== currentStatus) {
        const user = auth.currentUser;
        if (user) {
            set(ref(db, 'users/' + user.uid + '/statusText'), newStatus);
            document.getElementById('profile-status').innerText = newStatus;
            showToast("Státusz frissítve!");
        }
    }
});

// Playstyle Change
document.getElementById('playstyle-select').addEventListener('change', (e) => {
    const user = auth.currentUser;
    if (user) {
        set(ref(db, 'users/' + user.uid + '/playstyle'), e.target.value);
        showToast("Játékstílus mentve!");
    }
});

document.getElementById('edit-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast("Adatok mentése sikeres! (Demo)");
    editModal.classList.remove('active');
});

// Scroll to Top Logic
window.onscroll = function() { scrollFunction() };

function scrollFunction() {
    if (scrollTopBtn) {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            scrollTopBtn.style.display = "block";
        } else {
            scrollTopBtn.style.display = "none";
        }
    }
}

if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    });
}

// Dynamic Stats from Firebase
// Figyeli a 'stats' csomópontot az adatbázisban
const statsRef = ref(db, 'stats');
onValue(statsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Ha van adat, frissítjük a DOM-ot.
        // Animációt is tehetnénk ide, de MVP-nek elég a text csere.
        if(document.getElementById('stat-players')) document.getElementById('stat-players').innerText = data.onlinePlayers || 0;
        if(document.getElementById('stat-admins')) document.getElementById('stat-admins').innerText = data.activeAdmins || 0;
        if(document.getElementById('stat-events')) document.getElementById('stat-events').innerText = data.activeEvents || 0;
    }
});

// Faction Application Logic
document.querySelectorAll('.faction-apply-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const user = auth.currentUser;
        if (!user) {
            showToast("Jelentkezéshez be kell jelentkezned!", true);
            openModal('login-view');
            return;
        }

        // Check user status (already in faction or pending)
        const userRef = ref(db, 'users/' + user.uid);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        if (userData.faction && userData.faction !== 'Civil') {
            showToast("Már van aktív frakciód!", true);
            return;
        }

        if (userData.applicationStatus === 'pending') {
            showToast("Már van folyamatban lévő jelentkezésed!", true);
            return;
        }

        const factionName = e.target.dataset.faction;
        document.getElementById('app-faction-name').innerText = factionName;
        document.getElementById('app-faction-id').value = factionName;
        openModal('application');
    });
});

document.getElementById('faction-application-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const faction = document.getElementById('app-faction-id').value;
    const exp = document.getElementById('app-exp').value;
    const reason = document.getElementById('app-reason').value;
    const plan = document.getElementById('app-plan').value;
    const hours = document.getElementById('app-hours').value;
    const btn = e.target.querySelector('button[type="submit"]');

    if (reason.length < 20) {
        showToast("Az indoklás legyen legalább 20 karakter!", true);
        return;
    }

    setLoading(btn, true);
    try {
        // Save application
        await push(ref(db, 'factionApplications'), {
            userId: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            factionId: faction,
            exp: exp,
            reason: reason,
            plan: plan,
            hours: hours,
            status: 'pending',
            createdAt: Date.now()
        });

        // Update user status
        await set(ref(db, 'users/' + user.uid + '/applicationStatus'), 'pending');
        await set(ref(db, 'users/' + user.uid + '/statusText'), 'Jelentkezés folyamatban');

        showToast("Jelentkezés elküldve! Admin elbírálás alatt.");
        applicationModal.classList.remove('active');
        e.target.reset(); // Clear form
    } catch (error) {
        showToast("Hiba történt: " + error.message, true);
    } finally {
        setLoading(btn, false);
    }
});