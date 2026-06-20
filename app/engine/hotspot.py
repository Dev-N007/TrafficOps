import pandas as pd
import numpy as np
import json
import os

def compute_criticality_mappings(df: pd.DataFrame) -> dict:
    """
    Computes frequency mappings for junction, corridor, and zone.
    Returns a dict with frequency maps normalized by max frequency in each category.
    """
    mappings = {
        'junction': {},
        'corridor': {},
        'zone': {}
    }
    
    # Calculate frequencies, ignoring 'Unknown' placeholders for max calculation to keep it meaningful
    for col in ['junction', 'corridor', 'zone']:
        counts = df[col].value_counts()
        # Remove unknown key if it exists when finding maximum frequency, to avoid skewing
        clean_counts = counts.copy()
        unknown_keys = ['Unknown Junction', 'Unknown Corridor', 'Unknown Zone', 'non-corridor', 'Non-corridor']
        for uk in unknown_keys:
            if uk in clean_counts:
                clean_counts = clean_counts.drop(uk)
                
        max_val = clean_counts.max() if not clean_counts.empty else (counts.max() if not counts.empty else 1.0)
        if pd.isna(max_val) or max_val == 0:
            max_val = 1.0
            
        for val, count in counts.items():
            if val in unknown_keys:
                # Give unknown elements a low baseline weight
                mappings[col][str(val)] = 0.05
            else:
                mappings[col][str(val)] = float(count) / float(max_val)
                
    return mappings

def get_criticality_score(junction: str, corridor: str, zone: str, mappings: dict) -> float:
    """
    Calculates criticality score (0 to 100) based on junction, corridor, and zone.
    """
    w_junc = mappings['junction'].get(junction, 0.0)
    w_corr = mappings['corridor'].get(corridor, 0.0)
    w_zone = mappings['zone'].get(zone, 0.0)
    
    # Fallback default if completely unseen
    if w_junc == 0 and junction != 'Unknown Junction': w_junc = 0.05
    if w_corr == 0 and corridor != 'Unknown Corridor': w_corr = 0.05
    if w_zone == 0 and zone != 'Unknown Zone': w_zone = 0.05
    
    # Weighted sum
    raw_score = (0.5 * w_junc + 0.3 * w_corr + 0.2 * w_zone)
    
    # Scale to 0-100 and round
    return round(raw_score * 100.0, 2)

def add_criticality_scores(df: pd.DataFrame, mappings: dict) -> pd.DataFrame:
    """
    Appends a criticality_score column to the DataFrame.
    """
    scores = []
    for _, row in df.iterrows():
        score = get_criticality_score(row['junction'], row['corridor'], row['zone'], mappings)
        scores.append(score)
    df['criticality_score'] = scores
    return df
