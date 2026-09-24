#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform float u_t; uniform vec2 u_res; uniform vec2 u_mouse;
#define PI 3.14159265359
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float box(vec3 p, vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
// letter E from boxes
float sdE(vec3 p){
  float d=box(p,vec3(0.10,0.55,0.10));
  d=smin(d,box(p-vec3(0.26,0.44,0.0),vec3(0.26,0.10,0.10)),0.05);
  d=smin(d,box(p-vec3(0.20,0.0,0.0),vec3(0.20,0.09,0.10)),0.05);
  d=smin(d,box(p-vec3(0.26,-0.44,0.0),vec3(0.26,0.10,0.10)),0.05);
  return d;
}
vec2 map(vec3 p){
  vec2 res=vec2(1e9,0.0);
  // ground
  float g=p.y+1.0;
  res=vec2(g,8.0);
  // city towers grid
  vec3 q=p; 
  vec2 id=floor(q.xz/2.0);
  q.xz=mod(q.xz,2.0)-1.0;
  float hgt=0.3+h21(id)*1.8;
  float pulse=0.5+0.5*sin(u_t*2.0+h21(id)*20.0);
  float tw=box(q-vec3(0.0,-1.0+hgt,0.0),vec3(0.28,hgt,0.28));
  if(tw<res.x)res=vec2(tw,1.0+step(0.5,pulse));
  // central E monolith
  vec3 pe=p; pe.xz*=rot(u_t*0.25+ (u_mouse.x-0.5)*2.0); pe-=vec3(0.0,0.6,0.0);
  float de=sdE(pe*1.3)/1.3;
  if(de<res.x)res=vec2(de,5.0);
  return res;
}
vec3 calcN(vec3 p){vec2 e=vec2(0.001,0.0);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}
void main(){
  vec2 uv=(v_uv*u_res-0.5*u_res)/u_res.y;
  float ca=(u_mouse.x-0.5)*1.2;
  vec3 ro=vec3(sin(ca)*6.0,3.0+ (u_mouse.y-0.5)*3.0,-6.0*cos(ca));
  vec3 ta=vec3(0.0,0.3,0.0);
  vec3 f=normalize(ta-ro),r=normalize(cross(vec3(0,1,0),f)),u=cross(f,r);
  vec3 rd=normalize(uv.x*r+uv.y*u+1.6*f);
  float t=0.1; float m=-1.0;
  for(int i=0;i<90;i++){vec3 p=ro+rd*t;vec2 h=map(p);if(h.x<0.001*t){m=h.y;break;}t+=h.x;if(t>40.0)break;}
  vec3 col=vec3(0.0);
  if(m>0.0){
    vec3 p=ro+rd*t; vec3 n=calcN(p);
    vec3 lig=normalize(vec3(0.8,1.0,-0.6));
    float dif=max(dot(n,lig),0.0);
    vec3 base=vec3(0.02);
    if(m<1.5)base=vec3(0.0,0.6,0.7);
    else if(m<2.5)base=vec3(1.0,0.1,0.5);
    else if(m<5.5)base=vec3(0.9,0.95,1.0);
    else base=vec3(0.03,0.05,0.08);
    col=base*(0.1+dif);
    if(m>0.5&&m<5.5)col+=base*1.5;
    float fog=1.0-exp(-t*0.05); col=mix(col,vec3(0.01,0.0,0.03),fog);
  } else {
    col=mix(vec3(0.0,0.01,0.04),vec3(0.03,0.0,0.06),v_uv.y);
  }
  col=pow(col,vec3(0.4545));
  o=vec4(col,1.0);
}
