# Taka sign fonts

`taka-serif.woff2` and `taka-sans-*.woff2` contain one character, the taka sign ৳ (U+09F3), cut
from the Bangla fonts the site already uses: Noto Serif Bengali (The Noto Project Authors) and
Hind Siliguri 400/500/600 (Indian Type Foundry). Both are licensed under the SIL Open Font License,
Version 1.1 (https://openfontlicense.org). The glyphs are unchanged; only the family names were set
to "Pinewood Taka Serif" / "Pinewood Taka Sans".

They sit ahead of the full Bangla fonts in the font stacks (src/app/globals.css) with
`unicode-range: U+09F3`, so an English page with prices downloads about 1 KB instead of the whole
Bangla font. Made with fontTools (`pyftsubset <font>.woff2 --unicodes=U+09F3 --flavor=woff2`).
