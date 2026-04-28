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
let currentGuestId = null;
let guestHasPlusOne = false;

const guestSelect   = document.getElementById('guest-select');
const btnNext       = document.getElementById('btn-next');
const btnBack       = document.getElementById('btn-back');
const btnSubmit     = document.getElementById('btn-submit');

const stepSelect    = document.getElementById('step-select');
const stepForm      = document.getElementById('step-form');
const stepConfirm   = document.getElementById('step-confirm');

const mealSection   = document.getElementById('meal-section');
const plusOneSection = document.getElementById('plus-one-section');
const plusOneDetails = document.getElementById('plus-one-details');
const formError     = document.getElementById('form-error');

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

    if (guests.length === 0) {
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
      showError(data.error || 'Something went wrong. Please try again.');
      loadGuests();
      guestSelect.value = '';
      btnNext.disabled = true;
      return;
    }
    const guest = await res.json();
    currentGuestId = guest.id;
    guestHasPlusOne = guest.has_plus_one;

    document.getElementById('guest-name-display').textContent = guest.name;
    resetForm();

    showStep(stepForm);
  } catch {
    showError('Unable to load guest details. Please try again.');
  }
});

btnBack.addEventListener('click', () => {
  showStep(stepSelect);
  resetForm();
});

/* Attending radios */
document.querySelectorAll('input[name="attending"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const attending = radio.value === 'yes';
    mealSection.classList.toggle('hidden', !attending);
    plusOneSection.classList.toggle('hidden', !attending || !guestHasPlusOne);
    plusOneDetails.classList.add('hidden');
    document.querySelectorAll('input[name="plus_one"]').forEach(r => r.checked = false);
    hideError();
  });
});

/* Plus one radios */
document.querySelectorAll('input[name="plus_one"]').forEach(radio => {
  radio.addEventListener('change', () => {
    plusOneDetails.classList.toggle('hidden', radio.value !== 'yes');
    hideError();
  });
});

btnSubmit.addEventListener('click', async () => {
  hideError();

  const attendingRadio = document.querySelector('input[name="attending"]:checked');
  if (!attendingRadio) { showError('Please indicate whether you will be attending.'); return; }

  const attending = attendingRadio.value === 'yes';

  let meal_choice = null;
  let bring_plus_one = false;
  let plus_one_name = null;
  let plus_one_meal = null;

  if (attending) {
    const mealRadio = document.querySelector('input[name="meal"]:checked');
    if (!mealRadio) { showError('Please select your meal choice.'); return; }
    meal_choice = mealRadio.value;

    if (guestHasPlusOne) {
      const plusOneRadio = document.querySelector('input[name="plus_one"]:checked');
      if (!plusOneRadio) { showError('Please indicate whether you will be bringing a guest.'); return; }
      bring_plus_one = plusOneRadio.value === 'yes';

      if (bring_plus_one) {
        plus_one_name = document.getElementById('plus-one-name').value.trim();
        if (!plus_one_name) { showError("Please enter your guest's name."); return; }

        const pMeal = document.querySelector('input[name="plus_one_meal"]:checked');
        if (!pMeal) { showError("Please select a meal for your guest."); return; }
        plus_one_meal = pMeal.value;
      }
    }
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_id: currentGuestId,
        attending,
        meal_choice,
        bring_plus_one,
        plus_one_name,
        plus_one_meal,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit RSVP';
      return;
    }

    const confirmMsg = attending
      ? `We can't wait to celebrate with you, ${data.name}! Your RSVP has been received and we look forward to seeing you on October 17th at the Royal Palms Resort & Spa.`
      : `Thank you for letting us know, ${data.name}. We'll miss you and hope to celebrate with you another time!`;

    document.getElementById('confirm-message').textContent = confirmMsg;
    showStep(stepConfirm);
    loadGuests();
  } catch {
    showError('Network error. Please check your connection and try again.');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Submit RSVP';
  }
});

function showStep(step) {
  [stepSelect, stepForm, stepConfirm].forEach(s => s.classList.add('hidden'));
  step.classList.remove('hidden');
}

function resetForm() {
  document.querySelectorAll('input[name="attending"], input[name="meal"], input[name="plus_one"], input[name="plus_one_meal"]')
    .forEach(r => r.checked = false);
  document.getElementById('plus-one-name').value = '';
  mealSection.classList.add('hidden');
  plusOneSection.classList.add('hidden');
  plusOneDetails.classList.add('hidden');
  hideError();
  btnSubmit.disabled = false;
  btnSubmit.textContent = 'Submit RSVP';
}

function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
  formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  formError.classList.add('hidden');
}

/* ===== INIT ===== */
loadGuests();
