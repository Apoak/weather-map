from flask import Flask, request, jsonify
from flask_cors import CORS # <-- 1. Import CORS
from shapely.geometry import shape, mapping
from shapely.ops import transform
import pyproj
import requests

app = Flask(__name__)
CORS(app)
# --- Database Setup (Placeholder for now) ---
# In a real project, this is where you'd set up your SQLAlchemy/PostGIS connection
MARKER_STORE = [] # Simple list for temporary storage (will be replaced by DB)

# So you need a route for each RESTapi command
@app.route('/api/marker', methods=['POST'])
def save_marker():
    """
    Receives marker coords from the frontend, calculates centroid, and stores it.
    """
    try:
        # 1. Receive data (GeoJSON)
        data = request.get_json()
        latitude = data.get('lat')
        longitude = data.get('lon')
        
        if latitude is None or longitude is None:
             return jsonify({'error': 'Missing coordinates'}), 400

        marker_data = {
            'id': len(MARKER_STORE) + 1,
            'lat': latitude,
            'lon': longitude,
            'name': f'Marker {len(MARKER_STORE) + 1}',
        }
        
        MARKER_STORE.append(marker_data)
        
        print(f"Marker saved at: ({latitude}, {longitude})")
        
        return jsonify({'message': 'Marker saved successfully', 'id': marker_data['id']}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 400
    
# --- Add a route here later to retrieve all polygons: @app.route('/api/polygons', methods=['GET'])
@app.route('/api/marker', methods=['GET'])
def get_markers():
    """
    Returns all stored markers and their data to the frontend.
    """
    # Simply return the entire list of stored polygon data as JSON
    return jsonify(MARKER_STORE), 200


# Route to get weather forecast for the lat lon coords
@app.route('/api/weather', methods=['GET'])
def get_Weather_forecast():
    """
    Fetches weather data for a given Lat/Lon point.
    Requires: lat and lon query parameters.
    """
    try:
        # 1. Get Lat/Lon from URL parameters
        latitude = request.args.get('lat', type=float)
        longitude = request.args.get('lon', type=float)

        if latitude is None or longitude is None:
            return jsonify({'error': 'Missing lat or lon parameters'})
        
        # 2. Buil;d the Open-Meteo API request
        # We request 5 days of hourly temperature and precipitation
        API_URL = "https://api.open-meteo.com/v1/forecast"
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'hourly': 'temperature_2m,weather_code,precipitation',
            "temperature_unit": "fahrenheit",
            'forecast_days': 5,
            'timezone': 'auto',
            'models': 'gfs_seamless' # Using the Global Forecast System model
        }

        # 3. Call the external API
        response = requests.get(API_URL, params=params)
        response.raise_for_status() 

        weather_data = response.json()

        # 4. Return data
        return jsonify(weather_data), 200
    
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': f"Weather API error: {e}"}), 502
    except Exception as e:
        return jsonify({'error': f"Internal server error {e}"}), 500



if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)

