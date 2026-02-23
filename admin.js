// VERSION: 1.0.2 (Supabase Migration Fix)
/* ============================================================
   Hotel Luxe — admin.js
   Handles: auth check, tab switching, sidebar toggle, stats,
            booking filters, pricing persistence, and table rendering.
   ============================================================ */

console.log('🔄 Admin script loading... (v1.0.2)');
if (!window.supabaseClient) {
    console.warn('⚠️ Supabase client not found on load. Checking window...');
}

document.addEventListener('DOMContentLoaded', () => {
    // 0. AUTH CHECK
    if (sessionStorage.getItem('dhv_admin') !== 'true') {
        window.location.href = 'admin';
        return;
    }

    // 1. INITIAL LOAD
    refreshDashboard();
});

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
    window.location.href = 'admin';
}

// ----------------------------------------------------------
// DASHBOARD DATA REFRESH
// ----------------------------------------------------------
async function refreshDashboard() {
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
    renderCharts(bookings);
}

// ----------------------------------------------------------
// CHART RENDERING
// ----------------------------------------------------------
function renderCharts(bookings) {
    // A. REVENUE CHART (Last 7 Months)
    const revenueEl = document.getElementById('revenueChart');
    if (revenueEl) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = new Date();
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
