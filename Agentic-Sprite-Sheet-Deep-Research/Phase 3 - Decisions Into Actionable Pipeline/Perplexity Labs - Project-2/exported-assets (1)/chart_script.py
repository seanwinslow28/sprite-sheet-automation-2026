
import plotly.graph_objects as go
import json

# Data
data = {"ranks": [{"name": "Diamond", "min": 92, "max": 100, "status": "PASS", "color": "#1f77b4"}, 
                  {"name": "Gold", "min": 80, "max": 91, "status": "PASS", "color": "#ffd700"}, 
                  {"name": "Silver", "min": 65, "max": 79, "status": "SOFT_FAIL", "color": "#c0c0c0"}, 
                  {"name": "Bronze", "min": 0, "max": 64, "status": "REJECT", "color": "#d62728"}]}

ranks = data['ranks']

# Create the bar chart
fig = go.Figure()

# Add bars for each rank showing their score range
for rank in ranks:
    fig.add_trace(go.Bar(
        x=[rank['name']],
        y=[rank['max'] - rank['min']],
        base=[rank['min']],
        name=rank['name'],
        marker_color=rank['color'],
        text=[f"{rank['min']}-{rank['max']}<br>{rank['status']}"],
        textposition='inside',
        textfont=dict(size=12, color='white'),
        hovertemplate=f"<b>{rank['name']}</b><br>Score Range: {rank['min']}-{rank['max']}<br>Status: {rank['status']}<extra></extra>",
        showlegend=False
    ))

# Update layout
fig.update_layout(
    title={
        "text": "Gemini v2.0 Scoring Rank Distribution (0-100)<br><span style='font-size: 18px; font-weight: normal;'>Four quality tiers from Bronze to Diamond standards</span>"
    },
    xaxis_title="Rank Band",
    yaxis_title="Score Range",
    yaxis=dict(range=[0, 100]),
    bargap=0.3
)

fig.update_traces(cliponaxis=False)

# Save the chart
fig.write_image("gemini_rank_distribution.png")
fig.write_image("gemini_rank_distribution.svg", format="svg")
