import pandas as pd
import numpy as np

# Severity weights for different event causes
EVENT_CAUSE_WEIGHTS = {
    'accident': 0.9,
    'construction': 0.8,
    'road_closure': 0.8,
    'water_logging': 0.7,
    'protest': 0.7,
    'procession': 0.7,
    'vip_movement': 0.7,
    'vehicle_breakdown': 0.5,
    'pot_holes': 0.4,
    'road_conditions': 0.4,
    'congestion': 0.4,
    'others': 0.3,
    'debris': 0.3,
    'test_demo': 0.3
}

PRIORITY_WEIGHTS = {
    'High': 1.0,
    'Medium': 0.6,
    'Low': 0.3
}

def get_cause_weight(cause: str) -> float:
    cause_clean = str(cause).strip().lower()
    return EVENT_CAUSE_WEIGHTS.get(cause_clean, 0.3)

def get_priority_weight(priority: str) -> float:
    priority_clean = str(priority).strip().capitalize()
    return PRIORITY_WEIGHTS.get(priority_clean, 0.6)

def calculate_traffic_impact_score(
    event_cause: str,
    priority: str,
    requires_road_closure: bool,
    resolution_time_minutes: float,
    criticality_score: float
) -> float:
    """
    Computes a traffic impact score (0 to 100) using weights for:
    - Cause (25%)
    - Priority (20%)
    - Road Closure (25%)
    - Duration log-scaled (15%)
    - Location Criticality (15%)
    """
    w_cause = get_cause_weight(event_cause)
    w_priority = get_priority_weight(priority)
    w_closure = 1.0 if requires_road_closure else 0.0
    
    # Duration log-scaling. Cap resolution time at 2880 mins (48 hours)
    duration_val = min(float(resolution_time_minutes), 2880.0)
    w_duration = float(np.log(duration_val + 1.0) / np.log(2880.0 + 1.0))
    
    w_criticality = float(criticality_score) / 100.0
    
    # Weighted sum
    raw_impact = (
        0.25 * w_cause +
        0.20 * w_priority +
        0.25 * w_closure +
        0.15 * w_duration +
        0.15 * w_criticality
    )
    
    # Normalize between 0 and 100 and round
    return round(raw_impact * 100.0, 2)

def add_impact_scores(df: pd.DataFrame) -> pd.DataFrame:
    """
    Appends a traffic_impact_score column to the DataFrame.
    """
    scores = []
    for _, row in df.iterrows():
        score = calculate_traffic_impact_score(
            row['event_cause'],
            row['priority'],
            row['requires_road_closure'],
            row['resolution_time_minutes'],
            row['criticality_score']
        )
        scores.append(score)
    df['traffic_impact_score'] = scores
    return df
