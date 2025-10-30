function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function safeJSONParse(s, fallback) {
  try { return JSON.parse(s) ?? fallback; } catch { return fallback; }
}

const API_BASE = "http://localhost:5000/api";

const LS_KEYS = {
  BOOKINGS: 'sas_bookings_v1',
  REGISTRATIONS: 'sas_registrations_v1'
};

function loadBookings() { return safeJSONParse(localStorage.getItem(LS_KEYS.BOOKINGS), []); }
function saveBookings(arr) { localStorage.setItem(LS_KEYS.BOOKINGS, JSON.stringify(arr)); }
function loadRegistrations() { return safeJSONParse(localStorage.getItem(LS_KEYS.REGISTRATIONS), []); }
function saveRegistrations(arr) { localStorage.setItem(LS_KEYS.REGISTRATIONS, JSON.stringify(arr)); }

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
}
window.scrollToSection = scrollToSection;


async function updateReports() {
  try {
    const [bookingsRes, regsRes] = await Promise.all([
      fetch(`${API_BASE}/bookings`),
      Promise.resolve({ json: () => loadRegistrations() }) // local fallback for registrations
    ]);

    const bookings = await bookingsRes.json();
    const regs = loadRegistrations();

    const totalEvents = qsa('.event-card').length || 0;
    const totalParticipants = regs.length;
    const slotsBooked = bookings.length;

    const sportCount = bookings.reduce((acc, b) => {
      if (!b.sport) return acc;
      acc[b.sport] = (acc[b.sport] || 0) + 1;
      return acc;
    }, {});
    const mostPopularSport = Object.keys(sportCount).length
      ? Object.entries(sportCount).sort((a, b) => b[1] - a[1])[0][0]
      : 'Football';

    qsa('.report-card').forEach(card => {
      const heading = (qs('h3', card)?.textContent || '').toLowerCase();
      if (heading.includes('total events')) {
        qs('p', card).textContent = totalEvents;
      } else if (heading.includes('total participants')) {
        qs('p', card).textContent = totalParticipants;
      } else if (heading.includes('slots booked')) {
        qs('p', card).textContent = slotsBooked;
      } else if (heading.includes('most popular sport')) {
        qs('p', card).textContent = mostPopularSport;
      }
    });
  } catch (err) {
    console.error("Report update error:", err);
  }
}


function initBookingForm() {
  const form = qs('.booking-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sport = form.querySelector('select')?.value || '';
    const date = form.querySelector('input[type="date"]')?.value || '';
    const time = form.querySelector('input[type="time"]')?.value || '';
    const user = localStorage.getItem("user") || "guest";

    if (!sport || !date || !time) return;

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, date, time, user })
      });

      const data = await res.json();
      if (res.ok) {
        alert(`🎯 Slot booked successfully for ${sport} on ${date} at ${time}!`);
        form.reset();
        updateReports();
      } else {
        alert("❌ Failed to book slot: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("⚠️ Could not connect to server. Please ensure backend is running.");
    }
  });
}

function initEventRegistrationForm() {
  const form = qs('.event-register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const select = form.querySelector('select');
    const name = form.querySelector('input[type="text"]')?.value?.trim();
    const email = form.querySelector('input[type="email"]')?.value?.trim();
    const phone = form.querySelector('input[type="tel"]')?.value?.trim();

    if (!select?.value || !name || !email || !phone) return;

    if (!/^\d{10}$/.test(phone)) {
      alert('Please enter a valid 10-digit contact number.');
      return;
    }

    const reg = {
      id: 'r_' + Date.now(),
      event: select.value,
      name,
      email,
      phone,
      createdAt: new Date().toISOString()
    };

    // Save locally (no backend endpoint yet)
    const regs = loadRegistrations();
    regs.push(reg);
    saveRegistrations(regs);

    alert(`✅ Registered ${name} to "${select.value}" successfully!`);
    form.reset();
    updateReports();
  });
}


function createModal({ title, htmlContent, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'sas-modal-overlay';
  overlay.style = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.6); z-index:2000; padding:20px;
  `;

  const box = document.createElement('div');
  box.className = 'sas-modal';
  box.style = `
    background:white; color:#111; border-radius:10px; max-width:700px; width:100%;
    padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.3);
  `;
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0">${title}</h3>
      <button aria-label="Close modal" class="sas-modal-close" style="background:none;border:none;font-size:20px;cursor:pointer">✖</button>
    </div>
    <div style="margin-top:12px">${htmlContent}</div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    try { document.body.removeChild(overlay); } catch {}
    if (typeof onClose === 'function') onClose();
  }

  qs('.sas-modal-close', box).addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });

  return { close, overlay, box };
}


function initSportsCards() {
  const cards = qsa('.sports-grid .card');
  if (!cards.length) return;

  cards.forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const sport = (qs('h3', card)?.textContent || qs('img', card)?.alt || 'Sport').trim();

      const content = `
        <p style="margin:8px 0">You selected <strong>${sport}</strong>.</p>
        <p style="margin:8px 0">Quick actions:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="sas-book-now" style="background:#ffdd57;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">Book Slot for ${sport}</button>
          <button id="sas-view-info" style="background:#eee;border:none;padding:8px 12px;border-radius:6px;cursor:pointer">View Sport Info</button>
        </div>
      `;

      const modal = createModal({ title: sport, htmlContent: content });

      const btnBook = qs('#sas-book-now', modal.box);
      if (btnBook) {
        btnBook.addEventListener('click', () => {
          modal.close();
          const select = qs('.booking-form select');
          if (select) {
            select.value = sport;
            scrollToSection('slots');
            setTimeout(() => qs('.booking-form input[type="date"]')?.focus(), 500);
          } else {
            alert('Booking form not found on this page.');
          }
        });
      }

      const btnInfo = qs('#sas-view-info', modal.box);
      if (btnInfo) {
        btnInfo.addEventListener('click', () => {
          alert(`${sport} is a great sport — have fun!`);
        });
      }
    });
  });
}

function initEventSlider() {
  const slider = qs('.event-slide');
  if (!slider) return;
  if (!slider.dataset.duplicated) {
    const slideContent = slider.innerHTML;
    slider.innerHTML += slideContent;
    slider.dataset.duplicated = 'true';
  }
  const parent = slider.parentElement;
  if (parent) {
    parent.addEventListener('mouseenter', () => {
      slider.style.animationPlayState = 'paused';
    });
    parent.addEventListener('mouseleave', () => {
      slider.style.animationPlayState = 'running';
    });
  }
}

function initNavHighlighting() {
  const navLinks = qsa('header nav a[href^="#"]');
  const sections = navLinks.map(a => {
    const id = a.getAttribute('href')?.slice(1);
    return { link: a, section: id ? document.getElementById(id) : null };
  });
  function onScroll() {
    const y = window.scrollY + (window.innerHeight * 0.2);
    let found = null;
    for (const pair of sections) {
      const el = pair.section;
      if (!el) continue;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (y >= top && y < bottom) { found = pair; break; }
    }
    sections.forEach(p => p.link.classList.toggle('active', p === found));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initFloatingBgRandomizer() {
  const nodes = qsa('.floating-bg span');
  if (!nodes.length) return;
  nodes.forEach((n) => {
    const delay = Math.random() * 12;
    const scale = 1 + Math.random() * 0.8;
    n.style.animationDelay = `${delay}s`;
    n.style.transform = `scale(${scale})`;
  });
  setInterval(() => {
    nodes.forEach((n) => {
      n.style.left = `${10 + Math.random() * 80}%`;
      n.style.top = `${5 + Math.random() * 85}%`;
    });
  }, 8000);
}

function initHeaderScrollEffect() {
  const header = qs('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.style.padding = '8px 20px';
      header.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
    } else {
      header.style.padding = '15px 30px';
      header.style.boxShadow = 'none';
    }
  }, { passive: true });
}

function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      scrollToSection('slots');
      qs('.booking-form select')?.focus();
    }
  });
}

function initDetailedReports() {
  const btn = document.getElementById('view-detailed-reports');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const bookingsRes = await fetch(`${API_BASE}/bookings`);
    const bookings = await bookingsRes.json();
    const regs = loadRegistrations();

    const sportCount = bookings.reduce((acc, b) => {
      acc[b.sport] = (acc[b.sport] || 0) + 1;
      return acc;
    }, {});
    let sportList = Object.entries(sportCount)
      .map(([sport, count]) => `<li>${sport}: ${count}</li>`)
      .join('') || '<li>No bookings yet</li>';

    let eventsList = qsa('.event-card')
      .map(card => `<li>${qs('h3', card).textContent} — ${qs('p', card).textContent}</li>`)
      .join('');

    let participants = regs.map(r => `<li>${r.name} (${r.event})</li>`).join('') || '<li>No participants yet</li>';

    createModal({
      title: 'Detailed Reports',
      htmlContent: `
        <h4>Bookings per Sport</h4>
        <ul>${sportList}</ul>
        <h4>Upcoming Events</h4>
        <ul>${eventsList}</ul>
        <h4>Registered Participants</h4>
        <ul>${participants}</ul>
      `
    });
  });
}

// ---------------------------
// Initialize All
// ---------------------------
function initAll() {
  initBookingForm();
  initEventRegistrationForm();
  initEventSlider();
  initSportsCards();
  initNavHighlighting();
  initFloatingBgRandomizer();
  initHeaderScrollEffect();
  initKeyboardShortcuts();
  initDetailedReports();
  updateReports();

  document.querySelectorAll('.fade-in, .fade-up, .zoom').forEach((el, idx) => {
    el.style.animationDelay = `${Math.min(0.8, idx * 0.05)}s`;
  });

  setTimeout(() => qs('.hero button')?.classList.add('visible'), 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
