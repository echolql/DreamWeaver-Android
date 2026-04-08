#!/bin/bash
set -e

SOURCE="/Users/echoli/.openclaw/workspace/DreamWeaver/public/logo5.png"
RES_DIR="/Users/echoli/.openclaw/workspace/DreamWeaver/android/app/src/main/res"

# Function to resize and replace icons
# For logo5, we want to scale it DOWN so the text is in the safe zone.
# The source logo occupies ~90% of the image. Safe zone is 66%.
# So we scale by (66/90) = 0.73
resize_icons() {
    local size=$1
    local dir=$2
    local target_dir="$RES_DIR/mipmap-$dir"
    
    echo "Processing $dir ($size x $size)..."
    
    # For standard icons, we want it to look like a normal icon. 
    # We'll use a scale that fits the rounded rect nicely.
    # Scale to 85% of target size and pad
    local scale_w=$(echo "$size * 0.85" | bc | cut -d. -f1)
    
    ffmpeg -y -i "$SOURCE" -vf "scale=$scale_w:-1:flags=lanczos,pad=$size:$size:(ow-iw)/2:(oh-ih)/2:color=white@0" -frames:v 1 -update 1 "$target_dir/ic_launcher.png"
    ffmpeg -y -i "$SOURCE" -vf "scale=$scale_w:-1:flags=lanczos,pad=$size:$size:(ow-iw)/2:(oh-ih)/2:color=white@0" -frames:v 1 -update 1 "$target_dir/ic_launcher_round.png"
}

# Adaptive foreground: scale to 66% to guarantee safe zone compliance
resize_foreground() {
    local size=$1
    local dir=$2
    local target_dir="$RES_DIR/mipmap-$dir"
    
    echo "Processing foreground for $dir ($size x $size)..."
    
    local scale_w=$(echo "$size * 0.66" | bc | cut -d. -f1)
    
    # We remove the white corners using colorkey with very low tolerance
    # and then scale and pad.
    ffmpeg -y -i "$SOURCE" -vf "colorkey=0xFFFFFF:0.01:0.01,scale=$scale_w:-1:flags=lanczos,pad=$size:$size:(ow-iw)/2:(oh-ih)/2:color=black@0" -frames:v 1 -update 1 "$target_dir/ic_launcher_foreground.png"
}

# Standard sizes
resize_icons 48 "mdpi"
resize_icons 72 "hdpi"
resize_icons 96 "xhdpi"
resize_icons 144 "xxhdpi"
resize_icons 192 "xxxhdpi"

# Foreground adaptive sizes
resize_foreground 108 "mdpi"
resize_foreground 162 "hdpi"
resize_foreground 216 "xhdpi"
resize_foreground 324 "xxhdpi"
resize_foreground 432 "xxxhdpi"

# Also update the anydpi folder
ANYDPI_DIR="$RES_DIR/mipmap-anydpi-v26"
if [ -d "$ANYDPI_DIR" ]; then
    echo "Updating anydpi-v26..."
    # Scale to 66% of 1024 and pad to 1024
    ffmpeg -y -i "$SOURCE" -vf "colorkey=0xFFFFFF:0.01:0.01,scale=675:-1:flags=lanczos,pad=1024:1024:(ow-iw)/2:(oh-ih)/2:color=black@0" -frames:v 1 -update 1 "$ANYDPI_DIR/ic_launcher_foreground.png"
fi

# CLEANUP overrides
echo "Cleaning up vector overrides..."
rm -f "$RES_DIR/drawable-v24/ic_launcher_foreground.xml"
rm -f "$RES_DIR/drawable/ic_launcher_foreground.xml"
rm -f "$RES_DIR/drawable/ic_launcher_foreground.png"

echo "Icons generated from logo5.png following Android specs!"
