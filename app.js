'use strict';

/* ============================================================
   NEXUS SOCIAL — app.js
   Full-featured social & messaging web application
   ============================================================ */

// ─── Storage Keys ─────────────────────────────────────────────
const STORAGE = {
  USERS: 'nexus_users_db',
  SESSION: 'nexus_current_session',
  POSTS: 'nexus_posts_db',
  DMS: 'nexus_dms_db',
  SAVED: 'nexus_saved_db',
  THEME: 'nexus-theme'
};

// ─── Default Users ────────────────────────────────────────────
const DEFAULT_USERS = {
  you: {
    id: 'you',
    name: 'Alex Rivera',
    email: 'alex@nexus.dev',
    handle: '@alex',
    password: 'password123',
    initials: 'A',
    gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
    bio: 'Software Engineer | Building products for the future ✨'
  },
  sarah: {
    id: 'sarah',
    name: 'Sarah K.',
    email: 'sarah@nexus.dev',
    handle: '@sarahk',
    password: 'password123',
    initials: 'S',
    gradient: 'linear-gradient(135deg,#a855f7,#6366f1)',
    bio: 'Product Designer & UI enthusiast 🎨'
  },
  maya: {
    id: 'maya',
    name: 'Maya T.',
    email: 'maya@nexus.dev',
    handle: '@mayat',
    password: 'password123',
    initials: 'M',
    gradient: 'linear-gradient(135deg,#f97316,#eab308)',
    bio: 'Frontend wizard & Open source lover 💻'
  },
  leo: {
    id: 'leo',
    name: 'Leo B.',
    email: 'leo@nexus.dev',
    handle: '@leob',
    password: 'password123',
    initials: 'Le',
    gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
    bio: 'Tech storyteller & creator 🎬'
  },
  liam: {
    id: 'liam',
    name: 'Liam R.',
    email: 'liam@nexus.dev',
    handle: '@liamr',
    password: 'password123',
    initials: 'L',
    gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
    bio: 'Systems Architect & Cloud engineer ☁️'
  },
  zoe: {
    id: 'zoe',
    name: 'Zoe P.',
    email: 'zoe@nexus.dev',
    handle: '@zoep',
    password: 'password123',
    initials: 'Z',
    gradient: 'linear-gradient(135deg,#ec4899,#f43f5e)',
    bio: 'Visual artist & digital creator 🌸'
  }
};

// In-memory active USERS registry
const USERS = { ...DEFAULT_USERS };

// ─── State ────────────────────────────────────────────────────
const state = {
  currentUser: null,
  view: 'feed',
  posts: [],
  dmMessages: {},
  activeDM: 'sarah',
  myPostCount: 0,
  savedPosts: [],
  searchQuery: ''
};

// ─── Seed Posts ────────────────────────────────────────────────
const SEED_POSTS = [
  {
    id: 'p1', type: 'text', user: 'sarah',
    time: '2 minutes ago',
    text: `Just wrapped up the new onboarding flow and I'm honestly so proud of how it turned out 🎉 The animations are silky smooth and the user testing feedback has been incredible!\n\nBig shoutout to the whole team for the support ❤️`,
    likes: 42, likedByMe: false, shares: 8,
    comments: [
      { user: 'maya',  text: 'This is amazing! The animations are so smooth 😍', time: '1m ago' },
      { user: 'leo',   text: 'Huge congrats Sarah! 🔥', time: 'Just now' },
    ],
    showComments: true,
  },
  {
    id: 'p4', type: 'text', user: 'liam',
    time: '3 hours ago',
    text: `Hot take: The best code review comment is a question, not a correction.\n\nInstead of "this is wrong, do it this way" → "Have you considered X? It might handle the edge case when Y happens"\n\nQuestions teach. Corrections sting. 🤝`,
    likes: 89, likedByMe: false, shares: 31,
    comments: [],
    showComments: false,
  },
];

// ─── Seed DMs ─────────────────────────────────────────────────
const SEED_DMS = {
  sarah: [
    { from: 'sarah', text: 'Hey! Can we chat about the Q4 roadmap?', time: '10:00 AM' },
    { from: 'you',   text: 'Of course! Give me 5 mins to finish up.', time: '10:02 AM' },
    { from: 'sarah', text: 'No worries, take your time 😊', time: '10:03 AM' },
    { from: 'sarah', text: 'Also — loved your post from this morning!', time: '10:05 AM' },
    { from: 'you',   text: 'Thanks! It got way more engagement than I expected 🎉', time: '10:06 AM' },
  ],
  maya: [
    { from: 'maya', text: 'Love the new design system colors!', time: 'Yesterday' },
    { from: 'you',  text: 'Thank you! Spent a whole weekend on the tokens 😅', time: 'Yesterday' },
    { from: 'maya', text: 'It totally shows. Really premium feel 🙌', time: 'Yesterday' },
  ],
  liam: [
    { from: 'you',  text: 'Hey Liam, can you review my PR when you get a chance?', time: '9:20 AM' },
    { from: 'liam', text: 'Sure! In a meeting until 11, will check after.', time: '9:45 AM' },
  ],
  leo: [
    { from: 'leo', text: 'Love the vlog idea — should we collab?', time: 'Yesterday' },
    { from: 'you', text: 'Yes! Let\'s set up a call this week 🎬', time: 'Yesterday' },
    { from: 'leo', text: 'Perfect! I\'ll DM you some ideas', time: 'Yesterday' },
  ],
  zoe: [
    { from: 'zoe', text: 'Hey! Have you seen the new design trends?', time: '2d ago' },
    { from: 'you', text: 'Yes! The glassmorphism stuff is 🔥', time: '2d ago' },
    { from: 'zoe', text: 'Great idea! We should do a concept together', time: '2d ago' },
  ],
};

// ─── Storage Helpers ──────────────────────────────────────────
function getStoredUsers() {
  try {
    const data = localStorage.getItem(STORAGE.USERS);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_USERS, ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_USERS };
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
  } catch (e) {}
}

function loadPosts() {
  try {
    const saved = localStorage.getItem(STORAGE.POSTS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return SEED_POSTS.map(p => ({ ...p, comments: p.comments.map(c => ({ ...c })) }));
}

function savePosts(posts) {
  try {
    localStorage.setItem(STORAGE.POSTS, JSON.stringify(posts));
  } catch (e) {}
}

function loadDMs() {
  try {
    const saved = localStorage.getItem(STORAGE.DMS);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  const dms = {};
  for (const [u, msgs] of Object.entries(SEED_DMS)) {
    dms[u] = msgs.map(m => ({ ...m }));
  }
  return dms;
}

function saveDMs(dms) {
  try {
    localStorage.setItem(STORAGE.DMS, JSON.stringify(dms));
  } catch (e) {}
}

function loadSavedPosts() {
  try {
    const saved = localStorage.getItem(STORAGE.SAVED);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
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
  // Hydrate USERS registry
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
  renderDMChat(state.activeDM || 'sarah');
  updateProfileStats();
  showToast(`👋 Welcome back, ${user.name}!`);
}

function demoLogin() {
  const users = getStoredUsers();
  const demoUser = users['you'] || DEFAULT_USERS['you'];
  loginUser(demoUser);
  showToast('🚀 Signed in as Demo User (Alex Rivera)');
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

  if (!user || user.password !== password) {
    showAuthError(errEl, 'Invalid email or password. Please try again.');
    return;
  }

  if (errEl) errEl.style.display = 'none';
  loginUser(user);
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
    bio: 'Hey there! I just joined Nexus Social ✨'
  };

  users[id] = newUser;
  saveStoredUsers(users);
  USERS[id] = newUser;

  // Add welcome DMs for new member
  if (!state.dmMessages) state.dmMessages = {};
  state.dmMessages['sarah'] = [
    { from: 'sarah', text: `Hi ${name}! Welcome to Nexus Social 🎉 Wonderful to have you here!`, time: 'Just now' }
  ];
  state.dmMessages['maya'] = [
    { from: 'maya', text: `Hey ${name}! Welcome to the platform ✨ Reach out if you need anything!`, time: 'Just now' }
  ];
  saveDMs(state.dmMessages);

  if (errEl) errEl.style.display = 'none';
  loginUser(newUser);
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

// ─── Init ─────────────────────────────────────────────────────
function init() {
  // Ensure default storage
  const stored = getStoredUsers();
  saveStoredUsers(stored);

  state.posts = loadPosts();
  state.dmMessages = loadDMs();
  state.savedPosts = loadSavedPosts();

  checkAuthSession();

  renderFeed();
  renderDMChat('sarah');
  updateProfileStats();
  attachEventListeners();

  // Init Theme
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    if (localStorage.getItem(STORAGE.THEME) === 'light') {
      themeToggle.checked = true;
      document.body.classList.add('light-theme');
    }
  }
}

// ─── RENDER FEED ──────────────────────────────────────────────
function renderFeed() {
  postsFeed.innerHTML = '';
  
  let visiblePosts = state.posts;
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    visiblePosts = visiblePosts.filter(p => 
      p.text.toLowerCase().includes(q) || 
      (USERS[p.user] && USERS[p.user].name.toLowerCase().includes(q))
    );
  }
  
  if (visiblePosts.length === 0) {
    postsFeed.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:32px;">No posts found for "${esc(state.searchQuery)}" 🧐</p>`;
    return;
  }

  visiblePosts.forEach(post => {
    postsFeed.appendChild(createPostCard(post));
  });
}

function createPostCard(post) {
  const user = USERS[post.user];
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
      const cu = USERS[c.user] || USERS.you;
      return `
        <div class="comment-item">
          <div class="comment-avatar" style="background:${cu.gradient}">${cu.initials}</div>
          <div class="comment-bubble">
            <div class="comment-author">${cu.name}</div>
            <div class="comment-text">${esc(c.text)}</div>
            <div class="comment-time">${c.time}</div>
          </div>
        </div>`;
    }).join('');

    commentsHtml = `
      <div class="comments-section">
        <div class="comment-list">${commentItems}</div>
        <div class="add-comment-row" style="margin-top:10px;">
          <div class="cp-avatar" style="background:${USERS.you.gradient};width:30px;height:30px;font-size:11px;">Y</div>
          <div class="comment-input" id="ci-${post.id}" contenteditable="true" data-placeholder="Write a comment…"></div>
          <button class="comment-send-btn" onclick="addComment('${post.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>`;
  }

  card.innerHTML = `
    <div class="post-card-header">
      <div class="post-user-avatar" style="background:${user.gradient}" title="${user.name}">${user.initials}</div>
      <div class="post-user-info">
        <div class="post-user-name" style="display:flex;align-items:center;gap:8px;">
          ${user.name}
          ${post.user !== 'you' ? `<button class="follow-btn-sm" onclick="toggleFollow(this)">Follow</button>` : ''}
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

// ─── RENDER PROFILE ───────────────────────────────────────────
function updateProfileStats() {
  const currentId = state.currentUser ? state.currentUser.id : 'you';
  const myPosts = state.posts.filter(p => p.user === currentId || (currentId === 'you' && p.user === 'you'));
  state.myPostCount = myPosts.length;
  if (statPosts) statPosts.textContent = state.myPostCount;

  profilePosts.innerHTML = '';
  if (myPosts.length === 0) {
    profilePosts.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:32px;">You haven't posted anything yet. Create your first post! 🚀</p>`;
    return;
  }
  myPosts.forEach(p => profilePosts.appendChild(createPostCard(p)));
}

// ─── RENDER DM CHAT ───────────────────────────────────────────
function renderDMChat(userId) {
  state.activeDM = userId;
  if (!state.dmMessages[userId]) state.dmMessages[userId] = [];
  const msgs = state.dmMessages[userId];
  chatMessages.innerHTML = '';

  chatMessages.appendChild(createDateDivider('Today'));

  msgs.forEach(msg => {
    chatMessages.appendChild(createChatBubble(msg));
  });

  scrollChatToBottom();

  // Update chat header
  const user = USERS[userId];
  if (user) {
    const avatarEl = document.getElementById('chat-peer-avatar');
    if (avatarEl) {
      avatarEl.style.background = user.gradient;
      avatarEl.textContent = user.initials;
    }
    const nameEl = document.getElementById('chat-peer-name');
    if (nameEl) nameEl.textContent = user.name;
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
  const currentId = state.currentUser ? state.currentUser.id : 'you';
  const isOwn = msg.from === currentId || msg.from === 'you';
  const user = isOwn ? (USERS[currentId] || USERS.you) : (USERS[msg.from] || USERS.you);
  const row = document.createElement('div');
  row.className = `chat-msg-row${isOwn ? ' own' : ''}`;

  // Consecutive message grouping (hide avatar if same sender as next)
  const ticks = isOwn
    ? `<span class="bubble-ticks ${msg.read ? 'read' : ''}">
         <svg width="14" height="9" viewBox="0 0 16 10" fill="currentColor">
           <path d="M1 5l4 4L15 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
           ${msg.read !== false ? '<path d="M5 5l4 4L15 1" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(-3,0)"/>' : ''}
         </svg>
       </span>`
    : '';

  row.innerHTML = `
    ${!isOwn ? `<div class="chat-msg-bubble-avatar" style="background:${user.gradient}">${user.initials}</div>` : ''}
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
  const msg = { from: currentId, text, time, read: false };

  if (!state.dmMessages[state.activeDM]) state.dmMessages[state.activeDM] = [];
  state.dmMessages[state.activeDM].push(msg);
  saveDMs(state.dmMessages);

  chatInput.textContent = '';
  const bubble = createChatBubble(msg);
  chatMessages.appendChild(bubble);
  scrollChatToBottom();

  // Update DM sidebar preview
  const dmEl = document.querySelector(`.dm-item[data-user="${state.activeDM}"]`);
  if (dmEl) {
    const preview = dmEl.querySelector('.dm-preview');
    const timeEl  = dmEl.querySelector('.dm-time');
    if (preview) preview.textContent = text;
    if (timeEl)  timeEl.textContent  = time;
  }

  // Message status: delivered
  setTimeout(() => {
    const ticks = bubble.querySelector('.bubble-ticks');
    if (ticks) ticks.classList.add('read');
    msg.read = true;
    saveDMs(state.dmMessages);
  }, 1000);
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
  let post = { id: 'p' + Date.now(), type, user: currentId, time: 'Just now', likes: 0, likedByMe: false, shares: 0, comments: [], showComments: false };

  if (type === 'text') {
    const text = document.getElementById('post-text-input').textContent.trim();
    if (!text) { showToast('⚠️ Please write something!'); return; }
    post.text = text;
  } else if (type === 'photo') {
    const caption = document.getElementById('photo-caption-input').textContent.trim();
    post.text = caption || '📸';
    post.type = 'text';
  }

  // Prepend to posts & persist
  state.posts.unshift(post);
  savePosts(state.posts);
  renderFeed();
  updateProfileStats();

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

  // Update message badge & toggle full-screen messages layout (NO FREE SPACE)
  if (viewId === 'messages') {
    document.body.classList.add('messages-active');
    const msgBadge = document.getElementById('msg-nav-badge');
    if (msgBadge) msgBadge.style.display = 'none';
    const lnavBadge = document.querySelector('.lnav-badge');
    if (lnavBadge) lnavBadge.textContent = '';
    renderDMChat(state.activeDM || 'sarah');
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

  // Follow buttons
  window.toggleFollow = function(btn) {
    btn.textContent = btn.textContent === 'Follow' ? 'Following ✓' : 'Follow';
    btn.style.background = btn.textContent === 'Follow' ? '' : 'var(--accent)';
    btn.style.color = btn.textContent === 'Follow' ? '' : '#fff';
    showToast(btn.textContent === 'Following ✓' ? '✅ You are now following this user' : 'Unfollowed');
  };

  document.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      window.toggleFollow(this);
    });
  });

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
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.dm-item').forEach(item => {
        const name = item.querySelector('.dm-name')?.textContent.toLowerCase() || '';
        const preview = item.querySelector('.dm-preview')?.textContent.toLowerCase() || '';
        if (!q || name.includes(q) || preview.includes(q)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
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
window.showToast = showToast;

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
