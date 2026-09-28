# eth3rn5l — portfolio

Portfolio cyberpunk di **Ethan Lacerenza** (eth3rn5l), interamente in **Rust + WebGL2 + WASM**.

Tutto il rendering gira sulla GPU via tre pass WebGL2 orchestrate da Rust:

1. **Scene** — raymarcher di una città cyberpunk vista dall'alto: torri neon che pulsano su una griglia procedurale. Il centro è lasciato sgombro: l'elemento *hero* è la segnaletica katakana dell'overlay.
2. **Post** — aberrazione cromatica, bloom, glitch a blocchi, grana cinematica, scanlines CRT. Sopra il grade viene composto un layer di **insegne al neon in katakana** (stile Edgerunners/Night City), **generato in un modulo WebAssembly dedicato** (`wasm-glyph/`): insegne verticali sui lati e banner in alto, con bordo neon, flicker e glitch (block-shift + RGB split). Il layout cambia ad ogni caricamento.
3. **Katakana rain** — pioggia di ideogrammi generati proceduralmente in GLSL puro (nessun canvas 2D), in blend additivo sopra la scena. Reagisce al mouse.

L'intera interfaccia (nav, hero, sezioni, footer) è costruita nel DOM **da Rust** via `web-sys`. L'HTML di partenza è solo un `<canvas>`.

## Stack

| Layer     | Tech                                  |
|-----------|---------------------------------------|
| Rendering | GLSL ES 3.00 (WebGL2), 3-pass         |
| Logica    | Rust → `wasm32-unknown-unknown`       |
| Bindings  | `wasm-bindgen` 0.2.128 + `web-sys`    |
| UI        | costruita da Rust via DOM API         |
| Build     | GitHub Actions                        |
| Hosting   | GitHub Pages                          |

## Deploy (una volta sola)

1. Pusha tutti questi file nella branch `main` del repo
2. **Settings → Pages → Source → GitHub Actions**
3. La Action compila Rust→WASM e deploya. Live in ~2-3 min.

## Sviluppo locale

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128

cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir ./pkg --no-typescript \
  ./target/wasm32-unknown-unknown/release/eth3rn5l_portfolio.wasm

python3 -m http.server 8080   # poi apri http://localhost:8080
```

## Struttura

```
├── src/
│   ├── lib.rs              ← pipeline WebGL2 + UI injection
│   └── shaders/
│       ├── scene.frag      ← raymarcher città (centro sgombro)
│       ├── post.frag       ← post glitch + overlay insegne katakana
│       └── kana.frag       ← katakana rain
├── wasm-glyph/             ← modulo WASM (AssemblyScript) che genera
│   ├── src/glyph.ts        ↳ le insegne ed emette il GLSL dell'overlay
│   ├── glyph.wasm          ↳ artefatto compilato (committato)
│   └── glyph.js            ↳ bindings ESM
├── index.html              ← guscio: <canvas> + bootstrap WASM
├── Cargo.toml
├── Cargo.lock              ← pinna wasm-bindgen 0.2.128
└── .github/workflows/deploy.yml
```

## Insegne katakana in WebAssembly (`wasm-glyph/`)

Le insegne usano **katakana veri** (glifi vettoriali codificati a mano e
composti in parole a tema: ネオン, サイバー, ナイト, ミライ, サムライ…) e la
**palette ufficiale Edgerunners** (color-hex 1035160: giallo #f8e602, verde
#4bff21, cyan #00f0ff, rosa #f4d5fd, viola #772289), applicata anche a città e
pioggia. Sono calcolate da un secondo modulo
**WebAssembly** compilato con AssemblyScript. Il modulo semina un PRNG, dispone
le insegne (verticali laterali + banner alti, centro sgombro) ed **emette
direttamente il GLSL** — renderer katakana, dati e la funzione `signage()` —
che viene composto in `post.frag`. Il JavaScript fa solo da cavo: passa l'output
di WASM alla shader intercettando `WebGL2.shaderSource` (instradando per
contenuto: `post.frag` riceve l'overlay, `scene.frag` viene liberata del vecchio
monolite "E").

```bash
cd wasm-glyph
npm install
npm run build      # rigenera glyph.wasm + glyph.js
```

## Autore

**Ethan Lacerenza** · [github.com/ethanlacerenza](https://github.com/ethanlacerenza) · [LinkedIn](https://www.linkedin.com/in/ethan-lacerenza-2633421ab/)
