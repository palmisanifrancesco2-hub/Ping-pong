#!/usr/bin/env bash
set -euo pipefail

android_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
: "${PPA_BUILD_TOOLS:?Set PPA_BUILD_TOOLS to the Android build-tools directory}"
: "${PPA_ANDROID_JAR:?Set PPA_ANDROID_JAR to the Android platform android.jar}"
: "${PPA_KEYSTORE:?Set PPA_KEYSTORE to the private signing keystore}"
: "${PPA_KEYSTORE_PASSWORD:?Set PPA_KEYSTORE_PASSWORD for apksigner}"

output_dir="${1:-$android_dir/../.research-data/android/dist}"
mkdir -p -- "$output_dir"
output_dir="$(cd -- "$output_dir" && pwd)"
build_dir="$(mktemp -d)"
trap 'rm -rf -- "$build_dir"' EXIT
mkdir -p -- "$build_dir/java" "$build_dir/classes" "$build_dir/dex"

"$PPA_BUILD_TOOLS/aapt2" compile --dir "$android_dir/res" -o "$build_dir/resources.zip"
"$PPA_BUILD_TOOLS/aapt2" link -I "$PPA_ANDROID_JAR" --manifest "$android_dir/AndroidManifest.xml" \
    --java "$build_dir/java" -o "$build_dir/unsigned.apk" "$build_dir/resources.zip"

sources=("$android_dir/src/com/pingponganalytics/launcher/MainActivity.java" \
    "$build_dir/java/com/pingponganalytics/launcher/R.java")
if [[ -n "${PPA_ECJ:-}" ]]; then
    java -jar "$PPA_ECJ" -8 -proc:none -bootclasspath "$PPA_ANDROID_JAR" -d "$build_dir/classes" "${sources[@]}"
else
    javac -source 8 -target 8 -bootclasspath "$PPA_ANDROID_JAR" -d "$build_dir/classes" "${sources[@]}"
fi
mapfile -t classes < <(find "$build_dir/classes" -name '*.class')
"$PPA_BUILD_TOOLS/d8" --release --min-api 24 --lib "$PPA_ANDROID_JAR" --output "$build_dir/dex" "${classes[@]}"
(cd -- "$build_dir/dex" && zip -q -j "$build_dir/unsigned.apk" classes.dex)
"$PPA_BUILD_TOOLS/zipalign" -f 4 "$build_dir/unsigned.apk" "$build_dir/aligned.apk"

export PPA_KEYSTORE_PASSWORD
"$PPA_BUILD_TOOLS/apksigner" sign --ks "$PPA_KEYSTORE" --ks-key-alias ping-pong-analytics \
    --ks-pass env:PPA_KEYSTORE_PASSWORD --out "$build_dir/Ping-Pong-Analytics.apk" "$build_dir/aligned.apk"
"$PPA_BUILD_TOOLS/apksigner" verify --verbose --print-certs "$build_dir/Ping-Pong-Analytics.apk"
mv -- "$build_dir/Ping-Pong-Analytics.apk" "$output_dir/Ping-Pong-Analytics.apk"
sha256sum "$output_dir/Ping-Pong-Analytics.apk"
