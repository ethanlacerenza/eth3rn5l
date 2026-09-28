#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_scene; uniform float u_t; uniform vec2 u_res;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float h11(float v){return fract(sin(v*127.1)*43758.5453);}
float sHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float segCov(vec2 p, vec2 a, vec2 b, float w){
  vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);
  return smoothstep(w, w*0.35, length(pa-ba*h));
}
const int NGL=33;
const int MXS=4;
const float SEG[360]=float[360](0.220,0.700,0.800,0.700,0.660,0.700,0.460,0.140,0.460,0.400,0.300,0.260,0.360,0.760,0.540,0.540,0.660,0.840,0.420,0.120,0.500,0.880,0.500,0.740,0.240,0.660,0.760,0.660,0.720,0.660,0.720,0.400,0.720,0.400,0.420,0.140,0.240,0.740,0.760,0.740,0.500,0.740,0.500,0.260,0.220,0.260,0.780,0.260,0.280,0.680,0.740,0.680,0.560,0.840,0.520,0.140,0.560,0.500,0.300,0.200,0.280,0.660,0.720,0.680,0.400,0.780,0.400,0.460,0.660,0.680,0.460,0.140,0.280,0.660,0.740,0.700,0.260,0.460,0.720,0.500,0.560,0.820,0.460,0.120,0.300,0.740,0.700,0.760,0.660,0.760,0.420,0.120,0.340,0.800,0.300,0.460,0.260,0.660,0.720,0.680,0.640,0.760,0.500,0.140,0.280,0.740,0.740,0.740,0.740,0.740,0.740,0.260,0.300,0.260,0.740,0.260,0.280,0.640,0.720,0.680,0.400,0.780,0.360,0.400,0.600,0.780,0.560,0.400,0.540,0.660,0.460,0.120,0.280,0.700,0.420,0.620,0.280,0.480,0.420,0.400,0.660,0.800,0.300,0.200,0.280,0.720,0.740,0.720,0.700,0.720,0.360,0.360,0.500,0.480,0.720,0.140,0.260,0.580,0.720,0.640,0.460,0.800,0.440,0.280,0.440,0.280,0.740,0.360,0.340,0.760,0.460,0.620,0.660,0.800,0.360,0.160,0.300,0.740,0.660,0.780,0.620,0.780,0.380,0.140,0.400,0.500,0.600,0.400,0.240,0.600,0.760,0.640,0.580,0.820,0.440,0.120,0.320,0.660,0.620,0.680,0.240,0.280,0.760,0.300,0.480,0.860,0.480,0.720,0.260,0.660,0.720,0.680,0.440,0.680,0.340,0.140,0.440,0.480,0.660,0.260,0.680,0.800,0.340,0.140,0.440,0.760,0.260,0.160,0.520,0.720,0.760,0.160,0.340,0.760,0.360,0.340,0.340,0.540,0.660,0.620,0.300,0.300,0.720,0.200,0.280,0.720,0.720,0.720,0.700,0.720,0.440,0.380,0.540,0.500,0.500,0.140,0.300,0.720,0.660,0.660,0.300,0.520,0.660,0.460,0.300,0.320,0.660,0.240,0.500,0.780,0.320,0.280,0.320,0.280,0.720,0.280,0.580,0.460,0.720,0.280,0.340,0.740,0.700,0.180,0.660,0.720,0.300,0.200,0.340,0.760,0.660,0.760,0.280,0.560,0.720,0.580,0.660,0.580,0.440,0.140,0.380,0.780,0.340,0.300,0.640,0.800,0.600,0.120,0.360,0.760,0.340,0.200,0.340,0.200,0.480,0.320,0.580,0.760,0.580,0.400,0.580,0.400,0.760,0.160,0.300,0.720,0.720,0.720,0.720,0.720,0.720,0.220,0.300,0.220,0.720,0.220,0.300,0.720,0.300,0.220,0.300,0.640,0.440,0.560,0.660,0.780,0.320,0.200,0.220,0.500,0.780,0.500,0.420,0.820,0.400,0.140,0.400,0.480,0.700,0.340);
const int GOFF[33]=int[33](0,3,5,9,12,15,18,21,23,26,29,33,36,39,42,44,47,49,51,55,56,58,61,64,67,70,72,75,77,81,85,87,88);
const int GCNT[33]=int[33](3,2,4,3,3,3,3,2,3,3,4,3,3,3,2,3,2,2,4,1,2,3,3,3,3,2,3,2,4,4,2,1,2);
// glifo katakana reale: unione dei suoi segmenti
float kata(vec2 p, int gi){
  float g=0.0; int o=GOFF[gi]; int c=GCNT[gi];
  for(int k=0;k<MXS;k++){ if(k>=c) break; int j=(o+k)*4;
    g=max(g, segCov(p, vec2(SEG[j],SEG[j+1]), vec2(SEG[j+2],SEG[j+3]), 0.058)); }
  return g;
}
const int NW=15;
const int WORD[43]=int[43](18,4,30,10,1,20,31,16,1,32,23,26,1,0,6,26,7,29,14,26,10,24,26,1,18,9,20,28,5,25,5,28,16,6,5,1,13,5,1,9,18,7,32);
const int WOFF[15]=int[15](0,3,7,10,13,16,18,20,24,26,29,31,33,36,39);
const int WCNT[15]=int[15](3,4,3,3,3,2,2,4,2,3,2,2,3,3,4);
vec3 sPal(float i){
  if(i<0.5) return vec3(0.973,0.902,0.008);  // giallo
  if(i<1.5) return vec3(0.294,1.0,0.129);    // verde
  if(i<2.5) return vec3(0.0,0.941,1.0);      // cyan
  return vec3(0.957,0.835,0.992);            // rosa
}
//__PANEL_DATA_START__
const int NP=7;
const float PX[7]=float[7](0.055,0.055,0.877,0.911,0.080,0.611,0.080);
const float PY[7]=float[7](0.179,0.182,0.104,0.230,0.041,0.089,0.778);
const float PW[7]=float[7](0.084,0.069,0.094,0.063,0.201,0.208,0.187);
const float PH[7]=float[7](0.311,0.308,0.336,0.402,0.069,0.065,0.072);
const float PHUE[7]=float[7](0.000,1.000,3.000,1.000,3.000,2.000,0.000);
const float PORI[7]=float[7](1.000,1.000,1.000,1.000,0.000,0.000,0.000);
const float PWORD[7]=float[7](1.000,12.000,13.000,9.000,3.000,6.000,6.000);
const float PFL[7]=float[7](0.241,0.116,0.744,0.694,0.223,0.045,0.080);
//__PANEL_DATA_END__
vec3 signage(vec2 uv, vec3 col){
  for(int i=0;i<NP;i++){
    vec2 pp=vec2(PX[i],PY[i]); vec2 ps=vec2(PW[i],PH[i]); float fi=float(i);
    float fr=floor(u_t*(5.0+PFL[i]*7.0)+PFL[i]*13.0);
    float on=step(0.12, sHash(vec3(fi,fr,2.0)));
    float bright=on*(0.65+0.35*sHash(vec3(fi,fr,5.0)));
    if(bright<=0.001) continue;
    float gph=floor(u_t*3.0+PFL[i]*5.0); float gg=sHash(vec3(fi,gph,7.0));
    float shift=(gg>0.85)?(sHash(vec3(fi,gph,9.0))-0.5)*0.05:0.0;
    float go=(gg>0.85)?0.010:0.0;
    vec2 suv=uv; suv.x-=shift; vec2 luv=(suv-pp)/ps;
    if(luv.x<0.0||luv.x>1.0||luv.y<0.0||luv.y>1.0) continue;
    vec3 hue=sPal(PHUE[i]);
    float bd=min(min(luv.x,1.0-luv.x),min(luv.y,1.0-luv.y));
    float frame=smoothstep(0.05,0.0,bd)-smoothstep(0.028,0.0,bd);
    int wi=int(PWORD[i]); int nc=WCNT[wi];
    float gM=0.0,gR=0.0,gB=0.0;
    if(PORI[i]<0.5){                        // banner orizzontale
      float t=luv.x*float(nc); int ci=int(clamp(floor(t),0.0,float(nc-1)));
      int gi=WORD[WOFF[wi]+ci];
      vec2 cp=vec2(fract(t),(luv.y-0.16)/0.68);
      if(cp.y>=0.0&&cp.y<=1.0){ gM=kata(cp,gi);
        if(go>0.0){gR=kata(cp+vec2(go,0.0),gi);gB=kata(cp-vec2(go,0.0),gi);} }
    } else {                                 // insegna verticale (alto->basso)
      float tv=(1.0-luv.y)*float(nc); int ci=int(clamp(floor(tv),0.0,float(nc-1)));
      int gi=WORD[WOFF[wi]+ci];
      vec2 cp=vec2((luv.x-0.16)/0.68, 1.0-fract(tv));
      if(cp.x>=0.0&&cp.x<=1.0){ gM=kata(cp,gi);
        if(go>0.0){gR=kata(cp+vec2(0.0,go),gi);gB=kata(cp-vec2(0.0,go),gi);} }
    }
    vec3 cov=(go>0.0)?vec3(gR,gM,gB):vec3(gM);
    vec3 sig = hue*cov*1.9 + hue*frame*1.2 + vec3(0.467,0.133,0.537)*0.05;
    col += sig*bright;
  }
  float sl=abs(fract(uv.y - u_t*0.06)-0.5);
  col += vec3(0.294,1.0,0.129)*smoothstep(0.5,0.497,sl)*0.04;
  return col;
}
void main(){
  vec2 uv=v_uv; vec2 uvG=uv;
  float gt=fract(u_t*0.31+0.07);
  if(gt<0.05){float sy=floor(uv.y*u_res.y/4.0)*4.0/u_res.y;float r=h21(vec2(sy,floor(u_t*30.0)));if(r>0.6)uvG.x=fract(uv.x+(r-0.6)*0.2);}
  float edge=pow(length(uv-0.5)*1.8,1.4); float str=0.003+edge*0.016+(gt<0.05?0.008:0.0);
  vec2 dir=normalize(uvG-0.5+0.001);
  vec3 col; col.r=texture(u_scene,uvG+dir*str).r; col.g=texture(u_scene,uvG).g; col.b=texture(u_scene,uvG-dir*str*0.5).b;
  vec2 px=1.0/u_res; vec3 bl=vec3(0.0);
  for(int i=-4;i<=4;i++){
    float fi=float(i); float w=exp(-fi*fi*0.18)*0.24;
    bl+=texture(u_scene,uvG+vec2(fi*px.x*2.5,0.0)).rgb*w;
    bl+=texture(u_scene,uvG+vec2(0.0,fi*px.y*2.5)).rgb*w;
  }
  col+=max(bl*0.5-0.4,vec3(0.0))*0.5;
  float luma=dot(col,vec3(0.299,0.587,0.114)); col=mix(vec3(luma),col,1.2);
  col+=vec3(-0.01,0.02,0.02)*(1.0-luma)+vec3(0.015,-0.008,0.012)*luma;
  col*=1.0-pow(length(uv-0.5)*1.28,2.4);
  col+=(h21(uv+fract(u_t*0.1))-0.5)*0.05; col-=sin(uv.y*u_res.y*0.5)*0.025;
  col = signage(uv, col);
  o=vec4(clamp(col,0.0,1.0),1.0);
}
