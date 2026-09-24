#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform sampler2D u_scene; uniform float u_t; uniform vec2 u_res;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float h11(float v){return fract(sin(v*127.1)*43758.5453);}
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
  o=vec4(clamp(col,0.0,1.0),1.0);
}
