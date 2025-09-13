// ===== CONFIG =====
const config = {
    spotifyClientId: "212b06b3ee574cc2b7b90a58446eb4df",
    spotifyRedirectUri: "https://charliefdgfdgfd.github.io/mypersonalmapsnew"
};

// ===== MAP & ROUTING =====
const map = L.map('map').setView([51.505, -0.09], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

const routingControl = L.Routing.control({ waypoints: [], routeWhileDragging: true }).addTo(map);

// ===== SPEED LIMIT =====
async function fetchSpeedLimit(lat, lon){
    const query = `[out:json];way(around:50,${lat},${lon})[highway];out tags center 1;`;
    const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);
    try {
        const response = await fetch(url);
        const data = await response.json();
        let speed = "--";
        if(data.elements.length > 0){
            for(let way of data.elements){
                if(way.tags && way.tags.maxspeed){
                    speed = way.tags.maxspeed;
                    break;
                }
            }
        }
        document.getElementById("speedLimit").textContent = speed;
    } catch {
        document.getElementById("speedLimit").textContent = "--";
    }
}

function updateSpeedLimit(){
    if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos => fetchSpeedLimit(pos.coords.latitude, pos.coords.longitude));
    }
}

setInterval(updateSpeedLimit, 10000);
updateSpeedLimit();

// ===== WEATHER =====
async function fetchWeather(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    const data = await res.json();
    const weather = data.current_weather;
    document.getElementById("temperature").textContent = `Temp: ${weather.temperature}°C`;
    document.getElementById("details").textContent = `Wind: ${weather.windspeed} km/h`;

    let icon = "wi wi-day-sunny";
    if(weather.weathercode>=51 && weather.weathercode<=67) icon="wi wi-rain";
    if(weather.weathercode>=71 && weather.weathercode<=77) icon="wi wi-snow";
    if(weather.weathercode==3) icon="wi wi-cloudy";

    document.getElementById("weatherIcon").className = icon;
}

if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude, pos.coords.longitude));
}

// ===== SPOTIFY =====
let _token = null;

window.addEventListener("load", () => {
    const hash = window.location.hash.substring(1).split("&").reduce((acc, item) => {
        if(item){
            const parts = item.split("=");
            acc[parts[0]] = decodeURIComponent(parts[1]);
        }
        return acc;
    }, {});
    if(hash.access_token){
        _token = hash.access_token;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("player").style.display = "block";
        initializePlayer();
    }
});

document.getElementById("loginBtn").addEventListener("click", () => {
    const scopes = "streaming user-read-playback-state user-modify-playback-state user-read-currently-playing";
    window.open(
        `https://accounts.spotify.com/authorize?client_id=${config.spotifyClientId}&response_type=token&redirect_uri=${encodeURIComponent(config.spotifyRedirectUri)}&scope=${encodeURIComponent(scopes)}`,
        '_blank'
    );
});

function initializePlayer(){
    window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new Spotify.Player({
            name: 'Car Dashboard Player',
            getOAuthToken: cb => cb(_token),
            volume: 0.5
        });

        player.addListener('player_state_changed', state => {
            if(!state) return;
            const track = state.track_window.current_track;
            document.getElementById("trackName").textContent = track.name;
            document.getElementById("artistName").textContent = track.artists.map(a => a.name).join(", ");
            document.getElementById("albumArt").src = track.album.images[0].url;
        });

        player.connect();

        document.getElementById("playPauseBtn").addEventListener("click", () => { player.togglePlay(); });
        document.getElementById("nextBtn").addEventListener("click", () => { player.nextTrack(); });
        document.getElementById("prevBtn").addEventListener("click", () => { player.previousTrack(); });

        // ===== SEARCH =====
        const resultsDiv = document.getElementById("searchResults");
        document.getElementById("searchBtn").addEventListener("click", async () => {
            const query = document.getElementById("spotifySearch").value;
            if(!query) return;
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
                headers:{ Authorization:`Bearer ${_token}` }
            });
            const data = await res.json();
            resultsDiv.innerHTML = "";
            if(data.tracks.items.length > 0){
                data.tracks.items.forEach(track => {
                    const div = document.createElement("div");
                    div.textContent = `${track.name} - ${track.artists.map(a=>a.name).join(", ")}`;
                    div.addEventListener("click", async () => {
                        await fetch(`https://api.spotify.com/v1/me/player/play`, {
                            method:'PUT',
                            body: JSON.stringify({uris:[track.uri]}),
                            headers:{ Authorization:`Bearer ${_token}` }
                        });
                    });
                    resultsDiv.appendChild(div);
                });
            }
        });
    };
}
