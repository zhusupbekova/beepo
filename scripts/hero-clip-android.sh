#!/bin/bash
# Raw Android clip for X: YouTube on the emulator, Beepo walking the bottom edge (Plus "stay out"),
# a long press sends him into the camera hole, and he drops back out with the STOP sign when the
# 1-minute limit is reached. Needs: emulator up, debug build with usage access + overlay allowed,
# Plus on (Settings → "Dev: Plus off → on"), YouTube opened once (notification prompt dismissed).
# Usage: bash scripts/hero-clip-android.sh   → dist/social/hero/raw/hide.mp4 (+ hide-full.mp4 at 30fps)
set -e
PKG=studio.panikka.beepo
OUT="$(cd "$(dirname "$0")/.." && pwd)/dist/social/hero"
mkdir -p "$OUT/raw" "$OUT/frames"

put() { adb push -q /tmp/seed.json /data/local/tmp/seed.json; adb shell "run-as $PKG sh -c 'cat /data/local/tmp/seed.json > files/$1'"; }
# Pink/red pixels around the camera hole: the STOP sign hanging out of it.
stop_up() {
  ffmpeg -loglevel error -i "$1" -vf "crop=300:320:390:0" -f rawvideo -pix_fmt rgb24 - | python3 -c '
import sys
d=sys.stdin.buffer.read(); n=0
for i in range(0,len(d),3):
    r,g,b=d[i],d[i+1],d[i+2]
    if r>190 and g<120 and b<160: n+=1
print(n)'
}
# Cyan pixels around the camera hole: his head peeking out.
head_up() {
  ffmpeg -loglevel error -i "$1" -vf "crop=300:200:390:0" -f rawvideo -pix_fmt rgb24 - | python3 -c '
import sys
d=sys.stdin.buffer.read(); n=0
for i in range(0,len(d),3):
    r,g,b=d[i],d[i+1],d[i+2]
    if r<140 and g>170 and b>190: n+=1
print(n)'
}
# Centre x of Beepo's ink (#1b1b2f) in the bottom band of a screenshot; empty if he isn't there.
beepo_x() {
  ffmpeg -loglevel error -i "$1" -vf "crop=1080:200:0:2130" -f rawvideo -pix_fmt rgb24 - | python3 -c '
import sys
d=sys.stdin.buffer.read(); W=1080; xs=[]
for i in range(0,len(d),3):
    r,g,b=d[i],d[i+1],d[i+2]
    if abs(r-27)+abs(g-27)+abs(b-47)<30: xs.append((i//3)%W)
if len(xs)>300: print(sum(xs)//len(xs))'
}
swipe() { adb shell input swipe 540 1700 540 $((1700 - $1)) ${2:-350}; }

# Minutes Beepo itself counts for YouTube today (its Today tab, "37m/39m"); the limit goes one above.
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 5
adb shell uiautomator dump /sdcard/ui.xml >/dev/null
U=$(adb shell cat /sdcard/ui.xml | tr '>' '\n' | grep -o 'text="[0-9]*m/[0-9]*m"' | head -1 | sed -E 's/text="([0-9]+)m.*/\1/')
[ -z "$U" ] && U=0
MIN=$(( U + 1 ))
echo "youtube at ${U} min by Beepo's count → limit ${MIN} min; he whispers from the hole ~25 s before the limit, the STOP at the limit (1–2 min)"
adb shell am force-stop $PKG
echo "[{\"id\":\"yt\",\"name\":\"YouTube\",\"patterns\":[],\"apps\":[\"com.google.android.youtube\"],\"mode\":\"limit\",\"minutes\":$MIN,\"weekendMinutes\":null,\"block\":false,\"hidden\":false,\"focus\":null}]" > /tmp/seed.json; put rules.json
echo '[]' > /tmp/seed.json; put pending.json
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; sleep 4
# Plus (the dev toggle) lives in memory only, so turn it on again after the restart: Settings → "Dev: Plus off → on".
texts() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml | tr '>' '\n'; }
for i in 1 2 3 4 5 6; do texts | grep -q '⚙️' && break; sleep 1; done
G=$(texts | grep '⚙️' | grep -o 'bounds="\[[0-9]*,[0-9]*\]' | grep -o '[0-9]*,[0-9]*' || true)
adb shell input tap $(( ${G%,*} + 60 )) $(( ${G#*,} + 60 )); sleep 1.5
for i in 1 2 3; do adb shell input swipe 540 2000 540 400 300; done; sleep 1
B=$(texts | grep 'Dev: Plus off' | grep -o 'bounds="\[[0-9]*,[0-9]*\]' | grep -o '[0-9]*,[0-9]*' || true)
if [ -n "$B" ]; then adb shell input tap $(( ${B%,*} + 60 )) $(( ${B#*,} + 20 )); echo "plus on"
elif texts | grep -q 'Dev: Plus on'; then echo "plus already on"
else echo "settings not open, no Plus toggle found"; exit 1; fi
sleep 1; adb shell input keyevent BACK; sleep 0.5
adb shell input keyevent HOME; sleep 1
adb shell am force-stop com.google.android.youtube
adb shell monkey -p com.google.android.youtube -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 6
adb shell screenrecord --time-limit 170 --bit-rate 16000000 /sdcard/hide.mp4 &
REC=$!
T0=$(date +%s)
sleep 3
for i in 1 2 3; do swipe 1000 350; sleep 2; done
# Find him at the bottom and long-press; he keeps walking, so check he's gone and retry if not.
for try in 1 2 3 4; do
  adb exec-out screencap -p > /tmp/hide-pre.png
  X=$(beepo_x /tmp/hide-pre.png)
  if [ -z "$X" ]; then echo "Beepo not at the bottom (try $try)"; sleep 1.5; continue; fi
  adb shell input swipe $X 2240 $X 2240 1500
  sleep 2.5
  adb exec-out screencap -p > /tmp/hide-post.png
  if [ "$(head_up /tmp/hide-post.png)" -gt 30 ]; then echo "hidden at $(( $(date +%s) - T0 ))s (x=$X, try $try)"; break; fi
done
sleep 3
# Scroll on until the STOP sign hangs out of the hole, then tap it: he drops out and falls back down.
TAPPED=0
while [ $(( $(date +%s) - T0 )) -lt 165 ]; do
  swipe 1000 350; sleep 2.5
  if [ $TAPPED = 0 ]; then
    adb exec-out screencap -p > /tmp/hide-now.png
    if [ "$(stop_up /tmp/hide-now.png)" -gt 300 ]; then
      sleep 2.5; echo "STOP at the hole, tapping at $(( $(date +%s) - T0 ))s"
      adb shell input tap 540 185; TAPPED=1; TAP_T=$(date +%s)
    fi
  elif [ $(( $(date +%s) - TAP_T )) -gt 12 ]; then
    adb shell pkill -l INT screenrecord; break
  fi
done
wait $REC || true
adb pull -q /sdcard/hide.mp4 "$OUT/raw/hide.mp4"
cp "$OUT/raw/hide.mp4" "$OUT/raw/hide-$(date +%H%M%S).mp4"
ffmpeg -y -loglevel error -i "$OUT/raw/hide.mp4" -vf "fps=1" "$OUT/frames/hide-%03d.png"
ffmpeg -y -loglevel error -i "$OUT/raw/hide.mp4" -r 30 -pix_fmt yuv420p -c:v libx264 -crf 18 -an "$OUT/raw/hide-full.mp4"
echo "hide: raw/hide.mp4 ($(( $(date +%s) - T0 ))s)"
