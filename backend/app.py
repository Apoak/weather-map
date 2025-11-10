from flask import Flask, request, jsonify
from flask_cors import CORS # <-- 1. Import CORS
from shapely.geometry import shape, mapping
from shapely.ops import transform
import datetime
import pyproj
import requests
from timezonefinder import TimezoneFinder
import pytz 

app = Flask(__name__)
CORS(app)
# --- Database Setup (Placeholder for now) ---
# In a real project, this is where you'd set up your SQLAlchemy/PostGIS connection
MARKER_STORE = [] # Simple list for temporary storage (will be replaced by DB)
tf = TimezoneFinder()

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
        
        return jsonify({'message': 'Marker saved successfully', 'id': marker_data}), 201

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


@app.route('/api/markers/<int:marker_id>', methods=['DELETE'])
def delete_marker(marker_id):
    return jsonify({"DELETE"})
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
        # 1. Determine local timezone for accurate calculation
        # Since you used 'timezone': 'auto' in params, we should use that logic 
        # to get the local time. However, to keep it simple and directly match the API 
        # request, we will get the current time and rely on the API's timezone logic.

        # Get current UTC time and format it as ISO 8601, rounded to the hour
        # Open-Meteo is robust in handling this.

        iana_timezone = get_timezone_from_coords(latitude, longitude)
        if not iana_timezone:
            return jsonify({'error': 'Could not determine local timezone.'}), 400
          
        timezone_param = iana_timezone

        start_hour, end_hour = calculate_time(timezone_param)

        # now_utc = datetime.datetime.now(datetime.timezone.utc)
        # start_hour_str = now_utc.strftime('%Y-%m-%dT%H:00')
        # print(start_hour_str)
        # Calculate the end time: Current time + (5 days * 24 hours) = 120 hours
        # If you want exactly 5 full days from midnight, this logic must change. 
        # Sticking to 5 days *from the current hour*.
        # end_time = now_utc + datetime.timedelta(hours=120) 
        # end_hour_str = end_time.strftime('%Y-%m-%dT%H:00')


        API_URL = "https://api.open-meteo.com/v1/forecast"
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'hourly': 'temperature_2m,weather_code,precipitation,precipitation_probability', 
            "temperature_unit": "fahrenheit",
            # 'forecast_days': 5, 
            # ADDED: start_hour and end_hour parameters
            'start_hour': start_hour, 
            'end_hour': end_hour,
            'timezone': timezone_param,
            'models': 'gfs_seamless',
            'precipitation_unit': 'inch' 
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

def get_timezone_from_coords(latitude, longitude):
    """
    Returns the IANA timezone string (e.g., 'America/New_York') for the given coordinates.
    Returns None if no timezone is found (e.g., in open ocean).
    """
    # The timezone_at method requires longitude first, then latitude.
    timezone_name = tf.timezone_at(lng=longitude, lat=latitude)
    
    # Use closest_timezone_at for coordinates far out at sea where no polygon exists,
    # though this is less accurate and usually unnecessary for land clicks.
    # if timezone_name is None:
    #     timezone_name = tf.closest_timezone_at(lng=longitude, lat=latitude)
        
    return timezone_name

def calculate_time(iana_timezone):
    # 2. Calculate Local Start and End Hours
    try:
        # Set the Timezone object
        tz = pytz.timezone(iana_timezone)
        
        # Get the current time localized to the user's location
        now_local = datetime.datetime.now(tz)
        
        # Start hour is the current time, truncated to the hour, formatted to ISO 8601
        start_time = now_local.strftime('%Y-%m-%dT%H:00')
        
        # End time: 5 days (120 hours) from the current hour
        end_dt = now_local + datetime.timedelta(hours=120) 
        end_time = end_dt.strftime('%Y-%m-%dT%H:00')

    except Exception as e:
        return jsonify({'error': f"Time calculation error: {e}"}), 500
    
    return start_time, end_time
    
if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)

