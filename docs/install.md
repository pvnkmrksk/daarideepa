# Install daarideepa

1. Download the ZIP for your operating system from [the latest release](https://github.com/pvnkmrksk/daarideepa/releases/latest).
2. Extract the whole archive to a local folder. Keep the application, launcher and runtime together.
3. Open the launcher below. The browser opens at **http://127.0.0.1:8060/**. Leave the terminal window open while you use the dashboard. Close it or press Ctrl+C to stop the server.
4. Choose **Source → Load sample**, or enter a path to your own MATREX CSV file or folder.

| Release asset | Open after extracting |
| --- | --- |
| `daarideepa-windows-x64.zip` | `DaariDeepa.exe` |
| `daarideepa-macos-arm64.zip` | `OpenDashboard.command` |
| `daarideepa-macos-x64.zip` | `OpenDashboard.command` |
| `daarideepa-linux-x64.zip` | Run `./OpenDashboard.sh` from the extracted folder |

The ZIP contains Python and all browser assets. You need a current desktop browser with WebGL2 enabled. The packages are unsigned. If your operating system prompts you when launching, confirm that the archive came from the release page and compare its SHA-256 with `SHA256SUMS.txt`. On macOS, use **System Settings → Privacy & Security → Open Anyway** for the downloaded launcher if macOS blocks the first attempt. If the shell launcher lost its execute permission during extraction, run it with `sh OpenDashboard.sh` on Linux or `sh OpenDashboard.command` on macOS.

If the browser does not open, enter the printed URL manually. If port 8060 is already in use, close the other instance or add `--port 8061` when launching from a terminal. Use `--help` for the complete command-line list.

## Install from source

Clone the repository with Git. Use Python 3.12 for the same major and minor version as the release builds.

```sh
git clone https://github.com/pvnkmrksk/daarideepa.git
cd daarideepa
python -m venv .venv
```

Activate the environment with `source .venv/bin/activate` on macOS or Linux, or `.venv\Scripts\Activate.ps1` in Windows PowerShell. Then run:

```sh
python -m pip install -r requirements-native.txt
python native_app.py --open-browser
```

Pass `--glob "/path/to/recordings"` to load a dataset at startup. To build a standalone package on the target operating system, install `pyinstaller>=6,<7` in the same environment and run `python tools/build_native.py`.

Continue to the [settings manual](manual.md) for recorded data, live telemetry, replay, and exports.
