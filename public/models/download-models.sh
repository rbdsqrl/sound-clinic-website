#!/bin/bash
# Run this script once to download face-api.js model weights into this folder.
# Required for the attendance face recognition feature.

BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

files=(
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
)

for f in "${files[@]}"; do
  echo "Downloading $f ..."
  curl -L -o "$f" "$BASE/$f"
done

echo "Done."
