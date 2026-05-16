// script.js - Фронтенд для VidBee API
const API_BASE = 'https://vidbee-api.onrender.com'; // ⚠️ Твой URL

let currentTaskId = null;
let eventSource = null;

// Универсальная функция вызова API
async function apiCall(method, params) {
    const url = `${API_BASE}/rpc/${method}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            let errorText = `Ошибка HTTP ${response.status}`;
            try {
                const errData = await response.json();
                errorText += `: ${errData.message || errData.error || JSON.stringify(errData)}`;
            } catch (e) {}
            throw new Error(errorText);
        }
        return response.json();
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Сервер недоступен. Возможно, он "просыпается" после сна (ждать до 60 сек).');
        }
        throw error;
    }
}

// Получение информации о видео
async function fetchVideoInfo() {
    const url = document.getElementById('videoUrl').value.trim();
    if (!url) return alert('Вставьте ссылку');
    
    hideError();
    hideSection('info');
    hideSection('downloadLink');
    
    const btn = document.getElementById('fetchBtn');
    btn.disabled = true;
    btn.textContent = 'Загрузка...';
    
    try {
        const data = await apiCall('videoInfo', { url });
        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('videoDuration').textContent = 
            `Длительность: ${Math.floor(data.duration / 60)} мин ${data.duration % 60} сек`;
        showSection('info');
    } catch (e) {
        showError(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Проверить';
    }
}

// Прослушивание прогресса через SSE
function listenProgress(taskId) {
    if (eventSource) eventSource.close();
    
    eventSource = new EventSource(`${API_BASE}/events`);
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.taskId === taskId) {
                const percent = data.progress || 0;
                document.getElementById('progressBar').style.width = percent + '%';
                document.getElementById('progressText').textContent = 
                    `${Math.round(percent)}% — ${data.speed || ''}`;
                showSection('progress');
                
                if (percent >= 100) {
                    eventSource.close();
                    showDownloadLink(taskId);
                }
            }
        } catch (e) {
            console.error('SSE parse error:', e);
        }
    };
    
    eventSource.onerror = () => {
        eventSource.close();
        // Если загрузка могла завершиться, показываем ссылку
        showDownloadLink(taskId);
    };
}

// Запуск загрузки
async function startDownload(type) {
    const url = document.getElementById('videoUrl').value.trim();
    hideError();
    hideSection('downloadLink');
    
    try {
        const res = await apiCall('downloads.create', {
            url,
            type: type, // 'video' или 'audio'
            format: 'best'
        });
        
        currentTaskId = res.id;
        listenProgress(currentTaskId);
        showSection('progress');
    } catch (e) {
        showError(e.message);
    }
}

// Показать ссылку на файл
function showDownloadLink(taskId) {
    hideSection('progress');
    const link = document.getElementById('fileLink');
    link.href = `${API_BASE}/api/downloads/${taskId}/file`;
    link.textContent = 'Скачать готовый файл';
    showSection('downloadLink');
}

// Вспомогательные функции для UI
function showSection(id) { document.getElementById(id).classList.remove('hidden'); }
function hideSection(id) { document.getElementById(id).classList.add('hidden'); }
function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}
function hideError() {
    document.getElementById('error').classList.add('hidden');
}

// Привязка функций к глобальному scope (для onclick в HTML)
window.fetchVideoInfo = fetchVideoInfo;
window.downloadVideo = () => startDownload('video');
window.downloadAudio = () => startDownload('audio');
