
# Build the complete JSON for the sheets artifact

sheets_json = {
    "file_name": "SpriteGen_QA_Dashboard",
    "sheets": [
        {
            "name": "CONFIG_THRESHOLDS",
            "rows": config_thresholds_data
        },
        {
            "name": "REASON_CODES",
            "rows": reason_codes_data
        },
        {
            "name": "RUNS",
            "rows": runs_data
        },
        {
            "name": "FRAMES",
            "rows": frames_data
        },
        {
            "name": "CHARTS",
            "rows": charts_data
        },
        {
            "name": "V0_V1_DIFF",
            "rows": v0_v1_diff_data
        }
    ]
}

# Validate and output JSON
import json
json_str = json.dumps(sheets_json)
print(f"✓ Sheets JSON generated: {len(json_str)} characters")
print(f"✓ {len(sheets_json['sheets'])} sheets created")
print("\nSheet summary:")
for sheet in sheets_json['sheets']:
    print(f"  {sheet['name']}: {len(sheet['rows'])} rows")

# Save to variable for artifact
sheets_json_final = json_str
