#!/bin/sh
# Rebuilds kit.css (the one stylesheet the 031 / 032 artboards link): the design system's tokens,
# 027's motion values, 027's mockup kit and kit-031.css. Run from the repo root.
D=docs/design
{
  echo "/* kit.css — built by build-kit.sh from tokens.css, 027 motion.css, the 027 kit and kit-031.css. Don't edit. */"
  cat $D/design-system/tokens.css
  cat $D/features/027-feel/motion.css
  grep -v -e '^@import' -e '^@font-face' -e '^html, body' -e '^body {' -e '^\* {' $D/features/027-feel/mockups/kit.css \
    | sed -e 's/html\.light /[data-theme="light"] /g' -e 's/html\.pins /.pins /g' -e 's/^\.scr { position: relative; width: 100vw; height: 100vh;/.scr { position: relative;/'
  cat $D/features/031-one-board/mockups/kit-031.css
} > $D/features/031-one-board/mockups/kit.css
