from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="고1 2학기 중간 순서 삽입",
    page_icon="📘",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Streamlit 자체 여백/메뉴를 최대한 숨김
st.markdown(
    """
    <style>
    #MainMenu, footer, header {visibility: hidden;}
    .block-container {padding: 0 !important; max-width: 100% !important;}
    [data-testid="stAppViewContainer"] {background: white;}
    </style>
    """,
    unsafe_allow_html=True,
)

root = Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")

html = html.replace(
    '<link rel="stylesheet" href="style.css">',
    f"<style>{css}</style>",
)

for name in ["data1.js", "data2.js", "data3.js", "data4.js", "data5.js", "data6.js", "data.js", "app.js"]:
    js = (root / name).read_text(encoding="utf-8")
    html = html.replace(
        f'<script src="{name}"></script>',
        f"<script>{js}</script>",
    )

components.html(html, height=1200, scrolling=True)
