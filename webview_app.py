import webview
import os
import sys
from api import API

# Handle PyInstaller _MEIPASS unpacked temp dir
if hasattr(sys, '_MEIPASS'):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# HTML files
MAIN_HTML = os.path.join(BASE_DIR, 'static', 'index.html')
SETTINGS_HTML = os.path.join(BASE_DIR, 'static', 'settings', 'index.html')
ABOUT_HTML = os.path.join(BASE_DIR, 'static', 'about', 'index.html')

# Convert to file:// URLs
def get_url(path):
    return f'file:///{os.path.abspath(path).replace(os.sep, "/")}'

if __name__ == '__main__':
    api = API()
    window = webview.create_window(
        title='Face Sorter',
        url=get_url(MAIN_HTML),
        js_api=api,
        width=800,
        height=800,
        resizable=True
    )
    api._window = window  # store reference for navigation
    webview.start()
