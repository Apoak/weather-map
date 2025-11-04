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
  drawPolygon: true,
  editMode: true,
  dragMode: true,
  removalMode: true,
});

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

async function savePolygonToBackend(layer) {
    // 1. Convert the Leaflet layer to standard GeoJSON Feature format
    const geojsonFeature = layer.toGeoJSON();

    try {
        const response = await fetch('http://127.0.0.1:5000/api/polygon', {
            // REST API
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // The body is the JSON data being sent to the Flask server
            body: JSON.stringify(geojsonFeature)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Backend Response:', result);
    } catch (error) {
        console.error('Failed to save polygon:', error);
    }
}

// Listen for ANT layer creation event from Geoman
// SO this is the code that is always waiting for an event to happen,
// it waits for the event and then delegates it to the propper function.
//map.on('pm:create', handleCreatedLayer);
map.on('pm:create', (e) => {
    // 1. Process and set up the popup logic (from our last successful step)
    handleCreatedLayer(e); // Assuming you kept the previous function structure
    
    // 2. SEND THE DATA TO THE PYTHON BACKEND
    savePolygonToBackend(e.layer); 
});

