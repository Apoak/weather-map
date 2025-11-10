// script.js
// Initialize the Leaflet map centered on something (like San Luis Obispo)
const map = L.map('map').setView([35.2828, -120.6596], 13);

// Add the OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Enable Geoman controls (for drawing polygons)
map.pm.addControls({
  position: 'topleft',
  drawPolygon: false,
  drawMarker: true,
  editMode: true,
  dragMode: true,
  removalMode: true,
});

// --- Function to Fetch and Display Weather ---
async function fetchAndDisplayWeather(layer) {
    const coords = layer.getLatLng();
    const lat = coords.lat;
    const lon = coords.lng;

    // Set a loading message in the popup
    layer.setPopupContent("<h4>Fetching Weather...</h4>").openPopup();

    try{
        // 1. Call your Flask Weather API endpoint
        const api_url = `http://127.0.0.1:5000/api/weather?lat=${lat}&lon=${lon}`;
        const response = await fetch(api_url);

        if (!response.ok){
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const weatherData = await response.json()

        // 2. Generate detailed HTML forecast (simplified for this example)
        const forecastHTML = generateForecastHTML(weatherData);

        // 3. Update the popup content with the forecast
        layer.setPopupContent(forecastHTML);

    } catch (error) {
        console.error('Weather fetching failed:', error);
        layer.setPopupContent(`<h4>Error loading weather:</h4><p>${error.message}</p>`);
    }
} 

function generateForecastHTML(data){
    const hourly = data.hourly
    // Just display the first few hours of temperature and precipitation FOR NOW
    let html = `<h4>5-Day Forecast (GFS Model)</h4>
                <p>Timezone: ${data.timezone}</p>
                <hr>
                <table>
                    <tr><th>Time</th><th>Temp (°C)</th><th>Rain (mm)</th></tr>`;

    for (let i = 0; i < 6; i++) { // Show 6 hours
        const time = new Date(hourly.time[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `<tr>
                    <td>${time}</td>
                    <td>${hourly.temperature_2m[i].toFixed(1)}</td>
                    <td>${hourly.precipitation[i].toFixed(1)}</td>
                 </tr>`;
    }
    html += `</table>`;
    return html;
}

async function loadSavedMarkers() {
    try {
        // Fetch data from the new GET endpoint
        const response = await fetch('http://127.0.0.1:5000/api/marker');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // The response will be an array of objects, not pure GeoJSON features yet
        const storedMarkers = await response.json();

        console.log(`Loaded ${storedMarkers.length} marker(s) from backend.`);

        // Iterate over the loaded data
        storedMarkers.forEach(markerData => {
            // Create a new Leaflet marker object using the loaded coordinates
            const marker = L.marker([markerData.lat, markerData.lon]).addTo(map);

            // 1. NEW/FIXED: Bind the INITIAL static popup content to the loaded marker
            const initialPopupContent = `Marker ${markerData.id} at: ${markerData.lat.toFixed(4)}, ${markerData.lon.toFixed(4)}`;
            marker.bindPopup(initialPopupContent); // <--- THIS LINE IS CRUCIAL
            
            // 2. Attach the weather fetch logic to the 'popupopen' event
            marker.on('popupopen', () => {
                fetchAndDisplayWeather(marker);
            });
        });

    } catch (error) {
        console.error('Failed to load markers:', error);
    }
}

loadSavedMarkers();

// --- Function to Handle Layer Creation and Popups ---
// e is the event that is passed to this function
function handleCreatedLayer(e) {
    const layer = e.layer
    const geojson = layer.toGeoJSON();

    // --- Core Logic: Attaching the Click Event ---

  // The content will be a simple HTML string showing the object's coordinates.
  const popupContnet = createCoordinatesPopup(layer);

  // bind the popup to the layer
  layer.bindPopup(popupContnet)
}

// Function to generate the HTML content for the popup
function createCoordinatesPopup(layer){
    let coords;
    let type = layer.toGeoJSON().geometry.type;

    // Different geometry types have different ways of getting coords
    if (type === 'Point') {
        coords = layer.getLatLng();
        return `
            <h4>Coordinates for ${type}</h4>
            <p>Lat: ${coords.lat.toFixed(4)}</p>
            <p>Lon: ${coords.lng.toFixed(4)}</p>
            <hr>
            <p>Ready for Weather API call!</p>
        `;
     } else {
        // Handles Polygon, LineString, Rectangle, Circle, etc.
        // Flatten the array of coordinates for easier access.
        // .flat() method recursively flattens array structures.
        const allLatLngs = layer.getLatLngs().flat(Infinity);
        const firstPoint = allLatLngs[0];
        // --- FIX END ---

        if (!firstPoint) {
            // Safety check for empty shapes (e.g., a line with only one click)
            return `<h4>Cannot determine coordinates. Shape is empty.</h4>`;
        }

        return `
            <h4>Coordinates for ${type}</h4>
            <p>This shape has **${allLatLngs.length}** vertices.</p>
            <p>First Point: Lat: ${firstPoint.lat.toFixed(4)}, Lon: ${firstPoint.lng.toFixed(4)}</p>
            <hr>
            <p>This is the data you'll send to your Python backend.</p>
        `;
    }
}

// Function to send GeoJSON to the Flask backend (Communicates with the back end)
// using async signals that this has a promise. Used synchronously with await.

async function saveMarkerToBackend(layer) {
    // 1. Convert the Leaflet layer to standard GeoJSON Feature format
    const coords = layer.getLatLng(); // Returns an object like: {lat: 34.05, lng: -118.25}
    // 2. **CHANGE:** Construct the simple data payload
    const markerData = {
        // Use 'lat' and 'lon' keys to match the Flask backend's expected JSON format
        lat: coords.lat, 
        lon: coords.lng
    };

    // try block
    try {
        // request the response from backend
        const response = await fetch('http://127.0.0.1:5000/api/marker', {
            // REST API
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // The body is the JSON data being sent to the Flask server
            body: JSON.stringify(markerData)
        });
        // check the response
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // await command is the other half of the pormise signaled by async
        const result = await response.json();
        console.log('Backend Response: (Marker Save', result);
    } catch (error) {
        console.error('Failed to save polygon:', error);
    }
}


// Listen for ANT layer creation event from Geoman
// SO this is the code that is always waiting for an event to happen,
// it waits for the event and then delegates it to the propper function.
//map.on('pm:create', handleCreatedLayer);
map.on('pm:create', (e) => {
    const layer = e.layer;
    
    // 1. SAVE marker to backend (Optional, but should be here if you want persistence)
    saveMarkerToBackend(layer); 
    
    // 2. NEW/FIXED: Bind the INITIAL static popup content
    // You can use a generic message or the coordinate function here.
    const initialPopupContent = `Marker at: ${layer.getLatLng().lat.toFixed(4)}, ${layer.getLatLng().lng.toFixed(4)}`;
    layer.bindPopup(initialPopupContent); // <--- THIS LINE IS CRUCIAL

    // 3. Attach the weather fetch logic to the 'popupopen' event
    layer.on('popupopen', () => {
        // This is where fetchAndDisplayWeather runs
        fetchAndDisplayWeather(layer);
    });
});