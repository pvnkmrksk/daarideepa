# daarideepa settings manual

Start the app using the [installation guide](install.md). Open **Source → Load sample** to try the controls with two synthetic treatments. Use the **☰** button to open the analysis sidebar.

## Load and navigate

**Source** accepts a CSV, a directory searched recursively, or a glob such as `/data/choice/**/*.csv.gz`. You can also drop a folder the dashboard server can locate. If dragging fails, paste the absolute path. Files must be readable by the server process. Set `TRAJ_DATA_ROOT` before launching if the folder picker needs to search outside the project tree.

MATREX files contain **Current Time**, **CurrentTrial**, **CurrentStep**, **GameObjectPosX**, and **GameObjectPosZ**. **GameObjectRotY** provides body yaw in degrees, **ConfigFile** identifies the scene JSON, and **AnimalID** identifies the animal. Keep scene JSON and animal metadata with the recording. The loader accepts canonical `AnimalMetadata.json` and the older `FlyMetaData.json`. A segment is scoped to a source file, trial, and step. Positive X is right and positive Z is forward. Time charts normally use seconds since the segment started.

Select a workspace from the top rail. In **Explore**, select a spatial layer. Drag a spatial plot to pan, scroll or pinch to zoom, and double-click to fit. The Cartesian views share an equal-scale X/Z viewport. Shift + wheel scrolls the page. **Reset view** fits the plots. **Clean view** removes controls for presentation. **Update analysis** applies pending settings.

## Sidebar settings

| Group | Controls |
| --- | --- |
| Dataset and animal visibility | Counts describe the retained source. Toggle animals individually or use **Show all**, **Hide all**, or **Invert**. |
| Subsets and panels | Split by **Treatment**, **Scene**, **VR arena**, **Animal**, **Source folder**, or pool all. Colour by the active panel, a category, ROI outcome, trial, replicate order, time, velocity, or tortuosity. **Neutral** uses a single path colour. **Point budget** decimates displayed paths. **Panel columns** sets layout. **Moving samples only** uses the **Walk threshold**. **Spatial grid** and **Marginal distributions** toggle their overlays. |
| Mirror pairing | **Pool matched panel pairs** combines matched groups in one reference frame. Enable pairing within the selected split, choose X or Z and the mirror line coordinate, then add or remove the pairs. The preview shows the reflection line in the spatial views. |
| Data filters | Select category values with the checklist, **All**, **None**, or **Invert**. Set lower and upper ranges for trial, step, replicate order, local time, resultant R, peak smoothed velocity, net displacement, and distance. **Jump threshold** gates large movements, **Buffer (ms)** extends the rejected interval around a jump, **Min displacement** removes short-displacement segments, and **Trim each edge** removes time at both ends. Inspect the retained counts after filtering. |
| Targets and ROI mask | Show target rings from the scene JSON, set the **Reach radius**, restrict analysis to **Reached trials only**, or **Trim after ROI exit**. Set **Expected right fraction** for the exact two-sided first-choice test. Its default is 0.50. |
| Plot display names and panel order | Choose a label set and rename the displayed categories. Drag panels or use their arrows. Labels and order apply to the linked views. |
| View recipe (JSON) | **Capture** records source, filters, layout, labels, units, viewport, and visual settings. **Copy** or **Download** saves it. Paste a recipe and choose **Apply** to restore it. To use a recipe on another machine, make the recorded source path accessible there or load the equivalent dataset first. |
| Statistical unit | Use **Trial** for trial-level summaries or **Animal** to aggregate repeated observations within each animal. **Polar R min/max** limits resultant magnitude. **Valid points min** excludes resultants with too few contributing observations. |
| Units and figure size | Set how many cm, m, mm, or world units equal one data unit. This changes display units. Set export panel width and height and choose an automatic or fixed on-screen plot height. |

## Explore layers

| Layer | Controls and interpretation |
| --- | --- |
| Paths | **Displayed trials** and **New sample** control the visible subset. **Path style** sets line width and opacity. Click near a path for its segment. **Play** animates the path. **Playback settings** offers simultaneous, single-segment, and sequential modes, a segment selector and arrows, an all-segment duration cap, speed, and a time scrubber. |
| Occupancy | **Heatmap settings** selects seconds, samples, or percent per cell, linear or log colour scale, percentile or fixed colour limits, minimum/maximum colour values, grid size, central percentage, and origin-centred cells. |
| Flow | **Direction source** switches between body orientation and movement heading. Set abundance in samples or seconds, direction hue or neutral colour, illustrative or measured-velocity particles, percentile or fixed limits and their bounds, emission density, trail persistence, playback speed, and angular spread. |
| Polar | Select the direction source and **Resultant vectors**, **Resultant histogram**, or **All-heading density**. The direction source also affects the R filter, Flow, Heading, and circular statistics. |
| Transitions | Choose paths that **Crossed opposite half** or **Ended opposite half** after entering each cell. Show a fraction or count, set minimum support, choose a split axis and coordinate, and style selected paths with width and opacity. Click a cell to inspect contributing paths. |
| Overview | Compare Paths, Occupancy, Flow, and Transitions in a pooled four-view layout or with each treatment shown separately. |

**Curtain** (shortcut **C**) defines shared spatial subsets. Enable **Match paths**, choose **Any ring** or **All rings**, and toggle **Faint context** to see excluded paths. Add or delete rings, choose the active ring, and set its centre X/Z and radius numerically or with the slider. On a Cartesian view, drag the centre to move the ring and its edge to resize it.

## Other workspaces

- **Targets** shows first left, right, simultaneous, and unreached outcomes and the numbers that ever reached either target. Download counts, exact intervals and p-values with **Export counts · CSV**.
- **Windows** compares residence, within-window distance, and heading in two rectangular regions. Choose **Edit windows** to set X and Z minima and maxima for A and B. **Show rectangles on Paths** overlays the windows.
- **Heading** shows signed heading over local time. Choose trial traces, animal circular mean, or a time-by-heading heatmap. Set the time bin and number of angle sectors for the heatmap.
- **Metrics** shows distance, displacement, speed and tortuosity by segment. **Statistics** shows group comparisons and circular tests. Interpret repeated trials using the appropriate **Statistical unit**.
- **Diagnostics** shows loader and analysis counts plus velocity and displacement distributions. Plot limits can hide the upper tail for readability. Calculations retain those observations unless a filter excludes them.
- **Export native report** creates self-contained HTML with figures, analysis tables and the current recipe. The figure export controls create presentation PNGs.

## Live and recorded replay

Open **Live MATREX telemetry** from the sidebar. In **Live**, enter the Unity publisher address (normally `tcp://127.0.0.1:9880`) and topic (normally `matrex.telemetry.v2`), then select **Connect**. The status panel shows session, scene, phase, FPS, units, tracker state, and receiver diagnostics. **Pause view** holds the plotted sample window. **Resume view** catches up. **Clear viewing window** empties this browser's observed history. The receiver keeps working while paused. See the [telemetry guide](../LIVE_TELEMETRY.md) for remote viewers, ports, and how connection permissions work.

For a saved run, the **Paths** playback controls work independently. If MATREX launches its linked **Recorded replay** workspace, **Play/Pause** and the time scrubber follow Unity's replay clock. **Fit trajectories** resets the plot viewport, **Reload trajectories** reads the recording again, and **Show full path context** toggles the faint complete paths. See the [replay protocol](../native_dashboard/REPLAY_PROTOCOL.md).

## Command-line options

| Option | Effect |
| --- | --- |
| `--glob PATH` | Preload a recorded CSV, folder, or glob. |
| `--host ADDRESS` and `--port NUMBER` | Set the server bind address and port. Defaults are 127.0.0.1 and 8060. |
| `--telemetry ENDPOINT` and `--telemetry-topic TOPIC` | Choose the live publisher and topic at startup. |
| `--live-only` | Start in Live and disable recorded file loading. |
| `--open-browser` and `--no-browser` | Choose whether to open the browser at startup. |
| `--debug` and `--log-level LEVEL` | Enable development serving or set terminal logging detail. |
| `--replay-token TOKEN` | Enable the MATREX-owned loopback replay bridge. MATREX supplies the token when it launches the viewer. |

See the [legacy Dash guide](../LEGACY_DASH.md) if you launch `app.py`.
