"""Benchmark the production worker against a recorded source without saving its data."""

import argparse
import math
from pathlib import Path
import subprocess
import tempfile

from native_dashboard.dataset import load_native_dataset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="CSV file, folder, or quoted glob")
    parser.add_argument("--flight-variance-threshold", type=float, default=.01,
                        help="Override to benchmark in rad² (default: 0.01)")
    args = parser.parse_args()
    if not math.isfinite(args.flight_variance_threshold) or args.flight_variance_threshold < 0:
        parser.error("--flight-variance-threshold must be finite and nonnegative")
    root = Path(__file__).resolve().parents[1]
    dataset = load_native_dataset(args.source)
    with tempfile.TemporaryDirectory(prefix="daarideepa-benchmark-") as directory:
        payload = Path(directory) / "dataset.bin"
        payload.write_bytes(dataset.binary)
        subprocess.run(["node", str(root / "scripts/benchmark_native.mjs"), str(payload),
                        str(root / "native_dashboard/static/worker.js"),
                        str(args.flight_variance_threshold)], cwd=root, check=True)


if __name__ == "__main__":
    main()
