# -*- coding: utf-8 -*-
"""Open-Meteo(무료, 키 없음)에서 보라카이 시간별 예보·자외선 → site/weather.json. 실행: python3 scripts/weather.py"""
import json, os, urllib.request, datetime
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
U = ("https://api.open-meteo.com/v1/forecast?latitude=11.9595&longitude=121.927&timezone=Asia%2FManila"
     "&start_date=2026-11-24&end_date=2026-11-28"
     "&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,wind_speed_10m,is_day"
     "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset,wind_speed_10m_max")
d = json.load(urllib.request.urlopen(urllib.request.Request(U, headers={"User-Agent": "BoracayFamilyGuide/1.0"}), timeout=30))
h = d["hourly"]; dl = d["daily"]
hours = {}
for i, t in enumerate(h["time"]):
    hours[t] = [h["weather_code"][i], round(h["temperature_2m"][i]), round(h["apparent_temperature"][i]), h["precipitation_probability"][i],
                round(h["uv_index"][i] or 0, 1), round(h["wind_speed_10m"][i]), h["is_day"][i]]
days = {}
for i, t in enumerate(dl["time"]):
    days[t] = dict(code=dl["weather_code"][i], tmax=round(dl["temperature_2m_max"][i]), tmin=round(dl["temperature_2m_min"][i]),
                   rain=dl["precipitation_probability_max"][i], uv=round(dl["uv_index_max"][i] or 0, 1), sunrise=dl["sunrise"][i][-5:], sunset=dl["sunset"][i][-5:],
                   wind=round(dl["wind_speed_10m_max"][i]))
# 바다: 해수면(조석 포함)·파고·수온 — 화이트비치 앞바다 격자. 실패해도 날씨는 저장.
marine = {}
try:
    M = ("https://marine-api.open-meteo.com/v1/marine?latitude=11.955&longitude=121.918&timezone=Asia%2FManila"
         "&start_date=2026-11-24&end_date=2026-11-28&cell_selection=sea&hourly=sea_level_height_msl,wave_height,sea_surface_temperature")
    m = json.load(urllib.request.urlopen(urllib.request.Request(M, headers={"User-Agent": "BoracayFamilyGuide/1.0"}), timeout=30))["hourly"]
    for i, t in enumerate(m["time"]):
        marine[t] = [m["sea_level_height_msl"][i], m["wave_height"][i], m["sea_surface_temperature"][i]]
except Exception as e:
    print("marine failed:", e)
now = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
out = dict(updated=now.strftime("%Y-%m-%d %H:%M"), src="Open-Meteo", fields=["code", "temp", "feels", "rain%", "uv", "wind_kmh", "is_day"], hours=hours, days=days, marine=marine, marine_fields=["sea_level_m", "wave_m", "sea_temp"])
json.dump(out, open(os.path.join(R, "site", "weather.json"), "w"), separators=(",", ":"))
print("weather.json", len(hours), "hours,", len(marine), "marine hours,", len(days), "days, updated", out["updated"])
for k, v in days.items(): print(k, v)
