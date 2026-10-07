'use strict';

/* ============================================================
   NEXUS SOCIAL — app.js
   Full-featured social & messaging web application
   ============================================================ */

// ─── Firebase Cloud Setup ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCGhR4_M4pfLwiphauCPO7O_53HsguUo5I",
  authDomain: "nexus-social-13cd3.firebaseapp.com",
  projectId: "nexus-social-13cd3",
  storageBucket: "nexus-social-13cd3.firebasestorage.app",
  messagingSenderId: "606825690972",
  appId: "1:606825690972:web:8bce3f36e6a3905a513399",
  measurementId: "G-QYXFW63938"
};

let db = null;
let isFirebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      isFirebaseReady = true;
      console.log('🔥 Firebase Cloud connected successfully!');

      // Start listening for real-time cloud data
      listenToCloudUsers();
      listenToCloudPosts();
      listenToCloudMessages();
    }
  } catch (err) {
    console.warn('Firebase initialization warning:', err);
  }
}

// ─── Storage Keys ─────────────────────────────────────────────
const STORAGE = {
  USERS: 'nexus_users_db',
  SESSION: 'nexus_current_session',
  POSTS: 'nexus_posts_db',
  DMS: 'nexus_dms_db',
  SAVED: 'nexus_saved_db',
  THEME: 'nexus-theme',
  DM_SETTINGS: 'nexus_dm_settings',
  FOLLOWING: 'nexus_following_db'
};

// Dummy users blacklist — permanently prevented from showing
const DUMMY_IDS = new Set(['sarah', 'maya', 'leo', 'liam', 'zoe', 'alex', 'you', 'demo_user']);
const DUMMY_HANDLES = new Set(['@sarahk', '@mayat', '@leob', '@liamr', '@zoep', '@alex', '@you']);
const DUMMY_NAMES = new Set(['Sarah K.', 'Maya T.', 'Leo B.', 'Liam R.', 'Zoe P.', 'Alex Rivera']);

function isDummyUser(u, id) {
  if (id && DUMMY_IDS.has(id.toLowerCase())) return true;
  if (u) {
    if (u.id && DUMMY_IDS.has(u.id.toLowerCase())) return true;
    if (u.handle && DUMMY_HANDLES.has(u.handle.toLowerCase())) return true;
    if (u.name && DUMMY_NAMES.has(u.name)) return true;
  }
  return false;
}

function purgeLegacyDummyData() {
  ['nexus_users', 'nexus_posts', 'nexus_dms', 'nexus_messages'].forEach(k => {
    try { localStorage.removeItem(k); } catch (e) {}
  });

  try {
    const rawUsers = localStorage.getItem(STORAGE.USERS);
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (isDummyUser(parsed[k], k)) {
          delete parsed[k];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(STORAGE.USERS, JSON.stringify(parsed));
    }
  } catch (e) {}

  try {
    const rawDms = localStorage.getItem(STORAGE.DMS);
    if (rawDms) {
      const parsed = JSON.parse(rawDms);
      let changed = false;
      for (const k of Object.keys(parsed)) {
        if (DUMMY_IDS.has(k.toLowerCase()) || isDummyUser(null, k)) {
          delete parsed[k];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(STORAGE.DMS, JSON.stringify(parsed));
    }
  } catch (e) {}

  try {
    const rawPosts = localStorage.getItem(STORAGE.POSTS);
    if (rawPosts) {
      const parsed = JSON.parse(rawPosts);
      const filtered = parsed.filter(p => !DUMMY_IDS.has(p.user) && !DUMMY_NAMES.has(p.author));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(STORAGE.POSTS, JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  for (const k of Object.keys(USERS)) {
    if (isDummyUser(USERS[k], k)) delete USERS[k];
  }
  for (const k of Object.keys(state.dmMessages)) {
    if (DUMMY_IDS.has(k.toLowerCase())) delete state.dmMessages[k];
  }
}

// Default Users — empty, only real registered users are loaded
const DEFAULT_USERS = {};

// In-memory active USERS registry
const USERS = {};

// ─── State ────────────────────────────────────────────────────
const state = {
  currentUser: null,
  view: 'feed',
  posts: [],
  dmMessages: {},
  activeDM: null,
  myPostCount: 0,
  savedPosts: [],
  searchQuery: '',
  dmSettings: {}, // { [userId]: { muted: bool, deleted: bool, unread: bool } }
  following: [], // [userId, ...]
  feedTab: 'all', // 'all' | 'following'
  viewingProfileUserId: null // null = own profile, otherwise userId
};

// ─── Seed Posts & DMs ─────────────────────────────────────────
// No seed data — only real user content is shown
const SEED_POSTS = [];
const SEED_DMS = {};

// ─── Storage Helpers ──────────────────────────────────────────
function getStoredUsers() {
  try {
    const data = localStorage.getItem(STORAGE.USERS);
    if (data) {
      const users = JSON.parse(data);
      const clean = {};
      for (const k of Object.keys(users)) {
        if (!isDummyUser(users[k], k)) clean[k] = users[k];
      }
      return clean;
    }
  } catch (e) {}
  return {};
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
  } catch (e) {}
}

function loadPosts() {
  try {
    const saved = localStorage.getItem(STORAGE.POSTS);
    if (saved) {
      const posts = JSON.parse(saved);
      return posts.filter(p => !DUMMY_IDS.has(p.user) && !DUMMY_NAMES.has(p.author));
    }
  } catch (e) {}
  return [];
}

function savePosts(posts) {
  try {
    localStorage.setItem(STORAGE.POSTS, JSON.stringify(posts));
  } catch (e) {}
}

function loadDMs() {
  try {
    const saved = localStorage.getItem(STORAGE.DMS);
    if (saved) {
      const dms = JSON.parse(saved);
      const clean = {};
      for (const k of Object.keys(dms)) {
        if (!DUMMY_IDS.has(k.toLowerCase()) && !isDummyUser(null, k)) {
          clean[k] = dms[k];
        }
      }
      return clean;
    }
  } catch (e) {}
  return {};
}

function saveDMs(dms) {
  try {
    localStorage.setItem(STORAGE.DMS, JSON.stringify(dms));
  } catch (e) {}
}

function loadDMSettings() {
  try {
    const saved = localStorage.getItem(STORAGE.DM_SETTINGS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {};
}

function saveDMSettings() {
  try {
    localStorage.setItem(STORAGE.DM_SETTINGS, JSON.stringify(state.dmSettings));
  } catch (e) {}
}

function loadSavedPosts() {
  try {
    const saved = localStorage.getItem(STORAGE.SAVED);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

function loadFollowing() {
  try {
    const saved = localStorage.getItem(STORAGE.FOLLOWING);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

function saveFollowing(following) {
  try {
    localStorage.setItem(STORAGE.FOLLOWING, JSON.stringify(following));
  } catch (e) {}
}

function saveSavedPosts(savedIds) {
  try {
    localStorage.setItem(STORAGE.SAVED, JSON.stringify(savedIds));
  } catch (e) {}
}

// ─── DOM Refs ─────────────────────────────────────────────────
const postsFeed      = document.getElementById('posts-feed');
const profilePosts   = document.getElementById('profile-posts');
const chatMessages   = document.getElementById('chat-messages');
const chatInput      = document.getElementById('chat-input');
const chatSendBtn    = document.getElementById('chat-send-btn');
const toastContainer = document.getElementById('toast-container');
const notifPanel     = document.getElementById('notif-panel');
const createPostOverlay = document.getElementById('create-post-overlay');
const statPosts      = document.getElementById('stat-posts');
const savedPostsFeed = document.getElementById('saved-posts-feed');

// ─── Authentication Core ──────────────────────────────────────
function checkAuthSession() {
  const storedUsers = getStoredUsers();
  // Hydrate USERS registry with only real registered users
  Object.assign(USERS, storedUsers);

  const currentUserId = localStorage.getItem(STORAGE.SESSION);
  const authScreen = document.getElementById('auth-screen');

  if (currentUserId && USERS[currentUserId]) {
    state.currentUser = USERS[currentUserId];
    if (authScreen) authScreen.style.display = 'none';
    syncUserUI();
  } else {
    state.currentUser = null;
    if (authScreen) {
      authScreen.style.display = 'flex';
      switchAuthPanel('login');
    }
  }
}

function loginUser(user) {
  state.currentUser = user;
  USERS[user.id] = user;
  localStorage.setItem(STORAGE.SESSION, user.id);

  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    authScreen.style.opacity = '0';
    authScreen.style.transition = 'opacity 0.25s ease';
    setTimeout(() => {
      authScreen.style.display = 'none';
      authScreen.style.opacity = '1';
    }, 250);
  }

  // Clear auth inputs
  ['login-email', 'login-password', 'reg-name', 'reg-email', 'reg-password', 'reg-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  syncUserUI();
  renderFeed();
  renderDMUserList();
  renderOnlineMembers();
  renderFriendsList();

  // Open chat with first available user if any exist
  const others = Object.keys(USERS).filter(u => u !== user.id);
  if (others.length) {
    state.activeDM = others[0];
    renderDMChat(others[0]);
  } else {
    state.activeDM = null;
    if (chatMessages) chatMessages.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:40px 20px;">No other members yet. Share your profile link to invite friends! 🚀</p>';
  }

  updateProfileStats();
  showToast(`👋 Welcome back, ${user.name}!`);
}

function demoLogin() {
  const users = getStoredUsers();
  let demoUser = users['demo_user'] || users['you'];
  if (!demoUser) {
    demoUser = {
      id: 'demo_user',
      name: 'Demo User',
      handle: '@demouser',
      bio: 'Exploring Nexus Social ✨',
      initials: 'DU',
      gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
      email: 'demo@nexus.app'
    };
    users['demo_user'] = demoUser;
    saveStoredUsers(users);
  }
  loginUser(demoUser);
  showToast('🚀 Signed in as Demo User');
}

function handleLogin() {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');

  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    showAuthError(errEl, 'Please enter both email/username and password.');
    return;
  }

  const users = getStoredUsers();
  const user = Object.values(users).find(u =>
    (u.email && u.email.toLowerCase() === email) ||
    (u.handle && u.handle.toLowerCase() === email) ||
    (u.handle && u.handle.toLowerCase() === '@' + email) ||
    (u.id && u.id.toLowerCase() === email)
  );

  if (user && user.password === password) {
    if (errEl) errEl.style.display = 'none';
    loginUser(user);
    return;
  }

  // If not found locally, check Firebase Cloud Database for multi-device sync
  if (db) {
    db.collection('users').where('email', '==', email).get().then(snapshot => {
      if (!snapshot.empty) {
        const cloudUser = snapshot.docs[0].data();
        if (cloudUser && cloudUser.password === password) {
          users[cloudUser.id] = cloudUser;
          saveStoredUsers(users);
          USERS[cloudUser.id] = cloudUser;
          if (errEl) errEl.style.display = 'none';
          loginUser(cloudUser);
          return;
        }
      }
      showAuthError(errEl, 'Invalid email or password. Please try again.');
    }).catch(() => {
      showAuthError(errEl, 'Invalid email or password. Please try again.');
    });
    return;
  }

  showAuthError(errEl, 'Invalid email or password. Please try again.');
}

function handleRegister() {
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-password');
  const confirmInput = document.getElementById('reg-confirm');
  const errEl = document.getElementById('register-error');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const password = passInput ? passInput.value : '';
  const confirm = confirmInput ? confirmInput.value : '';

  if (!name || name.length < 2) {
    showAuthError(errEl, 'Please enter your full name (at least 2 characters).');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showAuthError(errEl, 'Please enter a valid email address.');
    return;
  }
  if (!password || password.length < 6) {
    showAuthError(errEl, 'Password must be at least 6 characters long.');
    return;
  }
  if (password !== confirm) {
    showAuthError(errEl, 'Passwords do not match. Please retype.');
    return;
  }

  const users = getStoredUsers();
  const exists = Object.values(users).some(u => u.email && u.email.toLowerCase() === email);
  if (exists) {
    showAuthError(errEl, 'An account with this email already exists. Please sign in.');
    return;
  }

  const id = 'user_' + Date.now();
  const rawHandle = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const handle = '@' + (rawHandle || 'user' + Math.floor(Math.random() * 900 + 100));

  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();

  const gradients = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#ec4899,#f43f5e)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
    'linear-gradient(135deg,#f97316,#eab308)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#14b8a6,#0ea5e9)'
  ];
  const gradient = gradients[Math.floor(Math.random() * gradients.length)];

  const newUser = {
    id,
    name,
    email,
    password,
    handle,
    initials,
    gradient,
    bio: 'Hey there! I just joined Nexus Social ✨',
    createdAt: Date.now()
  };

  // Local storage
  users[id] = newUser;
  saveStoredUsers(users);
  USERS[id] = newUser;

  // Cloud Firestore database sync
  if (db) {
    db.collection('users').doc(id).set(newUser).then(() => {
      console.log('✅ User profile successfully saved to Firebase Cloud!');
    }).catch(e => {
      console.warn('Firebase user save error:', e);
    });
  }

  if (errEl) errEl.style.display = 'none';
  loginUser(newUser);
  renderDMUserList();
  renderOnlineMembers();
  showToast(`🎉 Welcome to Nexus Social, ${name}!`);
}

function handleForgotPassword() {
  const emailInput = document.getElementById('forgot-email');
  const passInput = document.getElementById('forgot-password');
  const confirmInput = document.getElementById('forgot-confirm');
  const errEl = document.getElementById('forgot-error');
  const formBody = document.getElementById('forgot-form-body');
  const successMsg = document.getElementById('forgot-success');

  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const newPassword = passInput ? passInput.value : '';
  const confirm = confirmInput ? confirmInput.value : '';

  if (!email) {
    showAuthError(errEl, 'Please enter your registered email address.');
    return;
  }

  const users = getStoredUsers();
  const user = Object.values(users).find(u => u.email && u.email.toLowerCase() === email);

  if (!user) {
    showAuthError(errEl, 'No account found with this email address.');
    return;
  }

  if (!newPassword || newPassword.length < 6) {
    showAuthError(errEl, 'New password must be at least 6 characters long.');
    return;
  }

  if (newPassword !== confirm) {
    showAuthError(errEl, 'Passwords do not match. Please retype.');
    return;
  }

  // Update password in storage
  user.password = newPassword;
  users[user.id] = user;
  saveStoredUsers(users);
  USERS[user.id] = user;

  if (errEl) errEl.style.display = 'none';
  if (formBody) formBody.style.display = 'none';
  if (successMsg) successMsg.style.display = 'block';

  const loginEmail = document.getElementById('login-email');
  if (loginEmail) loginEmail.value = email;

  showToast('✅ Password reset successfully! You can now sign in.');
}

function logout() {
  localStorage.removeItem(STORAGE.SESSION);
  state.currentUser = null;

  switchView('feed');

  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    authScreen.style.display = 'flex';
    authScreen.style.opacity = '1';
    switchAuthPanel('login');
  }

  ['login-email', 'login-password', 'reg-name', 'reg-email', 'reg-password', 'reg-confirm', 'forgot-email', 'forgot-password', 'forgot-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  showToast('🔒 You have been logged out.');
}

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'authSlideIn 0.2s ease';
}

function switchAuthPanel(panelName) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('auth-' + panelName);
  if (target) target.classList.add('active');

  document.querySelectorAll('.auth-error').forEach(err => {
    err.style.display = 'none';
    err.textContent = '';
  });

  const forgotFormBody = document.getElementById('forgot-form-body');
  const forgotSuccess = document.getElementById('forgot-success');
  if (forgotFormBody) forgotFormBody.style.display = 'block';
  if (forgotSuccess) forgotSuccess.style.display = 'none';
}

function syncUserUI() {
  const user = state.currentUser || USERS.you;

  // Nav avatar
  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) {
    navAvatar.style.background = user.gradient;
    navAvatar.textContent = user.initials;
    navAvatar.title = `${user.name} (${user.handle})`;
  }

  // Left sidebar profile
  const sidebarAvatar = document.querySelector('.sidebar-profile .profile-avatar');
  if (sidebarAvatar) {
    sidebarAvatar.style.background = user.gradient;
    sidebarAvatar.innerHTML = `${user.initials}<div class="status-dot online"></div>`;
  }
  const sidebarName = document.querySelector('.sidebar-profile .profile-name');
  if (sidebarName) sidebarName.textContent = user.name;
  const sidebarHandle = document.querySelector('.sidebar-profile .profile-handle');
  if (sidebarHandle) sidebarHandle.textContent = `${user.handle} · Active`;

  // Profile hero
  const heroAvatar = document.querySelector('.profile-hero-avatar');
  if (heroAvatar) {
    heroAvatar.style.background = user.gradient;
    heroAvatar.textContent = user.initials;
  }
  const heroName = document.querySelector('.profile-hero-name');
  if (heroName) heroName.textContent = user.name;
  const heroBio = document.querySelector('.profile-hero-bio');
  if (heroBio) heroBio.textContent = user.bio || 'Software Engineer | Building products for the future ✨';

  // Create post modal author
  const cpAvatar = document.querySelector('.post-author-row .cp-avatar');
  if (cpAvatar) {
    cpAvatar.style.background = user.gradient;
    cpAvatar.textContent = user.initials;
  }
  const cpName = document.querySelector('.post-author-row .post-author-name');
  if (cpName) cpName.textContent = user.name;

  // Settings inputs
  const settingsEmail = document.querySelector('#view-settings input[type="email"]');
  if (settingsEmail) settingsEmail.value = user.email || 'you@nexus.dev';
  const settingsUsername = document.querySelector('#view-settings input[type="text"]');
  if (settingsUsername) settingsUsername.value = user.handle || '@you';
}

// ─── RENDER FEED & TWITTER-STYLE TABS ─────────────────────────
function setFeedTab(tab) {
  state.feedTab = tab;
  const allBtn = document.getElementById('feed-tab-all');
  const followingBtn = document.getElementById('feed-tab-following');
  if (allBtn && followingBtn) {
    if (tab === 'following') {
      followingBtn.classList.add('active');
      allBtn.classList.remove('active');
    } else {
      allBtn.classList.add('active');
      followingBtn.classList.remove('active');
    }
  }
  renderFeed();
}

function getCommentAvatar() {
  const cu = state.currentUser || { gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: 'U' };
  return `<div class="cp-avatar" style="background:${cu.gradient};width:30px;height:30px;font-size:11px;">${cu.initials}</div>`;
}

function renderFeed() {
  if (!postsFeed) return;
  postsFeed.innerHTML = '';

  let visiblePosts = state.posts.filter(p => !DUMMY_IDS.has(p.user) && !DUMMY_NAMES.has(p.author));

  // Filter by Twitter-style tab
  if (state.feedTab === 'following') {
    const currentId = state.currentUser ? state.currentUser.id : null;
    visiblePosts = visiblePosts.filter(p => state.following.includes(p.user) || p.user === currentId);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    visiblePosts = visiblePosts.filter(p =>
      p.text.toLowerCase().includes(q) ||
      (USERS[p.user] && USERS[p.user].name.toLowerCase().includes(q))
    );
  }

  if (visiblePosts.length === 0) {
    if (state.searchQuery) {
      postsFeed.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:32px;">No posts found for "${esc(state.searchQuery)}" 🧐</p>`;
    } else if (state.feedTab === 'following') {
      postsFeed.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:var(--text-3);">
          <div style="font-size:36px;margin-bottom:12px;">👥</div>
          <h3 style="font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:6px;">No posts from people you follow yet</h3>
          <p style="font-size:13px;max-width:360px;margin:0 auto 16px;">Follow other registered members to see their posts here, just like Twitter!</p>
          <button class="btn-primary" style="padding:8px 20px;font-size:13px;border-radius:99px;" onclick="setFeedTab('all')">Browse "For You" Feed</button>
        </div>`;
    } else {
      postsFeed.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:40px 20px;">No posts yet — be the first to share something! ✨</p>`;
    }
    return;
  }

  visiblePosts.forEach(post => {
    postsFeed.appendChild(createPostCard(post));
  });
}

function createPostCard(post) {
  const user = USERS[post.user] || { name: post.author || 'Member', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: 'U' };
  const card = document.createElement('div');
  card.className = 'post-card';
  card.id = 'post-' + post.id;

  // Type badge
  let typeBadge = '';
  if (post.type === 'photo') typeBadge = `<span class="post-type-badge ptb-photo">🖼️ Photo</span>`;

  // Main content
  let bodyContent = '';

  const isLong = post.text.length > 300;
  bodyContent = `
    <div class="post-body">
      ${post.title ? `<div class="post-title">${esc(post.title)}</div>` : ''}
      <div class="post-text ${isLong ? 'collapsed' : ''}" id="pt-${post.id}">${esc(post.text).replace(/\n/g,'<br>')}</div>
      ${isLong ? `<button class="read-more-btn" onclick="toggleReadMore('${post.id}')">See more</button>` : ''}
      ${(post.tags || []).length ? `<div class="post-tags">${post.tags.map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;

  // Reactions summary
  const totalReactions = post.likes;
  const reactionsSummary = totalReactions > 0 ? `
    <div class="post-reactions-summary">
      <div style="display:flex;align-items:center;gap:6px;">
        <div class="reactions-icons">
          <div class="reaction-emoji-icon">❤️</div>
          ${totalReactions > 10 ? '<div class="reaction-emoji-icon">👍</div>' : ''}
          ${totalReactions > 30 ? '<div class="reaction-emoji-icon">🔥</div>' : ''}
        </div>
        <span>${totalReactions.toLocaleString()}</span>
      </div>
      <span>${post.shares || 0} shares · ${post.comments.length} comments</span>
    </div>` : '';

  // Comments
  let commentsHtml = '';
  if (post.showComments) {
    const commentItems = post.comments.map(c => {
      const cu = USERS[c.user] || { name: 'Member', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: 'M' };
      return `
        <div class="comment-item">
          <div class="comment-avatar" style="background:${cu.gradient}" onclick="viewUserProfile('${c.user}')">${cu.initials}</div>
          <div class="comment-bubble">
            <div class="comment-author" onclick="viewUserProfile('${c.user}')">${esc(cu.name)}</div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-time">${c.time}</div>
          </div>
        </div>`;
    }).join('');

    commentsHtml = `
      <div class="comments-section">
        <div class="comment-list">${commentItems}</div>
        <div class="add-comment-row" style="margin-top:10px;">
          ${getCommentAvatar()}
          <div class="comment-input" id="ci-${post.id}" contenteditable="true" data-placeholder="Write a comment…"></div>
          <button class="comment-send-btn" onclick="addComment('${post.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>`;
  }

  const isPostAuthorOwn = (post.user === state.currentUser?.id);
  const userFollowing = isFollowing(post.user);
  const followBtnHtml = (!isPostAuthorOwn && post.user) ? `
    <button class="follow-btn-sm ${userFollowing ? 'following' : ''}" data-user="${post.user}" onclick="event.stopPropagation(); toggleFollowUser('${post.user}', this);">
      ${userFollowing ? 'Following ✓' : 'Follow'}
    </button>` : '';

  card.innerHTML = `
    <div class="post-card-header">
      <div class="post-user-avatar" style="background:${user.gradient}" title="${esc(user.name)}" onclick="viewUserProfile('${post.user}')">${user.initials}</div>
      <div class="post-user-info">
        <div class="post-user-name" style="display:flex;align-items:center;gap:8px;">
          <span onclick="viewUserProfile('${post.user}')">${esc(user.name)}</span>
          ${followBtnHtml}
        </div>
        <div class="post-meta"><span>🌍 Public</span><span class="post-meta-dot">·</span><span>${post.time}</span></div>
      </div>
      <button class="post-more-btn" title="Save Post" onclick="savePost('${post.id}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${post.isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>
    ${bodyContent}
    ${reactionsSummary}
    <div class="post-actions">
      <button class="post-action-btn ${post.likedByMe ? 'liked' : ''}" id="like-btn-${post.id}" onclick="toggleLike('${post.id}')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="${post.likedByMe ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        ${post.likedByMe ? 'Liked' : 'Like'} · ${post.likes}
      </button>
      <button class="post-action-btn" onclick="toggleComments('${post.id}')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Comment · ${post.comments.length}
      </button>
      <button class="post-action-btn" onclick="sharePost('${post.id}')">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Share · ${post.shares || 0}
      </button>
    </div>
    ${commentsHtml}
  `;
  return card;
}

// ─── RENDER PROFILE & VIEW USER PROFILE ─────────────────────────
function isFollowing(userId) {
  if (!userId) return false;
  return state.following.includes(userId);
}

function toggleFollowUser(userId, btnEl) {
  if (!userId) return;
  const user = USERS[userId];
  const userName = user ? user.name : 'this user';

  const index = state.following.indexOf(userId);
  let nowFollowing = false;

  if (index > -1) {
    state.following.splice(index, 1);
    nowFollowing = false;
    showToast(`Unfollowed ${userName}`);
  } else {
    state.following.push(userId);
    nowFollowing = true;
    showToast(`✨ You are now following ${userName}! Their posts will appear in your "Following" feed.`);
  }

  saveFollowing(state.following);

  // Sync button element
  if (btnEl) {
    if (btnEl.classList.contains('profile-follow-btn')) {
      btnEl.className = `profile-follow-btn ${nowFollowing ? 'following' : ''}`;
      btnEl.textContent = nowFollowing ? 'Following ✓' : 'Follow';
    } else if (btnEl.classList.contains('follow-btn-sm')) {
      btnEl.className = `follow-btn-sm ${nowFollowing ? 'following' : ''}`;
      btnEl.textContent = nowFollowing ? 'Following ✓' : 'Follow';
    } else {
      btnEl.textContent = nowFollowing ? 'Following ✓' : 'Follow';
    }
  }

  document.querySelectorAll(`.follow-btn-sm[data-user="${userId}"]`).forEach(b => {
    b.className = `follow-btn-sm ${nowFollowing ? 'following' : ''}`;
    b.textContent = nowFollowing ? 'Following ✓' : 'Follow';
  });

  // Update stats if currently on profile
  if (state.viewingProfileUserId === userId) {
    const statFollowersEl = document.getElementById('stat-followers');
    if (statFollowersEl) statFollowersEl.textContent = nowFollowing ? '1' : '0';
  } else if (!state.viewingProfileUserId || state.viewingProfileUserId === state.currentUser?.id) {
    const statFollowingEl = document.getElementById('stat-following');
    if (statFollowingEl) statFollowingEl.textContent = state.following.length;
  }

  if (state.feedTab === 'following') {
    renderFeed();
  }
}

function startChatWithUser(userId) {
  if (!userId) return;
  switchView('messages');
  renderDMChat(userId);
}

function viewUserProfile(userId) {
  const currentId = state.currentUser ? state.currentUser.id : null;
  const targetId = userId || currentId;
  state.viewingProfileUserId = targetId;

  const isOwn = (!targetId || targetId === currentId);
  const user = (targetId && USERS[targetId]) ? USERS[targetId] : (state.currentUser || { name: 'You', handle: '@you', bio: 'Exploring Nexus Social ✨', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: 'Y' });

  // Update profile header
  const heroAvatar = document.getElementById('profile-hero-avatar') || document.querySelector('.profile-hero-avatar');
  if (heroAvatar) {
    heroAvatar.style.background = user.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)';
    heroAvatar.textContent = user.initials || user.name?.slice(0, 2).toUpperCase() || 'U';
  }

  const heroName = document.getElementById('profile-hero-name') || document.querySelector('.profile-hero-name');
  if (heroName) heroName.textContent = user.name;

  const heroHandle = document.getElementById('profile-hero-handle');
  if (heroHandle) heroHandle.textContent = user.handle || `@${user.name.toLowerCase().replace(/\s+/g, '')}`;

  const heroBio = document.getElementById('profile-hero-bio') || document.querySelector('.profile-hero-bio');
  if (heroBio) heroBio.textContent = user.bio || (isOwn ? 'Software Engineer | Building products for the future ✨' : 'Member of Nexus Social ✨');

  // Stats
  const userPosts = state.posts.filter(p => p.user === targetId && !DUMMY_IDS.has(p.user));
  const statPostsEl = document.getElementById('stat-posts');
  if (statPostsEl) statPostsEl.textContent = userPosts.length;

  const statFollowingEl = document.getElementById('stat-following');
  if (statFollowingEl) {
    statFollowingEl.textContent = isOwn ? state.following.length : (user.followingCount || '0');
  }

  const statFollowersEl = document.getElementById('stat-followers');
  if (statFollowersEl) {
    statFollowersEl.textContent = isOwn ? (user.followersCount || '0') : (isFollowing(targetId) ? '1' : '0');
  }

  // Action buttons
  const actionsBar = document.getElementById('profile-actions-bar');
  if (actionsBar) {
    if (isOwn) {
      actionsBar.innerHTML = `<button class="btn-primary" id="edit-profile-btn" onclick="openEditProfileModal()">Edit Profile</button>`;
    } else {
      const following = isFollowing(targetId);
      actionsBar.innerHTML = `
        <button class="profile-follow-btn ${following ? 'following' : ''}" id="profile-follow-btn" onclick="toggleFollowUser('${targetId}', this)">
          ${following ? 'Following ✓' : 'Follow'}
        </button>
        <button class="profile-msg-btn" id="profile-msg-btn" onclick="startChatWithUser('${targetId}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Message
        </button>
      `;
    }
  }

  // Render User Posts
  const profilePostsEl = document.getElementById('profile-posts');
  if (profilePostsEl) {
    profilePostsEl.innerHTML = '';
    if (userPosts.length === 0) {
      profilePostsEl.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:40px 20px;">${isOwn ? "You haven't posted anything yet. Share your first post! 🚀" : `${esc(user.name)} hasn't posted anything yet.`}</p>`;
    } else {
      userPosts.forEach(p => profilePostsEl.appendChild(createPostCard(p)));
    }
  }

  switchView('profile');
}

function updateProfileStats() {
  viewUserProfile(state.viewingProfileUserId || state.currentUser?.id);
}

// ─── CLOUD SYNC & REAL-TIME LISTENERS ─────────────────────────
function listenToCloudUsers() {
  if (!db) return;
  try {
    db.collection('users').onSnapshot(snapshot => {
      let changed = false;
      snapshot.forEach(doc => {
        const u = doc.data();
        if (u && u.id) {
          USERS[u.id] = u;
          changed = true;
        }
      });
      if (changed) {
        saveStoredUsers(USERS);
        renderDMUserList();
        renderOnlineMembers();
        renderFriendsList();
      }
    }, err => {
      console.warn('Firestore users subscription warning:', err);
    });
  } catch (e) {
    console.warn(e);
  }
}

function listenToCloudPosts() {
  if (!db) return;
  try {
    db.collection('posts').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
      if (snapshot.empty) return;
      const cloudPosts = [];
      snapshot.forEach(doc => {
        cloudPosts.push({ id: doc.id, ...doc.data() });
      });
      if (cloudPosts.length > 0) {
        const cloudIds = new Set(cloudPosts.map(p => p.id));
        const locals = state.posts.filter(p => !cloudIds.has(p.id));
        state.posts = [...cloudPosts, ...locals];
        savePosts(state.posts);
        renderFeed();
        updateProfileStats();
      }
    }, err => {
      console.warn('Firestore posts subscription warning:', err);
    });
  } catch (e) {
    console.warn(e);
  }
}

function listenToCloudMessages() {
  if (!db) return;
  try {
    db.collection('messages').orderBy('timestamp', 'asc').limitToLast(100).onSnapshot(snapshot => {
      if (snapshot.empty) return;
      let hasUpdateForActive = false;

      snapshot.forEach(doc => {
        const msg = doc.data();
        if (!msg || !msg.from || !msg.to) return;
        const currentId = state.currentUser ? state.currentUser.id : 'you';

        if (msg.from === currentId) {
          const peer = msg.to;
          if (!state.dmMessages[peer]) state.dmMessages[peer] = [];
          if (!state.dmMessages[peer].some(m => m.id === doc.id || (m.timestamp && m.timestamp === msg.timestamp))) {
            state.dmMessages[peer].push({ ...msg, id: doc.id });
            if (peer === state.activeDM) hasUpdateForActive = true;
          }
        } else if (msg.to === currentId) {
          const peer = msg.from;
          if (!state.dmMessages[peer]) state.dmMessages[peer] = [];
          if (!state.dmMessages[peer].some(m => m.id === doc.id || (m.timestamp && m.timestamp === msg.timestamp))) {
            state.dmMessages[peer].push({ ...msg, id: doc.id });
            if (peer === state.activeDM) {
              hasUpdateForActive = true;
            } else {
              showToast(`💬 New message from ${USERS[peer]?.name || 'a member'}`);
            }
          }
        }
      });

      saveDMs(state.dmMessages);
      renderDMUserList();
      if (hasUpdateForActive && state.view === 'messages') {
        renderDMChat(state.activeDM);
      }
    }, err => {
      console.warn('Firestore messages subscription warning:', err);
    });
  } catch (e) {
    console.warn(e);
  }
}

// ─── DYNAMIC USER & MEMBERS LIST ──────────────────────────────
function renderDMUserList(query = '') {
  const dmList = document.getElementById('dm-list');
  if (!dmList) return;

  const currentId = state.currentUser ? state.currentUser.id : null;
  const allUserIds = Object.keys(USERS).filter(uid => uid !== currentId && !DUMMY_IDS.has(uid.toLowerCase()) && !isDummyUser(USERS[uid], uid));

  const q = (query || '').toLowerCase().trim();
  const filteredIds = allUserIds.filter(uid => {
    const u = USERS[uid];
    if (!u) return false;
    // Hide deleted conversations unless there's a search query
    if (!q && state.dmSettings[uid] && state.dmSettings[uid].deleted) return false;
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.handle && u.handle.toLowerCase().includes(q))
    );
  });

  dmList.innerHTML = '';

  if (filteredIds.length === 0) {
    dmList.innerHTML = `
      <li style="padding:24px 16px;text-align:center;color:var(--text-3);font-size:13px;">
        ${q ? 'No members matching "' + esc(q) + '"' : 'No conversations yet. Start chatting! ✨'}
      </li>
    `;
    return;
  }

  filteredIds.forEach(uid => {
    const u = USERS[uid];
    const msgs = state.dmMessages[uid] || [];
    const lastMsg = msgs[msgs.length - 1];
    const previewText = lastMsg ? lastMsg.text : 'Click to start chatting ✨';
    const previewTime = lastMsg ? (lastMsg.time || '') : '';
    const isActive = state.activeDM === uid;
    const settings = state.dmSettings[uid] || {};
    const isMuted = !!settings.muted;
    const isUnread = !!settings.unread;

    const li = document.createElement('li');
    li.className = `dm-item ${isActive ? 'active' : ''} ${isMuted ? 'dm-muted' : ''}`;
    li.dataset.user = uid;
    li.innerHTML = `
      <div class="dm-avatar" style="background:${u.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)'}">
        ${u.initials || u.name?.slice(0, 2).toUpperCase() || 'U'}
        <div class="status-dot online"></div>
      </div>
      <div class="dm-info">
        <span class="dm-name" style="${isUnread ? 'font-weight:800;' : ''}">${esc(u.name)}
          <span style="font-size:11px;font-weight:400;color:var(--text-3);">${esc(u.handle || '')}</span>
          ${isMuted ? '<span class="dm-muted-badge">🔇 Muted</span>' : ''}
        </span>
        <span class="dm-preview" style="${isUnread ? 'color:var(--text-1);font-weight:600;' : ''}">${esc(previewText)}</span>
      </div>
      <div class="dm-meta">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="dm-time">${previewTime}</span>
          <button class="dm-more-btn" data-user="${uid}" title="More options" onclick="openDMMenu(event, '${uid}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
        ${isUnread ? '<span class="dm-unread">●</span>' : ''}
      </div>
    `;

    li.addEventListener('click', (e) => {
      // Don't open chat when clicking the three-dot menu
      if (e.target.closest('.dm-more-btn')) return;
      state.dmSettings[uid] = { ...(state.dmSettings[uid] || {}), unread: false };
      saveDMSettings();
      renderDMChat(uid);
    });

    dmList.appendChild(li);
  });
}

// ─── INBOX CONTEXT MENU ───────────────────────────────────────
let _dmMenuOpenFor = null;

function openDMMenu(event, userId) {
  event.stopPropagation();
  event.preventDefault();

  // Close any existing menu
  closeAllDMMenus();

  const settings = state.dmSettings[userId] || {};
  const isMuted = !!settings.muted;

  const menu = document.createElement('div');
  menu.className = 'dm-context-menu';
  menu.id = 'dm-context-menu';
  menu.innerHTML = `
    <button class="dm-menu-item" onclick="toggleMuteConversation('${userId}')">
      ${isMuted
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Unmute'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> Mute'}
    </button>
    <button class="dm-menu-item" onclick="markConversationUnread('${userId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      Mark as Unread
    </button>
    <button class="dm-menu-item" onclick="archiveConversation('${userId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      Archive Chat
    </button>
    <div class="dm-menu-divider"></div>
    <button class="dm-menu-item danger" onclick="confirmDeleteConversation('${userId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Delete Conversation
    </button>
  `;

  // Position the menu near the button
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  document.body.appendChild(menu);

  // Smart positioning
  const menuW = 200;
  const menuH = menu.offsetHeight || 220;
  let left = rect.right - menuW;
  let top = rect.bottom + 4;
  if (left < 8) left = 8;
  if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 4;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  _dmMenuOpenFor = userId;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeAllDMMenus, { once: true });
  }, 0);
}

function closeAllDMMenus() {
  const existing = document.getElementById('dm-context-menu');
  if (existing) existing.remove();
  _dmMenuOpenFor = null;
}

// ─── INBOX ACTIONS ────────────────────────────────────────────
function toggleMuteConversation(userId) {
  closeAllDMMenus();
  const settings = state.dmSettings[userId] || {};
  settings.muted = !settings.muted;
  state.dmSettings[userId] = settings;
  saveDMSettings();
  renderDMUserList();
  showToast(settings.muted ? '🔇 Conversation muted' : '🔔 Conversation unmuted');
}

function markConversationUnread(userId) {
  closeAllDMMenus();
  const settings = state.dmSettings[userId] || {};
  settings.unread = true;
  state.dmSettings[userId] = settings;
  saveDMSettings();
  renderDMUserList();
  showToast('✉️ Marked as unread');
}

function archiveConversation(userId) {
  closeAllDMMenus();
  // Toggle archive: remove from list (same as soft-delete but recoverable via search)
  const settings = state.dmSettings[userId] || {};
  settings.deleted = !settings.deleted;
  state.dmSettings[userId] = settings;
  saveDMSettings();
  if (state.activeDM === userId && settings.deleted) {
    // Switch to another user
    const others = Object.keys(USERS).filter(u => u !== (state.currentUser?.id || 'you') && !(state.dmSettings[u] && state.dmSettings[u].deleted));
    if (others.length) renderDMChat(others[0]);
  }
  renderDMUserList();
  showToast(settings.deleted ? '📁 Chat archived' : '📂 Chat unarchived');
}

function confirmDeleteConversation(userId) {
  closeAllDMMenus();
  const u = USERS[userId];
  const name = u ? u.name : 'this user';

  // Create confirmation modal
  const overlay = document.createElement('div');
  overlay.className = 'delete-confirm-overlay';
  overlay.id = 'delete-confirm-overlay';
  overlay.innerHTML = `
    <div class="delete-confirm-modal">
      <div class="delete-confirm-icon">🗑️</div>
      <div class="delete-confirm-title">Delete Conversation</div>
      <div class="delete-confirm-body">
        Are you sure you want to delete your conversation with <strong>${esc(name)}</strong>?
        This will permanently remove all messages from your inbox.
      </div>
      <div class="delete-confirm-actions">
        <button class="delete-confirm-btn cancel" onclick="closeDMConfirm()">Cancel</button>
        <button class="delete-confirm-btn confirm" onclick="deleteConversation('${userId}')">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDMConfirm();
  });
}

function closeDMConfirm() {
  const overlay = document.getElementById('delete-confirm-overlay');
  if (overlay) overlay.remove();
}

function deleteConversation(userId) {
  closeDMConfirm();
  // Delete local messages
  delete state.dmMessages[userId];
  saveDMs(state.dmMessages);
  // Mark as deleted so it's hidden from DM list
  state.dmSettings[userId] = { ...(state.dmSettings[userId] || {}), deleted: true };
  saveDMSettings();
  // Switch chat away if this was active
  if (state.activeDM === userId) {
    const others = Object.keys(USERS).filter(u => u !== (state.currentUser?.id || 'you') && !(state.dmSettings[u] && state.dmSettings[u].deleted));
    if (others.length) renderDMChat(others[0]);
    else {
      if (chatMessages) chatMessages.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:40px 20px;">No conversations yet. Select a member to start chatting! 💬</p>';
    }
  }
  renderDMUserList();
  showToast('🗑️ Conversation deleted');
}

function renderOnlineMembers() {
  const onlineList = document.getElementById('online-friends-list');
  if (!onlineList) return;

  const currentId = state.currentUser ? state.currentUser.id : null;
  const members = Object.keys(USERS).filter(uid => uid !== currentId && !DUMMY_IDS.has(uid.toLowerCase()) && !isDummyUser(USERS[uid], uid));

  onlineList.innerHTML = '';
  if (members.length === 0) {
    onlineList.innerHTML = '<li style="color:var(--text-3);font-size:12.5px;padding:8px 0;">No other members online</li>';
    return;
  }
  members.slice(0, 8).forEach(uid => {
    const u = USERS[uid];
    if (!u) return;
    const li = document.createElement('li');
    li.className = 'online-friend';
    li.dataset.user = uid;
    li.style.cursor = 'pointer';
    li.innerHTML = `
      <div class="of-avatar" style="background:${u.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)'}">
        ${u.initials || 'U'}
        <div class="status-dot online"></div>
      </div>
      <span>${esc(u.name)}</span>
    `;
    li.addEventListener('click', () => {
      viewUserProfile(uid);
    });
    onlineList.appendChild(li);
  });
}

function renderFriendsList() {
  const friendsList = document.getElementById('friends-list');
  const suggestionsList = document.getElementById('suggestions-list');

  const currentId = state.currentUser ? state.currentUser.id : null;
  const members = Object.keys(USERS).filter(uid => uid !== currentId && !DUMMY_IDS.has(uid.toLowerCase()) && !isDummyUser(USERS[uid], uid));

  if (friendsList) {
    friendsList.innerHTML = '';
    if (members.length === 0) {
      friendsList.innerHTML = '<li style="color:var(--text-3);font-size:12.5px;padding:8px 12px;">No members yet</li>';
    } else {
      members.forEach(uid => {
        const u = USERS[uid];
        if (!u) return;
        const li = document.createElement('li');
        li.className = 'friend-item';
        li.dataset.user = uid;
        li.innerHTML = `
          <div class="friend-avatar" style="background:${u.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)'}">
            ${u.initials || u.name?.slice(0, 2).toUpperCase() || 'U'}
            <div class="status-dot online"></div>
          </div>
          <div class="friend-info">
            <span class="fname">${esc(u.name)}</span>
            <span class="fstatus">${esc(u.handle || 'Member')}</span>
          </div>
          <button class="msg-friend-btn" data-user="${uid}" title="Message">
            <svg width="14" height="14" viewBox="0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        `;
        const btn = li.querySelector('.msg-friend-btn');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startChatWithUser(uid);
          });
        }
        li.addEventListener('click', () => {
          viewUserProfile(uid);
        });
        friendsList.appendChild(li);
      });
    }
  }

  if (suggestionsList) {
    suggestionsList.innerHTML = '';
    if (members.length === 0) {
      suggestionsList.innerHTML = '<li style="color:var(--text-3);font-size:12.5px;padding:8px 0;">No suggestions yet</li>';
    } else {
      members.slice(0, 4).forEach(uid => {
        const u = USERS[uid];
        if (!u) return;
        const following = isFollowing(uid);
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.innerHTML = `
          <div class="sug-avatar" style="background:${u.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)'}; cursor:pointer;" onclick="viewUserProfile('${uid}')">
            ${u.initials || u.name?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div class="sug-info" style="cursor:pointer;" onclick="viewUserProfile('${uid}')">
            <span class="sug-name">${esc(u.name)}</span>
            <span class="sug-mutual">${esc(u.handle || 'Member')}</span>
          </div>
          <button class="follow-btn-sm ${following ? 'following' : ''}" onclick="toggleFollowUser('${uid}', this)">${following ? 'Following ✓' : 'Follow'}</button>
        `;
        suggestionsList.appendChild(li);
      });
    }
  }
}

// ─── RENDER DM CHAT ───────────────────────────────────────────
function renderDMChat(userId) {
  const chatMsgContainer = document.getElementById('chat-messages');
  if (!userId || !USERS[userId]) {
    state.activeDM = null;
    if (chatMsgContainer) {
      chatMsgContainer.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:40px 20px;">Select a conversation to start messaging 💬</p>';
    }
    const avatarEl = document.getElementById('chat-peer-avatar');
    if (avatarEl) { avatarEl.textContent = ''; avatarEl.style.display = 'none'; }
    const nameEl = document.getElementById('chat-peer-name');
    if (nameEl) nameEl.textContent = 'Select a conversation';
    const statusEl = document.getElementById('chat-peer-status');
    if (statusEl) statusEl.textContent = '';
    const inputEl = document.getElementById('chat-input');
    if (inputEl) inputEl.dataset.placeholder = 'Select a user to message…';
    return;
  }

  state.activeDM = userId;
  if (!state.dmMessages[userId]) state.dmMessages[userId] = [];
  const msgs = state.dmMessages[userId];
  if (chatMsgContainer) chatMsgContainer.innerHTML = '';

  if (chatMsgContainer) {
    chatMsgContainer.appendChild(createDateDivider('Today'));
    msgs.forEach(msg => {
      chatMsgContainer.appendChild(createChatBubble(msg));
    });
  }

  scrollChatToBottom();

  // Update chat header
  const user = USERS[userId];
  if (user) {
    const avatarEl = document.getElementById('chat-peer-avatar');
    if (avatarEl) {
      avatarEl.style.display = '';
      avatarEl.style.cursor = 'pointer';
      avatarEl.onclick = () => viewUserProfile(userId);
      avatarEl.style.background = user.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)';
      avatarEl.textContent = user.initials || user.name?.slice(0, 2).toUpperCase() || 'U';
    }
    const nameEl = document.getElementById('chat-peer-name');
    if (nameEl) {
      nameEl.textContent = user.name;
      nameEl.style.cursor = 'pointer';
      nameEl.onclick = () => viewUserProfile(userId);
    }
    const statusEl = document.getElementById('chat-peer-status');
    if (statusEl) statusEl.textContent = 'Active now';
    const inputEl = document.getElementById('chat-input');
    if (inputEl) inputEl.dataset.placeholder = `Message ${user.name}…`;
  }

  // Update DM list active state
  document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));
  const dmEl = document.querySelector(`.dm-item[data-user="${userId}"]`);
  if (dmEl) {
    dmEl.classList.add('active');
    const badge = dmEl.querySelector('.dm-unread');
    if (badge) badge.remove();
  }
}

function createDateDivider(label) {
  const d = document.createElement('div');
  d.className = 'chat-date-divider';
  d.textContent = label;
  return d;
}

function createChatBubble(msg) {
  const currentId = state.currentUser ? state.currentUser.id : null;
  const isOwn = msg.from === currentId || (!currentId && msg.from === 'you');
  const currentUser = state.currentUser || { gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: 'U' };
  const user = isOwn ? (USERS[currentId] || currentUser) : (USERS[msg.from] || { gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', initials: '?' });
  const row = document.createElement('div');
  row.className = `chat-msg-row${isOwn ? ' own' : ''}`;

  const ticks = isOwn
    ? `<span class="bubble-ticks ${msg.read ? 'read' : ''}">
         <svg width="14" height="9" viewBox="0 0 16 10" fill="currentColor">
           <path d="M1 5l4 4L15 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
           ${msg.read !== false ? '<path d="M5 5l4 4L15 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(-3,0)"/>' : ''}
         </svg>
       </span>`
    : '';

  row.innerHTML = `
    ${!isOwn ? `<div class="chat-msg-bubble-avatar" style="background:${user.gradient || 'linear-gradient(135deg,#8b5cf6,#ec4899)'}">${user.initials || 'U'}</div>` : ''}
    <div class="chat-msg-bubble">
      ${esc(msg.text).replace(/\n/g,'<br>')}
      <div class="bubble-footer">
        <span class="bubble-time">${msg.time}</span>
        ${ticks}
      </div>
    </div>
  `;
  return row;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
}

// ─── SEND DM ──────────────────────────────────────────────────
function sendChatMessage() {
  const text = chatInput.textContent.trim();
  if (!text) return;

  const currentId = state.currentUser ? state.currentUser.id : 'you';
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timestamp = Date.now();
  const targetUser = state.activeDM;

  const msg = { from: currentId, to: targetUser, text, time, timestamp, read: false };

  if (!state.dmMessages[targetUser]) state.dmMessages[targetUser] = [];
  state.dmMessages[targetUser].push(msg);
  saveDMs(state.dmMessages);

  chatInput.textContent = '';
  const bubble = createChatBubble(msg);
  chatMessages.appendChild(bubble);
  scrollChatToBottom();

  renderDMUserList();

  // Sync to Firebase Cloud
  if (db) {
    db.collection('messages').add({
      from: currentId,
      to: targetUser,
      text: text,
      time: time,
      timestamp: timestamp
    }).then(docRef => {
      msg.id = docRef.id;
    }).catch(err => {
      console.warn('Firebase message send warning:', err);
    });
  }

  setTimeout(() => {
    const ticks = bubble.querySelector('.bubble-ticks');
    if (ticks) ticks.classList.add('read');
    msg.read = true;
    saveDMs(state.dmMessages);
  }, 600);
}

// ─── POST ACTIONS ─────────────────────────────────────────────
function toggleLike(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  post.likedByMe = !post.likedByMe;
  post.likes += post.likedByMe ? 1 : -1;
  savePosts(state.posts);
  refreshPost(postId);
  showToast(post.likedByMe ? '❤️ You liked this post!' : '💔 Unliked');
}

function toggleComments(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  post.showComments = !post.showComments;
  savePosts(state.posts);
  refreshPost(postId);
}

function addComment(postId) {
  const post = state.posts.find(p => p.id === postId);
  const input = document.getElementById('ci-' + postId);
  if (!post || !input) return;
  const text = input.textContent.trim();
  if (!text) return;

  const currentId = state.currentUser ? state.currentUser.id : 'you';
  post.comments.push({ user: currentId, text, time: 'Just now' });
  savePosts(state.posts);
  refreshPost(postId);
  showToast('💬 Comment posted!');
}

function sharePost(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (post) {
    post.shares = (post.shares || 0) + 1;
    savePosts(state.posts);
    refreshPost(postId);
  }
  showToast('📤 Post shared with your followers!');
}

function savePost(postId) {
  const isSaved = state.savedPosts.includes(postId);
  if (isSaved) {
    state.savedPosts = state.savedPosts.filter(id => id !== postId);
    showToast('Unsaved post');
  } else {
    state.savedPosts.push(postId);
    showToast('🔖 Post saved to your bookmarks!');
  }
  saveSavedPosts(state.savedPosts);

  const post = state.posts.find(p => p.id === postId);
  if (post) {
    post.isSaved = !isSaved;
    refreshPost(postId);
  }

  renderSavedPosts();
}

function renderSavedPosts() {
  if (!savedPostsFeed) return;
  savedPostsFeed.innerHTML = '';

  if (state.savedPosts.length === 0) {
    savedPostsFeed.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:32px;">No posts saved yet. Bookmark posts you want to find later! 🔖</p>`;
    return;
  }

  state.savedPosts.forEach(id => {
    const post = state.posts.find(p => p.id === id);
    if (post) savedPostsFeed.appendChild(createPostCard(post));
  });
}

function toggleReadMore(postId) {
  const el = document.getElementById('pt-' + postId);
  const btn = el && el.nextElementSibling;
  if (!el) return;
  if (el.classList.contains('collapsed')) {
    el.classList.remove('collapsed');
    if (btn && btn.classList.contains('read-more-btn')) btn.textContent = 'See less';
  } else {
    el.classList.add('collapsed');
    if (btn && btn.classList.contains('read-more-btn')) btn.textContent = 'See more';
  }
}

function refreshPost(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const oldEl = document.getElementById('post-' + postId);
  if (oldEl) oldEl.replaceWith(createPostCard(post));

  // Also refresh in profile view
  const profileOld = document.querySelector(`#profile-posts #post-${postId}`);
  if (profileOld) profileOld.replaceWith(createPostCard(post));
}

// ─── CREATE POST ──────────────────────────────────────────────
let currentPostType = 'text';

function openCreatePost(type = 'text') {
  createPostOverlay.style.display = 'flex';
  switchPostType(type);
}

function switchPostType(type) {
  currentPostType = type;
  document.querySelectorAll('.ptype-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.post-fields').forEach(f => f.classList.add('hidden'));
  const activeTab = document.getElementById('ptype-' + type);
  const activeFields = document.getElementById('post-fields-' + type);
  if (activeTab) activeTab.classList.add('active');
  if (activeFields) activeFields.classList.remove('hidden');

  const titles = { text: 'Create Post', photo: '🖼️ Share Photos' };
  document.getElementById('modal-post-type-title').textContent = titles[type] || 'Create Post';
}

function submitPost() {
  const type = currentPostType;
  const currentId = state.currentUser ? state.currentUser.id : 'you';
  const timestamp = Date.now();
  let post = { id: 'p' + timestamp, type, user: currentId, time: 'Just now', timestamp, likes: 0, likedByMe: false, shares: 0, comments: [], showComments: false };

  if (type === 'text') {
    const text = document.getElementById('post-text-input').textContent.trim();
    if (!text) { showToast('⚠️ Please write something!'); return; }
    post.text = text;
  } else if (type === 'photo') {
    const caption = document.getElementById('photo-caption-input').textContent.trim();
    post.text = caption || '📸';
    post.type = 'text';
  }

  // Prepend to posts & persist locally
  state.posts.unshift(post);
  savePosts(state.posts);
  renderFeed();
  updateProfileStats();

  // Sync to Firebase Cloud
  if (db) {
    db.collection('posts').doc(post.id).set(post).catch(err => {
      console.warn('Firebase post sync warning:', err);
    });
  }

  // Close modal & reset
  createPostOverlay.style.display = 'none';
  ['post-text-input','photo-caption-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });

  showToast('🎉 Your post is live! Everyone can see it.');
}

// ─── VIEW SWITCHING ───────────────────────────────────────────
function switchView(viewId) {
  state.view = viewId;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab, .left-nav-item').forEach(el => el.classList.remove('active'));

  const viewEl = document.getElementById('view-' + viewId);
  if (viewEl) viewEl.classList.add('active');

  // Highlight matching nav items
  document.querySelectorAll(`[data-view="${viewId}"]`).forEach(el => el.classList.add('active'));

  // switchView for messages — use first real user
  if (viewId === 'messages') {
    document.body.classList.add('messages-active');
    const msgBadge = document.getElementById('msg-nav-badge');
    if (msgBadge) msgBadge.style.display = 'none';
    const lnavBadge = document.querySelector('.lnav-badge');
    if (lnavBadge) lnavBadge.textContent = '';
    if (state.activeDM && USERS[state.activeDM]) {
      renderDMChat(state.activeDM);
    } else {
      const currentId = state.currentUser ? state.currentUser.id : null;
      const others = Object.keys(USERS).filter(u => u !== currentId);
      if (others.length) renderDMChat(others[0]);
      else if (chatMessages) chatMessages.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:40px 20px;">No members yet — invite friends to start chatting! 🚀</p>';
    }
  } else {
    document.body.classList.remove('messages-active');
  }
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function toggleNotifPanel() {
  const visible = notifPanel.style.display !== 'none';
  notifPanel.style.display = visible ? 'none' : 'block';
  document.getElementById('notif-dot').style.display = visible ? '' : 'none';
}


// ─── HELPERS ─────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────
function attachEventListeners() {
  // Nav tabs (top + left sidebar)
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });

  // Create post triggers
  document.getElementById('open-post-modal-btn').addEventListener('click', () => openCreatePost('text'));
  document.getElementById('quick-photo-btn').addEventListener('click', () => openCreatePost('photo'));

  // Post type tabs in modal
  document.querySelectorAll('.ptype-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPostType(tab.dataset.type));
  });

  // Close modal
  document.getElementById('close-create-post').addEventListener('click', () => {
    createPostOverlay.style.display = 'none';
  });
  createPostOverlay.addEventListener('click', e => {
    if (e.target === createPostOverlay) createPostOverlay.style.display = 'none';
  });

  // Submit post
  document.getElementById('submit-post-btn').addEventListener('click', submitPost);

  // DM list
  document.querySelectorAll('.dm-item').forEach(el => {
    el.addEventListener('click', () => renderDMChat(el.dataset.user));
  });

  // Message friends from left sidebar
  document.querySelectorAll('.msg-friend-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      switchView('messages');
      renderDMChat(btn.dataset.user);
    });
  });

  // Online friends in right sidebar
  document.querySelectorAll('.online-friend').forEach(el => {
    el.addEventListener('click', () => {
      switchView('messages');
      renderDMChat(el.dataset.user);
    });
  });

  // Chat send
  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });

  // Notifications
  document.getElementById('notif-btn').addEventListener('click', toggleNotifPanel);
  document.getElementById('mark-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    document.getElementById('notif-dot').style.display = 'none';
    showToast('✅ All notifications marked as read');
  });

  // Photo upload area
  const photoDropArea = document.getElementById('photo-drop-area');
  const photoFileInput = document.getElementById('photo-file-input');
  if (photoDropArea) {
    photoDropArea.addEventListener('click', () => photoFileInput.click());
    photoFileInput.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      const grid = document.getElementById('photo-preview-grid');
      grid.innerHTML = '';
      grid.style.display = files.length ? 'grid' : 'none';
      files.forEach(f => {
        const reader = new FileReader();
        reader.onload = ev => {
          const img = document.createElement('img');
          img.className = 'photo-preview-img';
          img.src = ev.target.result;
          grid.appendChild(img);
        };
        reader.readAsDataURL(f);
      });
      photoDropArea.style.display = files.length ? 'none' : 'flex';
    });
  }

  // Thumb upload area
  const thumbArea = document.getElementById('thumb-upload-area');
  const thumbInput = document.getElementById('thumb-file-input');
  if (thumbArea) {
    thumbArea.addEventListener('click', () => thumbInput.click());
  }

  // Forward legacy toggleFollow if called
  window.toggleFollow = function(btn) {
    const uid = btn.dataset?.user;
    if (uid) toggleFollowUser(uid, btn);
  };

  // Close notif panel on outside click
  document.addEventListener('click', e => {
    if (!notifPanel.contains(e.target) && !document.getElementById('notif-btn').contains(e.target)) {
      notifPanel.style.display = 'none';
    }
  });

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      createPostOverlay.style.display = 'none';
      notifPanel.style.display = 'none';
      closeDMConfirm();
      closeAllDMMenus();
    }
  });

  // Nav avatar → profile
  document.getElementById('nav-avatar').addEventListener('click', () => switchView('profile'));
  document.getElementById('edit-profile-btn').addEventListener('click', () => showToast('⚙️ Profile editor coming soon!'));

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      if (themeToggle.checked) {
        document.body.classList.add('light-theme');
        localStorage.setItem('nexus-theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('nexus-theme', 'dark');
      }
    });
  }

  // Global search
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (state.view !== 'feed') {
        switchView('feed');
      }
      renderFeed();
    });
  }

  // DM Search
  const msgSearch = document.getElementById('msg-search');
  if (msgSearch) {
    msgSearch.addEventListener('input', (e) => {
      renderDMUserList(e.target.value);
    });
  }

  // New Message Button
  const newMsgBtn = document.getElementById('new-msg-btn');
  if (newMsgBtn) {
    newMsgBtn.addEventListener('click', () => {
      const availableUsers = Object.keys(USERS).filter(u => u !== (state.currentUser?.id || 'you'));
      const nextUser = availableUsers.find(u => u !== state.activeDM) || availableUsers[0];
      if (nextUser) {
        renderDMChat(nextUser);
        showToast(`💬 Switched chat to ${USERS[nextUser].name}`);
      }
    });
  }

  // Auth Inputs Enter key submit
  ['login-email', 'login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleLogin(); }
      });
    }
  });

  ['reg-name', 'reg-email', 'reg-password', 'reg-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleRegister(); }
      });
    }
  });

  ['forgot-email', 'forgot-password', 'forgot-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleForgotPassword(); }
      });
    }
  });
}

// ─── INIT & BOOT ──────────────────────────────────────────────
function init() {
  // 1. Permanently purge any legacy dummy data (Sarah, Maya, Leo, Liam, Zoe, etc.) from storage
  purgeLegacyDummyData();

  // Theme initialization
  const savedTheme = localStorage.getItem(STORAGE.THEME);
  const themeToggle = document.getElementById('theme-toggle');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeToggle) themeToggle.checked = true;
  }

  // Init & Boot state
  state.posts = loadPosts();
  state.dmMessages = loadDMs();
  state.savedPosts = loadSavedPosts();
  state.dmSettings = loadDMSettings();
  state.following = loadFollowing();

  // Attach event handlers
  attachEventListeners();

  // Check user authentication session
  checkAuthSession();

  // Render initial views & dynamic member lists
  renderFeed();
  updateProfileStats();
  renderDMUserList();
  renderOnlineMembers();
  renderFriendsList();

  // Select first available real conversation if any exist, otherwise clear chat panel
  const currentId = state.currentUser ? state.currentUser.id : null;
  const others = Object.keys(USERS).filter(u => u !== currentId && !DUMMY_IDS.has(u.toLowerCase()) && !isDummyUser(USERS[u], u));
  if (others.length) {
    renderDMChat(others[0]);
  } else {
    renderDMChat(null);
  }

  // Connect to Firebase Cloud Database for multi-device sync
  initFirebase();
}

// ─── Expose globals for inline handlers ──────────────────────
window.toggleLike = toggleLike;
window.toggleComments = toggleComments;
window.addComment = addComment;
window.sharePost = sharePost;
window.savePost = savePost;
window.toggleReadMore = toggleReadMore;
window.switchView = switchView;
window.switchAuthPanel = switchAuthPanel;
window.handleLogin = handleLogin;
window.demoLogin = demoLogin;
window.handleRegister = handleRegister;
window.handleForgotPassword = handleForgotPassword;
window.logout = logout;
window.renderDMChat = renderDMChat;
window.renderDMUserList = renderDMUserList;
window.showToast = showToast;
window.openDMMenu = openDMMenu;
window.closeAllDMMenus = closeAllDMMenus;
window.toggleMuteConversation = toggleMuteConversation;
window.markConversationUnread = markConversationUnread;
window.archiveConversation = archiveConversation;
window.confirmDeleteConversation = confirmDeleteConversation;
window.closeDMConfirm = closeDMConfirm;
window.deleteConversation = deleteConversation;
window.renderFriendsList = renderFriendsList;
window.viewUserProfile = viewUserProfile;
window.startChatWithUser = startChatWithUser;
window.toggleFollowUser = toggleFollowUser;
window.isFollowing = isFollowing;
window.setFeedTab = setFeedTab;

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
