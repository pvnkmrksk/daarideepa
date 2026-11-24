# Publish a standalone release

Release the four packages from a single successful [Standalone dashboard builds run](https://github.com/pvnkmrksk/daarideepa/actions/workflows/native-build.yml) on `main`. The workflow runs the test suite, launches each packaged executable, and checks its HTTP, event stream, and ZeroMQ telemetry.

1. Pick a new version and identify a successful `main` run for the commit being released. If that commit has no completed run, dispatch the build workflow on `main` and wait for it to pass. In the run details, confirm that the commit and all four platform jobs match the intended source.

   ```sh
   repo=pvnkmrksk/daarideepa
   gh run list --repo "$repo" --workflow native-build.yml --branch main --status success
   run_id=REPLACE_WITH_RUN_ID
   gh run view "$run_id" --repo "$repo"
   revision=$(gh run view "$run_id" --repo "$repo" --json headSha --jq .headSha)
   ```

2. Stage the archives outside the checkout. The download-site builder verifies ZIP integrity, checks for the platform launchers, and creates the canonical asset names and SHA-256 manifest.

   ```sh
   stage=$(mktemp -d)
   gh run download "$run_id" --repo "$repo" --pattern 'DaariDeepa-*' --dir "$stage/run"
   mkdir "$stage/input"
   for platform in windows-x64 macos-arm64 macos-x64 linux-x64; do
     cp "$stage/run/DaariDeepa-$platform/DaariDeepa-$platform.zip" "$stage/input/"
   done
   python tools/build_download_site.py "$stage/input" "$stage/assets" --revision "$revision"
   (cd "$stage/assets" && shasum -a 256 -c SHA256SUMS.txt)
   ```

3. Write release notes outside the checkout. Include a link to the build run. Create a draft pinned to the tested commit, then check that GitHub has all four ZIPs and the manifest and that their digests match the staged files.

   ```sh
   version=vX.Y.Z
   notes_file=/path/to/release-notes.md
   gh release create "$version" --repo "$repo" --draft --target "$revision" \
     --title "daarideepa $version" --notes-file "$notes_file" \
     "$stage/assets"/daarideepa-*.zip "$stage/assets/SHA256SUMS.txt"
   gh release view "$version" --repo "$repo" --json targetCommitish,isDraft,assets \
     --jq '{targetCommitish,isDraft,assets:[.assets[]|{name,state,digest}]}'
   ```

4. Publish as the latest stable release. Verify that the published tag points to the tested commit.

   ```sh
   gh release edit "$version" --repo "$repo" --draft=false --latest
   git ls-remote --tags origin "refs/tags/$version"
   gh release view "$version" --repo "$repo"
   ```
