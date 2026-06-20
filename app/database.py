import sqlite3
import pandas as pd
import os
import json
from app.engine.preprocessor import preprocess_data
from app.engine.hotspot import compute_criticality_mappings, add_criticality_scores
from app.engine.impact import add_impact_scores

DB_PATH = os.path.join("data", "trafficops.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def create_tables(conn):
    cursor = conn.cursor()
    # Create events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT,
        latitude REAL,
        longitude REAL,
        event_cause TEXT,
        requires_road_closure INTEGER,
        start_datetime TEXT,
        end_datetime TEXT,
        status TEXT,
        corridor TEXT,
        priority TEXT,
        zone TEXT,
        junction TEXT,
        resolution_time_minutes REAL,
        criticality_score REAL,
        traffic_impact_score REAL,
        Hour INTEGER,
        Day INTEGER,
        Month INTEGER,
        Weekday INTEGER,
        Weekend INTEGER
    )
    """)
    
    # Create location criticality table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS location_criticality (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_type TEXT, -- 'junction', 'corridor', 'zone'
        location_name TEXT,
        frequency_weight REAL
    )
    """)
    
    # Create predictions log table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT,
        event_cause TEXT,
        zone TEXT,
        corridor TEXT,
        junction TEXT,
        priority TEXT,
        requires_road_closure INTEGER,
        start_time TEXT,
        predicted_impact_score REAL,
        predicted_resolution_time REAL,
        burden_score REAL,
        officers INTEGER,
        barricades INTEGER,
        patrol_vehicles INTEGER
    )
    """)
    conn.commit()

def load_historical_data(conn, csv_path):
    cursor = conn.cursor()
    
    # Check if table already contains data
    cursor.execute("SELECT COUNT(*) FROM events")
    if cursor.fetchone()[0] > 0:
        print("Database already initialized with historical data.")
        return
        
    print(f"Reading and preprocessing raw dataset from {csv_path}...")
    df_raw = pd.read_csv(csv_path)
    df_clean = preprocess_data(df_raw)
    
    # Calculate criticality scores
    print("Calculating criticality mappings and scores...")
    mappings = compute_criticality_mappings(df_clean)
    df_clean = add_criticality_scores(df_clean, mappings)
    
    # Save criticality mappings to models directory for lookup
    os.makedirs("models", exist_ok=True)
    with open(os.path.join("models", "location_stats.json"), "w") as f:
        json.dump(mappings, f, indent=4)
        
    # Calculate impact scores
    print("Calculating traffic impact scores...")
    df_clean = add_impact_scores(df_clean)
    
    # Insert events into SQLite
    print("Loading events into database...")
    events_data = []
    for _, row in df_clean.iterrows():
        events_data.append((
            str(row.get('id', '')),
            str(row.get('event_type', '')),
            float(row.get('latitude', 0.0)),
            float(row.get('longitude', 0.0)),
            str(row.get('event_cause', '')),
            str(row.get('address', '')),
            1 if row.get('requires_road_closure', False) else 0,
            str(row.get('start_datetime', '')),
            str(row.get('end_datetime', '')),
            str(row.get('status', '')),
            str(row.get('corridor', '')),
            str(row.get('priority', '')),
            str(row.get('zone', '')),
            str(row.get('junction', '')),
            float(row.get('resolution_time_minutes', 0.0)),
            float(row.get('criticality_score', 0.0)),
            float(row.get('traffic_impact_score', 0.0)),
            int(row.get('Hour', 0)),
            int(row.get('Day', 1)),
            int(row.get('Month', 1)),
            int(row.get('Weekday', 0)),
            int(row.get('Weekend', 0))
        ))
        
    cursor.executemany("""
    INSERT INTO events (
        id, event_type, latitude, longitude, event_cause, requires_road_closure,
        start_datetime, end_datetime, status, corridor, priority, zone, junction,
        resolution_time_minutes, criticality_score, traffic_impact_score,
        Hour, Day, Month, Weekday, Weekend
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, events_data)
    
    # Insert criticality mapping values
    print("Loading criticality mappings into database...")
    mapping_data = []
    for loc_type, values in mappings.items():
        for loc_name, freq in values.items():
            mapping_data.append((loc_type, loc_name, freq))
            
    cursor.executemany("""
    INSERT INTO location_criticality (location_type, location_name, frequency_weight)
    VALUES (?, ?, ?)
    """, mapping_data)
    
    conn.commit()
    print("Database initialization complete.")

def initialize_database(csv_path="data/events.csv"):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db_connection()
    try:
        create_tables(conn)
        load_historical_data(conn, csv_path)
    finally:
        conn.close()

if __name__ == "__main__":
    # Test script execution
    initialize_database()
