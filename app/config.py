import os
import json

# Operational Burden Score weights
BURDEN_WEIGHT_IMPACT = 0.40
BURDEN_WEIGHT_DURATION = 0.30
BURDEN_WEIGHT_ROAD_CLOSURE = 0.20
BURDEN_WEIGHT_CRITICALITY = 0.10

# Baseline duration cap for score calculation (e.g. 480 mins = 8 hours)
DURATION_SCORE_CAP_MINUTES = 480.0

# Configurable resource allocation thresholds
# Each entry specifies the upper bound score and the recommended assets.
DEFAULT_RESOURCE_THRESHOLDS = [
    {
        "min_score": 0.0,
        "max_score": 20.0,
        "officers": 2,
        "barricades": 2,
        "patrol_vehicles": 0
    },
    {
        "min_score": 20.0,
        "max_score": 40.0,
        "officers": 4,
        "barricades": 4,
        "patrol_vehicles": 1
    },
    {
        "min_score": 40.0,
        "max_score": 60.0,
        "officers": 8,
        "barricades": 8,
        "patrol_vehicles": 1
    },
    {
        "min_score": 60.0,
        "max_score": 80.0,
        "officers": 12,
        "barricades": 15,
        "patrol_vehicles": 2
    },
    {
        "min_score": 80.0,
        "max_score": 100.0,
        "officers": 20,
        "barricades": 30,
        "patrol_vehicles": 3
    }
]

CONFIG_PATH = os.path.join("data", "resource_config.json")

def load_resource_thresholds():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_RESOURCE_THRESHOLDS

def save_resource_thresholds(thresholds):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(thresholds, f, indent=4)
