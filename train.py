import sqlite3
import pandas as pd
import numpy as np
import os
import json
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from catboost import CatBoostRegressor, Pool

DB_PATH = os.path.join("data", "trafficops.db")
MODELS_DIR = "models"

def train_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # 1. Load data from SQLite
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT event_type, event_cause, zone, corridor, junction, priority, 
           requires_road_closure, Hour, Day, Month, Weekday, Weekend,
           traffic_impact_score, resolution_time_minutes
    FROM events
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    print(f"Loaded {len(df)} records for training.")
    
    # Features list
    features = [
        'event_type', 'event_cause', 'zone', 'corridor', 'junction', 
        'priority', 'requires_road_closure', 'Hour', 'Day', 'Month', 
        'Weekday', 'Weekend'
    ]
    
    # Categorical features list
    cat_features = ['event_type', 'event_cause', 'zone', 'corridor', 'junction', 'priority']
    
    # Ensure categorical features are string type
    for col in cat_features:
        df[col] = df[col].astype(str)
        
    # Convert requires_road_closure to int
    df['requires_road_closure'] = df['requires_road_closure'].astype(int)
    
    X = df[features]
    y_impact = df['traffic_impact_score']
    y_duration = df['resolution_time_minutes']
    
    # 2. Train Model 1: Traffic Impact Predictor
    print("\n--- Training Model 1: Traffic Impact Predictor ---")
    X_train, X_test, y_train, y_test = train_test_split(X, y_impact, test_size=0.2, random_state=42)
    
    model_impact = CatBoostRegressor(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        eval_metric='RMSE',
        random_seed=42,
        verbose=100
    )
    
    train_pool = Pool(X_train, y_train, cat_features=cat_features)
    test_pool = Pool(X_test, y_test, cat_features=cat_features)
    
    model_impact.fit(train_pool, eval_set=test_pool, use_best_model=True)
    
    # Evaluate Model 1
    y_pred = model_impact.predict(X_test)
    mae_imp = mean_absolute_error(y_test, y_pred)
    rmse_imp = np.sqrt(mean_squared_error(y_test, y_pred))
    r2_imp = r2_score(y_test, y_pred)
    
    print(f"Model 1 Metrics - MAE: {mae_imp:.4f}, RMSE: {rmse_imp:.4f}, R²: {r2_imp:.4f}")
    
    # Save Model 1
    impact_model_path = os.path.join(MODELS_DIR, "traffic_impact_model.cbor")
    model_impact.save_model(impact_model_path)
    print(f"Saved traffic impact model to {impact_model_path}")
    
    # Get feature importances
    impact_importances = dict(zip(features, model_impact.get_feature_importance()))
    
    # 3. Train Model 2: Resolution Time Predictor
    print("\n--- Training Model 2: Resolution Time Predictor ---")
    X_train_dur, X_test_dur, y_train_dur, y_test_dur = train_test_split(X, y_duration, test_size=0.2, random_state=42)
    
    model_duration = CatBoostRegressor(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        eval_metric='RMSE',
        random_seed=42,
        verbose=100
    )
    
    train_pool_dur = Pool(X_train_dur, y_train_dur, cat_features=cat_features)
    test_pool_dur = Pool(X_test_dur, y_test_dur, cat_features=cat_features)
    
    model_duration.fit(train_pool_dur, eval_set=test_pool_dur, use_best_model=True)
    
    # Evaluate Model 2
    y_pred_dur = model_duration.predict(X_test_dur)
    mae_dur = mean_absolute_error(y_test_dur, y_pred_dur)
    rmse_dur = np.sqrt(mean_squared_error(y_test_dur, y_pred_dur))
    r2_dur = r2_score(y_test_dur, y_pred_dur)
    
    print(f"Model 2 Metrics - MAE: {mae_dur:.4f}, RMSE: {rmse_dur:.4f}, R²: {r2_dur:.4f}")
    
    # Save Model 2
    duration_model_path = os.path.join(MODELS_DIR, "resolution_time_model.cbor")
    model_duration.save_model(duration_model_path)
    print(f"Saved resolution time model to {duration_model_path}")
    
    # Get feature importances
    duration_importances = dict(zip(features, model_duration.get_feature_importance()))
    
    # 4. Save metrics and importances
    summary = {
        "impact_model": {
            "mae": mae_imp,
            "rmse": rmse_imp,
            "r2": r2_imp,
            "feature_importances": impact_importances
        },
        "duration_model": {
            "mae": mae_dur,
            "rmse": rmse_dur,
            "r2": r2_dur,
            "feature_importances": duration_importances
        }
    }
    
    with open(os.path.join(MODELS_DIR, "feature_importances.json"), "w") as f:
        json.dump(summary, f, indent=4)
        
    print("\nAll models trained and saved successfully.")

if __name__ == "__main__":
    train_models()
