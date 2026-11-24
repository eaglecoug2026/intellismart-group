#!/bin/sh
# Instagram only takes jpg pictures, and Facebook's link previews handle jpg
# more reliably than webp, so every article's cover picture gets a jpg copy
# beside its webp. Covers that already have one are left alone, so a normal
# run only does the work for the new article.
#
# GitHub's runner image dropped ImageMagick and ffmpeg in Nov 2026, which made
# this step fail and stopped every article from publishing (11/19-11/23). So
# when no converter is found, install ImageMagick; and if a jpg still can't be
# made, warn and carry on: a missing jpg only affects the social post, it must
# never stop the article itself from publishing.
set -u

have() { command -v "$1" >/dev/null 2>&1; }

if ! have magick && ! have convert && ! have ffmpeg; then
  if have apt-get && have sudo; then
    echo "No image converter found; installing ImageMagick."
    sudo apt-get update -qq >/dev/null 2>&1 || true
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends imagemagick >/dev/null 2>&1 || true
  fi
fi

made=0
failed=0
for webp in blog-images/*.webp; do
  [ -e "$webp" ] || continue
  jpg="${webp%.webp}.jpg"
  if [ -e "$jpg" ]; then
    continue
  fi
  ok=1
  if have magick; then
    magick "$webp" -quality 88 "$jpg" || ok=0
  elif have convert; then
    convert "$webp" -quality 88 "$jpg" || ok=0
  elif have ffmpeg; then
    ffmpeg -loglevel error -y -i "$webp" -q:v 3 "$jpg" || ok=0
  else
    ok=0
  fi
  if [ "$ok" = 1 ] && [ -s "$jpg" ]; then
    made=$((made + 1))
  else
    rm -f "$jpg"
    failed=$((failed + 1))
    echo "::warning::Could not make a jpg for $webp; the article still publishes, but its social post may fail."
  fi
done

echo "Made $made jpg cover pictures."
[ "$failed" = 0 ] || echo "Could not make $failed."
exit 0
