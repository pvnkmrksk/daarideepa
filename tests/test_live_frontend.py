"""Exercise live normalization and the shared native worker in Node."""
from pathlib import Path
import subprocess


def test_live_frontend_contract():
    subprocess.run(
        ["node", "tools/test_live_frontend.cjs"],
        cwd=Path(__file__).resolve().parents[1],
        check=True,
        capture_output=True,
        text=True,
    )
