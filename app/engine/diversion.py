import os
import traceback
import numpy as np
import networkx as nx

# Conditional imports of GIS packages
try:
    import osmnx as ox
    import shapely
    GIS_AVAILABLE = True
except ImportError:
    GIS_AVAILABLE = False

# Baseline speed in city traffic: 25 km/h -> ~6.94 m/s
CITY_SPEED_MPS = 25.0 * 1000.0 / 3600.0

def get_diversion_route(lat: float, lng: float, dist_m: float = 1000.0) -> dict:
    """
    Computes a diversion route around the given coordinates (lat, lng).
    Returns a dictionary with original route coordinates, diversion route coordinates,
    detour length difference, and detour duration estimation.
    """
    if not GIS_AVAILABLE:
        return get_fallback_route(lat, lng)
        
    try:
        # Set OSMnx config to be quiet
        ox.settings.log_console = False
        ox.settings.use_cache = True
        
        # 1. Download local road network (drive only)
        # We download a small bounding box or radius around the point.
        # 1000 meters is small enough to download in 2-3 seconds.
        G = ox.graph_from_point((lat, lng), dist=dist_m, network_type='drive')
        
        if len(G.nodes) < 2:
            return get_fallback_route(lat, lng)
            
        # 2. Find nearest edge to incident location
        # OSMnx nearest_edges takes (G, X, Y) where X is longitude and Y is latitude
        u, v, key = ox.nearest_edges(G, lng, lat)
        
        # Get edge data for length
        edge_data = G.get_edge_data(u, v, key)
        orig_length = edge_data.get('length', 100.0)
        
        # Save original node coordinates
        u_coords = (G.nodes[u]['y'], G.nodes[u]['x'])
        v_coords = (G.nodes[v]['y'], G.nodes[v]['x'])
        
        # 3. Simulate road closure by removing this edge
        # We copy graph first so we don't mutate cache
        G_closed = G.copy()
        if G_closed.has_edge(u, v, key):
            G_closed.remove_edge(u, v, key)
        # If it's a bidirectional road, remove the reverse edge too
        if G_closed.has_edge(v, u, key):
            G_closed.remove_edge(v, u, key)
            
        # 4. Compute alternative shortest path from u to v
        try:
            route = nx.shortest_path(G_closed, u, v, weight='length')
            
            # Extract route coordinates
            route_coords = [[G_closed.nodes[node]['y'], G_closed.nodes[node]['x']] for node in route]
            
            # Calculate route length
            alt_length = sum(ox.utils_graph.get_route_edge_attributes(G_closed, route, 'length'))
            
            # Difference
            diff_length = max(0.0, alt_length - orig_length)
            detour_time_sec = diff_length / CITY_SPEED_MPS
            detour_time_min = round(detour_time_sec / 60.0, 1)
            
            return {
                "success": True,
                "closure_point": [lat, lng],
                "closed_road": {
                    "start": [u_coords[0], u_coords[1]],
                    "end": [v_coords[0], v_coords[1]],
                    "length_m": round(orig_length, 1)
                },
                "original_route": [[u_coords[0], u_coords[1]], [v_coords[0], v_coords[1]]],
                "diversion_route": route_coords,
                "original_length_m": round(orig_length, 1),
                "diversion_length_m": round(alt_length, 1),
                "detour_length_m": round(diff_length, 1),
                "detour_time_minutes": max(1.0, detour_time_min),
                "engine": "OSMnx/NetworkX"
            }
            
        except nx.NetworkXNoPath:
            # If nodes are disconnected, return geometric detour
            return get_fallback_route(lat, lng, orig_length=orig_length)
            
    except Exception as e:
        print(f"Error in OSMnx diversion routing: {e}")
        # Print stack trace in debug but keep server running
        traceback.print_exc()
        return get_fallback_route(lat, lng)

def get_fallback_route(lat: float, lng: float, orig_length: float = 200.0) -> dict:
    """
    Generates a simple, plausible geometric rectangular detour around the closed point.
    Guarantees a valid return path even in offline mode.
    """
    # Offset coordinates by ~150 meters for start/end
    # 0.0015 latitude is roughly 165 meters
    lat_start = lat - 0.0015
    lng_start = lng - 0.0015
    
    lat_end = lat + 0.0015
    lng_end = lng + 0.0015
    
    # Detour takes a rectangular path around the coordinate
    # Start -> Top-Left -> Top-Right -> End
    diversion_route = [
        [lat_start, lng_start],
        [lat_start + 0.003, lng_start],       # go north
        [lat_start + 0.003, lng_end],         # go east
        [lat_end, lng_end]                    # go south to target
    ]
    
    original_route = [
        [lat_start, lng_start],
        [lat_end, lng_end]
    ]
    
    # Calculate approximate lengths
    # straight line is ~470m
    direct_dist = 470.0
    # detour goes north 330m, east 330m, south 165m -> total ~825m
    alt_dist = 825.0
    
    diff_length = alt_dist - direct_dist
    detour_time_min = round((diff_length / CITY_SPEED_MPS) / 60.0, 1)
    
    return {
        "success": True,
        "closure_point": [lat, lng],
        "closed_road": {
            "start": [lat_start, lng_start],
            "end": [lat_end, lng_end],
            "length_m": round(direct_dist, 1)
        },
        "original_route": original_route,
        "diversion_route": diversion_route,
        "original_length_m": round(direct_dist, 1),
        "diversion_length_m": round(alt_dist, 1),
        "detour_length_m": round(diff_length, 1),
        "detour_time_minutes": max(1.0, detour_time_min),
        "engine": "Geometric Fallback Engine (Offline)"
    }
