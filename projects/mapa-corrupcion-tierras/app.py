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
TODAS = "Todas"

CASE_COLORSCALE = [
    [0.0, "rgb(245, 245, 245)"],
    [0.001, "rgb(254, 224, 210)"],
    [0.25, "rgb(252, 187, 161)"],
    [0.5, "rgb(252, 117, 94)"],
    [1.0, "rgb(189, 0, 38)"],
]

df = pd.read_csv(CSV_FILE)
with open(GEOJSON_FILE, encoding="utf-8") as f:
    geojson = json.load(f)

ALL_PROVINCES = sorted(f["properties"]["nombre"] for f in geojson["features"])

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

INITIAL_DECADA = "1900s" if "1900s" in periodos else periodos[0]
INITIAL_SIDEBAR_OPEN = True

GEO_LON_RANGE = [-73.5, -53.0]
GEO_LAT_RANGE = [-55.5, -21.5]

FILTER_SPECS: list[tuple[str, str, str]] = [
    ("provincia-dropdown", "provincia", "Provincia"),
    ("categoria-dropdown", "categoria_visual", "Categoría"),
    ("actores-dropdown", "actores", "Actores"),
    ("tipo-dropdown", "tipo_tierra", "Tipo de tierra"),
    ("mecanismo-dropdown", "mecanismo", "Mecanismo"),
    ("estado-dropdown", "estado_judicial", "Estado judicial"),
    ("fuente-dropdown", "fuente", "Fuente"),
]


def _truncate(text: object, max_len: int = 160) -> str:
    value = "" if pd.isna(text) else str(text)
    if len(value) <= max_len:
        return value
    return value[: max_len - 1] + "…"


def _dropdown_options(column: str, max_label: int = 72) -> list[dict[str, str]]:
    options = [{"label": TODAS, "value": TODAS}]
    for value in sorted(df[column].dropna().astype(str).unique()):
        label = value if len(value) <= max_label else value[: max_label - 1] + "…"
        options.append({"label": label, "value": value})
    return options


def _periodo_label(periodo: str) -> str:
    if periodo == "Sin fecha":
        return periodo
    year = int(periodo[:4])
    if year < 1900:
        return f"Siglo XIX · {periodo}"
    if year < 2000:
        return f"Siglo XX · {periodo}"
    return f"Siglo XXI · {periodo}"


PERIODO_OPTIONS = [{"label": _periodo_label(p), "value": p} for p in periodos]
FILTER_OPTIONS = {dropdown_id: _dropdown_options(col) for dropdown_id, col, _ in FILTER_SPECS}

app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.BOOTSTRAP,
        dbc.icons.FONT_AWESOME,
    ],
)

SIDEBAR_WIDTH = "380px"
sidebar_style_open = {
    "position": "fixed",
    "top": "0",
    "left": "0",
    "bottom": "0",
    "width": SIDEBAR_WIDTH,
    "padding": "18px",
    "backgroundColor": "#f8f9fa",
    "borderRight": "1px solid #ddd",
    "overflowY": "auto",
    "transition": "all 0.35s ease",
    "zIndex": "1000",
}
sidebar_style_closed = {
    **sidebar_style_open,
    "left": "-400px",
}
content_style_open = {
    "marginLeft": SIDEBAR_WIDTH,
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


def _filter_data(periodo: str, filters: dict[str, str]) -> pd.DataFrame:
    d = df[df["periodo_slider"] == periodo].copy()
    for dropdown_id, column, _label in FILTER_SPECS:
        value = filters.get(dropdown_id, TODAS)
        if value and value != TODAS:
            d = d[d[column].astype(str) == value]
    return d


def _province_case_counts(d: pd.DataFrame) -> list[int]:
    counts = (
        d[~d["provincia"].isin(COROPLETA_EXCLUDE)]
        .groupby("provincia")["caso"]
        .count()
    )
    return [int(counts.get(name, 0)) for name in ALL_PROVINCES]


def _hover_frame(d: pd.DataFrame) -> pd.DataFrame:
    hover = d.copy()
    for col, limit in [
        ("actores", 120),
        ("tipo_tierra", 80),
        ("mecanismo", 100),
        ("detalle", 220),
        ("estado_judicial", 80),
        ("fuente", 100),
    ]:
        hover[col] = hover[col].apply(_truncate, max_len=limit)
    return hover


def build_figure(periodo: str, filters: dict[str, str]) -> go.Figure:
    d = _filter_data(periodo, filters)
    hover = _hover_frame(d)
    z_values = _province_case_counts(d)
    zmax = max(max(z_values), 1)

    fig = go.Figure()
    fig.add_trace(
        go.Choropleth(
            geojson=geojson,
            locations=ALL_PROVINCES,
            z=z_values,
            featureidkey="properties.nombre",
            colorscale=CASE_COLORSCALE,
            zmin=0,
            zmax=zmax,
            marker_line_color="#3d3d3d",
            marker_line_width=1.2,
            colorbar_title="Casos",
            hovertemplate="<b>%{location}</b><br>Casos visibles: %{z}<extra></extra>",
            name="Casos por provincia",
        )
    )

    if len(hover):
        fig.add_trace(
            go.Scattergeo(
                lon=hover["lon_jitter"],
                lat=hover["lat_jitter"],
                mode="markers",
                marker=dict(
                    size=hover["intensidad"] * 3 + 5,
                    color=hover["intensidad"],
                    colorscale="Blues",
                    opacity=0.85,
                    line=dict(width=0.8, color="#1a1a1a"),
                ),
                text=hover["caso"],
                customdata=hover[
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
                        "intensidad",
                    ]
                ].to_numpy(),
                hovertemplate=(
                    "<b>%{text}</b><br><br>"
                    "<b>Provincia:</b> %{customdata[0]}<br>"
                    "<b>Años:</b> %{customdata[1]} – %{customdata[2]}<br>"
                    "<b>Intensidad:</b> %{customdata[11]}/5<br>"
                    "<b>Categoría:</b> %{customdata[9]} · %{customdata[10]}<br><br>"
                    "<b>Actores:</b> %{customdata[3]}<br>"
                    "<b>Tipo de tierra:</b> %{customdata[4]}<br>"
                    "<b>Mecanismo:</b> %{customdata[5]}<br>"
                    "<b>Estado judicial:</b> %{customdata[7]}<br>"
                    "<b>Fuente:</b> %{customdata[8]}<br><br>"
                    "<b>Detalle:</b> %{customdata[6]}"
                    "<extra></extra>"
                ),
                name="Casos",
            )
        )

    fig.update_geos(
        projection_type="mercator",
        showcountries=False,
        showcoastlines=True,
        coastlinecolor="#2f2f2f",
        coastlinewidth=1.4,
        showland=True,
        landcolor="rgb(235, 235, 235)",
        showocean=True,
        oceancolor="rgb(220, 230, 240)",
        lonaxis_range=GEO_LON_RANGE,
        lataxis_range=GEO_LAT_RANGE,
        bgcolor="rgba(0,0,0,0)",
    )
    fig.update_layout(
        margin=dict(l=0, r=0, t=60, b=0),
        height=900,
        showlegend=False,
        title=f"Década {periodo} · {len(d)} caso(s) visible(s)",
        hoverlabel=dict(
            bgcolor="rgba(255, 255, 255, 0.97)",
            bordercolor="#333",
            font_size=13,
            font_family="system-ui, sans-serif",
            align="left",
        ),
    )
    return fig


def _filter_dropdown(label: str, dropdown_id: str) -> html.Div:
    return html.Div(
        [
            html.Label(label, className="fw-semibold small"),
            dcc.Dropdown(
                id=dropdown_id,
                options=FILTER_OPTIONS[dropdown_id],
                value=TODAS,
                clearable=False,
                searchable=True,
                optionHeight=42,
            ),
            html.Div(className="mb-2"),
        ]
    )


def sidebar_style(open_state: bool) -> dict:
    return sidebar_style_open if open_state else sidebar_style_closed


def content_style(open_state: bool) -> dict:
    return content_style_open if open_state else content_style_closed


def toggle_icon(open_state: bool) -> html.I:
    return html.I(
        className="fa-solid fa-xmark" if open_state else "fa-solid fa-bars",
        style={"fontSize": "1.1rem"},
    )


filter_controls = [
    html.H6("Tiempo", className="text-muted mt-1"),
    html.Label("Década", className="fw-semibold small"),
    dcc.Dropdown(
        id="decada-dropdown",
        options=PERIODO_OPTIONS,
        value=INITIAL_DECADA,
        clearable=False,
    ),
    html.Div(className="mb-3"),
    html.H6("Territorio y clasificación", className="text-muted"),
    *[_filter_dropdown(label, dropdown_id) for dropdown_id, _col, label in FILTER_SPECS[:2]],
    html.H6("Hecho y procedimiento", className="text-muted"),
    *[_filter_dropdown(label, dropdown_id) for dropdown_id, _col, label in FILTER_SPECS[2:5]],
    html.H6("Judicial y fuentes", className="text-muted"),
    *[_filter_dropdown(label, dropdown_id) for dropdown_id, _col, label in FILTER_SPECS[5:]],
]

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
                html.P(
                    "Pasá el mouse sobre un punto del mapa para ver el detalle completo.",
                    className="small text-muted",
                ),
                html.Hr(),
                *filter_controls,
                dbc.Button("Reset", id="reset-filters", color="danger", outline=True, className="w-100"),
                html.Div(
                    id="resumen-filtro",
                    style={"fontSize": "0.9rem", "lineHeight": "1.45", "marginTop": "14px"},
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


FILTER_INPUTS = [Input(dropdown_id, "value") for dropdown_id, _, _ in FILTER_SPECS]
RESET_OUTPUTS = [Output(dropdown_id, "value") for dropdown_id, _, _ in FILTER_SPECS]


@app.callback(
    Output("mapa", "figure"),
    Output("resumen-filtro", "children"),
    Input("decada-dropdown", "value"),
    *FILTER_INPUTS,
)
def update_map(periodo: str, *filter_values: str):
    filters = {
        dropdown_id: value
        for (dropdown_id, _, _), value in zip(FILTER_SPECS, filter_values, strict=True)
    }
    fig = build_figure(periodo, filters)
    d = _filter_data(periodo, filters)

    active = [(label, filters[dropdown_id]) for dropdown_id, _, label in FILTER_SPECS if filters[dropdown_id] != TODAS]
    resumen = [
        html.P(f"Década: {_periodo_label(periodo)}", className="mb-1"),
        html.P(f"Casos visibles: {len(d)}", className="mb-1 fw-semibold"),
        html.P(f"Provincias con casos: {d['provincia'].nunique()}", className="mb-2"),
    ]
    if active:
        resumen.append(html.P("Filtros activos:", className="mb-1 fw-semibold"))
        resumen.extend(html.P(f"{label}: {_truncate(value, 60)}", className="mb-0 small") for label, value in active)
    else:
        resumen.append(html.P("Sin filtros adicionales activos.", className="mb-0 small text-muted"))

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
    Output("decada-dropdown", "value"),
    *RESET_OUTPUTS,
    Output("sidebar", "style", allow_duplicate=True),
    Output("content", "style", allow_duplicate=True),
    Output("toggle-sidebar", "children", allow_duplicate=True),
    Input("reset-filters", "n_clicks"),
    prevent_initial_call=True,
)
def reset_all(_n_clicks):
    return (
        INITIAL_DECADA,
        *[TODAS] * len(FILTER_SPECS),
        sidebar_style_open,
        content_style_open,
        toggle_icon(True),
    )


if __name__ == "__main__":
    app.run(debug=True)
