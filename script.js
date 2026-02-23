/* ============================================================
   Hotel Luxe — script.js
   Handles: nav scroll, room filters, booking bar, form validation,
            price summary, card formatting, confirm modal, animations
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------
    // 0. DYNAMIC PRICING SYNC
    // ----------------------------------------------------------
    async function getPricing() {
        if (!window.supabaseClient) return { prices: { single: 180, deluxe: 320, family: 420 } };
        const { data } = await window.supabaseClient.from('settings').select('prices').eq('id', 1).single();
        return data || { prices: { single: 180, deluxe: 320, family: 420 } };
    }

    async function applyDynamicPricing() {
        const config = await getPricing();

        // 1. Update Room Cards (index.html / rooms.html)
        document.querySelectorAll('.room-card').forEach(card => {
            const name = card.querySelector('.room-name')?.textContent.toLowerCase();
            const amountEl = card.querySelector('.amount');
            const bookBtn = card.querySelector('.btn-book');

            let price = 0;
            if (name?.includes('single')) price = config.prices.single;
            else if (name?.includes('deluxe')) price = config.prices.deluxe;
            else if (name?.includes('family')) price = config.prices.family;

            if (price > 0) {
                if (amountEl) amountEl.textContent = `₱${price}`;
                if (bookBtn) {
                    const url = new URL(bookBtn.href, window.location.origin);
                    url.searchParams.set('price', price);
                    bookBtn.href = url.pathname + url.search;
                }
            }
        });

        // 2. Update Booking Page Select Options
        const roomSel = document.getElementById('b-room');
        if (roomSel) {
            [...roomSel.options].forEach(opt => {
                const val = opt.value.toLowerCase();
                if (val.includes('single')) opt.dataset.price = config.prices.single;
                else if (val.includes('deluxe')) opt.dataset.price = config.prices.deluxe;
                else if (val.includes('family')) opt.dataset.price = config.prices.family;
            });
            updatePriceSummary();
        }
    }

    applyDynamicPricing();

    // ----------------------------------------------------------
    // 1. NAVBAR SCROLL EFFECT
    // ----------------------------------------------------------
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        }, { passive: true });
    }

    // ----------------------------------------------------------
    // 2. HAMBURGER MENU (mobile)
    // ----------------------------------------------------------
    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) navLinks.classList.toggle('mobile-open');
        });
    }

    // ----------------------------------------------------------
    // 3. SCROLL-REVEAL ANIMATIONS
    // ----------------------------------------------------------
    const revealEls = document.querySelectorAll('.reveal');
    if (revealEls.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    // Stagger siblings within the same parent
                    const siblings = [...entry.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
                    const delay = siblings.indexOf(entry.target) * 80;
                    setTimeout(() => entry.target.classList.add('visible'), delay);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        revealEls.forEach(el => observer.observe(el));
    }

    // ----------------------------------------------------------
    // 4. STATS COUNTER ANIMATION
    // ----------------------------------------------------------
    const statNums = document.querySelectorAll('.number[data-count]');
    if (statNums.length) {
        const counterObs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    counterObs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        statNums.forEach(el => counterObs.observe(el));
    }

    function animateCounter(el) {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.count >= 100 ? '' : '';
        const duration = 1800;
        const start = performance.now();
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target) + (progress < 1 ? '' : '');
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // ----------------------------------------------------------
    // 5. ROOM FILTER TABS (rooms.html)
    // ----------------------------------------------------------
    const filterTabs = document.querySelectorAll('.filter-tab');
    const roomCards = document.querySelectorAll('.room-card[data-category]');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.dataset.filter;
            roomCards.forEach(card => {
                const match = filter === 'all' || card.dataset.category === filter;
                card.style.display = match ? 'block' : 'none';
                if (match) {
                    card.style.animation = 'none';
                    card.offsetHeight; // reflow
                    card.style.animation = 'fadeInUp 0.4s ease forwards';
                }
            });
        });
    });

    // ----------------------------------------------------------
    // 6. BOOKING BAR — Date Defaults (index.html)
    // ----------------------------------------------------------
    const checkinEl = document.getElementById('checkin');
    const checkoutEl = document.getElementById('checkout');

    if (checkinEl && checkoutEl) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(today);
        dayAfter.setDate(dayAfter.getDate() + 3);

        checkinEl.value = formatDate(tomorrow);
        checkoutEl.value = formatDate(dayAfter);
        checkinEl.min = formatDate(today);
        checkoutEl.min = formatDate(tomorrow);

        checkinEl.addEventListener('change', () => {
            const newMin = new Date(checkinEl.value);
            newMin.setDate(newMin.getDate() + 1);
            checkoutEl.min = formatDate(newMin);
            if (new Date(checkoutEl.value) <= new Date(checkinEl.value)) {
                checkoutEl.value = formatDate(newMin);
            }
        });
    }

    // ----------------------------------------------------------
    // 7. BOOKING FORM — Pre-fill from URL params (booking.html)
    // ----------------------------------------------------------
    const bookingRoom = document.getElementById('b-room');
    if (bookingRoom) {
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        const priceParam = params.get('price');

        if (roomParam) {
            [...bookingRoom.options].forEach(opt => {
                if (opt.value === roomParam) opt.selected = true;
            });
        }

        // Set today/tomorrow defaults for booking form dates
        const bCheckin = document.getElementById('b-checkin');
        const bCheckout = document.getElementById('b-checkout');
        if (bCheckin && bCheckout) {
            const today = new Date();
            const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 3);
            bCheckin.value = formatDate(tomorrow);
            bCheckout.value = formatDate(dayAfter);
            bCheckin.min = formatDate(today);
            bCheckout.min = formatDate(tomorrow);

            bCheckin.addEventListener('change', () => {
                const newMin = new Date(bCheckin.value);
                newMin.setDate(newMin.getDate() + 1);
                bCheckout.min = formatDate(newMin);
                if (new Date(bCheckout.value) <= new Date(bCheckin.value)) {
                    bCheckout.value = formatDate(newMin);
                }
                updatePriceSummary();
            });

            bCheckout.addEventListener('change', updatePriceSummary);
        }

        bookingRoom.addEventListener('change', updatePriceSummary);
        document.getElementById('b-addons')?.addEventListener('change', updatePriceSummary);

        // Initial update
        updatePriceSummary();
    }

    // ----------------------------------------------------------
    // 8. CARD NUMBER FORMATTING
    // ----------------------------------------------------------


}); // end DOMContentLoaded

// ----------------------------------------------------------
// HELPERS
// ----------------------------------------------------------
function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getNights() {
    const ci = document.getElementById('b-checkin')?.value;
    const co = document.getElementById('b-checkout')?.value;
    if (!ci || !co) return 1;
    const diff = (new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24);
    return diff > 0 ? diff : 1;
}

// ----------------------------------------------------------
// UPDATE PRICE SUMMARY
// ----------------------------------------------------------
function updatePriceSummary() {
    const roomSel = document.getElementById('b-room');
    const addonSel = document.getElementById('b-addons');
    if (!roomSel) return;

    const selectedOpt = roomSel.options[roomSel.selectedIndex];
    const roomName = selectedOpt.value;
    const roomPrice = parseInt(selectedOpt.dataset.price, 10) || 0;
    const roomImg = selectedOpt.dataset.img || '';
    const nights = getNights();

    const addonOpt = addonSel?.options[addonSel.selectedIndex];
    const addonCost = parseInt(addonOpt?.dataset.cost, 10) || 0;
    const addonName = addonOpt?.value !== 'none' ? addonOpt?.text.split(' —')[0] : null;

    const config = JSON.parse(localStorage.getItem('dhv_config') || '{"taxRate":0}');
    const subtotal = roomPrice * nights + addonCost;
    const total = subtotal;

    // Update preview image
    const preview = document.getElementById('roomPreview');
    const previewImg = document.getElementById('roomPreviewImg');
    if (preview && previewImg) {
        if (roomImg) {
            previewImg.src = roomImg;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    // Update room name
    const summaryName = document.getElementById('summaryRoomName');
    if (summaryName) {
        summaryName.textContent = roomName || 'Select a room to see summary';
        summaryName.style.color = roomName ? 'var(--text-primary)' : 'var(--text-muted)';
    }

    const show = (id, visible) => {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? 'flex' : 'none';
    };
    const text = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    if (roomName && roomPrice) {
        show('priceNight', true);
        show('priceNights', true);
        show('priceTax', true);
        show('priceDivider', true);
        show('priceTotal', true);
        text('pricePerNightLabel', `${roomName}`);
        text('pricePerNightVal', `₱${roomPrice}/night`);
        text('nightsLabel', `× ${nights} night${nights > 1 ? 's' : ''}`);
        text('nightsVal', `₱${roomPrice * nights}`);

        if (addonName && addonCost) {
            show('priceAddon', true);
            text('addonLabel', addonName);
            text('addonVal', `+₱${addonCost}`);
        } else {
            show('priceAddon', false);
        }

        text('totalVal', `₱${total}`);
    } else {
        ['priceNight', 'priceNights', 'priceAddon', 'priceTax', 'priceDivider', 'priceTotal'].forEach(id => show(id, false));
    }
}

// ----------------------------------------------------------
// HERO SEARCH HANDLER
// ----------------------------------------------------------
function handleHeroSearch() {
    const ci = document.getElementById('checkin')?.value;
    const co = document.getElementById('checkout')?.value;
    const guests = document.getElementById('guests')?.value;
    const roomType = document.getElementById('room-type')?.value;

    if (!ci || !co) {
        alert('Please select check-in and check-out dates.');
        return;
    }
    if (new Date(co) <= new Date(ci)) {
        alert('Check-out must be after check-in.');
        return;
    }

    const params = new URLSearchParams({ checkin: ci, checkout: co, guests, room: roomType });
    window.location.href = `rooms.html?${params}`;
}

// ----------------------------------------------------------
// BOOKING FORM VALIDATION + SUBMIT
// ----------------------------------------------------------
function handleBookingSubmit() {
    let valid = true;

    function validateField(groupId, inputId, condition, errMsg) {
        const group = document.getElementById(groupId);
        const input = document.getElementById(inputId);
        if (!group || !input) return;
        const errEl = group.querySelector('.error-msg');
        if (!condition(input.value)) {
            group.classList.add('has-error');
            if (input) input.classList.add('error');
            valid = false;
        } else {
            group.classList.remove('has-error');
            if (input) input.classList.remove('error');
        }
    }

    const ci = document.getElementById('b-checkin')?.value;
    const co = document.getElementById('b-checkout')?.value;

    validateField('fg-checkin', 'b-checkin', v => !!v, '');
    validateField('fg-checkout', 'b-checkout', v => !!v && (!ci || new Date(v) > new Date(ci)), '');
    validateField('fg-room', 'b-room', v => !!v, '');
    validateField('fg-firstname', 'b-firstname', v => v.trim().length >= 2, '');
    validateField('fg-lastname', 'b-lastname', v => v.trim().length >= 2, '');
    validateField('fg-email', 'b-email', v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), '');
    validateField('fg-phone', 'b-phone', v => v.trim().length >= 6, '');

    if (!valid) {
        const firstErr = document.querySelector('.has-error input, .has-error select');
        if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Success — collect booking details
    const ref = 'DHV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('bookingRef').textContent = `Ref: #${ref}`;

    const roomSel = document.getElementById('b-room');
    const roomOpt = roomSel?.options[roomSel.selectedIndex];
    const roomName = roomOpt?.value || 'Selected Room';
    const roomPrice = parseInt(roomOpt?.dataset.price, 10) || 0;
    const nights = getNights();
    const ci2 = document.getElementById('b-checkin')?.value;
    const co2 = document.getElementById('b-checkout')?.value;
    const firstName = document.getElementById('b-firstname')?.value || '';
    const lastName = document.getElementById('b-lastname')?.value || '';
    const email = document.getElementById('b-email')?.value || '';
    const phone = document.getElementById('b-phone')?.value || '';
    const guestName = `${firstName} ${lastName}`.trim();

    // Calculate total (matches price summary logic)
    const config = JSON.parse(localStorage.getItem('dhv_config') || '{"taxRate":0}');
    const addonSel = document.getElementById('b-addons');
    const addonCost = parseInt(addonSel?.options[addonSel?.selectedIndex]?.dataset?.cost, 10) || 0;
    const subtotal = roomPrice * nights + addonCost;
    const total = subtotal;

    // Save to localStorage
    const booking = {
        ref, guest: guestName, email, phone,
        room: roomName, checkin: ci2, checkout: co2,
        nights, amount: total, status: 'confirmed',
        createdAt: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem('dhv_bookings') || '[]');
    existing.unshift(booking);
    localStorage.setItem('dhv_bookings', JSON.stringify(existing));

    // Send email confirmation to the guest
    sendConfirmationEmail({
        ref,
        guest_name: guestName,
        email,
        room: roomName,
        checkin: ci2,
        checkout: co2,
        nights,
        amount: '₱' + total.toLocaleString(),
    });

    document.getElementById('bookingSummaryText').textContent =
        `${guestName} · ${roomName} · ${nights} night${nights > 1 ? 's' : ''} (${ci2} → ${co2})`;

    document.getElementById('confirmModal').classList.add('active');
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
    window.location.href = 'index.html';
}

// ----------------------------------------------------------
// EMAIL CONFIRMATION (EmailJS)
// ⚠️  Setup required — see instructions below
// ----------------------------------------------------------
function sendConfirmationEmail(data) {
    // ⚠️  Replace these two values after setting up EmailJS:
    //   SERVICE_ID  — from https://dashboard.emailjs.com/admin  (Email Services tab)
    //   TEMPLATE_ID — from https://dashboard.emailjs.com/admin  (Email Templates tab)
    const SERVICE_ID = 'service_mqs5wkg';
    const TEMPLATE_ID = 'template_6utwaf4';

    // Template variables sent to EmailJS:
    //  {{ref}}         Booking reference
    //  {{guest_name}}  Guest full name
    //  {{email}}       Guest email (used as "To" in the template)
    //  {{room}}        Room type booked
    //  {{checkin}}     Check-in date
    //  {{checkout}}    Check-out date
    //  {{nights}}      Number of nights
    //  {{amount}}      Total amount (e.g. $403)
    emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        ref: data.ref,
        guest_name: data.guest_name,
        email: data.email,
        room: data.room,
        checkin: data.checkin,
        checkout: data.checkout,
        nights: data.nights,
        amount: data.amount,
        hotel_name: "D'HILLSVIEW HOTEL",
    }).then(() => {
        console.log('✅ Confirmation email sent to', data.email);
    }).catch(err => {
        console.warn('Email send failed:', err);
    });
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') closeModal();
});

// ----------------------------------------------------------
// NAVBAR MOBILE OPEN STYLES (inject dynamically)
// ----------------------------------------------------------
const mobileStyle = document.createElement('style');
mobileStyle.textContent = `
  @media (max-width: 768px) {
    .nav-links.mobile-open {
      display: flex !important;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; right: 0;
      background: rgba(6,6,13,0.97);
      backdrop-filter: blur(20px);
      padding: 5rem 2rem 2rem;
      gap: 1.5rem;
      border-bottom: 1px solid var(--border);
      z-index: 999;
    }
    .nav-links.mobile-open a { font-size: 1.1rem; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(mobileStyle);
