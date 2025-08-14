// Координаты серверов
const coordinates = {
    'CLOUD-RU-7': [55.75, 37.62], // Moscow
    'MSK2': [55.75, 37.62], // Moscow
    'MSK2X': [55.75, 37.62], // Moscow
    'TAS': [41.26, 69.22], // Tashkent
    'EKB': [56.84, 60.61], // Ekaterinburg
    'SMR': [53.2, 50.15], // Samara
    'RST': [47.23, 39.72], // Rostov-on-Don
    'NSK': [55.04, 82.93], // Novosibirsk
    'KRY': [56.01, 92.89], // Krasnoyarsk
    'KHB': [48.48, 135.08], // Khabarovsk
    'ALM': [43.25, 76.92], // Almaty
    'AST': [51.18, 71.45], // Astana
    'RIG': [56.95, 24.11], // Riga
    'VIL': [54.69, 25.28], // Vilnius
    'WAW': [52.23, 21.01], // Warsaw
    'MNK': [53.9, 27.57] // Minsk
};

let currentOnline = 0;
let map = null;

function initializeMap() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (window.jsVectorMap) {
                clearInterval(checkInterval);
                map = new window.jsVectorMap({
                    container: document.getElementById('map'),
                    map: 'world',
                    regionsSelectable: false,
                    markersSelectable: false,
                    zoomButtons: false,
                    zoomOnScroll: false,
                    backgroundColor: 'transparent',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    markerStyle: {
                        initial: {
                            r: 8, // Radius of markers
                            stroke: '#fff',
                            strokeWidth: 1
                        }
                    },
                    labels: {
                        markers: {
                            render: function(index) {
                                return map.markers[index].config.name;
                            }
                        }
                    },
                    onMarkerTooltipShow: function(event, tooltip, index) {
                        const marker = map.markers[index].config;
                        tooltip.text(marker.name + ': ' + marker.pingText);
                    }
                });
                resolve();
            }
        }, 100); // Проверяем каждые 100 мс
    });
}

window.onload = async () => {
    await initializeMap();

    async function fetchServers() {
        try {
            const response = await fetch('/servers');
            if (!response.ok) throw new Error('Server fetch failed');
            const serverData = await response.json();
            const parsedData = JSON.parse(serverData.data);
            const newOnline = parsedData[0]?.onlineCurrent || 0;
            animateOnlineCount(newOnline);
        } catch (error) {
            document.getElementById('online').innerText = 'Error';
            console.error('Error fetching servers:', error);
        }
    }

    function animateOnlineCount(target) {
        const element = document.getElementById('online');
        const difference = target - currentOnline;
        if (difference === 0) {
            element.style.color = '#000000';
            element.innerText = target;
            return;
        }

        const duration = 1000; // 1 секунда анимации
        const stepTime = 50; // Шаг в 50 мс
        const steps = duration / stepTime;
        const stepValue = difference / steps;
        let currentStep = 0;

        element.style.color = difference > 0 ? '#4bc63b' : '#c63b3b';

        const interval = setInterval(() => {
            currentStep++;
            const newValue = Math.round(currentOnline + stepValue * currentStep);
            element.innerText = newValue;
            if (currentStep >= steps) {
                clearInterval(interval);
                element.innerText = target;
                currentOnline = target;
                if (target === currentOnline) {
                    element.style.color = '#000000';
                }
            }
        }, stepTime);
    }

    async function fetchPing() {
        try {
            const response = await fetch('/ping');
            if (!response.ok) throw new Error('Ping fetch failed');
            const data = await response.json();
            updateMap(data);
        } catch (error) {
            console.error('Error fetching ping:', error);
        }
    }

    function updateMap(data) {
        if (!map) {
            console.error('Map not initialized');
            return;
        }

        const markers = [];
        data.pools.forEach(pool => {
            const coords = coordinates[pool.name];
            if (!coords) return;

            const pings = pool.tunnels.map(t => {
                const p = t.ping;
                if (p === 'Timeout' || p === 'Unreachable') return 9999;
                return parseInt(p.replace(' ms', ''), 10) || 9999;
            });

            const validPings = pings.filter(p => !isNaN(p));
            const avg = validPings.length ? validPings.reduce((a, b) => a + b, 0) / validPings.length : 9999;
            const color = avg < 50 ? '#00FF00' : avg < 150 ? '#FFD700' : '#FF0000';
            const pingText = avg >= 9999 ? 'Unreachable' : Math.round(avg) + ' ms';

            markers.push({
                coords: coords,
                name: pool.name,
                style: { fill: color },
                pingText: pingText
            });
        });

        map.removeAllMarkers();
        map.addMarkers(markers);
    }

    fetchServers();
    fetchPing();
    setInterval(() => {
        fetchServers();
        fetchPing();
    }, 10000);
};