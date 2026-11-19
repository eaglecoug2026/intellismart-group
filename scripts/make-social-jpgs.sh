#!/bin/sh
# Instagram only takes jpg pictures, and Facebook's link previews handle jpg
# more reliably than webp, so every article's cover picture gets a jpg copy
# beside its webp. Covers that already have one are left alone, so a normal
# run only does the work for the new article.
set -eu

made=0
for webp in blog-images/*.webp; do
  [ -e "$webp" ] || continue
  jpg="${webp%.webp}.jpg"
  if [ -e "$jpg" ]; then
    continue
  fi
  if command -v magick >/dev/null 2>&1; then
    magick "$webp" -quality 88 "$jpg"
  elif command -v convert >/dev/null 2>&1; then
    convert "$webp" -quality 88 "$jpg"
  else
    ffmpeg -loglevel error -y -i "$webp" -q:v 3 "$jpg"
  fi
  made=$((made + 1))
done

echo "Made $made jpg cover pictures."
