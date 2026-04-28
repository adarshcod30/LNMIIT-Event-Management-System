const API_BASE_URL = 'http://localhost:4000';

const form = document.getElementById('scheduleForm');
const tableBody = document.getElementById('scheduleTableBody');
const alertBox = document.getElementById('alertBox');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEditBtn');

document.getElementById('logoutBtn').addEventListener('click', logout);
form.addEventListener('submit', saveSchedule);
cancelEditBtn.addEventListener('click', resetForm);

initDashboard();

async function initDashboard() {
    const me = await api('/api/users/me');

    if (!me.ok) {
        redirectToLogin();
        return;
    }

    document.getElementById('userLabel').textContent = `Logged in: ${me.data.name}`;
    loadSchedules();
}

async function api(url, method = 'GET', body = null) {
    const opts = {
        method,
        credentials: 'include',
        headers: {}
    };

    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(API_BASE_URL + url, opts);
    let data = {};
    try {
        data = await res.json();
    } catch (error) {
        data = {};
    }

    if (res.status === 401 && url !== '/api/users/logout') {
        redirectToLogin();
    }

    return { ok: res.ok, data };
}

function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = 'alert alert-' + type + ' show';
    setTimeout(() => {
        alertBox.className = 'alert';
    }, 2500);
}

async function logout() {
    await api('/api/users/logout', 'POST');
    redirectToLogin();
}

function redirectToLogin() {
    window.location.href = 'http://localhost:3000/';
}

function formatDate(value) {
    if (!value) {
        return '-';
    }
    const date = new Date(value);
    return date.toISOString().slice(0, 10);
}

async function loadSchedules() {
    const { ok, data } = await api('/api/schedules');
    if (!ok) {
        showAlert(data.message || 'Unable to load schedules.', 'error');
        return;
    }

    if (!data.length) {
        tableBody.innerHTML = '<tr><td colspan="8">No schedules added yet.</td></tr>';
        return;
    }

    tableBody.innerHTML = data.map((item) => {
        return `<tr>
            <td>${escapeHtml(item.eventName)}</td>
            <td>${escapeHtml(item.roundName)}</td>
            <td>${item.roundNumber}</td>
            <td>${formatDate(item.date)}</td>
            <td>${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</td>
            <td>${escapeHtml(item.venue)}</td>
            <td>${escapeHtml(item.status)}</td>
            <td>
                <button class="small-btn" type="button" onclick="startEdit('${item._id}')">Edit</button>
                <button class="small-btn danger" type="button" onclick="deleteSchedule('${item._id}')">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

function getFormData() {
    return {
        eventName: document.getElementById('eventName').value.trim(),
        roundName: document.getElementById('roundName').value.trim(),
        roundNumber: Number(document.getElementById('roundNumber').value),
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value.trim(),
        endTime: document.getElementById('endTime').value.trim(),
        venue: document.getElementById('venue').value.trim(),
        status: document.getElementById('status').value
    };
}

async function saveSchedule(e) {
    e.preventDefault();
    const scheduleId = document.getElementById('scheduleId').value;
    const body = getFormData();

    const request = scheduleId
        ? await api('/api/schedules/' + scheduleId, 'PUT', body)
        : await api('/api/schedules', 'POST', body);

    if (request.ok) {
        showAlert(request.data.message || 'Saved successfully.', 'success');
        resetForm();
        loadSchedules();
    } else {
        showAlert(request.data.message || 'Could not save schedule.', 'error');
    }
}

async function startEdit(id) {
    const { ok, data } = await api('/api/schedules');
    if (!ok) {
        return;
    }

    const schedule = data.find((item) => item._id === id);
    if (!schedule) {
        return;
    }

    document.getElementById('scheduleId').value = schedule._id;
    document.getElementById('eventName').value = schedule.eventName;
    document.getElementById('roundName').value = schedule.roundName;
    document.getElementById('roundNumber').value = schedule.roundNumber;
    document.getElementById('date').value = formatDate(schedule.date);
    document.getElementById('startTime').value = schedule.startTime;
    document.getElementById('endTime').value = schedule.endTime;
    document.getElementById('venue').value = schedule.venue;
    document.getElementById('status').value = schedule.status;
    formTitle.textContent = 'Edit Schedule';
}

async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) {
        return;
    }

    const { ok, data } = await api('/api/schedules/' + id, 'DELETE');
    if (ok) {
        showAlert(data.message || 'Deleted.', 'success');
        resetForm();
        loadSchedules();
    } else {
        showAlert(data.message || 'Could not delete schedule.', 'error');
    }
}

function resetForm() {
    form.reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('roundNumber').value = 1;
    document.getElementById('status').value = 'scheduled';
    formTitle.textContent = 'Add Schedule';
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

window.startEdit = startEdit;
window.deleteSchedule = deleteSchedule;
