import pandas as pd
import numpy as np

def clean_event_cause(cause):
    if pd.isna(cause):
        return 'others'
    cause = str(cause).strip().lower()
    # Normalize debris
    if cause == 'debris':
        return 'debris'
    # Normalize other similar causes if any
    return cause

def preprocess_data(df: pd.DataFrame) -> pd.DataFrame:
    # 1. Duplicate removal
    if 'id' in df.columns:
        df = df.drop_duplicates(subset=['id'], keep='first')
    
    # 2. Category normalization
    df['event_type'] = df['event_type'].fillna('unplanned').str.strip().str.lower()
    df['event_cause'] = df['event_cause'].apply(clean_event_cause)
    df['priority'] = df['priority'].fillna('Medium').str.strip().str.capitalize()
    
    # Fill missing geocodes with defaults or drop if missing latitude/longitude
    df = df.dropna(subset=['latitude', 'longitude'])
    
    df['zone'] = df['zone'].fillna('Unknown Zone').str.strip()
    df['corridor'] = df['corridor'].fillna('Unknown Corridor').str.strip()
    df['junction'] = df['junction'].fillna('Unknown Junction').str.strip()
    
    # 3. Datetime parsing
    dt_cols = ['start_datetime', 'end_datetime', 'resolved_datetime', 'closed_datetime', 'modified_datetime']
    for col in dt_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    
    # 4. Calculate resolution_time_minutes
    # Use end_datetime if available, fallback to resolved_datetime, then closed_datetime, then modified_datetime
    res_dt = df['end_datetime'].fillna(df['resolved_datetime']).fillna(df['closed_datetime']).fillna(df['modified_datetime'])
    
    # In case start_datetime is NaT, fallback to modified_datetime or drop
    start_dt = df['start_datetime'].fillna(df['modified_datetime'])
    
    # Calculate difference in minutes
    duration_min = (res_dt - start_dt).dt.total_seconds() / 60.0
    
    # Outlier handling:
    # If duration is negative or null, set to a baseline default of 60 minutes.
    duration_min = duration_min.fillna(60.0)
    duration_min = np.where(duration_min <= 0, 60.0, duration_min)
    
    # Cap extremely large durations at 2880 minutes (48 hours) to prevent outliers from distorting regressor
    df['resolution_time_minutes'] = np.minimum(duration_min, 2880.0)
    
    # 5. Generate datetime features
    ref_dt = start_dt
    df['Hour'] = ref_dt.dt.hour.fillna(12).astype(int)
    df['Day'] = ref_dt.dt.day.fillna(1).astype(int)
    df['Month'] = ref_dt.dt.month.fillna(1).astype(int)
    df['Weekday'] = ref_dt.dt.weekday.fillna(0).astype(int)
    df['Weekend'] = (df['Weekday'] >= 5).astype(int)
    
    # Convert requires_road_closure to bool/int
    if 'requires_road_closure' in df.columns:
        # Some values might be string 'TRUE' / 'FALSE' or bool
        closure = df['requires_road_closure']
        if closure.dtype == object:
            df['requires_road_closure'] = closure.astype(str).str.strip().str.upper() == 'TRUE'
        else:
            df['requires_road_closure'] = closure.fillna(False).astype(bool)
    else:
        df['requires_road_closure'] = False
        
    return df
