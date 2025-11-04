from flask import Flask, request, jsonify
from flask_cors import CORS # <-- 1. Import CORS
from shapely.geometry import shape, mapping
from shapely.ops import transform
import pyproj

app = Flask(__name__)
CORS(app)
# --- Database Setup (Placeholder for now) ---
# In a real project, this is where you'd set up your SQLAlchemy/PostGIS connection
POLYGON_STORE = [] # Simple list for temporary storage (will be replaced by DB)

@app.route('/api/polygon', methods=['POST'])
def save_polygon():
    """
    Receives GeoJSON from the frontend, calculates centroid, and stores it.
    """
    try:
        # 1. Receive data (GeoJSON)
        data = request.get_json()
        polygon_geojson = data.get('geometry')
        properties = data.get('properties', {})
        
        # 2. Process: Convert GeoJSON to a Shapely object
        # Shapely is used for all geometric calculations
        polygon_shape = shape(polygon_geojson)
        
        # Calculate the Centroid (The center point for the weather API call)
        # NOTE: For large areas, simple centroid might be inaccurate.
        # A project's true centroid might be better for an API call.
        centroid = polygon_shape.centroid
        
        # 3. Prepare data for storage/response
        polygon_data = {
            'geojson': mapping(polygon_shape),
            'centroid': (centroid.y, centroid.x), # (Lat, Lon) format
            'name': properties.get('name', f'Polygon {len(POLYGON_STORE) + 1}'),
            # Add other data like creation time, user ID, etc.
        }
        
        # 4. Persist data (Temporary list storage)
        POLYGON_STORE.append(polygon_data)
        
        print(f"Polygon saved. Centroid: {polygon_data['centroid']}")
        
        return jsonify({'message': 'Polygon saved successfully', 'id': len(POLYGON_STORE)}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 400

# --- Add a route here later to retrieve all polygons: @app.route('/api/polygons', methods=['GET'])

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)