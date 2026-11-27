# Validation of Aquos Geochemistry against PHREEQC

These scripts check that the web app gives the same results as PHREEQC itself. They need a native PHREEQC
built from the same `../../src` (for example `cmake ../.. -DCMAKE_BUILD_TYPE=Release && make phreeqc`)
and the app's dependencies (`cd ../app && npm ci`).

| Script | What it checks |
|---|---|
| `layer1.mjs` | All 33 official examples (`../../examples/ex1` … `ex22`, with the database each one names) run in the WebAssembly engine, through the app's own USER_GRAPH translation, and in native PHREEQC. Every output file is compared number by number. |
| `layer1-db.mjs` | One water analysis speciated with each of the 50 databases in `../../database`, web vs native. |
| `layer1-keywords.mjs` | The template of each of the 80 keywords that the app inserts, run as it stands, web vs native. |
| `layer2.mjs` | The synthetic data set (`synthetic.mjs`, written to `data/`) through the Excel/CSV import, field-data reader, calculators, sample map, reference library, serpentinization preset, sweep, contour and diagrams. Imported samples are compared with hand-written PHREEQC input run natively; calculators with hand-computed values. |
| `compare.mjs` | Line-aligned numeric comparison of PHREEQC output, with the classification of expected differences. |

```sh
node --experimental-strip-types --no-warnings layer1.mjs          /path/to/phreeqc layer1.json
node --experimental-strip-types --no-warnings layer1-db.mjs       /path/to/phreeqc layer1-db.json
node --experimental-strip-types --no-warnings layer1-keywords.mjs /path/to/phreeqc layer1-kw.json
node --experimental-strip-types --no-warnings layer2.mjs          /path/to/phreeqc layer2.json
```

## Tolerances and expected differences

A number counts as different when it differs by more than one unit in its last printed digit, by more than
1e-3 relative and by more than 1e-10 absolute. Two kinds of difference are expected between any two correct
builds of PHREEQC (WebAssembly and x86-64 native use different floating-point code paths) and are reported
separately, not as failures:

- **Indeterminate quantities.** In a solution without a redox couple, PHREEQC sets pe from about 1e-39 mol of
  H2 or O2 ("Adjusted to redox equilibrium"). That pe, the trace species and gases that follow from it
  (H2, O2, CH4, H2S, Sulfur SI, their isotopologues) and the number of solver iterations are not fixed by the
  chemistry, and they also differ between native PHREEQC and the reference `.out` files.
- **Ordering.** Species with equal concentrations (isotopologues in ex20) may be printed in another order.

Everything else must match. The app also runs USER_GRAPH programs to draw charts, as PHREEQC for Windows does;
PRINT statements inside USER_GRAPH are dropped so that the output file matches native PHREEQC, while values
stored with PUT (ex20b "Calcite added") still reach USER_PRINT, as in PHREEQC for Windows.
