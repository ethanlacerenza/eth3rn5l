# wasm-glyph

Generatore di **insegne al neon in katakana** compilato in **WebAssembly**
(AssemblyScript). È il modulo che porta il portfolio verso il look canon di
*Cyberpunk: Edgerunners* / Night City: insegne verticali sui lati e banner in
alto, con bordo neon, flicker e glitch (block-shift + RGB split), diverse ad
ogni caricamento. Il centro dell'inquadratura resta sgombro.

Tutta l'elaborazione gira in WASM: PRNG deterministico, layout delle insegne e
generazione del **GLSL** (renderer katakana + dati + funzione `signage()`) che
viene composto in `post.frag`. Il JavaScript del sito si limita a passare le
stringhe prodotte da WASM alla shader intercettando `WebGL2.shaderSource`.

## Export (`glyph.ts`)

| Funzione          | Ritorna                                                          |
|-------------------|-----------------------------------------------------------------|
| `genOverlay(seed)`| renderer katakana + dati insegne + `signage()` (per post.frag)  |
| `genData(seed)`   | solo la tabella dati, tra `//__PANEL_DATA_START/END__`           |
| `genComposite()`  | la riga da inserire in `main()`: `col = signage(uv, col);`       |
| `genScenePatch()` | commento che libera il centro scena (via il monolite "E")       |

## Build

```bash
npm install
npm run build     # asc src/glyph.ts --bindings esm --optimize → glyph.wasm + glyph.js
```

Gli artefatti `glyph.wasm` e `glyph.js` sono committati, così il deploy su
GitHub Pages non richiede Node (la Action li copia così come sono).

## Parametri rapidi

In `src/glyph.ts`: `NP` (numero di insegne), `PCPER` (caratteri max per insegna),
le bande di posizionamento in `panelData`, lo spessore dei tratti in `ksign`,
e in `signageFn()` la soglia del flicker (`0.12`) e del glitch (`gg>0.85`).
La palette neon è in `sPal`.
