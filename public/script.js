/* ===== NAVBAR SCROLL EFFECT ===== */
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
});

/* ===== COUNTDOWN ===== */
function updateCountdown() {
  const wedding = new Date('2026-10-17T17:00:00');
  const now = new Date();
  const diff = wedding - now;

  if (diff <= 0) {
    ['days', 'hours', 'minutes', 'seconds'].forEach(u => {
      document.getElementById(`cd-${u}`).textContent = '0';
    });
    return;
  }

  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000)  / 60000);
  const seconds = Math.floor((diff % 60000)    / 1000);

  document.getElementById('cd-days').textContent    = days;
  document.getElementById('cd-hours').textContent   = hours;
  document.getElementById('cd-minutes').textContent = minutes;
  document.getElementById('cd-seconds').textContent = seconds;
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ===== RSVP FLOW ===== */
let currentGuestId   = null;
let currentGuestType = null;
let currentNames     = { person1: '', person2: '' };

const guestSelect = document.getElementById('guest-select');
const btnNext     = document.getElementById('btn-next');
const btnBack     = document.getElementById('btn-back');
const btnSubmit   = document.getElementById('btn-submit');
const formError   = document.getElementById('form-error');

const stepSelect  = document.getElementById('step-select');
const stepForm    = document.getElementById('step-form');
const stepConfirm = document.getElementById('step-confirm');

const person1Section       = document.getElementById('person1-section');
const person1Header        = document.getElementById('person1-header');
const plusOneQuestion      = document.getElementById('plus-one-question');
const person2Section       = document.getElementById('person2-section');
const person2NameInputWrap = document.getElementById('person2-name-input-wrap');
const singleAttendSection  = document.getElementById('single-attend-section');
const coupleAttendSection  = document.getElementById('couple-attend-section');

/* Parse "Joe & Stenia Kurpiel" → { person1: "Joe Kurpiel", person2: "Stenia Kurpiel" } */
function parseCoupleName(name) {
  const t = name.trim();

  // "Godinez Family (Fermin/Margaret/kids)"
  if (t.includes('(') && t.includes('/')) {
    const m = t.match(/\(([^/]+)\/([^/\)]+)/);
    if (m) {
      const ln = t.split(' ')[0];
      return { person1: `${m[1].trim()} ${ln}`, person2: `${m[2].trim()} ${ln}` };
    }
  }

  if (!t.includes(' & ')) return { person1: t, person2: 'Guest 2' };

  const [left, right] = t.split(' & ');
  const lw = left.trim().split(' ');
  const rw = right.trim().split(' ');

  if (lw.length === 1 && rw.length === 1) {
    // "Fran & Rudy" — first names only
    return { person1: left.trim(), person2: right.trim() };
  }
  if (lw.length === 1 && rw.length >= 2) {
    // "Joe & Stenia Kurpiel" — shared last name in right part
    const ln = rw[rw.length - 1];
    const fn2 = rw.slice(0, -1).join(' ');
    return { person1: `${left.trim()} ${ln}`, person2: `${fn2} ${ln}` };
  }
  // "Ewa Rutkowska & John Kurpiel" — both have last names
  return { person1: left.trim(), person2: right.trim() };
}

async function loadGuests() {
  try {
    const res = await fetch('/api/guests');
    const guests = await res.json();
    guestSelect.innerHTML = '<option value="">— Select your name —</option>';
    guests.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      guestSelect.appendChild(opt);
    });
    if (!guests.length) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = 'All guests have RSVPed!';
      guestSelect.appendChild(opt);
    }
  } catch {
    showError('Unable to load guest list. Please refresh the page.');
  }
}

guestSelect.addEventListener('change', () => {
  btnNext.disabled = !guestSelect.value;
});

btnNext.addEventListener('click', async () => {
  const id = guestSelect.value;
  if (!id) return;
  try {
    const res = await fetch(`/api/guest/${id}`);
    if (!res.ok) {
      const data = await res.json();
      showError(data.error || 'Something went wrong.');
      loadGuests(); guestSelect.value = ''; btnNext.disabled = true;
      return;
    }
    const guest = await res.json();
    currentGuestId   = guest.id;
    currentGuestType = guest.type;
    currentNames     = guest.type === 'C'
      ? parseCoupleName(guest.name)
      : { person1: guest.name, person2: '' };

    document.getElementById('guest-name-display').textContent = guest.name;
    resetForm();

    if (guest.type === 'C') {
      singleAttendSection.classList.add('hidden');
      coupleAttendSection.classList.remove('hidden');
      document.getElementById('p1-attend-label').textContent = currentNames.person1;
      document.getElementById('p2-attend-label').textContent = currentNames.person2;
    } else {
      singleAttendSection.classList.remove('hidden');
      coupleAttendSection.classList.add('hidden');
    }

    showStep(stepForm);
  } catch {
    showError('Unable to load guest details. Please try again.');
  }
});

btnBack.addEventListener('click', () => { showStep(stepSelect); resetForm(); });

/* Attending toggle — N/Y types */
document.querySelectorAll('input[name="attending"]').forEach(r => {
  r.addEventListener('change', () => {
    hideError();
    const attending = r.value === 'yes';
    person1Section.classList.toggle('hidden', !attending);
    if (attending) {
      person1Header.classList.add('hidden');
      document.getElementById('person1-label').textContent = currentNames.person1;
      if (currentGuestType === 'Y') {
        plusOneQuestion.classList.remove('hidden');
        person2Section.classList.add('hidden');
      }
    } else {
      plusOneQuestion.classList.add('hidden');
      person2Section.classList.add('hidden');
      document.querySelectorAll('input[name="bring_plus_one"]').forEach(x => x.checked = false);
    }
  });
});

/* Per-person attending — C type */
document.querySelectorAll('input[name="person1_attending"]').forEach(r => {
  r.addEventListener('change', () => {
    hideError();
    const attending = r.value === 'yes';
    person1Section.classList.toggle('hidden', !attending);
    if (attending) {
      person1Header.classList.remove('hidden');
      document.getElementById('person1-label').textContent = currentNames.person1;
    }
  });
});

document.querySelectorAll('input[name="person2_attending"]').forEach(r => {
  r.addEventListener('change', () => {
    hideError();
    const attending = r.value === 'yes';
    person2Section.classList.toggle('hidden', !attending);
    if (attending) {
      person2NameInputWrap.classList.add('hidden');
      document.getElementById('person2-label').textContent = currentNames.person2;
    } else {
      document.querySelectorAll('input[name="meal2"]').forEach(x => x.checked = false);
      document.getElementById('dietary2').value = '';
    }
  });
});

/* Plus one question (Y type) */
document.querySelectorAll('input[name="bring_plus_one"]').forEach(r => {
  r.addEventListener('change', () => {
    hideError();
    if (r.value === 'yes') {
      person2Section.classList.remove('hidden');
      person2NameInputWrap.classList.remove('hidden');
      document.getElementById('person2-label').textContent = 'Plus One';
    } else {
      person2Section.classList.add('hidden');
      document.getElementById('person2-name-input').value = '';
      document.querySelectorAll('input[name="meal2"]').forEach(x => x.checked = false);
      document.getElementById('dietary2').value = '';
    }
  });
});

/* Live-update person 2 label as name is typed (Y type) */
document.getElementById('person2-name-input').addEventListener('input', e => {
  document.getElementById('person2-label').textContent = e.target.value.trim() || 'Plus One';
});

btnSubmit.addEventListener('click', async () => {
  hideError();

  let attending = false;
  let meal1 = null, dietary1 = null;
  let bring_plus_one = false, person2_name = null, meal2 = null, dietary2 = null;

  if (currentGuestType === 'C') {
    const p1El = document.querySelector('input[name="person1_attending"]:checked');
    const p2El = document.querySelector('input[name="person2_attending"]:checked');
    if (!p1El) { showError(`Please indicate if ${currentNames.person1} will be attending.`); return; }
    if (!p2El) { showError(`Please indicate if ${currentNames.person2} will be attending.`); return; }

    attending      = p1El.value === 'yes';
    bring_plus_one = p2El.value === 'yes';

    if (attending) {
      const m1 = document.querySelector('input[name="meal1"]:checked');
      if (!m1) { showError(`Please select a meal for ${currentNames.person1}.`); return; }
      meal1    = m1.value;
      dietary1 = document.getElementById('dietary1').value.trim() || null;
    }
    if (bring_plus_one) {
      person2_name = currentNames.person2;
      const m2 = document.querySelector('input[name="meal2"]:checked');
      if (!m2) { showError(`Please select a meal for ${currentNames.person2}.`); return; }
      meal2    = m2.value;
      dietary2 = document.getElementById('dietary2').value.trim() || null;
    }
  } else {
    const attendingEl = document.querySelector('input[name="attending"]:checked');
    if (!attendingEl) { showError('Please indicate whether you will be attending.'); return; }
    attending = attendingEl.value === 'yes';

    if (attending) {
      const m1 = document.querySelector('input[name="meal1"]:checked');
      if (!m1) { showError('Please select your meal choice.'); return; }
      meal1    = m1.value;
      dietary1 = document.getElementById('dietary1').value.trim() || null;

      if (currentGuestType === 'Y') {
        const poEl = document.querySelector('input[name="bring_plus_one"]:checked');
        if (!poEl) { showError('Please indicate whether you will be bringing a plus one.'); return; }
        bring_plus_one = poEl.value === 'yes';

        if (bring_plus_one) {
          person2_name = document.getElementById('person2-name-input').value.trim();
          if (!person2_name) { showError("Please enter your plus one's name."); return; }
          const m2 = document.querySelector('input[name="meal2"]:checked');
          if (!m2) { showError("Please select a meal for your plus one."); return; }
          meal2    = m2.value;
          dietary2 = document.getElementById('dietary2').value.trim() || null;
        }
      }
    }
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_id: currentGuestId, attending, meal1, dietary1, bring_plus_one, person2_name, meal2, dietary2 }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      btnSubmit.disabled = false; btnSubmit.textContent = 'Submit RSVP';
      return;
    }
    const msg = attending
      ? `We can't wait to celebrate with you! Your RSVP has been received — see you October 17th at Royal Palms Resort & Spa.`
      : `Thank you for letting us know, ${data.name}. We'll miss you and hope to celebrate together another time!`;
    document.getElementById('confirm-message').textContent = msg;
    showStep(stepConfirm);
    loadGuests();
  } catch {
    showError('Network error. Please check your connection and try again.');
    btnSubmit.disabled = false; btnSubmit.textContent = 'Submit RSVP';
  }
});

function showStep(step) {
  [stepSelect, stepForm, stepConfirm].forEach(s => s.classList.add('hidden'));
  step.classList.remove('hidden');
}

function resetForm() {
  document.querySelectorAll(
    'input[name="attending"], input[name="person1_attending"], input[name="person2_attending"], ' +
    'input[name="meal1"], input[name="meal2"], input[name="bring_plus_one"]'
  ).forEach(r => r.checked = false);
  document.getElementById('person2-name-input').value = '';
  document.getElementById('dietary1').value = '';
  document.getElementById('dietary2').value = '';
  document.getElementById('person1-label').textContent = '';
  document.getElementById('person2-label').textContent = 'Plus One';
  person1Section.classList.add('hidden');
  person1Header.classList.add('hidden');
  plusOneQuestion.classList.add('hidden');
  person2Section.classList.add('hidden');
  person2NameInputWrap.classList.add('hidden');
  coupleAttendSection.classList.add('hidden');
  singleAttendSection.classList.remove('hidden');
  hideError();
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Submit RSVP';
}

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
  formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() { formError.classList.add('hidden'); }

/* ===== INIT ===== */
loadGuests();

/* ===== LIGHTBOX ===== */
let openLightbox = null;
(function () {
  const slides  = [...document.querySelectorAll('.car-slide')];
  const lb      = document.getElementById('lightbox');
  const lbImg   = document.getElementById('lb-img');
  const lbCount = document.getElementById('lb-counter');
  let current   = 0;

  openLightbox = function (index) {
    current = index;
    lbImg.src = slides[index].querySelector('img').src;
    lbImg.alt = slides[index].querySelector('img').alt;
    lbCount.textContent = `${index + 1} / ${slides.length}`;
    lb.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  function close() {
    lb.classList.add('hidden');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function navigate(dir) {
    current = (current + dir + slides.length) % slides.length;
    lbImg.src = '';
    lbImg.src = slides[current].querySelector('img').src;
    lbImg.alt = slides[current].querySelector('img').alt;
    lbCount.textContent = `${current + 1} / ${slides.length}`;
  }

  document.getElementById('lb-close').addEventListener('click', close);
  document.getElementById('lb-prev').addEventListener('click', (e) => { e.stopPropagation(); navigate(-1); });
  document.getElementById('lb-next').addEventListener('click', (e) => { e.stopPropagation(); navigate(1); });
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });

  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('hidden')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowRight') navigate(1);
    if (e.key === 'ArrowLeft')  navigate(-1);
  });
})();

/* ===== CAROUSEL ===== */
(function () {
  const slides  = [...document.querySelectorAll('.car-slide')];
  const dots    = [...document.querySelectorAll('.car-dot')];
  const counter = document.getElementById('car-counter');
  const total   = slides.length;
  let current   = 0;
  let timer     = null;

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + total) % total;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
    counter.textContent = `${current + 1} / ${total}`;
  }

  function startAuto() { timer = setInterval(() => goTo(current + 1), 5000); }
  function stopAuto()  { clearInterval(timer); }
  function resetAuto() { stopAuto(); startAuto(); }

  document.getElementById('car-prev').addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); resetAuto(); });
  document.getElementById('car-next').addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); resetAuto(); });

  dots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); resetAuto(); }));

  const track = document.getElementById('car-track');
  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  track.addEventListener('click', () => { if (openLightbox) openLightbox(current); });

  /* touch swipe */
  let touchX = 0;
  track.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { goTo(dx < 0 ? current + 1 : current - 1); resetAuto(); }
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft')  { goTo(current - 1); resetAuto(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); resetAuto(); }
  });

  startAuto();
})();
