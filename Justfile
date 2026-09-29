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
