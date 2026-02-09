import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Auth Check & Role Verification
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(db, 'users/' + user.uid);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin' && userData.role !== 'moderator')) {
            window.location.href = 'index.html'; // Redirect unauthorized
        } else {
            initAdminPanel(user);
        }
    } else {
        window.location.href = 'index.html';
    }
});

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});
document.getElementById('adminLogoutBtnHeader').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Navigation Logic
document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
        if(item.id === 'adminLogoutBtn') return;
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        
        item.classList.add('active');
        const target = item.dataset.target;
        document.getElementById(target).classList.add('active');
    });
});

function initAdminPanel(currentUser) {
    console.log("Admin Panel Initialized");
    document.getElementById('admin-name').innerText = currentUser.displayName || currentUser.email.split('@')[0];
    const roleEl = document.getElementById('admin-role');
    if (roleEl) roleEl.innerText = (currentUser.role || 'ADMIN').toUpperCase();
    
    // Show Admin Logs tab only for Superadmin
    if (currentUser.role === 'superadmin') {
        document.getElementById('nav-adminlogs').style.display = 'flex';
    }

    onValue(ref(db, 'users'), (snapshot) => {
        const users = snapshot.val() || {};
        console.log("USERS SNAPSHOT:", users);
        document.getElementById('dash-total-users').innerText = Object.keys(users).length;
        renderUsersTable(users, currentUser);
    });

    onValue(ref(db, 'factionApplications'), (snapshot) => {
        const apps = snapshot.val();
        let pendingCount = 0;
        if (apps) {
            Object.values(apps).forEach(app => {
                if (app.status === 'pending') pendingCount++;
            });
            document.getElementById('dash-pending-apps').innerText = pendingCount;
            
            const badge = document.getElementById('pending-count-badge');
            badge.innerText = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            
            renderApplications(apps, currentUser);
            renderDashboardApps(apps);
        }
    });

    // Admin Logs (Superadmin only)
    onValue(ref(db, 'adminLogs'), (snapshot) => {
        const logs = snapshot.val();
        if(logs) { // Allow all admins to see logs for transparency in MVP
            const sortedLogs = Object.values(logs).sort((a,b) => b.timestamp - a.timestamp);
            
            // Calculate actions today
            const today = new Date().setHours(0,0,0,0);
            const actionsToday = sortedLogs.filter(l => l.timestamp >= today).length;
            document.getElementById('dash-admin-actions').innerText = actionsToday;

            renderDashboardLogs(sortedLogs);

            if (currentUser.role === 'superadmin') {
                renderAdminLogs(sortedLogs);
            }
        }
    });

    // Factions
    onValue(ref(db, 'factions'), (snapshot) => {
        const factions = snapshot.val() || {};
        let activeCount = 0;
        Object.values(factions).forEach(f => { if(f.open) activeCount++; });
        document.getElementById('dash-active-factions').innerText = activeCount;
        renderFactions(factions);
    });

    // Announcements
    onValue(ref(db, 'announcements'), (snapshot) => {
        renderAnnouncements(snapshot.val());
    });

    // Settings
    onValue(ref(db, 'serverSettings'), (snapshot) => {
        const settings = snapshot.val() || {};
        document.getElementById('setting-maintenance').checked = settings.maintenance || false;
        document.getElementById('setting-apps-lock').checked = settings.appsOpen || false; // Reusing ID but logic is "Open"
        document.getElementById('setting-reg-open').checked = settings.regOpen || false;
    });

    // Settings Save
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        await update(ref(db, 'serverSettings'), {
            maintenance: document.getElementById('setting-maintenance').checked,
            appsOpen: document.getElementById('setting-apps-lock').checked,
            regOpen: document.getElementById('setting-reg-open').checked
        });
        showToast('Beállítások mentve!');
    });

    // Create Faction
    document.getElementById('create-faction-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-faction-name').value;
        const type = document.getElementById('new-faction-type').value;
        const limit = document.getElementById('new-faction-limit').value;

        await push(ref(db, 'factions'), { 
            name, 
            type, 
            limit, 
            description: "Új frakció",
            open: true,
            createdAt: Date.now() 
        });
        e.target.reset();
    });

    // User Search
    document.getElementById('user-search').addEventListener('input', (e) => filterUsers(e.target.value));

    // Faction Search
    document.getElementById('faction-search').addEventListener('input', (e) => renderFactions(allFactions, e.target.value));

    // Post Announcement
    document.getElementById('btn-post-announcement').addEventListener('click', async () => {
        const title = document.getElementById('new-announcement-title').value;
        const text = document.getElementById('new-announcement-text').value;
        if(!text || !title) return showToast("Cím és szöveg kötelező!", 'error');
        await push(ref(db, 'announcements'), {
            title: title,
            text: text,
            author: currentUser.email,
            active: true,
            timestamp: Date.now()
        });
        document.getElementById('new-announcement-title').value = '';
        document.getElementById('new-announcement-text').value = '';
        showToast("Közlemény közzétéve!");
    });
}

// Toast Notification
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.borderLeft = `5px solid ${type === 'error' ? '#FF4B4B' : '#00FF7F'}`;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function renderApplications(apps, currentUser) {
    const tbody = document.getElementById('applications-table-body');
    tbody.innerHTML = '';
    
    if (!apps) return;

    Object.entries(apps).forEach(([key, app]) => {
        const tr = document.createElement('tr');
        
        // Lookup user for RP ID
        const user = allUsers[app.userId];
        const rpId = user ? user.rpId : '-';
        
        let badgeClass = app.status === 'pending' ? 'badge-pending' : (app.status === 'accepted' ? 'badge-accepted' : 'badge-rejected');
        let statusText = app.status === 'pending' ? 'Függő' : (app.status === 'accepted' ? 'Elfogadva' : 'Elutasítva');
        
        tr.innerHTML = `
            <td>
                <span style="font-family:monospace; color:var(--primary-color)">${rpId}</span>
            </td>
            <td><strong>${app.displayName || 'Névtelen'}</strong></td>
            <td>${app.factionId}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            <td>${new Date(app.createdAt).toLocaleDateString()}</td>
            <td>
                ${app.status === 'pending' ? `
                    <button class="action-btn btn-accept" title="Elbírálás" onclick="openAppSidePanel('${key}')"><i class="ph ph-gavel"></i></button>
                ` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

let allUsers = {};

function renderUsersTable(users, currentUser) {
    allUsers = users || {};
    console.log("Rendering Users Table. Total users:", Object.keys(allUsers).length);
    const searchInput = document.getElementById('user-search');
    filterUsers(searchInput ? searchInput.value : '');
}

function filterUsers(query) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if(!allUsers || Object.keys(allUsers).length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Nincs megjeleníthető adat.</td></tr>';
        return;
    }

    const lowerQuery = query.toLowerCase();
    let hasResults = false;

    Object.entries(allUsers).forEach(([uid, user]) => {
        if (!user || typeof user !== 'object') return; // Extra check for data integrity
        const email = (user.email || '').toLowerCase();
        const displayName = (user.displayName || '').toLowerCase();
        const username = (user.username || '').toLowerCase();
        const rpId = (user.rpId || '').toLowerCase();

        // Keresés emailben, megjelenített névben, felhasználónévben és RP ID-ben
        if (query && 
            !email.includes(lowerQuery) && 
            !displayName.includes(lowerQuery) && 
            !username.includes(lowerQuery) &&
            !rpId.includes(lowerQuery)) return;

        hasResults = true;
        const tr = document.createElement('tr');
        const isBanned = user.banned === true;
        
        let roleBadgeClass = 'badge-role-user';
        if (user.role === 'admin') roleBadgeClass = 'badge-role-admin';
        if (user.role === 'superadmin') roleBadgeClass = 'badge-role-superadmin';

        const statusBadgeClass = isBanned ? 'badge-rejected' : 'badge-accepted';
        
        tr.innerHTML = `
            <td>
                <span style="font-family:monospace; color:var(--primary-color)">${user.rpId || '-'}</span>
            </td>
            <td><strong>${user.username || user.displayName || 'Névtelen'}</strong></td>
            <td>${user.email || '-'}</td>
            <td>
                <span class="status-badge ${roleBadgeClass}">
                    ${user.role || 'user'}
                </span>
            </td>
            <td>
                <span class="status-badge ${statusBadgeClass}">
                    ${isBanned ? 'IGEN' : 'NEM'}
                </span>
            </td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}</td>
        `;

        const actionsTd = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn btn-view';
        viewBtn.title = 'Kezelés';
        viewBtn.innerHTML = '<i class="ph ph-pencil-simple"></i>';
        
        // Add listener programmatically to avoid scope issues
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Megakadályozza, hogy a sorra kattintás is lefusson
            window.openUserSidePanel(uid);
        });
        
        // Add listener for the whole row (except buttons)
        tr.addEventListener('click', () => window.openUserSidePanel(uid));

        actionsTd.appendChild(viewBtn);
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });

    if (!hasResults) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Nincs találat a keresésre.</td></tr>';
    }
}

let selectedUserUid = null;
// Side Panel Logic
window.closeSidePanel = () => {
    document.getElementById('side-panel').classList.remove('active');
    document.getElementById('side-panel-overlay').classList.remove('active');
};

window.openUserSidePanel = (uid) => {
    const user = allUsers[uid];
    if(!user) return;
    selectedUserUid = uid;
    const currentUser = getAuth().currentUser; // Need to check if superadmin

    document.getElementById('sp-title').innerText = "Felhasználó Kezelése";
    const body = document.getElementById('sp-body');
    const footer = document.getElementById('sp-footer');

    // Check if current user is superadmin to allow role change
    // We need to fetch current user role again or store it globally. 
    // For MVP, let's assume we can check the role from the auth object or a global var if set.
    // A safer way is to check the UI element we set earlier or pass it down.
    // Let's use a simple check on the role badge in the header for MVP client-side check.
    const isAdminSuper = document.getElementById('admin-role').innerText === 'SUPERADMIN';

    let roleSelectHTML = `
        <label class="sp-label">Jogosultság</label>
        <div class="sp-value">${user.role || 'user'}</div>
    `;

    if (isAdminSuper) {
        roleSelectHTML = `
            <label class="sp-label">Jogosultság (Superadmin)</label>
            <select id="sp-role-select" class="sp-input">
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>Superadmin</option>
            </select>
        `;
    }

    body.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
            <i class="ph ph-user-circle" style="font-size:4rem; color:var(--primary-color);"></i>
            <h2 style="margin:10px 0; color:white;">${user.displayName || 'Névtelen'}</h2>
            <span style="font-family:monospace; color:var(--text-muted);">${uid}</span>
        </div>
        <label class="sp-label">Email</label>
        <div class="sp-value">${user.email}</div>
        
        <label class="sp-label">RP ID</label>
        <div class="sp-value">${user.rpId || '-'}</div>

        ${roleSelectHTML}

        <label class="sp-label">Frakció</label>
        <div class="sp-value">${user.faction || 'Civil'}</div>

        <label class="sp-label">Munka</label>
        <div class="sp-value">${user.job || 'Civil'}</div>
    `;

    let saveBtn = isAdminSuper ? `<button class="btn small" onclick="saveUserRole('${uid}')">Mentés</button>` : '';

    footer.innerHTML = `
        <button class="btn small secondary" onclick="toggleBan('${uid}', ${user.banned})">${user.banned ? '✅ Unban' : '🚫 Ban'}</button>
        ${saveBtn}
    `;

    document.getElementById('side-panel').classList.add('active');
    document.getElementById('side-panel-overlay').classList.add('active');
};

window.saveUserRole = async (uid) => {
    const newRole = document.getElementById('sp-role-select').value;
    await update(ref(db, `users/${uid}`), { role: newRole });
    showToast("Jogosultság frissítve!");
    closeSidePanel();
};

window.openAppSidePanel = async (appId) => {
    const snapshot = await get(ref(db, `factionApplications/${appId}`));
    const app = snapshot.val();
    if(!app) return;

    document.getElementById('sp-title').innerText = "Jelentkezés Elbírálása";
    const body = document.getElementById('sp-body');
    const footer = document.getElementById('sp-footer');

    body.innerHTML = `
        <label class="sp-label">Jelentkező</label>
        <div class="sp-value">${app.displayName}</div>
        <label class="sp-label">Frakció</label>
        <div class="sp-value" style="color:var(--primary-color)">${app.factionId}</div>
        
        <label class="sp-label">RP Tapasztalat</label>
        <div style="background:#171B1C; padding:10px; border-radius:6px; font-size:0.9rem; color:#ccc;">${app.exp}</div>
        
        <label class="sp-label">Motiváció</label>
        <div style="background:#171B1C; padding:10px; border-radius:6px; font-size:0.9rem; color:#ccc;">${app.reason}</div>
        
        <label class="sp-label">Karakter Terv</label>
        <div style="background:#171B1C; padding:10px; border-radius:6px; font-size:0.9rem; color:#ccc;">${app.plan}</div>
    `;

    footer.innerHTML = `
        <button class="btn small secondary" style="border-color:#FF4B4B; color:#FF4B4B;" onclick="processApp('${appId}', 'rejected', '${app.userId}', '${app.factionId}')">Elutasítás</button>
        <button class="btn small" onclick="processApp('${appId}', 'accepted', '${app.userId}', '${app.factionId}')">Elfogadás</button>
    `;

    document.getElementById('side-panel').classList.add('active');
    document.getElementById('side-panel-overlay').classList.add('active');
};

// Atomic Update for Application
window.processApp = async (appId, status, userId, factionId) => {
    let reason = null;
    if(status === 'rejected') {
        reason = prompt("Elutasítás indoka (kötelező):");
        if(!reason) return;
    }

    const updates = {};
    const admin = getAuth().currentUser;
    
    // 1. App status
    updates[`factionApplications/${appId}/status`] = status;
    updates[`factionApplications/${appId}/processedBy`] = admin.email;
    updates[`factionApplications/${appId}/processedAt`] = Date.now();
    if(reason) updates[`factionApplications/${appId}/reason`] = reason;

    // 2. User update (Atomic)
    if(status === 'accepted') {
        updates[`users/${userId}/faction`] = factionId;
        updates[`users/${userId}/job`] = factionId;
        updates[`users/${userId}/applicationStatus`] = 'accepted';
        updates[`users/${userId}/statusText`] = 'Frakció tag';
        updates[`factions/${factionId}/members/${userId}`] = true;
    } else {
        updates[`users/${userId}/applicationStatus`] = 'rejected';
    }

    // 3. Log
    const logKey = push(ref(db, 'adminLogs')).key;
    updates[`adminLogs/${logKey}`] = {
        action: `${status.toUpperCase()} application for ${userId}`,
        adminEmail: admin.email,
        timestamp: Date.now()
    };

    await update(ref(db), updates);
    showToast(status === 'accepted' ? "Jelentkezés elfogadva!" : "Jelentkezés elutasítva.");
    closeSidePanel();
};

window.toggleRole = async (uid, currentRole) => {
    // currentRole here comes from the select value which is the TARGET role
    if(confirm(`Biztosan átállítod a rangot erre: ${currentRole}?`)) {
        await update(ref(db, `users/${uid}`), { role: currentRole });
        logAction(`Changed role of ${uid} to ${currentRole}`);
        showToast("Rang frissítve!");
    }
};

window.toggleBan = async (uid, isBanned) => {
    const reason = !isBanned ? prompt("Tiltás indoka:") : "Unban";
    if(!isBanned && !reason) return;

    await update(ref(db, `users/${uid}`), { 
        banned: !isBanned,
        banReason: !isBanned ? reason : null
    });
    logAction(`${!isBanned ? 'BANNED' : 'UNBANNED'} user ${uid}. Reason: ${reason}`);
    showToast(isBanned ? "Tiltás feloldva" : "Felhasználó kitiltva");
    closeSidePanel();
};

let allFactions = {};

function renderFactions(factions, query = '') {
    allFactions = factions || {};
    const tbody = document.getElementById('factions-table-body');
    tbody.innerHTML = '';
    if(!allFactions) return;

    const lowerQuery = query.toLowerCase();

    Object.entries(allFactions).forEach(([id, faction]) => {
        if (query && !faction.name.toLowerCase().includes(lowerQuery)) return;

        const memberCount = faction.members ? Object.keys(faction.members).length : 0;
        const statusClass = faction.open ? 'badge-accepted' : 'badge-rejected';
        const statusText = faction.open ? 'AKTÍV' : 'LETILTVA';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${faction.name}</strong></td>
            <td>${faction.type}</td>
            <td>${memberCount} / ${faction.limit}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="action-btn btn-view" title="Kezelés" onclick="toggleFaction('${id}', ${faction.open})">
                    <i class="ph ph-power"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.toggleFaction = async (id, isOpen) => {
    await update(ref(db, `factions/${id}`), { open: !isOpen });
    showToast("Frakció státusz frissítve!");
};

async function logAction(action) {
    const user = getAuth().currentUser;
    await push(ref(db, 'adminLogs'), {
        action: action,
        adminId: user.uid,
        adminEmail: user.email,
        timestamp: Date.now()
    });
}

function renderDashboardLogs(logs) {
    const container = document.getElementById('dashboard-logs-list');
    container.innerHTML = '';
    // Take last 5 logs
    logs.slice(0, 5).forEach(log => {
        container.innerHTML += `
            <div class="event-item">
                <span>${log.action}</span>
                <small>${new Date(log.timestamp).toLocaleTimeString()}</small>
            </div>
        `;
    });
}

function renderDashboardApps(apps) {
    const container = document.getElementById('dashboard-apps-list');
    container.innerHTML = '';
    const sortedApps = Object.values(apps).sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
    
    sortedApps.forEach(app => {
        container.innerHTML += `
            <div class="event-item">
                <span><strong>${app.displayName}</strong> - ${app.factionId}</span>
                <small>${app.status.toUpperCase()}</small>
            </div>
        `;
    });
}

function renderAdminLogs(logs) {
    const tbody = document.getElementById('admin-logs-table-body');
    tbody.innerHTML = '';
    logs.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.adminEmail || log.adminId}</td>
                <td>${log.action}</td>
            </tr>
        `;
    });
}

function renderAnnouncements(announcements) {
    const tbody = document.getElementById('announcements-table-body');
    tbody.innerHTML = '';
    if(!announcements) return;
    
    Object.values(announcements).sort((a,b) => b.timestamp - a.timestamp).forEach(ann => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(ann.timestamp).toLocaleDateString()}</td>
                <td>${ann.title}</td>
                <td><span class="status-badge badge-accepted">AKTÍV</span></td>
            </tr>
        `;
    });
}