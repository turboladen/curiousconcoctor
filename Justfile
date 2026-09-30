serve-and-open:
    zola serve --open

serve:
    zola serve

# Runs the same checks as CI. The build rewrites public/, which a running zola serve also reads.
check:
    zola build
    zola check --skip-external-links
    dprint check
    bun tools/check-site.ts public
    uvx zizmor@1.30.1 --offline .

# Rebuilds the Caveat subset from the full font. Run it after editing tools/fonts/caveat-glyphs.txt.
subset-caveat:
    uvx --from fonttools --with brotli pyftsubset tools/fonts/caveat-latin-500-normal.full.woff2 --text-file=tools/fonts/caveat-glyphs.txt --flavor=woff2 --layout-features='*' --output-file=static/fonts/caveat-latin-500-normal.woff2
