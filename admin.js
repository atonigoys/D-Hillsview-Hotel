// VERSION: 1.1.2 (Deployed: 2026-02-24 16:20)
/* ============================================================
   Hotel Luxe — admin.js
   Handles: auth check, tab switching, sidebar toggle, stats,
            booking filters, pricing persistence, and table rendering.
   ============================================================ */

console.log('🔄 Admin script loading... (v1.1.2 - Sticky Scrollbars & High Contrast)');
if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not found on load. Checking window...');
}

document.addEventListener('DOMContentLoaded', () => {
    // 0. AUTH CHECK
    if (sessionStorage.getItem('dhv_admin') !== 'true') {
        window.location.href = 'admin.html';
        return;
    }

    // 1. INITIAL LOAD
    refreshDashboard();

    // 2. REVENUE FILTER (Flatpickr Month Mode)
    initRevenueFilter();

    // 3. RBAC - Apply Permissions
    applyPermissions();

});

function applyPermissions() {
    const role = sessionStorage.getItem('dhv_role');
    if (!role) return;

    if (role === 'booking') {
        console.log('🛡️ Applying Booking Staff restrictions...');

        // Hide Restricted Sidebar items
        const restrictedPages = ['overview', 'rooms', 'rates', 'guests', 'settings'];
        restrictedPages.forEach(p => {
            const item = document.querySelector(`.nav-item[data-page="${p}"]`);
            if (item) item.style.display = 'none';
        });

        // Hide "Main" and "System" labels to keep it clean
        document.querySelectorAll('.nav-section-label').forEach(label => label.style.display = 'none');

        // Update User Profile
        const userName = document.querySelector('.user-name');
        const userRole = document.querySelector('.user-role');
        const userAvatar = document.querySelector('.user-avatar');

        if (userName) userName.textContent = 'Receptionist';
        if (userRole) userRole.textContent = 'Staff Access';
        if (userAvatar) {
            userAvatar.textContent = 'R';
            userAvatar.style.background = 'var(--blue)';
        }

        const topSub = document.getElementById('topbarSub');
        if (topSub) topSub.textContent = 'Welcome back, Receptionist';

        // Hide Topbar Actions (Revenue-related or New Booking if restricted)
        // Let's keep +New Booking since it's Booking Staff

        // Force switch to Bookings page as default
        const bookingTab = document.querySelector('.nav-item[data-page="bookings"]');
        if (bookingTab) switchPage(bookingTab, 'bookings');
    }
}

function initRevenueFilter() {
    const periodLabel = document.getElementById('currentPeriod');
    const labelWrap = document.getElementById('revenueDateLabel');

    if (periodLabel && labelWrap) {
        const picker = flatpickr("#revenueDate", {
            disableMobile: "true",
            static: true,
            monthSelectorType: "static",
            dateFormat: "F Y",
            onReady: function (selectedDates, dateStr, instance) {
                periodLabel.textContent = dateStr || "February 2026";
            },
            onChange: function (selectedDates, dateStr) {
                periodLabel.textContent = dateStr;
                refreshDashboard(selectedDates[0]);
            }
        });

        labelWrap.addEventListener('click', () => picker.open());
    }
}

// ----------------------------------------------------------
// PAGE NAVIGATION
// ----------------------------------------------------------
function switchPage(el, pageId) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');

    // Update Pages
    document.querySelectorAll('.dashboard-page').forEach(page => page.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');

    // Update Topbar
    const title = pageId.charAt(0).toUpperCase() + pageId.slice(1);
    document.getElementById('topbarTitle').textContent = title;

    // Special handling for specific pages
    if (pageId === 'overview') refreshDashboard();
    if (pageId === 'rooms') renderRoomsGrid();
    if (pageId === 'rates') renderRatesPage();

    // Reset Dropdowns if switching to a non-dropdown page
    if (pageId !== 'rates') {
        document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
    }
}

// ----------------------------------------------------------
// SIDEBAR DROPDOWNS
// ----------------------------------------------------------
function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    // Toggle logic
    dropdown.classList.toggle('open');

    // Close others
    document.querySelectorAll('.nav-dropdown').forEach(d => {
        if (d.id !== id) d.classList.remove('open');
    });
}

/**
 * Handle clicking the parent "Rates & Availability" item
 */
function handleRatesParentClick() {
    const dropdown = document.getElementById('ratesDropdown');
    const isAlreadyOpen = dropdown && dropdown.classList.contains('open');

    if (!isAlreadyOpen) {
        // Switch to default sub-page (Base Rates) and open
        switchRatesSubPage('base-rates');
    } else {
        // Just toggle/close if already open
        toggleDropdown('ratesDropdown');
    }
}

function switchRatesSubPage(tabId) {
    // 1. Switch to 'rates' page if not there
    const ratesNavItem = document.querySelector('#ratesDropdown .nav-item');
    switchPage(ratesNavItem, 'rates');

    // 2. Open dropdown
    const dropdown = document.getElementById('ratesDropdown');
    if (dropdown) dropdown.classList.add('open');

    // 3. Update Title & Highlight sub-item
    const subTitles = {
        'base-rates': 'Rates: Base Rates',
        'rate-plans': 'Rates: Rate Plans & Packages',
        'avail-matrix': 'Rates: Availability Matrix'
    };

    const titleEl = document.getElementById('topbarTitle');
    if (titleEl && subTitles[tabId]) titleEl.textContent = subTitles[tabId];

    document.querySelectorAll('.nav-sub-item').forEach(item => {
        item.classList.remove('active');
        const text = item.textContent.toLowerCase();
        if (text.includes(tabId.replace('-', ' '))) item.classList.add('active');
        if (tabId === 'base-rates' && text === 'base rates') item.classList.add('active');
        if (tabId === 'rate-plans' && text === 'rate plans & packages') item.classList.add('active');
        if (tabId === 'avail-matrix' && text === 'availability matrix') item.classList.add('active');
    });

    // 4. Trigger the actual sub-tab render
    const targetSubTabBtn = document.querySelector(`.rates-tab[onclick*="${tabId}"]`);
    if (targetSubTabBtn) {
        switchRatesTab(targetSubTabBtn, tabId);
    } else {
        // Fallback if no tab button found (shouldn't happen with correct tabId)
        if (tabId === 'avail-matrix') renderAvailMatrix(matrixStartDate);
    }
}

// ----------------------------------------------------------
// SIDEBAR TOGGLE (Mobile)
// ----------------------------------------------------------
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        const isShown = sidebar.style.transform === 'translateX(0px)';
        sidebar.style.transform = isShown ? 'translateX(-100%)' : 'translateX(0)';
    }
}

// ----------------------------------------------------------
// SIGN OUT
// ----------------------------------------------------------
function signOut() {
    sessionStorage.removeItem('dhv_admin');
    sessionStorage.removeItem('dhv_role');
    window.location.href = 'admin.html';
}

// ----------------------------------------------------------
// DASHBOARD DATA REFRESH
// ----------------------------------------------------------
async function refreshDashboard(targetDate = new Date()) {
    if (!window.supabaseClient) return;

    // Fetch Bookings
    const { data: bookings, error: bErr } = await window.supabaseClient
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

    // Fetch Settings
    const { data: config, error: cErr } = await window.supabaseClient
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (bErr || cErr) {
        console.warn('Refresh failed:', bErr || cErr);
        if (!bookings) bookings = [];
        if (!config) config = { prices: { single: 180, deluxe: 320, family: 420 }, inventory: { single: 10, deluxe: 10, family: 10 } };
    }

    // 1. Update Stats
    const totalRevenue = bookings.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    const guestCount = new Set(bookings.map(b => b.email)).size;
    const occupancy = bookings.length > 0 ? Math.min(Math.round((bookings.length / 50) * 100), 100) : 0;
    const pendingCount = bookings.filter(b => b.status === 'pending').length;

    if (document.getElementById('stat-revenue')) document.getElementById('stat-revenue').textContent = `₱${totalRevenue.toLocaleString()}`;
    if (document.getElementById('stat-bookings')) document.getElementById('stat-bookings').textContent = bookings.length;
    if (document.getElementById('stat-occupancy')) document.getElementById('stat-occupancy').textContent = `${occupancy}%`;
    if (document.getElementById('stat-guests')) document.getElementById('stat-guests').textContent = guestCount;

    // Update Table Header Counts
    if (document.getElementById('bookingCount')) document.getElementById('bookingCount').textContent = `${bookings.length} total`;
    if (document.getElementById('guestDirCount')) document.getElementById('guestDirCount').textContent = `${guestCount} registered guests`;

    // 2. Render Tables
    renderBookingsTable('overviewBookingBody', bookings.slice(0, 5));
    renderBookingsTable('allBookingBody', bookings);
    renderGuestsTable(bookings);

    // 3. Update Pricing Settings UI
    if (document.getElementById('price-single')) {
        document.getElementById('price-single').textContent = config.prices.single;
        document.getElementById('price-deluxe').textContent = config.prices.deluxe;
        document.getElementById('price-family').textContent = config.prices.family;
    }

    // 4. Update Notification Badge to actual Pending count
    const pendingBadge = document.getElementById('pendingBadge');
    if (pendingBadge) {
        pendingBadge.textContent = pendingCount;
    }

    // 5. Render Charts
    renderCharts(bookings, targetDate);
}

// ----------------------------------------------------------
// CHART RENDERING
// ----------------------------------------------------------
function renderCharts(bookings, viewDate = new Date()) {
    // A. REVENUE CHART (Last 7 Months from selection)
    const revenueEl = document.getElementById('revenueChart');
    if (revenueEl) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = viewDate;
        const last7 = [];

        // Prep 7 month slots
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            last7.push({
                label: monthNames[d.getMonth()],
                month: d.getMonth(),
                year: d.getFullYear(),
                val: 0
            });
        }

        // Sum up revenue
        bookings.forEach(b => {
            const bDate = new Date(b.created_at);
            const match = last7.find(m => m.month === bDate.getMonth() && m.year === bDate.getFullYear());
            if (match) match.val += (parseFloat(b.amount) || 0);
        });

        const maxVal = Math.max(...last7.map(m => m.val), 1000); // at least 1000 scale

        revenueEl.innerHTML = last7.map(m => {
            const height = (m.val / maxVal) * 100;
            return `
                <div class="bar-group">
                    <div class="bar-val">${m.val > 0 ? '₱' + Math.round(m.val / 1000) + 'k' : ''}</div>
                    <div class="bar" style="height: ${Math.max(height, 5)}%;" title="₱${m.val.toLocaleString()}"></div>
                    <div class="bar-label">${m.label}</div>
                </div>
            `;
        }).join('');
    }

    // B. DONUT CHART (Room Distribution)
    const donutPct = document.querySelector('.donut-center .pct');
    if (donutPct) {
        const counts = { single: 0, deluxe: 0, family: 0 };
        bookings.forEach(b => {
            const r = b.room.toLowerCase();
            if (r.includes('single')) counts.single++;
            else if (r.includes('deluxe')) counts.deluxe++;
            else if (r.includes('family')) counts.family++;
        });

        const total = bookings.length || 1; // avoid div by 0
        const sPct = Math.round((counts.single / total) * 100);
        const dPct = Math.round((counts.deluxe / total) * 100);
        const fPct = Math.round((counts.family / total) * 100);

        donutPct.textContent = bookings.length;

        // Update Legend
        const legendVals = document.querySelectorAll('.legend-val');
        if (legendVals.length >= 3) {
            legendVals[0].textContent = sPct + '%';
            legendVals[1].textContent = dPct + '%';
            legendVals[2].textContent = fPct + '%';
        }

        // Update SVG (Simple dash-array trick if we wanted, but let's stick to text for now)
    }
}

// ----------------------------------------------------------
// TABLE RENDERING
// ----------------------------------------------------------
function renderBookingsTable(tbodyId, data) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:var(--text-muted);">No bookings found</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(b => `
        <tr>
            <td style="font-weight:600; color:var(--gold);">#${b.ref}</td>
            <td>
                <div style="font-weight:500;">${b.guest}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${b.email}</div>
            </td>
            <td>${b.room}</td>
            <td>${b.checkin}</td>
            <td>${b.checkout}</td>
            ${tbodyId === 'allBookingBody' ? `<td>${b.nights}</td>` : ''}
            <td style="font-weight:600;">₱${(b.amount || 0).toLocaleString()}</td>
            <td><span class="badge ${b.status}">${b.status.charAt(0).toUpperCase() + b.status.slice(1)}</span></td>
            <td>
                <div style="display:flex; gap:0.4rem;">
                    ${b.status === 'pending' ? `<button class="topbar-btn" title="Confirm Booking" style="padding:0.4rem 0.6rem; color:var(--green);" onclick="confirmBooking('${b.ref}')">✅</button>` : ''}
                    ${b.status !== 'cancelled' ? `<button class="topbar-btn" title="Cancel Booking" style="padding:0.4rem 0.6rem;" onclick="cancelBooking('${b.ref}')">❌</button>` : ''}
                    <button class="topbar-btn" title="Delete Booking" style="padding:0.4rem 0.6rem; color:var(--red);" onclick="deleteBooking('${b.ref}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderGuestsTable(bookings) {
    const tbody = document.getElementById('guestsBody');
    if (!tbody) return;

    // Group bookings by guest email
    const guestsMap = {};
    bookings.forEach(b => {
        if (!guestsMap[b.email]) {
            guestsMap[b.email] = {
                guest: b.guest,
                email: b.email,
                phone: b.phone || 'N/A',
                totalStays: 0,
                totalSpent: 0,
                lastVisit: b.checkin
            };
        }
        guestsMap[b.email].totalStays += 1;
        guestsMap[b.email].totalSpent += (b.amount || 0);
        if (new Date(b.checkin) > new Date(guestsMap[b.email].lastVisit)) {
            guestsMap[b.email].lastVisit = b.checkin;
        }
    });

    const guests = Object.values(guestsMap);

    if (guests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No guests found</td></tr>`;
        return;
    }

    tbody.innerHTML = guests.map(g => `
        <tr>
            <td><div style="font-weight:600;">${g.guest}</div></td>
            <td>${g.email}</td>
            <td>${g.phone}</td>
            <td>${g.totalStays}</td>
            <td style="font-weight:600;">₱${g.totalSpent.toLocaleString()}</td>
            <td>${g.lastVisit}</td>
            <td>
                <button class="topbar-btn" style="padding:0.4rem 0.6rem;" onclick="showToast('View guest history for ${g.guest.replace(/'/g, "\\'")} coming soon', 'info')">👁️</button>
            </td>
        </tr>
    `).join('');
}

// ----------------------------------------------------------
// BOOKING ACTIONS
// ----------------------------------------------------------
async function confirmBooking(ref) {
    const ok = await showConfirm(`Are you sure you want to CONFIRM booking #${ref}?`, 'Confirm Booking', '✅');
    if (!ok) return;

    const { data: booking, error } = await window.supabaseClient
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('ref', ref)
        .select()
        .single();

    if (error) {
        showToast('Error confirming booking: ' + error.message, 'error');
        return;
    }

    // Trigger Email Confirmation
    sendConfirmationEmail({
        ref: booking.ref,
        guest_name: booking.guest,
        email: booking.email,
        room: booking.room,
        checkin: booking.checkin,
        checkout: booking.checkout,
        nights: booking.nights,
        amount: '₱' + (parseFloat(booking.amount) || 0).toLocaleString()
    });

    await refreshDashboard();
    showToast(`✅ Booking #${ref} confirmed and email sent!`);
}

function sendConfirmationEmail(data) {
    const SERVICE_ID = 'service_mqs5wkg';
    const TEMPLATE_ID = 'template_6utwaf4';

    emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        ref: data.ref,
        guest_name: data.guest_name,
        email: data.email,
        room: data.room,
        checkin: data.checkin,
        checkout: data.checkout,
        nights: data.nights,
        amount: data.amount,
        hotel_name: "D'HILLSVIEW HOTEL & RESTAURANT",
    }).then(() => {
        console.log('✅ Confirmation email sent to', data.email);
    }).catch(err => {
        console.warn('Email send failed:', err);
    });
}
async function cancelBooking(ref) {
    const ok = await showConfirm(`Are you sure you want to cancel booking #${ref}?`, 'Cancel Booking', '⚠️');
    if (!ok) return;

    const { error } = await window.supabaseClient
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('ref', ref);

    if (error) {
        showToast('Error cancelling booking: ' + error.message, 'error');
        return;
    }

    await refreshDashboard();
}

async function deleteBooking(ref) {
    const ok = await showConfirm(`CRITICAL: Are you sure you want to PERMANENTLY DELETE booking #${ref}?`, 'Delete Booking', '🗑️');
    if (!ok) return;

    const { error } = await window.supabaseClient
        .from('bookings')
        .delete()
        .eq('ref', ref);

    if (error) {
        showToast('Error deleting booking: ' + error.message, 'error');
        return;
    }

    await refreshDashboard();
}

// ----------------------------------------------------------
// SEARCH & FILTERS
// ----------------------------------------------------------
async function applyFilters() {
    const query = document.getElementById('bookingSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    const { data: allBookings, error } = await window.supabaseClient
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return;

    const filtered = allBookings.filter(b => {
        const matchesQuery = b.guest.toLowerCase().includes(query) || (b.ref && b.ref.toLowerCase().includes(query));
        const matchesStatus = status === 'all' || b.status === status;
        return matchesQuery && matchesStatus;
    });

    renderBookingsTable('allBookingBody', filtered);
    document.getElementById('bookingCount').textContent = `${filtered.length} total`;
}

// ----------------------------------------------------------
// ROOM INVENTORY MANAGEMENT
// ----------------------------------------------------------
async function renderRoomsGrid() {
    const grid = document.getElementById('adminRoomsGrid');
    if (!grid) return;

    const { data: config, error } = await window.supabaseClient
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) return;

    const rooms = [
        { id: 'single', name: 'Single Room', img: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=400&q=70' },
        { id: 'deluxe', name: 'Deluxe Room', img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=70' },
        { id: 'family', name: 'Family Room', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70' }
    ];

    grid.innerHTML = rooms.map(r => `
        <div class="admin-room-card">
            <div class="admin-room-img">
                <img src="${r.img}" alt="${r.name}">
                <div class="admin-room-status">
                    <span class="badge confirmed">Active</span>
                </div>
            </div>
            <div class="admin-room-body">
                <div class="admin-room-name">${r.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
                    Base Price: ₱${config.prices[r.id]} / night
                </div>
                
                <div style="background:rgba(255,255,255,0.03); padding:1.5rem 1.25rem; border-radius:12px; border:1px solid var(--border-light); transition:var(--transition);" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                    <label style="display:block; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--text-muted); margin-bottom:0.85rem; font-weight:600;">
                        Inventory Count
                    </label>
                    <div style="display:flex; gap:1rem; align-items:center;">
                        <input type="number" id="inv-${r.id}" value="${config.inventory[r.id]}" 
                               style="width:100px; background:var(--bg-deep); border:1px solid var(--border); color:var(--gold); padding:0.6rem; border-radius:8px; font-weight:700; font-size:1.1rem; text-align:center;">
                        <span style="font-size:0.85rem; color:var(--text-muted); flex:1;">Rooms available</span>
                        <button class="topbar-btn primary" style="padding:0.6rem 1.25rem; min-width:100px; justify-content:center; box-shadow:0 4px 12px rgba(201,169,110,0.2);" onclick="updateInventory('${r.id}')">Record</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function updateInventory(type) {
    const input = document.getElementById(`inv-${type}`);
    const newCount = parseInt(input.value, 10);

    if (isNaN(newCount) || newCount < 0) {
        showToast('Please enter a valid number of rooms.', 'error');
        return;
    }

    const { data: config, error: fErr } = await window.supabaseClient.from('settings').select('*').eq('id', 1).single();
    if (fErr) return;

    const newInventory = { ...config.inventory, [type]: newCount };

    const { error: uErr } = await window.supabaseClient
        .from('settings')
        .update({ inventory: newInventory })
        .eq('id', 1);

    if (uErr) {
        showToast('Update failed: ' + uErr.message, 'error');
        return;
    }

    showToast(`✅ ${type.toUpperCase()} Room inventory updated to ${newCount}`);
    await renderRoomsGrid();
}

function filterTable(query, tableId) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    query = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// ----------------------------------------------------------
// PRICING MANAGEMENT
// ----------------------------------------------------------
async function savePricing() {
    const parsePrice = (id) => {
        const val = document.getElementById(id).textContent.replace(/[^\d]/g, '');
        return parseInt(val, 10);
    };

    const single = parsePrice('price-single');
    const deluxe = parsePrice('price-deluxe');
    const family = parsePrice('price-family');

    if (isNaN(single) || isNaN(deluxe) || isNaN(family)) {
        showToast('Please enter valid numeric prices.', 'error');
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('settings')
            .update({
                prices: { single, deluxe, family }
            })
            .eq('id', 1);

        if (error) {
            console.error('Supabase Save Error:', error);
            showToast('Save failed: ' + (error.message || 'Unknown error'), 'error');
            return;
        }
    } catch (err) {
        console.error('Network/Fetch Error:', err);
        showToast('Save failed: ' + err.message, 'error');
        return;
    }

    showToast('✅ Prices saved successfully!');
    await refreshDashboard();
}

// ----------------------------------------------------------
// RATES & AVAILABILITY PAGE
// ----------------------------------------------------------
let matrixStartDate = new Date();
matrixStartDate.setDate(1); // Start at the 1st of the month
matrixStartDate.setHours(0, 0, 0, 0);

function navigateMatrix(months) {
    if (months === 0) {
        matrixStartDate = new Date();
        matrixStartDate.setDate(1);
        matrixStartDate.setHours(0, 0, 0, 0);
    } else {
        matrixStartDate.setMonth(matrixStartDate.getMonth() + months);
        matrixStartDate.setDate(1);
    }
    renderAvailMatrix(matrixStartDate);
}

function renderRatesPage() {
    renderBaseRates();
    renderRatePlans();
}

// Sub-Tab Switching
function switchRatesTab(el, tabId) {
    document.querySelectorAll('.rates-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.rates-subtab').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`subtab-${tabId}`);
    if (target) target.classList.remove('hidden');

    if (tabId === 'base-rates') renderBaseRates();
    if (tabId === 'rate-plans') renderRatePlans();
    if (tabId === 'avail-matrix') renderAvailMatrix(matrixStartDate);
}

// ----------------------------------------------------------
// BASE RATES
// ----------------------------------------------------------
async function renderBaseRates() {
    const grid = document.getElementById('rateCardsGrid');
    if (!grid) return;

    const { data: config, error } = await window.supabaseClient
        .from('settings').select('*').eq('id', 1).single();
    if (error) return;

    const rooms = [
        { id: 'single', name: 'Single Room', img: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=400&q=70', maxGuests: 2, extraFee: 50 },
        { id: 'deluxe', name: 'Deluxe Room', img: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400&q=70', maxGuests: 3, extraFee: 80 },
        { id: 'family', name: 'Family Room', img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70', maxGuests: 5, extraFee: 100 }
    ];

    const prices = config.prices;
    const inventory = config.inventory;
    const vals = Object.values(prices);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    if (document.getElementById('stat-avg-rate')) document.getElementById('stat-avg-rate').textContent = `₱${avg.toLocaleString()}`;
    if (document.getElementById('stat-min-rate')) document.getElementById('stat-min-rate').textContent = `₱${min.toLocaleString()}`;
    if (document.getElementById('stat-max-rate')) document.getElementById('stat-max-rate').textContent = `₱${max.toLocaleString()}`;

    grid.innerHTML = rooms.map(r => `
        <div class="rate-card">
            <div class="rate-card-img">
                <img src="${r.img}" alt="${r.name}">
            </div>
            <div class="rate-card-body">
                <div class="rate-card-name">${r.name}</div>
                <div class="rate-field-group">
                    <div class="rate-field">
                        <span class="rate-field-label">Nightly Rate (₱)</span>
                        <input type="number" class="rate-input" id="rate-price-${r.id}" value="${prices[r.id]}" min="0">
                    </div>
                    <div class="rate-field">
                        <span class="rate-field-label">Inventory</span>
                        <input type="number" class="rate-input" id="rate-inv-${r.id}" value="${inventory[r.id]}" min="0" style="width:80px;">
                    </div>
                    <div class="rate-field">
                        <span class="rate-field-label">Max Guests</span>
                        <span style="font-weight:600; color:var(--text-primary);">${r.maxGuests}</span>
                    </div>
                    <div class="rate-field">
                        <span class="rate-field-label">Extra Person Fee</span>
                        <span style="font-weight:600; color:var(--gold);">₱${r.extraFee}</span>
                    </div>
                </div>
                <div class="rate-card-actions">
                    <button class="topbar-btn primary" style="width:100%; justify-content:center;" onclick="saveBaseRate('${r.id}')">
                        💾 Save Changes
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function saveBaseRate(roomType) {
    const priceInput = document.getElementById(`rate-price-${roomType}`);
    const invInput = document.getElementById(`rate-inv-${roomType}`);
    const newPrice = parseInt(priceInput.value, 10);
    const newInv = parseInt(invInput.value, 10);

    if (isNaN(newPrice) || newPrice < 0 || isNaN(newInv) || newInv < 0) {
        showToast('Please enter valid values.', 'error');
        return;
    }

    const { data: config, error: fErr } = await window.supabaseClient
        .from('settings').select('*').eq('id', 1).single();
    if (fErr) return;

    const newPrices = { ...config.prices, [roomType]: newPrice };
    const newInventory = { ...config.inventory, [roomType]: newInv };

    const { error } = await window.supabaseClient
        .from('settings')
        .update({ prices: newPrices, inventory: newInventory })
        .eq('id', 1);

    if (error) {
        showToast('Save failed: ' + error.message, 'error');
        return;
    }

    showToast(`✅ ${roomType.charAt(0).toUpperCase() + roomType.slice(1)} Room rate & inventory updated!`);
    renderBaseRates();
}

// ----------------------------------------------------------
// RATE PLANS & PACKAGES (Supabase)
// ----------------------------------------------------------
async function getPlans() {
    try {
        const { data } = await window.supabaseClient
            .from('settings').select('rate_plans').eq('id', 1).single();
        return data?.rate_plans || [];
    } catch {
        return [];
    }
}
async function savePlansToStorage(plans) {
    await window.supabaseClient
        .from('settings')
        .update({ rate_plans: plans })
        .eq('id', 1);
}

function showAddPlanForm() {
    const wrap = document.getElementById('planFormWrap');
    if (wrap) wrap.classList.remove('hidden');
}
function hideAddPlanForm() {
    const wrap = document.getElementById('planFormWrap');
    if (wrap) wrap.classList.add('hidden');
    // Clear fields
    ['planName', 'planDiscount', 'planDesc', 'planFrom', 'planUntil'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const rooms = document.getElementById('planRooms');
    if (rooms) rooms.value = 'all';
    const nights = document.getElementById('planMinNights');
    if (nights) nights.value = '1';
}

async function savePlan() {
    const name = document.getElementById('planName')?.value.trim();
    const discount = parseInt(document.getElementById('planDiscount')?.value, 10);
    const rooms = document.getElementById('planRooms')?.value;
    const minNights = parseInt(document.getElementById('planMinNights')?.value, 10) || 1;
    const desc = document.getElementById('planDesc')?.value.trim();
    const from = document.getElementById('planFrom')?.value;
    const until = document.getElementById('planUntil')?.value;

    if (!name || isNaN(discount) || discount < 1 || discount > 100) {
        showToast('Please fill in plan name and a valid discount (1-100%).', 'error');
        return;
    }

    const plans = await getPlans();
    plans.push({
        id: Date.now().toString(36),
        name, discount, rooms, minNights, desc,
        validFrom: from, validUntil: until,
        active: true,
        createdAt: new Date().toISOString()
    });
    await savePlansToStorage(plans);
    hideAddPlanForm();
    await renderRatePlans();
    showToast(`✅ Rate plan "${name}" created!`);
}

async function togglePlan(id) {
    const plans = await getPlans();
    const plan = plans.find(p => p.id === id);
    if (plan) {
        plan.active = !plan.active;
        await savePlansToStorage(plans);
        await renderRatePlans();
        showToast(`${plan.active ? '✅ Activated' : '⏸️ Deactivated'}: ${plan.name}`);
    }
}

async function deletePlan(id) {
    const ok = await showConfirm('Are you sure you want to delete this rate plan?', 'Delete Plan', '🗑️');
    if (!ok) return;
    let plans = await getPlans();
    plans = plans.filter(p => p.id !== id);
    await savePlansToStorage(plans);
    await renderRatePlans();
    showToast('🗑️ Rate plan deleted.');
}

async function renderRatePlans() {
    const grid = document.getElementById('plansGrid');
    const empty = document.getElementById('plansEmpty');
    if (!grid) return;

    const plans = await getPlans();

    if (plans.length === 0) {
        if (empty) empty.style.display = '';
        // Remove any plan cards but keep empty state
        grid.querySelectorAll('.plan-card').forEach(c => c.remove());
        return;
    }

    if (empty) empty.style.display = 'none';

    const roomLabels = { all: 'All Rooms', single: 'Single', deluxe: 'Deluxe', family: 'Family' };

    grid.innerHTML = plans.map(p => `
        <div class="plan-card ${p.active ? '' : 'inactive'}">
            <div class="plan-card-header">
                <div class="plan-card-name">${p.name}</div>
                <label class="toggle" title="${p.active ? 'Active' : 'Inactive'}">
                    <input type="checkbox" ${p.active ? 'checked' : ''} onchange="togglePlan('${p.id}')">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            ${p.desc ? `<div class="plan-card-desc">${p.desc}</div>` : ''}
            <div class="plan-card-meta">
                <span class="plan-meta-tag">🛏️ ${roomLabels[p.rooms] || p.rooms}</span>
                <span class="plan-meta-tag">🌙 Min ${p.minNights} night${p.minNights > 1 ? 's' : ''}</span>
                ${p.validFrom ? `<span class="plan-meta-tag">📅 ${p.validFrom}</span>` : ''}
                ${p.validUntil ? `<span class="plan-meta-tag">⏰ Until ${p.validUntil}</span>` : ''}
            </div>
            <div class="plan-card-footer">
                <div class="plan-discount">-${p.discount}%</div>
                <div style="display:flex; gap:0.4rem;">
                    <button class="topbar-btn" style="padding:0.4rem 0.6rem; color:var(--red);" title="Delete" onclick="deletePlan('${p.id}')">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ----------------------------------------------------------
// AVAILABILITY MATRIX — TAPE CHART
// ----------------------------------------------------------
let currentTapeDays = 30;
let matrixCache = { bookings: null, config: null, lastFetch: 0 };
const CACHE_TTL = 30000; // 30 seconds cache for infinite scroll expansion

// Track manual room assignments: { bookingId: roomSlotNumber }
const roomAssignments = {};

async function renderAvailMatrix(startDate) {
    // 0. Ensure startDate is valid
    if (!startDate || isNaN(new Date(startDate).getTime())) {
        startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
    }
    matrixStartDate = new Date(startDate);
    matrixStartDate.setDate(1); // Always start at 1st

    // Calculate days in this month
    const year = matrixStartDate.getFullYear();
    const month = matrixStartDate.getMonth();
    currentTapeDays = new Date(year, month + 1, 0).getDate();

    console.log(`🗓️ Rendering Availability Matrix for: ${year}-${month + 1} (${currentTapeDays} days)`);
    const chart = document.getElementById('tapeChart');
    const rangeLabel = document.getElementById('matrixDateRange');
    if (!chart) {
        console.warn('⚠️ #tapeChart not found in DOM.');
        return;
    }

    // Update range label to show month
    if (rangeLabel) {
        const textSpan = rangeLabel.querySelector('span');
        const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const labelText = `${monthNamesLong[month]} ${year}`;
        if (textSpan) textSpan.textContent = labelText;
        else rangeLabel.textContent = labelText;
    }

    // ── JUMP TO DATE PICKER ──
    if (rangeLabel && !rangeLabel._flatpickr) {
        flatpickr(rangeLabel, {
            dateFormat: "Y-m-d",
            defaultDate: matrixStartDate,
            monthSelectorType: "static",
            yearSelectorType: "static",
            disableMobile: "true",
            position: "auto",
            // Removed static: true to allow it to pop over properly
            onOpen: () => rangeLabel.classList.add('active'),
            onClose: () => rangeLabel.classList.remove('active'),
            onChange: (selectedDates) => {
                if (selectedDates.length) {
                    renderAvailMatrix(selectedDates[0]);
                }
            }
        });
    } else if (rangeLabel && rangeLabel._flatpickr) {
        rangeLabel._flatpickr.setDate(matrixStartDate, false);
    }

    const nowTs = Date.now();
    let bookings, config;

    try {
        if (matrixCache.bookings && (nowTs - matrixCache.lastFetch < CACHE_TTL)) {
            console.log('📦 Using cached matrix data');
            bookings = matrixCache.bookings;
            config = matrixCache.config;
        } else {
            console.log('📡 Fetching fresh matrix data from Supabase...');
            const [bookingsRes, settingsRes] = await Promise.all([
                window.supabaseClient.from('bookings').select('*'),
                window.supabaseClient.from('settings').select('*').eq('id', 1).single()
            ]);

            if (bookingsRes.error) throw new Error('Bookings fetch failed: ' + bookingsRes.error.message);
            if (settingsRes.error) throw new Error('Settings fetch failed: ' + settingsRes.error.message);

            bookings = (bookingsRes.data || []).filter(b => b.status !== 'cancelled');
            config = settingsRes.data || {
                inventory: { single: 10, deluxe: 10, family: 10 },
                prices: { single: 180, deluxe: 320, family: 420 }
            };
            matrixCache = { bookings, config, lastFetch: nowTs };
            console.log(`✅ Loaded ${bookings.length} active bookings and config.`);
        }
    } catch (err) {
        console.error('❌ Matrix Data Fetch Error:', err);
        showToast('Error loading availability matrix: ' + err.message, 'error');
        return;
    }

    const roomStatuses = config.room_statuses || {};

    const roomTypes = [
        { id: 'single', name: 'Single Room', prefix: 1 },
        { id: 'deluxe', name: 'Deluxe Room', prefix: 2 },
        { id: 'family', name: 'Family Room', prefix: 3 }
    ];

    try {
        console.log('🏗️ Generating Matrix HTML...');
        // Generate dates
        const dates = [];
        for (let i = 0; i < currentTapeDays; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Today string (local)
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Helper: format date to YYYY-MM-DD (local)
        function fmtDate(d) {
            if (!(d instanceof Date) || isNaN(d)) return '';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        // Columns: 1 label + currentTapeDays dates
        chart.style.gridTemplateColumns = `140px repeat(${currentTapeDays}, 70px)`;

        let html = '';

        // ── 1. MONTH HEADER ROW ──
        html += `<div class="tc-header-row tc-month-row">`;
        html += `<div class="tc-corner"></div>`;

        // Group dates by month for spanning
        const monthClusters = [];
        dates.forEach((d, i) => {
            const mKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            if (monthClusters.length === 0 || monthClusters[monthClusters.length - 1].month !== mKey) {
                monthClusters.push({ month: mKey, count: 1 });
            } else {
                monthClusters[monthClusters.length - 1].count++;
            }
        });

        monthClusters.forEach(cluster => {
            html += `<div class="tc-header-cell tc-month-cell" style="grid-column: span ${cluster.count}">${cluster.month}</div>`;
        });
        html += `</div>`;

        // Calculate total occupancy per date (across all room types)
        const totalInvAcrossTypes = roomTypes.reduce((sum, rt) => sum + (config.inventory[rt.id] || 10), 0);
        const dailyOccupancy = dates.map(d => {
            const ds = fmtDate(d);
            const bookedTotal = bookings.filter(b => b.checkin <= ds && b.checkout > ds).length;
            return totalInvAcrossTypes > 0 ? Math.round((bookedTotal / totalInvAcrossTypes) * 100) : 0;
        });

        // ── 2. DAY/DATE/OCC ROW ──
        html += `<div class="tc-header-row tc-day-row">`;
        html += `<div class="tc-corner"></div>`;
        dates.forEach((d, i) => {
            const ds = fmtDate(d);
            const isToday = ds === todayStr;
            const dayName = dayNames[d.getDay()];
            const occ = dailyOccupancy[i];
            const weekendClass = (d.getDay() === 0 || d.getDay() === 6) ? ' tc-weekend-col' : '';
            const todayClass = isToday ? ' tc-today-col' : '';

            html += `<div class="tc-header-cell tc-day-cell${todayClass}${weekendClass}" data-date="${ds}">
                <span class="tc-day-name">${dayName}</span>
                <span class="tc-day-num">${d.getDate()}</span>
                <span class="tc-day-occ">${occ}%</span>
            </div>`;
        });
        html += `</div>`;

        // ── 3. PRICE HEADER ROW ──
        // (Since prices are per room type, we'll show an average or just a label "Rates")
        html += `<div class="tc-header-row tc-price-row">`;
        html += `<div class="tc-corner" style="display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-muted);">PRICE</div>`;
        dates.forEach((d, i) => {
            const ds = fmtDate(d);
            const isToday = ds === todayStr;
            const weekendClass = (d.getDay() === 0 || d.getDay() === 6) ? ' tc-weekend-col' : '';
            const todayClass = isToday ? ' tc-today-col' : '';

            // For the global header price, we'll show "Rates" or similar, 
            // but the Cloudbeds image shows room-type-specific prices in the toggle headers.
            // Let's just put a dash or the min price.
            const minPrice = Math.min(...Object.values(config.prices));
            html += `<div class="tc-header-cell tc-price-cell${todayClass}${weekendClass}">₱${minPrice.toLocaleString()}</div>`;
        });
        html += `</div>`;

        // For each room type
        roomTypes.forEach(rt => {
            const inv = config.inventory[rt.id] || 10;
            const price = config.prices[rt.id] || 0;

            // ── GROUP HEADER ──
            html += `<div class="tc-group-row">`;
            html += `<div class="tc-group-label">▸ ${rt.name} <span class="tc-group-price">₱${price.toLocaleString()} / night</span></div>`;
            dates.forEach(d => {
                const isToday = fmtDate(d) === todayStr;
                html += `<div class="tc-group-day${isToday ? ' tc-today' : ''}"></div>`;
            });
            html += `</div>`;

            // Get bookings for this room type
            const typeBookings = bookings.filter(b => b.room && b.room.toLowerCase().includes(rt.id));

            // Smart room assignment: respect manual assignments, then fill gaps
            function getSlotForBooking(booking, slotNum) {
                // If manually assigned, use that
                if (roomAssignments[booking.id] !== undefined) {
                    return roomAssignments[booking.id] === slotNum;
                }
                // Default round-robin
                const idx = typeBookings.indexOf(booking);
                return (idx % inv) === (slotNum - 1);
            }

            // ── INDIVIDUAL ROOM ROWS ──
            for (let r = 1; r <= inv; r++) {
                const roomNum = rt.prefix * 100 + r;
                const rStatus = roomStatuses[roomNum] || 'clean';
                const statusDotClass = rStatus === 'maintenance' ? 'status-maint-dot' : rStatus === 'dirty' ? 'status-dirty-dot' : 'status-clean-dot';
                const statusTitle = rStatus === 'maintenance' ? 'Maintenance' : rStatus === 'dirty' ? 'Dirty' : 'Clean';

                html += `<div class="tc-room-row">`;
                html += `<div class="tc-room-label">
                    <span class="tc-room-status-dot ${statusDotClass}" data-room="${roomNum}" title="${statusTitle} — Click to change"></span>
                    Room ${roomNum}
                </div>`;

                const roomSlotBookings = typeBookings.filter(b => getSlotForBooking(b, r));

                dates.forEach((d, colIdx) => {
                    const ds = fmtDate(d);
                    const isToday = ds === todayStr;
                    const weekendClass = (d.getDay() === 0 || d.getDay() === 6) ? ' tc-weekend-col' : '';
                    const todayClass = isToday ? ' tc-today-col' : '';

                    html += `<div class="tc-room-cell${todayClass}${weekendClass}" data-room="${roomNum}" data-room-type="${rt.id}" data-slot="${r}" data-date="${ds}">`;

                    roomSlotBookings.forEach(b => {
                        if (!b.checkin || !b.checkout) return; // Skip broken bookings
                        if (b.checkin <= ds && b.checkout > ds) {
                            const barStart = b.checkin < fmtDate(dates[0]) ? fmtDate(dates[0]) : b.checkin;
                            if (ds === barStart) {
                                const endDate = b.checkout > fmtDate(dates[currentTapeDays - 1]) ? fmtDate(dates[currentTapeDays - 1]) : b.checkout;

                                const startD = new Date(barStart + 'T00:00:00');
                                const endD = new Date(endDate + 'T00:00:00');

                                if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
                                    console.warn('⚠️ Invalid dates for booking:', b.ref, barStart, endDate);
                                    return;
                                }

                                const spanDays = Math.max(1, Math.round((endD - startD) / 86400000));
                                const widthPx = spanDays * 70 - 8;

                                const statusClass = b.status === 'confirmed' ? 'status-confirmed-bar'
                                    : b.status === 'pending' ? 'status-pending-bar'
                                        : b.status === 'checked-in' ? 'status-checked-in-bar'
                                            : 'status-cancelled-bar';

                                const guestName = b.guest || b.email?.split('@')[0] || 'Guest';
                                html += `<div class="tc-booking-bar ${statusClass}" draggable="true" data-booking-id="${b.id}" data-room-type="${rt.id}" style="width:${widthPx}px;" title="${guestName} — ${b.checkin} to ${b.checkout} (${b.status})">${guestName}</div>`;
                            }
                        }
                    });

                    html += `</div>`;
                });

                html += `</div>`;
            }

            // ── OCCUPANCY ROW ──
            html += `<div class="tc-occ-row">`;
            html += `<div class="tc-occ-label">Occupancy</div>`;
            dates.forEach((d, i) => {
                const ds = fmtDate(d);
                const isToday = ds === todayStr;
                const occ = dailyOccupancy[i];
                const occClass = occ >= 80 ? 'occ-high' : occ >= 40 ? 'occ-med' : 'occ-low';
                const weekendClass = (d.getDay() === 0 || d.getDay() === 6) ? ' tc-weekend-col' : '';
                const todayClass = isToday ? ' tc-today-col' : '';
                html += `<div class="tc-occ-cell${todayClass}${weekendClass} ${occClass}">${occ}%</div>`;
            });
            html += `</div>`;
        });

        chart.innerHTML = html;
        console.log('✨ Matrix HTML rendered to DOM.');
    } catch (renderErr) {
        console.error('❌ Matrix Render Loop Error:', renderErr);
        showToast('Rendering error: ' + renderErr.message, 'error');
        chart.innerHTML = `<div style="padding:2rem; color:var(--red); text-align:center;">
            ⚠️ Error building matrix: ${renderErr.message}<br>
            Check console for details.
        </div>`;
    }

    // ── ATTACH DRAG-AND-DROP LISTENERS ──
    attachTapeChartDragDrop(chart, bookings);

    // ── ATTACH CLICK HANDLERS ──

    // ── ATTACH ROOM STATUS CLICK HANDLERS ──
    chart.querySelectorAll('.tc-room-status-dot').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            cycleRoomStatus(icon.dataset.room);
        });
    });

    // ── SCROLLBAR SYNC REBORN ──
    const wrap = document.getElementById('tapeChartWrap');
    const bottomScroll = document.getElementById('bottomScrollContainer');
    const bottomScrollInner = document.getElementById('bottomScrollInner');

    if (wrap && bottomScroll && bottomScrollInner) {
        let isSyncing = false;

        const syncWidth = () => {
            const chartArea = document.getElementById('tapeChart');
            if (chartArea && bottomScrollInner) {
                // Use the scrollWidth of the chartArea to ensure the scrollbar matches the content exactly
                const actualWidth = chartArea.scrollWidth;
                bottomScrollInner.style.width = actualWidth + 'px';
                
                // If the wrap itself is wider than the content, we might not need the bottom scrollbar
                if (wrap.clientWidth >= actualWidth) {
                    bottomScroll.style.display = 'none';
                } else {
                    bottomScroll.style.display = 'block';
                }
            }
        };

        // Sync initially and on various triggers
        syncWidth();
        window.addEventListener('resize', syncWidth);
        
        // Use a MutationObserver to sync whenever the chart content changes
        if (window.matrixObserver) window.matrixObserver.disconnect();
        window.matrixObserver = new MutationObserver(() => {
            syncWidth();
        });
        const chartArea = document.getElementById('tapeChart');
        if (chartArea) {
            window.matrixObserver.observe(chartArea, { childList: true, subtree: true });
        }

        // Scroll synchronization with requestAnimationFrame for smoothness
        const handleWrapScroll = () => {
            if (!isSyncing) {
                isSyncing = true;
                requestAnimationFrame(() => {
                    bottomScroll.scrollLeft = wrap.scrollLeft;
                    isSyncing = false;
                });
            }
        };

        const handleBottomScroll = () => {
            if (!isSyncing) {
                isSyncing = true;
                requestAnimationFrame(() => {
                    wrap.scrollLeft = bottomScroll.scrollLeft;
                    isSyncing = false;
                });
            }
        };

        wrap.addEventListener('scroll', handleWrapScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
    }
}


// ── DRAG-AND-DROP ENGINE ──
function attachTapeChartDragDrop(chart, allBookings) {
    let draggedBar = null;
    let dragBookingId = null;
    let dragRoomType = null;

    // Booking bars: dragstart
    chart.querySelectorAll('.tc-booking-bar').forEach(bar => {
        bar.addEventListener('dragstart', (e) => {
            draggedBar = bar;
            dragBookingId = bar.dataset.bookingId;
            dragRoomType = bar.dataset.roomType;
            bar.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragBookingId);
        });

        bar.addEventListener('dragend', () => {
            bar.style.opacity = '1';
            // Remove all drop highlights
            chart.querySelectorAll('.tc-room-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
            draggedBar = null;
            dragBookingId = null;
            dragRoomType = null;
        });
    });

    // Room cells: dragover & drop
    chart.querySelectorAll('.tc-room-cell').forEach(cell => {
        cell.addEventListener('dragover', (e) => {
            // Only allow drop on same room type
            if (cell.dataset.roomType === dragRoomType) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                // Highlight the entire row
                const targetSlot = cell.dataset.slot;
                chart.querySelectorAll('.tc-room-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
                chart.querySelectorAll(`.tc-room-cell[data-slot="${targetSlot}"][data-room-type="${dragRoomType}"]`).forEach(c => c.classList.add('drag-over'));
            }
        });

        cell.addEventListener('dragleave', () => {
            cell.classList.remove('drag-over');
        });

        cell.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetSlot = parseInt(cell.dataset.slot);
            const targetRoomType = cell.dataset.roomType;
            const targetDate = cell.dataset.date;

            if (targetRoomType === dragRoomType && dragBookingId) {
                // Find original booking
                const booking = allBookings.find(b => b.id.toString() === dragBookingId);
                if (!booking) return;

                // Calculate duration
                const start = new Date(booking.checkin + 'T00:00:00');
                const end = new Date(booking.checkout + 'T00:00:00');
                const durationDays = Math.round((end - start) / 86400000);

                // Calculate new dates
                const newStart = new Date(targetDate + 'T00:00:00');
                const newEnd = new Date(newStart);
                newEnd.setDate(newEnd.getDate() + durationDays);

                function fmtDate(d) {
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }

                const newCheckin = fmtDate(newStart);
                const newCheckout = fmtDate(newEnd);

                // Update assignment map (for visuals)
                roomAssignments[dragBookingId] = targetSlot;

                // Sync to Supabase
                showToast('Moving booking...', 'info');

                const { error } = await window.supabaseClient
                    .from('bookings')
                    .update({
                        checkin: newCheckin,
                        checkout: newCheckout,
                        room: `${booking.room.split(' ')[0]} ${cell.dataset.room}` // e.g. "single 102"
                    })
                    .eq('id', dragBookingId);

                if (error) {
                    console.error('Error moving booking:', error);
                    showToast('Failed to move booking dates', 'error');
                } else {
                    showToast(`Moved to Room ${cell.dataset.room} (${newCheckin})`, 'success');
                }

                // Remove highlights
                chart.querySelectorAll('.tc-room-cell.drag-over').forEach(c => c.classList.remove('drag-over'));

                // Re-render
                renderAvailMatrix(matrixStartDate);
            }
        });
    });
}

// ── ROOM STATUS CYCLING ──
// Statuses: clean → dirty → maintenance → clean
async function cycleRoomStatus(roomNum) {
    // Fetch current statuses
    const { data } = await window.supabaseClient.from('settings').select('room_statuses').eq('id', 1).single();
    const statuses = (data && data.room_statuses) || {};

    const current = statuses[roomNum] || 'clean';
    const next = current === 'clean' ? 'dirty' : current === 'dirty' ? 'maintenance' : 'clean';
    statuses[roomNum] = next;

    // Save to Supabase
    const { error } = await window.supabaseClient.from('settings').update({ room_statuses: statuses }).eq('id', 1);
    if (error) {
        console.error('Supabase Error updating room status:', error);
        showToast('Failed to update room status. Check console for details.', 'error');
        return;
    }

    const labels = { clean: '🟢 Clean', dirty: '🟡 Dirty', maintenance: '🔴 Maintenance' };
    showToast(`Room ${roomNum}: ${labels[next]}`, 'info');

    // Re-render
    renderAvailMatrix(matrixStartDate);
}

// navigateMatrix moved to global section for consistency

/**
 * Custom Toast Notification System
 * type: 'success' | 'error' | 'info'
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${type.toUpperCase()}</div>
            <div class="toast-msg">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 4s
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/**
 * Custom Promise-based Confirmation Modal
 */
function showConfirm(message, title = 'Confirm', icon = '❓') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmActionModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const iconEl = document.getElementById('confirmIcon');
        const proceedBtn = document.getElementById('confirmProceedBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal || !titleEl || !msgEl || !proceedBtn || !cancelBtn) {
            return resolve(window.confirm(message)); // Fallback
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        if (iconEl) iconEl.textContent = icon;

        modal.classList.add('active');

        const cleanup = (result) => {
            modal.classList.remove('active');
            proceedBtn.removeEventListener('click', onProceed);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onProceed = () => cleanup(true);
        const onCancel = () => cleanup(false);

        proceedBtn.addEventListener('click', onProceed);
        cancelBtn.addEventListener('click', onCancel);
    });
}
