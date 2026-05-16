const API_BASE = 'https://vidbee-api.onrender.com'; // ⚠️ Твой Render URL

let currentTaskId = null;
let eventSource = null;

async function apiCall(method, params) {
    const res = await fetch(`${API_BASE}/rpc/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Ошибка HTTP ${res.status}`);
    }
    return res.json();
}

function showSection(id) { document.getElementById(id).classList.remove('hidden'); }
function hideSection(id) { document.getElementById(id).classList.add('hidden'); }

async function fetchVideoInfo() {
    const url = document.getElementById('videoUrl').value.trim();
    if (!url) return alert('Вставьте ссылку');
    hideError();
    hideSection('info');
    const btn = document.getElementById('fetchBtn');
    btn.disabled = true;
    btn.textContent = 'Загрузка...';
    try {
        const data = await apiCall('videoInfo', { url });
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('videoDuration').textContent = `Длительность: ${Math.floor(data.duration / 60)} мин ${data.duration % 60} сек`;
        showSection('info');
    } catch (e) {
        showError(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Проверить';
    }
}

function listenProgress(taskId) {
    if (eventSource) eventSource.close();
    eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'downloadProgress' && data.taskId === taskId) {
                const percent = data.progress || 0;
                document.getElementById('progressBar').style.width = percent + '%';
                document.getElementById('progressText').textContent = `${percent}% — ${data.speed || ''}`;
                showSection('progress');
                if (percent >= 100) {
                    eventSource.close();
                    showDownloadLink(taskId);
                }
            }
        } catch (e) {}
    };

    eventSource.onerror = () => {
        eventSource.close();
    };
}

async function downloadVideo() {
    await startDownload('video');
}
async function downloadAudio() {
    await startDownload('audio');
}

async function startDownload(type) {
    const url = document.getElementById('videoUrl').value.trim();
    hideError();
    hideSection('downloadLink');
    try {
        const res = await apiCall('downloads.create', {
            url,
            type: type, // 'video' или 'audio'
            format: 'best', // VidBee сам выберет лучший
        });
        currentTaskId = res.id;
        listenProgress(currentTaskId);
        showSection('progress');
    } catch (e) {
        showError(e.message);
    }
}

function showDownloadLink(taskId) {
    hideSection('progress');
    const link = document.getElementById('fileLink');
    link.href = `${API_BASE}/api/downloads/${taskId}/file`;
    link.textContent = 'Скачать готовый файл';
    showSection('downloadLink');
}

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}
function hideError() {
    document.getElementById('error').classList.add('hidden');
          }
