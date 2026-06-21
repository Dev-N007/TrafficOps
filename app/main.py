import os
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from catboost import CatBoostRegressor

from app.models import (
    PredictRequest, PredictResponse,
    RecommendRequest, RecommendResponse,
    DiversionRequest, DiversionResponse,
    HotspotsResponse, AnalyticsResponse, HotspotItem, HotspotCoordinates
)
from app.database import get_db_connection, initialize_database
from app.config import (
    load_resource_thresholds,
    BURDEN_WEIGHT_IMPACT, BURDEN_WEIGHT_DURATION,
    BURDEN_WEIGHT_ROAD_CLOSURE, BURDEN_WEIGHT_CRITICALITY,
    DURATION_SCORE_CAP_MINUTES
)
from app.engine.diversion import get_diversion_route
from app.engine.hotspot import get_criticality_score

# Initialize FastAPI App
app = FastAPI(title="TrafficOps API", description="AI-powered Event Traffic Impact Forecasting and Response System")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development allow all. Can restrict to localhost:3000 in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model pointers
model_impact = None
model_duration = None
location_stats = None
feature_importances = None

@app.on_event("startup")
def startup_event():
    global model_impact, model_duration, location_stats, feature_importances
    
    # 1. Initialize database if it doesn't exist
    db_path = os.path.join("data", "trafficops.db")
    if not os.path.exists(db_path):
        print("Database not found. Initializing...")
        initialize_database()
        
    # 2. Load location statistics
    stats_path = os.path.join("models", "location_stats.json")
    if os.path.exists(stats_path):
        with open(stats_path, "r") as f:
            location_stats = json.load(f)
    else:
        print("Warning: location_stats.json not found.")
        location_stats = {"junction": {}, "corridor": {}, "zone": {}}
        
    # 3. Load feature importances
    imp_path = os.path.join("models", "feature_importances.json")
    if os.path.exists(imp_path):
        with open(imp_path, "r") as f:
            feature_importances = json.load(f)
    else:
        feature_importances = {}
        
    # 4. Load trained CatBoost models
    impact_model_path = os.path.join("models", "traffic_impact_model.cbor")
    duration_model_path = os.path.join("models", "resolution_time_model.cbor")
    
    if os.path.exists(impact_model_path) and os.path.exists(duration_model_path):
        model_impact = CatBoostRegressor()
        model_impact.load_model(impact_model_path)
        
        model_duration = CatBoostRegressor()
        model_duration.load_model(duration_model_path)
        print("Models loaded successfully.")
    else:
        print("Warning: Trained models not found in models/. Running inference will fail.")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "available" if os.path.exists(os.path.join("data", "trafficops.db")) else "unavailable",
        "models_loaded": model_impact is not None and model_duration is not None
    }

@app.get("/analytics", response_model=AnalyticsResponse)
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get total events
        cursor.execute("SELECT COUNT(*) FROM events")
        total_events = cursor.fetchone()[0]
        
        if total_events == 0:
            return {
                "cause_distribution": {}, "planned_vs_unplanned": {}, "resolution_time_trends": [],
                "monthly_trends": [], "total_events": 0, "avg_resolution_time": 0.0,
                "high_risk_zone": "None", "top_junction": "None"
            }
            
        # Get average resolution time
        cursor.execute("SELECT AVG(resolution_time_minutes) FROM events")
        avg_res_time = cursor.fetchone()[0] or 0.0
        
        # High Risk Zone (zone with highest average traffic impact score)
        cursor.execute("""
            SELECT zone, COUNT(*), AVG(traffic_impact_score) as avg_score 
            FROM events 
            WHERE zone != 'Unknown Zone' 
            GROUP BY zone 
            ORDER BY avg_score DESC LIMIT 1
        """)
        row = cursor.fetchone()
        high_risk_zone = row['zone'] if row else "Unknown"
        
        # Top Junction (junction with most incidents)
        cursor.execute("""
            SELECT junction, COUNT(*) as cnt 
            FROM events 
            WHERE junction != 'Unknown Junction' 
            GROUP BY junction 
            ORDER BY cnt DESC LIMIT 1
        """)
        row = cursor.fetchone()
        top_junction = row['junction'] if row else "Unknown"
        
        # Cause Distribution
        cursor.execute("SELECT event_cause, COUNT(*) as cnt FROM events GROUP BY event_cause ORDER BY cnt DESC")
        cause_distribution = {row['event_cause']: row['cnt'] for row in cursor.fetchall()}
        
        # Planned vs Unplanned
        cursor.execute("SELECT event_type, COUNT(*) as cnt FROM events GROUP BY event_type")
        planned_vs_unplanned = {row['event_type']: row['cnt'] for row in cursor.fetchall()}
        
        # Average resolution time by cause
        cursor.execute("""
            SELECT event_cause, AVG(resolution_time_minutes) as avg_dur, COUNT(*) as cnt
            FROM events 
            GROUP BY event_cause
            ORDER BY avg_dur DESC
        """)
        resolution_time_trends = [
            {"cause": row['event_cause'], "avg_duration_minutes": round(row['avg_dur'], 1), "count": row['cnt']}
            for row in cursor.fetchall()
        ]
        
        # Monthly trends
        cursor.execute("""
            SELECT Month, COUNT(*) as cnt, AVG(traffic_impact_score) as avg_score
            FROM events
            GROUP BY Month
            ORDER BY Month ASC
        """)
        months_map = {1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"}
        monthly_trends = [
            {"month": months_map.get(row['Month'], str(row['Month'])), "count": row['cnt'], "avg_impact": round(row['avg_score'], 1)}
            for row in cursor.fetchall()
        ]
        
        return {
            "cause_distribution": cause_distribution,
            "planned_vs_unplanned": planned_vs_unplanned,
            "resolution_time_trends": resolution_time_trends,
            "monthly_trends": monthly_trends,
            "total_events": total_events,
            "avg_resolution_time": round(avg_res_time, 1),
            "high_risk_zone": high_risk_zone,
            "top_junction": top_junction
        }
    finally:
        conn.close()

@app.get("/hotspots", response_model=HotspotsResponse)
def get_hotspots():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Heatmap coordinates (sample 500 events to keep rendering fast but representative)
        cursor.execute("""
            SELECT latitude, longitude, traffic_impact_score, event_cause, address 
            FROM events 
            ORDER BY traffic_impact_score DESC LIMIT 500
        """)
        heatmap_data = [
            HotspotCoordinates(
                latitude=row['latitude'],
                longitude=row['longitude'],
                impact=row['traffic_impact_score'],
                cause=row['event_cause'],
                address=row['address'] if 'address' in row.keys() else ""
            ) for row in cursor.fetchall()
        ]
        
        # Critical Junctions (most frequent)
        cursor.execute("""
            SELECT junction, COUNT(*) as cnt, AVG(criticality_score) as avg_crit 
            FROM events 
            WHERE junction != 'Unknown Junction' 
            GROUP BY junction 
            ORDER BY cnt DESC LIMIT 10
        """)
        critical_junctions = [
            HotspotItem(name=row['junction'], count=row['cnt'], criticality=round(row['avg_crit'], 1))
            for row in cursor.fetchall()
        ]
        
        # Critical Corridors
        cursor.execute("""
            SELECT corridor, COUNT(*) as cnt, AVG(criticality_score) as avg_crit 
            FROM events 
            WHERE corridor != 'Unknown Corridor' 
            GROUP BY corridor 
            ORDER BY cnt DESC LIMIT 10
        """)
        critical_corridors = [
            HotspotItem(name=row['corridor'], count=row['cnt'], criticality=round(row['avg_crit'], 1))
            for row in cursor.fetchall()
        ]
        
        # Critical Zones
        cursor.execute("""
            SELECT zone, COUNT(*) as cnt, AVG(criticality_score) as avg_crit 
            FROM events 
            WHERE zone != 'Unknown Zone' 
            GROUP BY zone 
            ORDER BY cnt DESC LIMIT 10
        """)
        critical_zones = [
            HotspotItem(name=row['zone'], count=row['cnt'], criticality=round(row['avg_crit'], 1))
            for row in cursor.fetchall()
        ]
        
        return HotspotsResponse(
            critical_junctions=critical_junctions,
            critical_corridors=critical_corridors,
            critical_zones=critical_zones,
            heatmap_data=heatmap_data
        )
    finally:
        conn.close()

@app.post("/predict", response_model=PredictResponse)
def predict_traffic(req: PredictRequest):
    global model_impact, model_duration, location_stats, feature_importances
    
    if model_impact is None or model_duration is None:
        raise HTTPException(status_code=500, detail="Models are not loaded on server.")
        
    try:
        # 1. Parse date features
        try:
            dt = datetime.strptime(req.start_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                dt = datetime.fromisoformat(req.start_time.replace("Z", ""))
            except ValueError:
                dt = datetime.now()
                
        hour = dt.hour
        day = dt.day
        month = dt.month
        weekday = dt.weekday()
        weekend = 1 if weekday >= 5 else 0
        
        # 2. Get location stats/criticality
        crit_score = get_criticality_score(req.junction, req.corridor, req.zone, location_stats)
        
        # 3. Create feature structure
        feature_dict = {
            'event_type': req.event_type,
            'event_cause': req.event_cause,
            'zone': req.zone,
            'corridor': req.corridor,
            'junction': req.junction,
            'priority': req.priority,
            'requires_road_closure': 1 if req.requires_road_closure else 0,
            'Hour': hour,
            'Day': day,
            'Month': month,
            'Weekday': weekday,
            'Weekend': weekend
        }
        
        # Convert dictionary values to match model columns in correct order
        features_ordered = [
            'event_type', 'event_cause', 'zone', 'corridor', 'junction', 
            'priority', 'requires_road_closure', 'Hour', 'Day', 'Month', 
            'Weekday', 'Weekend'
        ]
        
        # Prepare input row
        input_data = [feature_dict[f] for f in features_ordered]
        
        # 4. Predict
        predicted_impact = float(model_impact.predict(input_data))
        predicted_duration = float(model_duration.predict(input_data))
        
        # Clamp predictions to valid ranges
        predicted_impact = max(0.0, min(100.0, predicted_impact))
        predicted_duration = max(5.0, predicted_duration) # Minimum 5 minutes resolution
        
        # 5. Generate human-readable explanation
        impact_level = "High" if predicted_impact > 60 else ("Medium" if predicted_impact > 30 else "Low")
        duration_hrs = round(predicted_duration / 60.0, 1)
        
        explanation = f"Incident classified with {impact_level} traffic impact. "
        reasons = []
        if req.requires_road_closure:
            reasons.append("requires a complete road closure, which severely affects block throughput")
        if req.priority == "High":
            reasons.append("has High operational priority")
        if crit_score > 50.0:
            reasons.append(f"occurs at a historically congested location ({req.junction}/{req.corridor}) with a criticality of {crit_score}%")
        else:
            reasons.append(f"occurs at a location with low historical frequency (criticality: {crit_score}%)")
            
        if req.event_cause in ['accident', 'water_logging', 'construction']:
            reasons.append(f"is caused by '{req.event_cause}', which historically requires significant cleanup and coordination")
            
        explanation += "This is because the event " + ", ".join(reasons) + ". "
        explanation += f"The expected resolution time is {round(predicted_duration, 1)} minutes (~{duration_hrs} hours) due to the complexity of resolving a '{req.event_cause}' event under '{req.priority}' priority."
        
        # 6. Extract global importance maps
        global_imp = feature_importances.get("impact_model", {}).get("feature_importances", {})
        
        return PredictResponse(
            predicted_impact_score=round(predicted_impact, 2),
            predicted_resolution_time=round(predicted_duration, 1),
            criticality_score=crit_score,
            features_used=features_ordered,
            global_importance=global_imp,
            explanation=explanation
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

@app.post("/recommend", response_model=RecommendResponse)
def recommend_resources(req: RecommendRequest):
    try:
        # Calculate Duration Score (normalized to 100 based on 8 hour shift cap)
        norm_duration = min(req.predicted_resolution_time, DURATION_SCORE_CAP_MINUTES)
        duration_score = (norm_duration / DURATION_SCORE_CAP_MINUTES) * 100.0
        
        # Road Closure Score: 100 if closure is required, else 0
        closure_score = 100.0 if req.requires_road_closure else 0.0
        
        # Formula: Burden = 40% Impact + 30% Duration + 20% Closure + 10% Criticality
        burden_score = (
            BURDEN_WEIGHT_IMPACT * req.predicted_impact_score +
            BURDEN_WEIGHT_DURATION * duration_score +
            BURDEN_WEIGHT_ROAD_CLOSURE * closure_score +
            BURDEN_WEIGHT_CRITICALITY * req.criticality_score
        )
        
        burden_score = round(max(0.0, min(100.0, burden_score)), 2)
        
        # Load resource thresholds
        thresholds = load_resource_thresholds()
        
        # Find matching recommendation
        officers = 2
        barricades = 2
        patrol_vehicles = 0
        
        for thresh in thresholds:
            if thresh["min_score"] <= burden_score <= thresh["max_score"]:
                officers = thresh["officers"]
                barricades = thresh["barricades"]
                patrol_vehicles = thresh["patrol_vehicles"]
                break
                
        # Generate explanation
        explanation = f"Recommended assets: {officers} Officers, {barricades} Barricades, and {patrol_vehicles} Patrol Vehicles. "
        explanation += f"This recommendation is derived from the Operational Burden Score ({burden_score}%), which evaluates: "
        explanation += f"1) Predicted traffic impact of {round(req.predicted_impact_score, 1)}% (weight: 40%); "
        explanation += f"2) Expected incident duration of {round(req.predicted_resolution_time, 1)} minutes (weight: 30%); "
        explanation += f"3) Road closure status of {'Required' if req.requires_road_closure else 'Not Required'} (weight: 20%); "
        explanation += f"4) Location criticality score of {round(req.criticality_score, 1)}% (weight: 10%)."
        
        # Log the recommendation to the database
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO predictions_log (
                    event_type, event_cause, zone, corridor, junction, priority,
                    requires_road_closure, start_time, predicted_impact_score,
                    predicted_resolution_time, burden_score, officers,
                    barricades, patrol_vehicles
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                req.event_type,
                req.event_cause,
                req.zone,
                req.corridor,
                req.junction,
                req.priority,
                1 if req.requires_road_closure else 0,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                req.predicted_impact_score,
                req.predicted_resolution_time,
                burden_score,
                officers,
                barricades,
                patrol_vehicles
            ))
            conn.commit()
        except Exception as db_err:
            print("Failed to log prediction to db:", db_err)
        finally:
            conn.close()
            
        return RecommendResponse(
            burden_score=burden_score,
            officers=officers,
            barricades=barricades,
            patrol_vehicles=patrol_vehicles,
            explanation=explanation,
            thresholds=thresholds
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation engine error: {e}")

@app.post("/diversion", response_model=DiversionResponse)
def simulate_diversion(req: DiversionRequest):
    res = get_diversion_route(req.latitude, req.longitude)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail="Failed to calculate diversion path.")
    return res

@app.get("/recent_predictions")
def get_recent_predictions(limit: int = 5):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, timestamp, event_type, event_cause, zone, corridor, junction, priority,
                   requires_road_closure, predicted_impact_score, predicted_resolution_time, 
                   burden_score, officers, barricades, patrol_vehicles 
            FROM predictions_log 
            ORDER BY id DESC LIMIT ?
        """, (limit,))
        
        predictions = []
        for row in cursor.fetchall():
            predictions.append({
                "id": row['id'],
                "timestamp": row['timestamp'],
                "event_type": row['event_type'],
                "event_cause": row['event_cause'],
                "zone": row['zone'],
                "corridor": row['corridor'],
                "junction": row['junction'],
                "priority": row['priority'],
                "requires_road_closure": bool(row['requires_road_closure']),
                "predicted_impact_score": row['predicted_impact_score'],
                "predicted_resolution_time": row['predicted_resolution_time'],
                "burden_score": row['burden_score'],
                "officers": row['officers'],
                "barricades": row['barricades'],
                "patrol_vehicles": row['patrol_vehicles']
            })
        return predictions
    finally:
        conn.close()
