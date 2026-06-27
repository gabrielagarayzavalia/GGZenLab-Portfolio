"""Mapa interactivo de casos históricos de corrupción y tierras en Argentina."""

from __future__ import annotations

import json
from pathlib import Path

import dash
import dash_bootstrap_components as dbc
import pandas as pd
import plotly.graph_objects as go
from dash import Input, Output, State, dcc, html

from scripts.geo_utils import normalize_provincia

PROJECT_ROOT = Path(__file__).resolve().parent
CSV_FILE = PROJECT_ROOT / "output" / "casos_tierra_argentina_jitter.csv"
GEOJSON_FILE = PROJECT_ROOT / "data" / "provincias.geojson"

COROPLETA_EXCLUDE = {"Patagonia"}

df = pd.read_csv(CSV_FILE)
with open(GEOJSON_FILE, encoding="utf-8") as f:
    geojson = json.load(f)

df["provincia"] = df["provincia"].map(normalize_provincia)
df["lat_jitter"] = pd.to_numeric(df["lat_jitter"], errors="coerce")
df["lon_jitter"] = pd.to_numeric(df["lon_jitter"], errors="coerce")
df["intensidad"] = pd.to_numeric(df["intensidad"], errors="coerce").fillna(3)
df = df.dropna(subset=["lat_jitter", "lon_jitter"]).copy()

bins = list(range(1800, 2031, 10))
labels = [f"{y}s" for y in range(1800, 2030, 10)]
df["periodo_slider"] = pd.cut(
    df["anio_inicio"],
    bins=bins,
    labels=labels,
    include_lowest=True,
    right=False,
).astype(str)
df["periodo_slider"] = df["periodo_slider"].replace("nan", "Sin fecha")

periodos = [p for p in labels if p in df["periodo_slider"].unique()]
if "Sin fecha" in df["periodo_slider"].unique():
    periodos.append("Sin fecha")

categorias = ["Todas"] + sorted(df["categoria_visual"].dropna().unique().tolist())

INITIAL_DECADE_IDX = 0
INITIAL_CATEGORY = "Todas"
INITIAL_SIDEBAR_OPEN = True

app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.BOOTSTRAP,
        dbc.icons.FONT_AWESOME,
    ],
)

sidebar_style_open = {
    "position": "fixed",
    "top": "0",
    "left": "0",
    "bottom": "0",
    "width": "320px",
    "padding": "18px",
    "backgroundColor": "#f8f9fa",
    "borderRight": "1px solid #ddd",
    "overflowY": "auto",
    "transition": "all 0.35s ease",
    "zIndex": "1000",
}
sidebar_style_closed = {
    **sidebar_style_open,
    "left": "-340px",
}
content_style_open = {
    "marginLeft": "320px",
    "padding": "14px 18px",
    "transition": "all 0.35s ease",
}
content_style_closed = {
    "marginLeft": "0px",
    "padding": "14px 18px",
    "transition": "all 0.35s ease",
}
floating_button_style = {
    "position": "fixed",
    "top": "16px",
    "left": "16px",
    "zIndex": "1100",
    "width": "46px",
    "height": "46px",
    "borderRadius": "50%",
    "boxShadow": "0 4px 12px rgba(0,0,0,0.15)",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "0",
}


def _filter_data(periodo: str, categoria: str) -> pd.DataFrame:
    d = df[df["periodo_slider"] == periodo].copy()
    if categoria != "Todas":
        d = d[d["categoria_visual"] == categoria]
    return d


def build_figure(periodo: str, categoria: str) -> go.Figure:
    d = _filter_data(periodo, categoria)
    prov = (
        d[~d["provincia"].isin(COROPLETA_EXCLUDE)]
        .groupby("provincia", as_index=False)
        .agg(cantidad_casos=("caso", "count"))
    )

    fig = go.Figure()
    fig.add_trace(
        go.Choropleth(
            geojson=geojson,
            locations=prov["provincia"],
            z=prov["cantidad_casos"] if len(prov) else [],
            featureidkey="properties.nombre",
            colorscale="Reds",
            marker_line_color="white",
            marker_line_width=0.7,
            colorbar_title="Casos",
            hovertemplate="<b>%{location}</b><br>Casos: %{z}<extra></extra>",
            name="Casos por provincia",
        )
    )
    fig.add_trace(
        go.Scattergeo(
            lon=d["lon_jitter"],
            lat=d["lat_jitter"],
            mode="markers",
            marker=dict(
                size=d["intensidad"] * 3 + 5,
                color=d["intensidad"],
                colorscale="Blues",
                opacity=0.8,
                line=dict(width=0.5, color="white"),
            ),
            text=d["caso"],
            customdata=d[
                [
                    "provincia",
                    "anio_inicio",
                    "anio_fin",
                    "actores",
                    "tipo_tierra",
                    "mecanismo",
                    "detalle",
                    "estado_judicial",
                    "fuente",
                    "categoria_visual",
                    "grupo_tematico",
                ]
            ].to_numpy(),
            hovertemplate=(
                "<b>%{text}</b><br>"
                "Provincia: %{customdata[0]}<br>"
                "Año: %{customdata[1]}-%{customdata[2]}<br>"
                "Actores: %{customdata[3]}<br>"
                "Tipo: %{customdata[4]}<br>"
                "Mecanismo: %{customdata[5]}<br>"
                "Detalle: %{customdata[6]}<br>"
                "Estado judicial: %{customdata[7]}<br>"
                "Categoría: %{customdata[9]}<br>"
                "Grupo: %{customdata[10]}<br>"
                "Fuente: %{customdata[8]}<extra></extra>"
            ),
            name="Casos",
        )
    )
    fig.update_geos(
        projection_type="mercator",
        showcountries=False,
        showcoastlines=False,
        showland=False,
        fitbounds="locations",
    )
    fig.update_layout(
        margin=dict(l=0, r=0, t=60, b=0),
        height=900,
        showlegend=False,
        title=f"Década {periodo} — Categoría: {categoria}",
    )
    return fig


def sidebar_style(open_state: bool) -> dict:
    return sidebar_style_open if open_state else sidebar_style_closed


def content_style(open_state: bool) -> dict:
    return content_style_open if open_state else content_style_closed


def toggle_icon(open_state: bool) -> html.I:
    return html.I(
        className="fa-solid fa-xmark" if open_state else "fa-solid fa-bars",
        style={"fontSize": "1.1rem"},
    )


app.layout = html.Div(
    [
        dbc.Button(
            toggle_icon(INITIAL_SIDEBAR_OPEN),
            id="toggle-sidebar",
            color="secondary",
            style=floating_button_style,
        ),
        dbc.Tooltip(
            "Mostrar u ocultar filtros",
            target="toggle-sidebar",
            placement="right",
        ),
        html.Div(
            [
                html.H3("Filtros"),
                html.Hr(),
                html.Label("Década"),
                dcc.Slider(
                    id="decada-slider",
                    min=0,
                    max=len(periodos) - 1,
                    step=1,
                    value=INITIAL_DECADE_IDX,
                    marks={i: periodos[i] for i in range(len(periodos))},
                    included=False,
                ),
                html.Br(),
                html.Label("Categoría"),
                dcc.Dropdown(
                    id="categoria-dropdown",
                    options=[{"label": c, "value": c} for c in categorias],
                    value=INITIAL_CATEGORY,
                    clearable=False,
                ),
                html.Br(),
                dbc.Button("Reset", id="reset-filters", color="danger", outline=True),
                html.Div(
                    id="resumen-filtro",
                    style={"fontSize": "0.95rem", "lineHeight": "1.4", "marginTop": "14px"},
                ),
            ],
            id="sidebar",
            style=sidebar_style(INITIAL_SIDEBAR_OPEN),
        ),
        html.Div(
            [
                html.H2(
                    "Casos históricos de corrupción y tierras en Argentina",
                    style={"marginBottom": "10px"},
                ),
                dcc.Graph(id="mapa", style={"height": "88vh"}, config={"scrollZoom": True}),
            ],
            id="content",
            style=content_style(INITIAL_SIDEBAR_OPEN),
        ),
    ]
)


@app.callback(
    Output("mapa", "figure"),
    Output("resumen-filtro", "children"),
    Input("decada-slider", "value"),
    Input("categoria-dropdown", "value"),
)
def update_map(decada_idx: int, categoria: str):
    periodo = periodos[decada_idx]
    fig = build_figure(periodo, categoria)
    d = _filter_data(periodo, categoria)
    resumen = [
        html.P(f"Década seleccionada: {periodo}"),
        html.P(f"Categoría: {categoria}"),
        html.P(f"Casos visibles: {len(d)}"),
        html.P(f"Provincias con casos: {d['provincia'].nunique()}"),
    ]
    return fig, resumen


@app.callback(
    Output("sidebar", "style"),
    Output("content", "style"),
    Output("toggle-sidebar", "children"),
    Input("toggle-sidebar", "n_clicks"),
    State("sidebar", "style"),
    prevent_initial_call=True,
)
def toggle_sidebar(_n_clicks, current_style):
    left = current_style.get("left", "0")
    if left == "0" or left == "0px":
        return sidebar_style_closed, content_style_closed, toggle_icon(False)
    return sidebar_style_open, content_style_open, toggle_icon(True)


@app.callback(
    Output("decada-slider", "value"),
    Output("categoria-dropdown", "value"),
    Output("sidebar", "style"),
    Output("content", "style"),
    Output("toggle-sidebar", "children"),
    Input("reset-filters", "n_clicks"),
    prevent_initial_call=True,
)
def reset_all(_n_clicks):
    return (
        INITIAL_DECADE_IDX,
        INITIAL_CATEGORY,
        sidebar_style_open,
        content_style_open,
        toggle_icon(True),
    )


if __name__ == "__main__":
    app.run(debug=True)
