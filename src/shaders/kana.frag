#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform float u_t; uniform vec2 u_res; uniform vec2 u_mouse;
float h11(float v){return fract(sin(v*127.1)*43758.5453);}
float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float glyph(vec2 p, float id){
  float g=0.0;
  for(int s=0;s<5;s++){float fs=float(s);float r1=h31(vec3(id,fs,0.0));
    if(r1>0.35){float ty=floor(h31(vec3(id,fs,1.0))*3.0);float x0=h31(vec3(id,fs,2.0))*0.7+0.05;float y0=h31(vec3(id,fs,3.0))*0.7+0.05;float ln=h31(vec3(id,fs,4.0))*0.5+0.25;
      vec2 a=vec2(x0,y0),b; if(ty<1.0)b=vec2(x0+ln,y0);else if(ty<2.0)b=vec2(x0,y0+ln);else b=vec2(x0+ln*0.7,y0+ln);
      vec2 pa=p-a,ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); float d=length(pa-ba*h);
      g+=smoothstep(0.025,0.008,d);}}
  return clamp(g,0.0,1.0);
}
vec3 kcol(float i){vec3 c[4];c[0]=vec3(0.0,1.0,0.88);c[1]=vec3(1.0,0.18,0.45);c[2]=vec3(0.72,0.0,1.0);c[3]=vec3(0.22,1.0,0.08);return c[int(i)];}
void main(){
  vec2 uv=v_uv; float COLS=floor(u_res.x/26.0); float ROWS=floor(u_res.y/42.0);
  vec2 cell=vec2(COLS,ROWS); vec2 cu=uv*cell; vec2 ci=floor(cu); vec2 cp=fract(cu);
  float col=ci.x,row=ci.y;
  float seed=h11(col*73.1+7.3); float spd=0.4+seed*1.2; float ph=h11(col*31.7+1.1)*8.0;
  float pal=floor(h11(col*17.3+3.7)*4.0); float clen=4.0+floor(h11(col*53.1)*18.0);
  float op=0.2+h11(col*11.3+5.5)*0.75;
  float head=mod(u_t*spd+ph,ROWS+clen)-clen; float dist=row-head;
  if(dist<0.0||dist>clen){o=vec4(0.0);return;}
  float tail=dist/clen;
  float ct=floor(u_t*(2.0+seed*4.0)); float cid=floor(h31(vec3(col,row,dist<2.0?ct:floor(dist)))*60.0);
  float pad=0.1; vec2 gu=(cp-pad)/(1.0-2.0*pad); float g=0.0;
  if(gu.x>=0.0&&gu.x<=1.0&&gu.y>=0.0&&gu.y<=1.0)g=glyph(gu,cid);
  float br; if(dist<1.0)br=2.5;else if(dist<2.0)br=1.8;else br=(1.0-tail)*(1.0-tail)*0.9; br*=op;
  vec3 fc; if(dist<1.0){fc=vec3(1.0)*g*br+kcol(pal)*0.8*(1.0-g)*0.15*br;}else{fc=kcol(pal)*g*br;}
  vec2 mc=u_mouse*cell; float md=length(ci-mc); if(md<3.0){float mf=1.0-md/3.0;fc*=1.0+mf*2.5;if(dist<1.0)fc+=kcol(pal)*mf*1.5*g;}
  float a=clamp(length(fc)*0.7,0.0,0.95); o=vec4(fc,a);
}
