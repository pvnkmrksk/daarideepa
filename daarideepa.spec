# PyInstaller spec: build independently on Windows, Linux, and macOS.
import sys

from PyInstaller.utils.hooks import collect_data_files

a = Analysis(
    ['native_app.py'],
    pathex=[],
    binaries=[],
    datas=[('native_dashboard/static', 'native_dashboard/static'),
           ('examples/demo', 'examples/demo')] + collect_data_files('trajectory_dashboard'),
    hiddenimports=['waitress', 'zmq.backend.cython'],
    hookspath=[],
    excludes=['dash', 'plotly', 'matplotlib', 'tkinter', 'IPython', 'pytest', 'notebook'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='DaariDeepa', debug=False, bootloader_ignore_signals=False, strip=False, upx=False, console=True, icon='native_dashboard/static/daarideepa.ico' if sys.platform == 'win32' else None)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='DaariDeepa')
