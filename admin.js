/* ============================================================
   Hotel Luxe — admin.js
   Handles: auth check, tab switching, sidebar toggle, stats,
            booking filters, pricing persistence, and table rendering.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 0. AUTH CHECK
    if (sessionStorage.getItem('dhv_admin') !== 'true') {
        window.location.href = 'admin-login.html';
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
    window.location.href = 'admin-login.html';
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
        .order('createdAt', { ascending: false });

    // Fetch Settings
    const { data: config, error: cErr } = await window.supabaseClient
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (bErr || cErr) {
        console.warn('Refresh failed:', bErr || cErr);
        return;
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
                <button class="topbar-btn" style="padding:0.4rem 0.6rem;" onclick="alert('View guest history for ${g.guest.replace(/'/g, "\\'")} coming soon')">👁️</button>
            </td>
        </tr>
    `).join('');
}

// ----------------------------------------------------------
// BOOKING ACTIONS
// ----------------------------------------------------------
async function confirmBooking(ref) {
    if (!confirm(`Are you sure you want to CONFIRM booking #${ref}?`)) return;

    const { data: booking, error } = await window.supabaseClient
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('ref', ref)
        .select()
        .single();

    if (error) {
        alert('Error confirming booking: ' + error.message);
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
    alert(`✅ Booking #${ref} confirmed and email sent!`);
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
        hotel_name: "D'HILLSVIEW HOTEL",
    }).then(() => {
        console.log('✅ Confirmation email sent to', data.email);
    }).catch(err => {
        console.warn('Email send failed:', err);
    });
}
async function cancelBooking(ref) {
    if (!confirm(`Are you sure you want to cancel booking #${ref}?`)) return;

    const { error } = await window.supabaseClient
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('ref', ref);

    if (error) {
        alert('Error cancelling booking: ' + error.message);
        return;
    }

    await refreshDashboard();
}

async function deleteBooking(ref) {
    if (!confirm(`CRITICAL: Are you sure you want to PERMANENTLY DELETE booking #${ref}?`)) return;

    const { error } = await window.supabaseClient
        .from('bookings')
        .delete()
        .eq('ref', ref);

    if (error) {
        alert('Error deleting booking: ' + error.message);
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
        .order('createdAt', { ascending: false });

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
                
                <div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px; border:1px solid var(--border-light);">
                    <label style="display:block; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin-bottom:0.5rem;">
                        How many rooms available
                    </label>
                    <div style="display:flex; gap:0.5rem;">
                        <input type="number" id="inv-${r.id}" value="${config.inventory[r.id]}" 
                               style="flex:1; background:var(--bg-card); border:1px solid var(--border); color:var(--text-primary); padding:0.4rem; border-radius:4px; font-weight:600;">
                        <button class="topbar-btn primary" style="padding:0.4rem 0.8rem;" onclick="updateInventory('${r.id}')">Record</button>
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
        alert('Please enter a valid number of rooms.');
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
        alert('Update failed: ' + uErr.message);
        return;
    }

    alert(`✅ ${type.toUpperCase()} Room inventory updated to ${newCount}`);
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
    const single = parseInt(document.getElementById('price-single').textContent, 10);
    const deluxe = parseInt(document.getElementById('price-deluxe').textContent, 10);
    const family = parseInt(document.getElementById('price-family').textContent, 10);

    if (isNaN(single) || isNaN(deluxe) || isNaN(family)) {
        alert('Please enter valid numeric prices.');
        return;
    }

    const { error } = await window.supabaseClient
        .from('settings')
        .update({
            prices: { single, deluxe, family }
        })
        .eq('id', 1);

    if (error) {
        alert('Save failed: ' + error.message);
        return;
    }

    alert('✅ Prices saved successfully! Changes will be reflected live on the website.');
    await refreshDashboard();
}
