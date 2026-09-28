// ─────────────────────────────────────────────────────────────────────────
//  glyph.ts — INSEGNE AL NEON in KATAKANA VERI (WebAssembly)
//
//  Stile canon Cyberpunk: Edgerunners. Palette ufficiale (color-hex 1035160):
//    giallo #f8e602 · verde #4bff21 · cyan #00f0ff · rosa #f4d5fd · viola #772289
//
//  I caratteri sono katakana REALI: ogni glifo e' codificato come insieme di
//  tratti vettoriali (segmenti) e composto in parole a tema (ネオン, サイバー,
//  ナイト, ミライ, サムライ...). Tutta l'elaborazione (PRNG, layout insegne,
//  emissione del GLSL: tabelle glifi + parole + renderer + signage()) gira in
//  WASM; il JavaScript passa solo le stringhe alla shader.
// ─────────────────────────────────────────────────────────────────────────

const NP: i32 = 7;        // numero di insegne
const MAXSEG: i32 = 4;    // segmenti massimi per glifo (bound del loop)

// ── PRNG xorshift32 ────────────────────────────────────────────────────────
let rngState: u32 = 1;
function seedRng(seed: u32): void { rngState = (seed ^ 0x9e3779b9) | 1; }
function nextU32(): u32 { let x = rngState; x ^= x << 13; x ^= x >> 17; x ^= x << 5; rngState = x; return x; }
function rnd(): f32 { return <f32>(nextU32() & 0xffffff) / <f32>0x1000000; }
function rrange(a: f32, b: f32): f32 { return a + (b - a) * rnd(); }
function ri(n: i32): i32 { return <i32>(rnd() * <f32>n); }

// ── formattazione ──────────────────────────────────────────────────────────
function fmt(x: f32): string {
  let neg = x < 0; let v = neg ? -x : x;
  let scaled = <i32>(v * 1000.0 + 0.5);
  let ip = scaled / 1000; let fp = scaled % 1000;
  let fps = fp.toString(); while (fps.length < 3) fps = "0" + fps;
  let s = ip.toString() + "." + fps; return neg ? "-" + s : s;
}
function farr(a: Array<f32>): string { let o = ""; for (let i = 0; i < a.length; i++) { o += fmt(a[i]); if (i < a.length - 1) o += ","; } return o; }
function iarr(a: Array<i32>): string { let o = ""; for (let i = 0; i < a.length; i++) { o += a[i].toString(); if (i < a.length - 1) o += ","; } return o; }

// ── tabelle glifi katakana (tratti vettoriali reali) ───────────────────────
let SEG: Array<f32> = new Array<f32>();
let GOFF: Array<i32> = new Array<i32>();
let GCNT: Array<i32> = new Array<i32>();

// spingi un segmento; y viene ribaltata (glyph space y-up: 0 in basso)
function s(x0: f32, y0: f32, x1: f32, y1: f32): void {
  SEG.push(x0); SEG.push(1.0 - y0); SEG.push(x1); SEG.push(1.0 - y1);
}
function gB(): void { GOFF.push(SEG.length / 4); }
function gE(): void { GCNT.push((SEG.length / 4) - GOFF[GOFF.length - 1]); }

function buildGlyphs(): void {
  gB(); s(0.22,0.30,0.80,0.30); s(0.66,0.30,0.46,0.86); s(0.46,0.60,0.30,0.74); gE(); // 0 ア
  gB(); s(0.36,0.24,0.54,0.46); s(0.66,0.16,0.42,0.88); gE();                          // 1 イ
  gB(); s(0.50,0.12,0.50,0.26); s(0.24,0.34,0.76,0.34); s(0.72,0.34,0.72,0.60); s(0.72,0.60,0.42,0.86); gE(); // 2 ウ
  gB(); s(0.24,0.26,0.76,0.26); s(0.50,0.26,0.50,0.74); s(0.22,0.74,0.78,0.74); gE();  // 3 エ
  gB(); s(0.28,0.32,0.74,0.32); s(0.56,0.16,0.52,0.86); s(0.56,0.50,0.30,0.80); gE();  // 4 オ
  gB(); s(0.28,0.34,0.72,0.32); s(0.40,0.22,0.40,0.54); s(0.66,0.32,0.46,0.86); gE();  // 5 カ
  gB(); s(0.28,0.34,0.74,0.30); s(0.26,0.54,0.72,0.50); s(0.56,0.18,0.46,0.88); gE();  // 6 キ
  gB(); s(0.30,0.26,0.70,0.24); s(0.66,0.24,0.42,0.88); gE();                          // 7 ク
  gB(); s(0.34,0.20,0.30,0.54); s(0.26,0.34,0.72,0.32); s(0.64,0.24,0.50,0.86); gE();  // 8 ケ
  gB(); s(0.28,0.26,0.74,0.26); s(0.74,0.26,0.74,0.74); s(0.30,0.74,0.74,0.74); gE();  // 9 コ
  gB(); s(0.28,0.36,0.72,0.32); s(0.40,0.22,0.36,0.60); s(0.60,0.22,0.56,0.60); s(0.54,0.34,0.46,0.88); gE(); // 10 サ
  gB(); s(0.28,0.30,0.42,0.38); s(0.28,0.52,0.42,0.60); s(0.66,0.20,0.30,0.80); gE();  // 11 シ
  gB(); s(0.28,0.28,0.74,0.28); s(0.70,0.28,0.36,0.64); s(0.50,0.52,0.72,0.86); gE();  // 12 ス
  gB(); s(0.26,0.42,0.72,0.36); s(0.46,0.20,0.44,0.72); s(0.44,0.72,0.74,0.64); gE();  // 13 セ
  gB(); s(0.34,0.24,0.46,0.38); s(0.66,0.20,0.36,0.84); gE();                          // 14 ソ
  gB(); s(0.30,0.26,0.66,0.22); s(0.62,0.22,0.38,0.86); s(0.40,0.50,0.60,0.60); gE();  // 15 タ
  gB(); s(0.24,0.40,0.76,0.36); s(0.58,0.18,0.44,0.88); gE();                          // 16 ナ
  gB(); s(0.32,0.34,0.62,0.32); s(0.24,0.72,0.76,0.70); gE();                          // 17 ニ
  gB(); s(0.48,0.14,0.48,0.28); s(0.26,0.34,0.72,0.32); s(0.44,0.32,0.34,0.86); s(0.44,0.52,0.66,0.74); gE(); // 18 ネ
  gB(); s(0.68,0.20,0.34,0.86); gE();                                                  // 19 ノ
  gB(); s(0.44,0.24,0.26,0.84); s(0.52,0.28,0.76,0.84); gE();                          // 20 ハ
  gB(); s(0.34,0.24,0.36,0.66); s(0.34,0.46,0.66,0.38); s(0.30,0.70,0.72,0.80); gE();  // 21 ヒ
  gB(); s(0.28,0.28,0.72,0.28); s(0.70,0.28,0.44,0.62); s(0.54,0.50,0.50,0.86); gE();  // 22 マ
  gB(); s(0.30,0.28,0.66,0.34); s(0.30,0.48,0.66,0.54); s(0.30,0.68,0.66,0.76); gE();  // 23 ミ
  gB(); s(0.50,0.22,0.32,0.72); s(0.32,0.72,0.72,0.72); s(0.58,0.54,0.72,0.72); gE();  // 24 ム
  gB(); s(0.34,0.26,0.70,0.82); s(0.66,0.28,0.30,0.80); gE();                          // 25 メ
  gB(); s(0.34,0.24,0.66,0.24); s(0.28,0.44,0.72,0.42); s(0.66,0.42,0.44,0.86); gE();  // 26 ラ
  gB(); s(0.38,0.22,0.34,0.70); s(0.64,0.20,0.60,0.88); gE();                          // 27 リ
  gB(); s(0.36,0.24,0.34,0.80); s(0.34,0.80,0.48,0.68); s(0.58,0.24,0.58,0.60); s(0.58,0.60,0.76,0.84); gE(); // 28 ル
  gB(); s(0.30,0.28,0.72,0.28); s(0.72,0.28,0.72,0.78); s(0.30,0.78,0.72,0.78); s(0.30,0.28,0.30,0.78); gE(); // 29 ロ
  gB(); s(0.30,0.36,0.44,0.44); s(0.66,0.22,0.32,0.80); gE();                          // 30 ン
  gB(); s(0.22,0.50,0.78,0.50); gE();                                                  // 31 ー
  gB(); s(0.42,0.18,0.40,0.86); s(0.40,0.52,0.70,0.66); gE();                          // 32 ト
}

// ── parole a tema (sequenze di indici katakana) ────────────────────────────
let WORD: Array<i32> = new Array<i32>();
let WOFF: Array<i32> = new Array<i32>();
let WCNT: Array<i32> = new Array<i32>();
function w(a: i32[]): void { WOFF.push(WORD.length); for (let i = 0; i < a.length; i++) WORD.push(a[i]); WCNT.push(a.length); }
function buildWords(): void {
  w([18,4,30]);      // ネオン  neon
  w([10,1,20,31]);   // サイバー cyber
  w([16,1,32]);      // ナイト  night
  w([23,26,1]);      // ミライ  mirai (futuro)
  w([0,6,26]);       // アキラ  akira
  w([7,29]);         // クロ    kuro (nero)
  w([14,26]);        // ソラ    sora (cielo)
  w([10,24,26,1]);   // サムライ samurai
  w([18,9]);         // ネコ    neko (gatto)
  w([20,28,5]);      // ハルカ  haruka
  w([25,5]);         // メカ    mecha
  w([28,16]);        // ルナ    luna
  w([6,5,1]);        // キカイ  kikai (macchina)
  w([13,5,1]);       // セカイ  sekai (mondo)
  w([9,18,7,32]);    // コネクト konekuto (connect)
}
const NW: i32 = 15;

let tablesReady = false;
function ensure(): void { if (!tablesReady) { buildGlyphs(); buildWords(); tablesReady = true; } }

// ── layout insegne (bande laterali + banner alti, centro sgombro) ──────────
function panelData(seed: u32): string {
  ensure(); seedRng(seed);
  let px = new Array<f32>(), py = new Array<f32>(), pw = new Array<f32>(), ph = new Array<f32>();
  let hue = new Array<f32>(), ori = new Array<f32>(), wrd = new Array<f32>(), flk = new Array<f32>();

  for (let i = 0; i < NP; i++) {
    let vertical = false; let x: f32 = 0.0, y: f32 = 0.0, ww: f32 = 0.0, hh: f32 = 0.0;
    if (i == 0 || i == 1) {                    // verticali a sinistra
      vertical = true; ww = rrange(0.06, 0.10); x = rrange(0.03, 0.06) + <f32>i * 0.004;
      hh = rrange(0.30, 0.46); y = rrange(0.10, 0.22) + <f32>i * 0.05;
    } else if (i == 2 || i == 3) {             // verticali a destra
      vertical = true; ww = rrange(0.06, 0.10); x = rrange(0.86, 0.92);
      hh = rrange(0.30, 0.46); y = rrange(0.10, 0.22) + <f32>(i - 2) * 0.05;
    } else if (i == 4) {                        // banner alto sinistra
      ww = rrange(0.17, 0.25); x = rrange(0.05, 0.09); hh = rrange(0.055, 0.08); y = rrange(0.04, 0.10);
    } else if (i == 5) {                        // banner alto destra
      ww = rrange(0.17, 0.25); x = rrange(0.60, 0.66); hh = rrange(0.055, 0.08); y = rrange(0.04, 0.10);
    } else {                                    // banner basso su un lato
      ww = rrange(0.16, 0.22); x = rnd() > 0.5 ? rrange(0.05, 0.10) : rrange(0.62, 0.70);
      hh = rrange(0.055, 0.08); y = rrange(0.72, 0.82);
    }
    if (x + ww > 0.98) x = 0.98 - ww;
    if (y + hh > 0.96) y = 0.96 - hh;
    // scegli una parola adatta all'orientamento (verticali: 3-4 char)
    let wi = ri(NW);
    if (vertical) { let guard = 0; while (WCNT[wi] < 3 && guard < 8) { wi = ri(NW); guard++; } }
    px.push(x); py.push(y); pw.push(ww); ph.push(hh);
    hue.push(<f32>ri(4)); ori.push(vertical ? 1.0 : 0.0); wrd.push(<f32>wi); flk.push(rnd());
  }

  let np = NP.toString();
  return "//__PANEL_DATA_START__\n" +
    "const int NP=" + np + ";\n" +
    "const float PX[" + np + "]=float[" + np + "](" + farr(px) + ");\n" +
    "const float PY[" + np + "]=float[" + np + "](" + farr(py) + ");\n" +
    "const float PW[" + np + "]=float[" + np + "](" + farr(pw) + ");\n" +
    "const float PH[" + np + "]=float[" + np + "](" + farr(ph) + ");\n" +
    "const float PHUE[" + np + "]=float[" + np + "](" + farr(hue) + ");\n" +
    "const float PORI[" + np + "]=float[" + np + "](" + farr(ori) + ");\n" +
    "const float PWORD[" + np + "]=float[" + np + "](" + farr(wrd) + ");\n" +
    "const float PFL[" + np + "]=float[" + np + "](" + farr(flk) + ");\n" +
    "//__PANEL_DATA_END__";
}

// ── GLSL statico: hash, segmento, glifi, kata(), parole, palette ───────────
function staticTables(): string {
  ensure();
  let ns = SEG.length.toString();
  let ngl = GOFF.length.toString();
  let nw = WOFF.length.toString();
  let nwd = WORD.length.toString();
  return "float sHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n" +
    "float segCov(vec2 p, vec2 a, vec2 b, float w){\n" +
    "  vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);\n" +
    "  return smoothstep(w, w*0.35, length(pa-ba*h));\n" +
    "}\n" +
    "const int NGL=" + ngl + ";\n" +
    "const int MXS=" + MAXSEG.toString() + ";\n" +
    "const float SEG[" + ns + "]=float[" + ns + "](" + farr(SEG) + ");\n" +
    "const int GOFF[" + ngl + "]=int[" + ngl + "](" + iarr(GOFF) + ");\n" +
    "const int GCNT[" + ngl + "]=int[" + ngl + "](" + iarr(GCNT) + ");\n" +
    "// glifo katakana reale: unione dei suoi segmenti\n" +
    "float kata(vec2 p, int gi){\n" +
    "  float g=0.0; int o=GOFF[gi]; int c=GCNT[gi];\n" +
    "  for(int k=0;k<MXS;k++){ if(k>=c) break; int j=(o+k)*4;\n" +
    "    g=max(g, segCov(p, vec2(SEG[j],SEG[j+1]), vec2(SEG[j+2],SEG[j+3]), 0.058)); }\n" +
    "  return g;\n" +
    "}\n" +
    "const int NW=" + nw + ";\n" +
    "const int WORD[" + nwd + "]=int[" + nwd + "](" + iarr(WORD) + ");\n" +
    "const int WOFF[" + nw + "]=int[" + nw + "](" + iarr(WOFF) + ");\n" +
    "const int WCNT[" + nw + "]=int[" + nw + "](" + iarr(WCNT) + ");\n" +
    "vec3 sPal(float i){\n" +
    "  if(i<0.5) return vec3(0.973,0.902,0.008);  // giallo\n" +
    "  if(i<1.5) return vec3(0.294,1.0,0.129);    // verde\n" +
    "  if(i<2.5) return vec3(0.0,0.941,1.0);      // cyan\n" +
    "  return vec3(0.957,0.835,0.992);            // rosa\n" +
    "}";
}

// funzione signage(): disegna le insegne (katakana veri) su col
function signageFn(): string {
  return "vec3 signage(vec2 uv, vec3 col){\n" +
    "  for(int i=0;i<NP;i++){\n" +
    "    vec2 pp=vec2(PX[i],PY[i]); vec2 ps=vec2(PW[i],PH[i]); float fi=float(i);\n" +
    "    float fr=floor(u_t*(5.0+PFL[i]*7.0)+PFL[i]*13.0);\n" +
    "    float on=step(0.12, sHash(vec3(fi,fr,2.0)));\n" +
    "    float bright=on*(0.65+0.35*sHash(vec3(fi,fr,5.0)));\n" +
    "    if(bright<=0.001) continue;\n" +
    "    float gph=floor(u_t*3.0+PFL[i]*5.0); float gg=sHash(vec3(fi,gph,7.0));\n" +
    "    float shift=(gg>0.85)?(sHash(vec3(fi,gph,9.0))-0.5)*0.05:0.0;\n" +
    "    float go=(gg>0.85)?0.010:0.0;\n" +
    "    vec2 suv=uv; suv.x-=shift; vec2 luv=(suv-pp)/ps;\n" +
    "    if(luv.x<0.0||luv.x>1.0||luv.y<0.0||luv.y>1.0) continue;\n" +
    "    vec3 hue=sPal(PHUE[i]);\n" +
    "    float bd=min(min(luv.x,1.0-luv.x),min(luv.y,1.0-luv.y));\n" +
    "    float frame=smoothstep(0.05,0.0,bd)-smoothstep(0.028,0.0,bd);\n" +
    "    int wi=int(PWORD[i]); int nc=WCNT[wi];\n" +
    "    float gM=0.0,gR=0.0,gB=0.0;\n" +
    "    if(PORI[i]<0.5){                        // banner orizzontale\n" +
    "      float t=luv.x*float(nc); int ci=int(clamp(floor(t),0.0,float(nc-1)));\n" +
    "      int gi=WORD[WOFF[wi]+ci];\n" +
    "      vec2 cp=vec2(fract(t),(luv.y-0.16)/0.68);\n" +
    "      if(cp.y>=0.0&&cp.y<=1.0){ gM=kata(cp,gi);\n" +
    "        if(go>0.0){gR=kata(cp+vec2(go,0.0),gi);gB=kata(cp-vec2(go,0.0),gi);} }\n" +
    "    } else {                                 // insegna verticale (alto->basso)\n" +
    "      float tv=(1.0-luv.y)*float(nc); int ci=int(clamp(floor(tv),0.0,float(nc-1)));\n" +
    "      int gi=WORD[WOFF[wi]+ci];\n" +
    "      vec2 cp=vec2((luv.x-0.16)/0.68, 1.0-fract(tv));\n" +
    "      if(cp.x>=0.0&&cp.x<=1.0){ gM=kata(cp,gi);\n" +
    "        if(go>0.0){gR=kata(cp+vec2(0.0,go),gi);gB=kata(cp-vec2(0.0,go),gi);} }\n" +
    "    }\n" +
    "    vec3 cov=(go>0.0)?vec3(gR,gM,gB):vec3(gM);\n" +
    "    vec3 sig = hue*cov*1.9 + hue*frame*1.2 + vec3(0.467,0.133,0.537)*0.05;\n" +
    "    col += sig*bright;\n" +
    "  }\n" +
    "  float sl=abs(fract(uv.y - u_t*0.06)-0.5);\n" +
    "  col += vec3(0.294,1.0,0.129)*smoothstep(0.5,0.497,sl)*0.04;\n" +
    "  return col;\n" +
    "}";
}

// ── EXPORTS ────────────────────────────────────────────────────────────────
export function genOverlay(seed: u32): string { return staticTables() + "\n" + panelData(seed) + "\n" + signageFn(); }
export function genData(seed: u32): string { return panelData(seed); }
export function genComposite(): string { return "  col = signage(uv, col);"; }
export function genScenePatch(): string { return "// centro sgombro: hero sulle insegne katakana (WASM)"; }

// ── recolor Edgerunners (scena + pioggia) ──────────────────────────────────
export function genSceneShade(): string {
  return "    vec3 base=vec3(0.02);\n" +
    "    if(m<1.5)base=vec3(0.0,0.941,1.0);        // cyan\n" +
    "    else if(m<2.5)base=vec3(0.467,0.133,0.537);// viola\n" +
    "    else if(m<5.5)base=vec3(0.294,1.0,0.129);  // verde\n" +
    "    else base=vec3(0.02,0.05,0.07);\n" +
    "    col=base*(0.12+dif);\n" +
    "    if(m>0.5&&m<5.5)col+=base*1.6;";
}
export function genSceneBg(): string {
  return "    col=mix(vec3(0.02,0.05,0.07),vec3(0.85,0.78,0.04),pow(v_uv.y,1.3));";
}
export function genSceneFog(): string {
  return "    float fog=1.0-exp(-t*0.05); col=mix(col,vec3(0.05,0.06,0.10),fog);";
}
export function genKanaPalette(): string {
  return "vec3 kcol(float i){vec3 c[4];c[0]=vec3(0.294,1.0,0.129);c[1]=vec3(0.973,0.902,0.008);c[2]=vec3(0.0,0.941,1.0);c[3]=vec3(0.467,0.133,0.537);return c[int(i)];}";
}
