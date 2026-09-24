# eth3rn5l — portfolio

Portfolio cyberpunk di **Ethan Lacerenza** (eth3rn5l), interamente in **Rust + WebGL2 + WASM**.

Tutto il rendering gira sulla GPU via tre pass WebGL2 orchestrate da Rust:

1. **Scene** — raymarcher di una città cyberpunk vista dall'alto: torri neon che pulsano su una griglia procedurale, con un monolite a forma di **E** (le iniziali) che ruota al centro.
2. **Post** — aberrazione cromatica, bloom, glitch a blocchi, grana cinematica, scanlines CRT.
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
│       ├── scene.frag      ← raymarcher città cyberpunk
│       ├── post.frag       ← post-processing glitch
│       └── kana.frag       ← katakana rain
├── index.html              ← guscio: solo <canvas> + loader
├── Cargo.toml
├── Cargo.lock              ← pinna wasm-bindgen 0.2.128
└── .github/workflows/deploy.yml
```

## Autore

**Ethan Lacerenza** · [github.com/ethanlacerenza](https://github.com/ethanlacerenza) · [LinkedIn](https://www.linkedin.com/in/ethan-lacerenza-2633421ab/)
