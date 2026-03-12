#!/usr/bin/env bash

# This script fetches the latest Linux x64 tarball from the
# HyPrism GitHub releases, computes its sha256 checksum and
# updates the Flathub manifest at
# Properties/linux/flathub/io.github.hyprismteam.HyPrism.module.yml
# with the concrete download URL and corresponding sha256.
#
# Dependencies: curl, jq, sha256sum (coreutils), sed

set -euo pipefail

MANIFEST="$(dirname "$0")/../Properties/linux/flathub/io.github.hyprismteam.HyPrism.yml"

# query GitHub API for the latest release
API="https://api.github.com/repos/hyprismteam/HyPrism/releases/latest"

# also fetch the SHA of the tip of the main branch
# we can use the GitHub API which doesn't require a local repo
MAIN_SHA=$(curl -s "https://api.github.com/repos/hyprismteam/HyPrism/branches/main" \
    | jq -r .commit.sha)
if [[ -z "$MAIN_SHA" || "$MAIN_SHA" == "null" ]]; then
    echo "error: unable to fetch main branch SHA" >&2
    exit 1
fi

# build final manifest by combining header and module fragments
# header comes from flatpak yaml, modules from flathub module file
FLATPAK="$(dirname "$MANIFEST")/../flatpak/io.github.hyprismteam.HyPrism.yml"
MODULE_FILE="$(dirname "$MANIFEST")/io.github.hyprismteam.HyPrism.module.yml"

if [[ ! -f "$FLATPAK" ]]; then
    echo "error: flatpak header file not found: $FLATPAK" >&2
    exit 1
fi
if [[ ! -f "$MODULE_FILE" ]]; then
    echo "error: module file not found: $MODULE_FILE" >&2
    exit 1
fi

# capture header (everything before the modules: directive)
# use sed to stop before printing the modules: line
header=$(sed '/^modules:/q' "$FLATPAK")
# remove any trailing modules: if accidentally included
header=$(printf '%s' "$header" | sed '/^modules:$/d')

# capture modules section from module file
# replace placeholders on url/sha lines, remove leading blank then drop first line (modules:)
modules=$(sed \
    -e "s|HYPRISM_MAIN_BRANCH|$MAIN_SHA|" \
    "$MODULE_FILE" \
  | sed '1{/^$/d}' \
  | sed '1d')

# write combined manifest
{
    printf '%s
' "$header"
    printf 'modules:
'
    printf '%s
' "$modules"
} >"$MANIFEST"

echo "Manifest regenerated and updated: $MANIFEST"

echo "Generating nuget sources file for Flathub manifest..."

runtime=$(grep -m1 '^runtime:' "$MANIFEST" | awk '{print $NF}')
# the manifest keeps the runtime version in a separate field; pull that out so we can
# use it when installing the SDK extension locally.  strip surrounding quotes if any.
runtime_version=$(grep -m1 '^runtime-version:' "$MANIFEST" | awk '{print $NF}' | tr -d "'\"")

# the manifest lists the full extension id (e.g. org.freedesktop.Sdk.Extension.dotnet10)
# but the Python generator expects just the numeric version ("10").
raw_dotnet=$(grep -m1 'org.freedesktop.Sdk.Extension.dotnet' "$MANIFEST" | awk '{print $NF}')
# strip prefix to obtain the version number
# shell parameter expansion removes everything up to the last ".dotnet".
dotnet=${raw_dotnet##*.dotnet}

echo "Extracted runtime: $runtime"
echo "Extracted dotnet extension id: $raw_dotnet"
echo "Using dotnet version: $dotnet"

flatpak install -y --user org.freedesktop.Sdk.Extension.dotnet$dotnet/x86_64/$runtime_version

# When invoking the generator we also need to tell it which freedesktop runtime
# version to use; otherwise it defaults to 24.08 and will restore packages inside
# the wrong runtime (see the earlier error message).  Use the version extracted
# from the manifest.
# NOTE: the Flatpak "runtime" field (e.g. org.freedesktop.Platform) is *not* a
# .NET runtime identifier, so we don't pass it to the generator.  The CLI's
# `--runtime` option is intended for dotnet RIDs such as linux-x64.
# compute absolute path to the project file (script may be run from any cwd)
project_file="$(dirname "${BASH_SOURCE[0]}")/../HyPrism.csproj"

echo "Executing: python3 Properties/linux/flathub/flatpak-dotnet-generator.py \
    --only-arches x86_64 \
    --freedesktop \"$runtime_version\" \
    --dotnet \"$dotnet\" \
    Properties/linux/flathub/nuget-sources.json \"$project_file\""

python3 Properties/linux/flathub/flatpak-dotnet-generator.py \
    --only-arches x86_64 \
    --freedesktop "$runtime_version" \
    --dotnet "$dotnet" \
    Properties/linux/flathub/nuget-sources.json "$project_file"

# ---------------------------------------------------------------------------
# Ensure the standard runtime packages are present in the generated JSON.
# When build occurs inside the Flatpak builder we restrict restore sources to
# the contents of `nuget-sources/`.  `dotnet publish` still expects a few
# Microsoft runtime packages (linux-x64) which are *not* restored by the
# earlier python tool because they live in the shared framework rather than the
# project itself.  Without them the builder reports errors like:
#
#   error NU1101: Unable to find package Microsoft.NETCore.App.Runtime.linux-x64
#
# We can compute the exact package version from the SDK installed in the
# extension and add entries for the three missing IDs.

# query dotnet inside the same Flatpak environment used by the generator
runtime_pkg_version=$(flatpak run \
    --env=DOTNET_CLI_TELEMETRY_OPTOUT=true \
    --env=DOTNET_SKIP_FIRST_TIME_EXPERIENCE=true \
    --command=sh \
    --runtime=org.freedesktop.Sdk//$runtime_version \
    --share=network \
    --filesystem=host \
    org.freedesktop.Sdk.Extension.dotnet$dotnet//$runtime_version \
    -c "PATH=\"\$PATH:/usr/lib/sdk/dotnet$dotnet/bin\" LD_LIBRARY_PATH=\"\$LD_LIBRARY_PATH:/usr/lib/sdk/dotnet$dotnet/lib\" dotnet --list-runtimes" \
  | awk '/Microsoft\.NETCore\.App/ {print $2; exit}')

if [[ -z "$runtime_pkg_version" ]]; then
    echo "warning: could not determine runtime package version" >&2
else
    echo "Detected runtime package version: $runtime_pkg_version"
    for pkg in \
        Microsoft.NETCore.App.Runtime.linux-x64 \
        Microsoft.AspNetCore.App.Runtime.linux-x64 \
        Microsoft.NETCore.App.Crossgen2.linux-x64; do
        # avoid duplicate entries if the JSON already contains this package
        if grep -q "\"$pkg\".*\"$runtime_pkg_version\"" Properties/linux/flathub/nuget-sources.json; then
            continue
        fi
        url="https://api.nuget.org/v3-flatcontainer/$pkg/$runtime_pkg_version/$pkg.$runtime_pkg_version.nupkg"
        tmpfile=$(mktemp)
        curl -fsSL "$url" -o "$tmpfile" || {
            echo "failed to download $url" >&2
            rm -f "$tmpfile"
            continue
        }
        sha512=$(sha512sum "$tmpfile" | awk '{print $1}')
        rm -f "$tmpfile"
        jq --arg url "$url" --arg sha512 "$sha512" \
            --arg fname "$pkg.$runtime_pkg_version.nupkg" \
            '. += [{"type":"file","url":$url,"sha512":$sha512,"dest":"nuget-sources","dest-filename":$fname}]' \
            Properties/linux/flathub/nuget-sources.json \
            > Properties/linux/flathub/nuget-sources.json.tmp && \
            mv Properties/linux/flathub/nuget-sources.json.tmp Properties/linux/flathub/nuget-sources.json
    done
fi