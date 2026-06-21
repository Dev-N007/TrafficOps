from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class PredictRequest(BaseModel):
    event_type: str = Field(..., example="unplanned")
    event_cause: str = Field(..., example="vehicle_breakdown")
    zone: str = Field(..., example="Central Zone 2")
    corridor: str = Field(..., example="Mysore Road")
    junction: str = Field(..., example="MekhriCircle")
    priority: str = Field(..., example="High")
    requires_road_closure: bool = Field(..., example=False)
    start_time: str = Field(..., example="2026-06-21 15:30:00")

class PredictResponse(BaseModel):
    predicted_impact_score: float
    predicted_resolution_time: float
    criticality_score: float
    features_used: List[str]
    global_importance: Dict[str, float]
    explanation: str

class RecommendRequest(BaseModel):
    predicted_impact_score: float
    predicted_resolution_time: float
    criticality_score: float
    requires_road_closure: bool
    event_type: Optional[str] = "unplanned"
    event_cause: Optional[str] = "vehicle_breakdown"
    zone: Optional[str] = "Unknown Zone"
    corridor: Optional[str] = "Unknown Corridor"
    junction: Optional[str] = "Unknown Junction"
    priority: Optional[str] = "Medium"

class RecommendResponse(BaseModel):
    burden_score: float
    officers: int
    barricades: int
    patrol_vehicles: int
    explanation: str
    thresholds: List[Dict[str, Any]]

class DiversionRequest(BaseModel):
    latitude: float = Field(..., example=12.9716)
    longitude: float = Field(..., example=77.5946)

class ClosedRoadInfo(BaseModel):
    start: List[float]
    end: List[float]
    length_m: float

class DiversionResponse(BaseModel):
    success: bool
    closure_point: List[float]
    closed_road: Optional[ClosedRoadInfo] = None
    original_route: List[List[float]]
    diversion_route: List[List[float]]
    original_length_m: float
    diversion_length_m: float
    detour_length_m: float
    detour_time_minutes: float
    engine: str

class HotspotItem(BaseModel):
    name: str
    count: int
    criticality: float

class HotspotCoordinates(BaseModel):
    latitude: float
    longitude: float
    impact: float
    cause: str
    address: Optional[str] = None

class HotspotsResponse(BaseModel):
    critical_junctions: List[HotspotItem]
    critical_corridors: List[HotspotItem]
    critical_zones: List[HotspotItem]
    heatmap_data: List[HotspotCoordinates]

class AnalyticsResponse(BaseModel):
    cause_distribution: Dict[str, int]
    planned_vs_unplanned: Dict[str, int]
    resolution_time_trends: List[Dict[str, Any]]
    monthly_trends: List[Dict[str, Any]]
    total_events: int
    avg_resolution_time: float
    high_risk_zone: str
    top_junction: str
