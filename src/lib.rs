//! eth3rn5l — portfolio cyberpunk, tutto in Rust/WASM.
//!
//! Pipeline (tre pass WebGL2, ogni frame):
//!   Pass 1  scene   → framebuffer A   (raymarcher: città neon + monolite "E")
//!   Pass 2  post    → framebuffer B   (aberrazione, bloom, glitch, grana, CRT)
//!   Pass 3  screen  = blit B + katakana rain additivo (GLSL puro, zero Canvas2D)
//!
//! L'intera UI (nav, hero, sezioni) è costruita nel DOM da Rust via web-sys.
//! L'HTML di partenza è un guscio vuoto con un solo <canvas>.

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{
    WebGl2RenderingContext as GL,
    WebGlProgram, WebGlBuffer, WebGlTexture, WebGlFramebuffer,
    HtmlCanvasElement, MouseEvent, Window, Document, Element,
};
use std::rc::Rc;
use std::cell::RefCell;

// ── shaders (validati con glslangValidator prima dell'embed) ─────────────────
const VS_QUAD: &str = r#"#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }
"#;
const FS_SCENE: &str = include_str!("shaders/scene.frag");
const FS_POST:  &str = include_str!("shaders/post.frag");
const FS_KANA:  &str = include_str!("shaders/kana.frag");

// ═══════════════════════════════════════════════════════════════════════════
//  WebGL helpers
// ═══════════════════════════════════════════════════════════════════════════
fn compile(gl: &GL, kind: u32, src: &str) -> Result<web_sys::WebGlShader, String> {
    let sh = gl.create_shader(kind).ok_or("create_shader")?;
    gl.shader_source(&sh, src);
    gl.compile_shader(&sh);
    if gl.get_shader_parameter(&sh, GL::COMPILE_STATUS).as_bool().unwrap_or(false) {
        Ok(sh)
    } else {
        Err(gl.get_shader_info_log(&sh).unwrap_or_default())
    }
}

fn program(gl: &GL, vs: &str, fs: &str) -> Result<WebGlProgram, String> {
    let p = gl.create_program().ok_or("create_program")?;
    gl.attach_shader(&p, &compile(gl, GL::VERTEX_SHADER, vs)?);
    gl.attach_shader(&p, &compile(gl, GL::FRAGMENT_SHADER, fs)?);
    gl.link_program(&p);
    if gl.get_program_parameter(&p, GL::LINK_STATUS).as_bool().unwrap_or(false) {
        Ok(p)
    } else {
        Err(gl.get_program_info_log(&p).unwrap_or_default())
    }
}

fn fullscreen_quad(gl: &GL) -> WebGlBuffer {
    let buf = gl.create_buffer().unwrap();
    gl.bind_buffer(GL::ARRAY_BUFFER, Some(&buf));
    let v: [f32; 8] = [-1., -1., 1., -1., -1., 1., 1., 1.];
    unsafe {
        gl.buffer_data_with_array_buffer_view(
            GL::ARRAY_BUFFER, &js_sys::Float32Array::view(&v), GL::STATIC_DRAW);
    }
    buf
}

fn bind_quad(gl: &GL, prog: &WebGlProgram, buf: &WebGlBuffer) {
    gl.bind_buffer(GL::ARRAY_BUFFER, Some(buf));
    let loc = gl.get_attrib_location(prog, "a_pos") as u32;
    gl.enable_vertex_attrib_array(loc);
    gl.vertex_attrib_pointer_with_i32(loc, 2, GL::FLOAT, false, 0, 0);
}

struct Target { tex: WebGlTexture, fbo: WebGlFramebuffer }

fn make_target(gl: &GL, w: i32, h: i32) -> Target {
    let tex = gl.create_texture().unwrap();
    gl.bind_texture(GL::TEXTURE_2D, Some(&tex));
    gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
        GL::TEXTURE_2D, 0, GL::RGBA8 as i32, w, h, 0,
        GL::RGBA, GL::UNSIGNED_BYTE, None).unwrap();
    gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_MIN_FILTER, GL::LINEAR as i32);
    gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_MAG_FILTER, GL::LINEAR as i32);
    gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_WRAP_S, GL::CLAMP_TO_EDGE as i32);
    gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_WRAP_T, GL::CLAMP_TO_EDGE as i32);
    let fbo = gl.create_framebuffer().unwrap();
    gl.bind_framebuffer(GL::FRAMEBUFFER, Some(&fbo));
    gl.framebuffer_texture_2d(
        GL::FRAMEBUFFER, GL::COLOR_ATTACHMENT0, GL::TEXTURE_2D, Some(&tex), 0);
    gl.bind_framebuffer(GL::FRAMEBUFFER, None);
    Target { tex, fbo }
}

fn uniforms(gl: &GL, p: &WebGlProgram, t: f32, w: i32, h: i32, mx: f32, my: f32) {
    if let Some(l) = gl.get_uniform_location(p, "u_t")    { gl.uniform1f(Some(&l), t); }
    if let Some(l) = gl.get_uniform_location(p, "u_res")  { gl.uniform2f(Some(&l), w as f32, h as f32); }
    if let Some(l) = gl.get_uniform_location(p, "u_mouse"){ gl.uniform2f(Some(&l), mx, my); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOM helpers — costruzione UI senza stringhe HTML grezze
// ═══════════════════════════════════════════════════════════════════════════
fn el(doc: &Document, tag: &str) -> Element {
    doc.create_element(tag).unwrap()
}
fn styled(doc: &Document, tag: &str, style: &str) -> Element {
    let e = el(doc, tag);
    e.set_attribute("style", style).unwrap();
    e
}

fn inject_ui(doc: &Document) {
    // CSS globale (fonts + animazioni + hover)
    let css = el(doc, "style");
    css.set_text_content(Some(concat!(
        "@import url(\"https://fonts.googleapis.com/css2?",
        "family=Share+Tech+Mono&family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&display=swap\");",
        "*{margin:0;padding:0;box-sizing:border-box;}",
        "html{scroll-behavior:smooth;}",
        "body{background:#05070d;overflow-x:hidden;font-family:'Share Tech Mono',monospace;}",
        "#glc{position:fixed;inset:0;width:100%;height:100%;z-index:0;display:block;}",
        "#eth-root{position:relative;z-index:10;}",
        "a{text-decoration:none;}",
        "@keyframes ethPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}",
        "@keyframes ethBlink{50%{opacity:0}}",
        "@keyframes ethReveal{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}",
        ".eth-nav a{color:#6a8494;font-size:.66rem;letter-spacing:.22em;padding:.4rem .85rem;",
          "border:1px solid transparent;transition:color .2s,border-color .2s,background .2s;}",
        ".eth-nav a:hover{color:#00ffe7;border-color:rgba(0,255,231,.3);background:rgba(0,255,231,.05);}",
        ".eth-card{transition:transform .25s cubic-bezier(.16,1,.3,1),border-color .25s,background .25s;}",
        ".eth-card:hover{transform:translateY(-4px);border-color:rgba(0,255,231,.35)!important;background:rgba(12,16,26,.96)!important;}",
        ".eth-pill{transition:border-color .2s,background .2s,color .2s,transform .15s;}",
        ".eth-pill:hover{border-color:#b700ff;background:rgba(183,0,255,.16);color:#fff;transform:translateY(-1px);}",
        ".eth-ct{transition:border-color .22s,background .22s,transform .22s;}",
        ".eth-ct:hover{border-color:rgba(0,255,231,.4)!important;background:rgba(12,16,26,.95)!important;transform:translateX(5px);}",
        ".eth-rev{opacity:0;}",
        ".eth-rev.on{animation:ethReveal .7s cubic-bezier(.16,1,.3,1) forwards;}",
        "@media(max-width:760px){.eth-nav-links{display:none!important;}.eth-about{grid-template-columns:1fr!important;}.eth-contact{grid-template-columns:1fr!important;}}"
    )));
    doc.head().unwrap().append_child(&css).unwrap();

    let body = doc.body().unwrap();
    let root = el(doc, "div");
    root.set_id("eth-root");

    // ── NAV ──────────────────────────────────────────────────────────────
    let nav = styled(doc, "nav",
        "position:fixed;top:0;left:0;right:0;z-index:100;height:3.9rem;\
         display:flex;align-items:center;justify-content:space-between;\
         padding:0 2rem;background:rgba(5,7,13,.96);\
         border-bottom:1px solid rgba(0,255,231,.1);\
         box-shadow:0 2px 34px rgba(0,0,0,.6);backdrop-filter:blur(16px);");
    nav.set_class_name("eth-nav");
    let brand = styled(doc, "div", "font-size:.8rem;letter-spacing:.14em;");
    brand.set_inner_html(
        "<span style=\"color:#4a6070\">//</span> \
         <span style=\"color:#39ff14\">eth3rn5l</span>\
         <span style=\"color:#4a6070\">.dev</span>");
    nav.append_child(&brand).unwrap();
    let links = styled(doc, "div", "display:flex;gap:.2rem;");
    links.set_class_name("eth-nav-links");
    for (h, t) in [("#about","ABOUT"),("#projects","PROJECTS"),("#skills","SKILLS"),("#contact","CONTACT")] {
        let a = el(doc, "a");
        a.set_attribute("href", h).unwrap();
        a.set_text_content(Some(t));
        links.append_child(&a).unwrap();
    }
    nav.append_child(&links).unwrap();
    let status = styled(doc, "div",
        "display:flex;align-items:center;gap:.5rem;font-size:.6rem;color:#4a6070;");
    let dot = styled(doc, "div",
        "width:6px;height:6px;border-radius:50%;background:#39ff14;\
         box-shadow:0 0 7px #39ff14;animation:ethPulse 2s infinite;");
    status.append_child(&dot).unwrap();
    let stxt = el(doc, "span");
    stxt.set_text_content(Some("available"));
    status.append_child(&stxt).unwrap();
    nav.append_child(&status).unwrap();
    root.append_child(&nav).unwrap();

    // ── HERO ─────────────────────────────────────────────────────────────
    let hero = styled(doc, "section",
        "min-height:100vh;display:flex;flex-direction:column;justify-content:flex-end;\
         padding:0 2rem 5rem;pointer-events:none;");
    let eyebrow = styled(doc, "p",
        "font-size:.7rem;letter-spacing:.18em;color:#4a6070;margin-bottom:.8rem;");
    eyebrow.set_inner_html(
        "<span style=\"color:#ff2f6e\">\u{2014}</span> \
         offensive security // red team // open source");
    hero.append_child(&eyebrow).unwrap();
    let name = styled(doc, "h1",
        "font-family:'Barlow Condensed',sans-serif;font-weight:900;\
         font-size:clamp(3.5rem,12vw,9rem);line-height:.86;color:#fff;\
         text-shadow:0 0 70px rgba(0,255,231,.28);");
    name.set_inner_html(
        "ETH3RN5L<br><span style=\"color:#ff2f6e;font-style:italic;\
         text-shadow:0 0 55px rgba(255,47,110,.55)\">ETHAN</span>");
    hero.append_child(&name).unwrap();
    let sub = styled(doc, "div",
        "margin-top:1.1rem;font-size:.82rem;letter-spacing:.12em;color:#00ffe7;\
         display:flex;gap:1.4rem;align-items:center;flex-wrap:wrap;");
    sub.set_inner_html(
        "<span>LACERENZA</span><span style=\"opacity:.3\">/</span>\
         <span>PENTESTER</span><span style=\"opacity:.3\">/</span>\
         <span>RED TEAMER<span style=\"animation:ethBlink .9s step-end infinite\">_</span></span>");
    hero.append_child(&sub).unwrap();
    root.append_child(&hero).unwrap();

    // sfondo scuro traslucido per le sezioni (leggibilità sul canvas)
    let sheet = styled(doc, "div",
        "background:linear-gradient(180deg,transparent,rgba(5,7,13,.9) 4%,rgba(5,7,13,.9) 96%,transparent);\
         backdrop-filter:blur(9px);");

    // helper per l'header di sezione
    let sec_header = |doc: &Document, num: &str, title: &str| -> Element {
        let h = styled(doc, "div",
            "display:flex;align-items:flex-end;gap:1.5rem;margin-bottom:3rem;");
        let meta = styled(doc, "div", "display:flex;flex-direction:column;gap:.4rem;");
        let n = styled(doc, "span",
            "font-size:.62rem;letter-spacing:.22em;color:#ff2f6e;");
        n.set_text_content(Some(num));
        let ti = styled(doc, "h2",
            "font-family:'Barlow Condensed',sans-serif;font-weight:900;\
             font-size:clamp(2rem,5vw,3.4rem);line-height:.92;color:#fff;");
        ti.set_text_content(Some(title));
        meta.append_child(&n).unwrap();
        meta.append_child(&ti).unwrap();
        h.append_child(&meta).unwrap();
        let line = styled(doc, "div",
            "flex:1;max-width:320px;height:1px;margin-bottom:.5rem;\
             background:linear-gradient(90deg,rgba(0,255,231,.35),transparent);");
        h.append_child(&line).unwrap();
        h
    };

    // ── ABOUT ────────────────────────────────────────────────────────────
    let about = styled(doc, "section",
        "max-width:1120px;margin:0 auto;padding:5rem 2rem;");
    about.set_id("about");
    about.append_child(&sec_header(doc, "// 01", "About")).unwrap();
    let ag = styled(doc, "div",
        "display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:start;");
    ag.set_class_name("eth-about");
    let left = el(doc, "div");
    let bio = styled(doc, "p",
        "font-size:1.12rem;line-height:1.8;color:#c8dce8;max-width:50ch;\
         text-shadow:0 1px 10px rgba(5,7,13,.9);");
    bio.set_inner_html(
        "I'm <b style=\"color:#00ffe7\">Ethan Lacerenza</b>, aka \
         <b style=\"color:#00ffe7\">eth3rn5l</b> — an offensive security \
         researcher and red teamer focused on structured, repeatable attack \
         methodologies.<br><br>I build tools and mindmaps that turn chaotic \
         pentesting knowledge into clean, actionable flows. My work sits at the \
         intersection of <b style=\"color:#00ffe7\">offensive security</b>, \
         <b style=\"color:#00ffe7\">open source</b>, and the belief that good \
         documentation is itself a weapon.");
    left.append_child(&bio).unwrap();
    let pills = styled(doc, "div",
        "display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1.8rem;");
    for p in ["OSCP mindset","Red Team","OSINT","Privilege Escalation",
              "Lateral Movement","Post-Exploitation","Mindmapping"] {
        let pill = styled(doc, "span",
            "font-size:.63rem;letter-spacing:.1em;padding:.35rem .85rem;\
             border:1px solid rgba(183,0,255,.35);color:rgba(183,0,255,.85);\
             background:rgba(12,16,26,.7);");
        pill.set_class_name("eth-pill");
        pill.set_text_content(Some(p));
        pills.append_child(&pill).unwrap();
    }
    left.append_child(&pills).unwrap();
    ag.append_child(&left).unwrap();
    let stats = styled(doc, "div", "display:flex;flex-direction:column;gap:1.4rem;");
    for (v, l) in [("Gh0stFl0w","flagship project · 7 stars"),
                   ("6+","pentest phases mapped"),
                   ("MIT","open source · free to use")] {
        let card = styled(doc, "div",
            "padding:1.5rem 1.5rem 1.5rem 1.8rem;border:1px solid rgba(255,255,255,.08);\
             border-left:3px solid #ff2f6e;background:rgba(10,13,22,.88);");
        card.set_class_name("eth-card");
        let vv = styled(doc, "div",
            "font-family:'Barlow Condensed',sans-serif;font-weight:900;\
             font-size:2.6rem;line-height:1;color:#fff;");
        vv.set_text_content(Some(v));
        let ll = styled(doc, "div",
            "font-size:.62rem;letter-spacing:.15em;color:#5a7080;margin-top:.35rem;");
        ll.set_text_content(Some(l));
        card.append_child(&vv).unwrap();
        card.append_child(&ll).unwrap();
        stats.append_child(&card).unwrap();
    }
    ag.append_child(&stats).unwrap();
    about.append_child(&ag).unwrap();

    // ── PROJECTS ─────────────────────────────────────────────────────────
    let projects = styled(doc, "section",
        "max-width:1120px;margin:0 auto;padding:5rem 2rem;");
    projects.set_id("projects");
    projects.append_child(&sec_header(doc, "// 02", "Projects")).unwrap();
    let pg = styled(doc, "div",
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.2rem;");
    let projects_data: [(&str,&str,&str,&[&str],&str); 5] = [
        ("Gh0stFl0w","\u{2605} 7",
         "Pentesting mindmaps covering the full offensive lifecycle — from recon to reporting. Built in Notion and Excalidraw for fast in-field reference.",
         &["Pentesting","Mindmap","Recon","PrivEsc"],
         "https://github.com/ethanlacerenza/Gh0stFl0w"),
        ("File Transfer Methodology","",
         "Structured exfiltration and file-transfer techniques across heterogeneous environments. A core module of Gh0stFl0w.",
         &["Exfiltration","OPSEC","Post-Exploit"], ""),
        ("Web Info Gathering","",
         "OSINT and web reconnaissance workflows covering passive and active information gathering for penetration testing engagements.",
         &["OSINT","Recon","Web"], ""),
        ("Security Assessment","",
         "Templates and checklists for structured security assessments, from scoping to final report delivery.",
         &["Assessment","Reporting","Methodology"], ""),
        ("Next drop","",
         "Something new is being built. Watch the repo.",
         &["soon"], "https://github.com/ethanlacerenza"),
    ];
    for (nm, badge, desc, tags, url) in projects_data {
        let card = styled(doc, "div",
            "background:rgba(10,13,22,.9);border:1px solid rgba(255,255,255,.08);\
             padding:1.5rem;display:flex;flex-direction:column;");
        card.set_class_name("eth-card");
        let top = styled(doc, "div",
            "display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;");
        let name = styled(doc, "div",
            "font-family:'Barlow Condensed',sans-serif;font-weight:900;\
             font-size:1.35rem;color:#fff;letter-spacing:.02em;");
        name.set_text_content(Some(nm));
        top.append_child(&name).unwrap();
        if !badge.is_empty() {
            let b = styled(doc, "div",
                "font-size:.6rem;padding:.2rem .55rem;border:1px solid rgba(57,255,20,.4);\
                 color:#39ff14;white-space:nowrap;");
            b.set_text_content(Some(badge));
            top.append_child(&b).unwrap();
        }
        card.append_child(&top).unwrap();
        let d = styled(doc, "p",
            "font-size:.92rem;line-height:1.65;color:#8aabb8;flex:1;");
        d.set_text_content(Some(desc));
        card.append_child(&d).unwrap();
        let tagrow = styled(doc, "div",
            "display:flex;flex-wrap:wrap;gap:.35rem;margin-top:1.2rem;");
        for t in tags {
            let tg = styled(doc, "span",
                "font-size:.58rem;letter-spacing:.08em;padding:.18rem .5rem;\
                 border:1px solid rgba(0,255,231,.2);color:rgba(0,255,231,.6);");
            tg.set_text_content(Some(t));
            tagrow.append_child(&tg).unwrap();
        }
        card.append_child(&tagrow).unwrap();
        if !url.is_empty() {
            let a = styled(doc, "a",
                "display:inline-block;margin-top:1.2rem;font-size:.66rem;\
                 letter-spacing:.12em;color:#ff2f6e;");
            a.set_attribute("href", url).unwrap();
            a.set_attribute("target", "_blank").unwrap();
            a.set_attribute("rel", "noopener").unwrap();
            a.set_text_content(Some("View on GitHub \u{2192}"));
            card.append_child(&a).unwrap();
        }
        pg.append_child(&card).unwrap();
    }
    projects.append_child(&pg).unwrap();

    // ── SKILLS ───────────────────────────────────────────────────────────
    let skills = styled(doc, "section",
        "max-width:1120px;margin:0 auto;padding:5rem 2rem;");
    skills.set_id("skills");
    skills.append_child(&sec_header(doc, "// 03", "Toolkit")).unwrap();
    let sg = styled(doc, "div",
        "display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.7rem;");
    let skills_data: [(&str,&str,&str,&str); 8] = [
        ("\u{25C8}","Penetration Testing","web · network · ad","#ff2f6e"),
        ("\u{2B21}","OSINT & Recon","passive · active","#00ffe7"),
        ("\u{25B2}","Privilege Escalation","linux · windows","#b700ff"),
        ("\u{2192}","Lateral Movement","pivoting · tunneling","#ff2f6e"),
        ("\u{25C9}","Post-Exploitation","persistence · exfil","#39ff14"),
        ("\u{25B8}","Payload Crafting","custom · obfuscated","#00ffe7"),
        ("\u{229E}","Notion / Excalidraw","knowledge base","#b700ff"),
        ("\u{2261}","Report Writing","technical · executive","#ff2f6e"),
    ];
    for (icon, nm, sub, col) in skills_data {
        let card = styled(doc, "div",
            &format!("display:flex;align-items:center;gap:1rem;padding:1rem 1.3rem;\
                      background:rgba(10,13,22,.9);border:1px solid rgba(255,255,255,.08);"));
        card.set_class_name("eth-card");
        let ic = styled(doc, "div",
            &format!("width:2.6rem;height:2.6rem;flex-shrink:0;display:flex;\
                      align-items:center;justify-content:center;font-size:1rem;\
                      border:1px solid {c};color:{c};", c=col));
        ic.set_text_content(Some(icon));
        card.append_child(&ic).unwrap();
        let bd = styled(doc, "div", "display:flex;flex-direction:column;gap:.2rem;");
        let n = styled(doc, "div",
            "font-family:'Barlow Condensed',sans-serif;font-weight:700;\
             font-size:1.05rem;color:#fff;");
        n.set_text_content(Some(nm));
        let s = styled(doc, "div", "font-size:.58rem;color:#5a7080;letter-spacing:.08em;");
        s.set_text_content(Some(sub));
        bd.append_child(&n).unwrap();
        bd.append_child(&s).unwrap();
        card.append_child(&bd).unwrap();
        sg.append_child(&card).unwrap();
    }
    skills.append_child(&sg).unwrap();

    // ── CONTACT ──────────────────────────────────────────────────────────
    let contact = styled(doc, "section",
        "max-width:1120px;margin:0 auto;padding:5rem 2rem;");
    contact.set_id("contact");
    contact.append_child(&sec_header(doc, "// 04", "Contact")).unwrap();
    let cg = styled(doc, "div",
        "display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;");
    cg.set_class_name("eth-contact");
    let copy = styled(doc, "p",
        "font-size:1.1rem;line-height:1.78;color:#8aabb8;max-width:38ch;\
         text-shadow:0 1px 10px rgba(5,7,13,.9);");
    copy.set_inner_html(
        "Open to <b style=\"color:#c8dce8\">red team engagements</b>, consulting, \
         and collaborations on offensive security research.<br><br>\
         Reach out via GitHub or LinkedIn.");
    cg.append_child(&copy).unwrap();
    let clinks = styled(doc, "div", "display:flex;flex-direction:column;gap:1rem;");
    for (icon, label, val, url) in [
        ("\u{2B21}","GITHUB","ethanlacerenza","https://github.com/ethanlacerenza"),
        ("\u{25C8}","LINKEDIN","Ethan Lacerenza","https://www.linkedin.com/in/ethan-lacerenza-2633421ab/"),
    ] {
        let a = styled(doc, "a",
            "display:flex;align-items:center;gap:1rem;padding:1rem 1.5rem;\
             background:rgba(10,13,22,.9);border:1px solid rgba(255,255,255,.08);");
        a.set_class_name("eth-ct");
        a.set_attribute("href", url).unwrap();
        a.set_attribute("target", "_blank").unwrap();
        a.set_attribute("rel", "noopener").unwrap();
        let ic = styled(doc, "div",
            "width:2.4rem;height:2.4rem;flex-shrink:0;display:flex;\
             align-items:center;justify-content:center;font-size:1.1rem;\
             border:1px solid rgba(0,255,231,.3);color:#00ffe7;");
        ic.set_text_content(Some(icon));
        a.append_child(&ic).unwrap();
        let bd = styled(doc, "div", "display:flex;flex-direction:column;gap:.15rem;");
        let lb = styled(doc, "span",
            "font-size:.6rem;letter-spacing:.15em;color:#5a7080;");
        lb.set_text_content(Some(label));
        let vl = styled(doc, "span",
            "font-family:'Barlow Condensed',sans-serif;font-weight:700;\
             font-size:1rem;color:#fff;");
        vl.set_text_content(Some(val));
        bd.append_child(&lb).unwrap();
        bd.append_child(&vl).unwrap();
        a.append_child(&bd).unwrap();
        let ar = styled(doc, "span", "margin-left:auto;color:#5a7080;");
        ar.set_text_content(Some("\u{2192}"));
        a.append_child(&ar).unwrap();
        clinks.append_child(&a).unwrap();
    }
    cg.append_child(&clinks).unwrap();
    contact.append_child(&cg).unwrap();

    // assembla dentro lo sheet traslucido
    sheet.append_child(&about).unwrap();
    sheet.append_child(&projects).unwrap();
    sheet.append_child(&skills).unwrap();
    sheet.append_child(&contact).unwrap();
    root.append_child(&sheet).unwrap();

    // ── FOOTER ───────────────────────────────────────────────────────────
    let footer = styled(doc, "footer",
        "background:#39ff14;padding:.8rem 2rem;display:flex;\
         align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;\
         font-size:.7rem;letter-spacing:.1em;color:#000;");
    let fl = styled(doc, "span", "font-weight:700;");
    fl.set_text_content(Some("\u{25B6} ETH3RN5L // OFFENSIVE SECURITY"));
    let fm = styled(doc, "span", "opacity:.55;");
    fm.set_text_content(Some("ethanlacerenza.github.io"));
    footer.append_child(&fl).unwrap();
    footer.append_child(&fm).unwrap();
    root.append_child(&footer).unwrap();

    body.append_child(&root).unwrap();
}

// scroll-reveal via IntersectionObserver — leggero, in JS minimale iniettato
fn setup_reveal(doc: &Document) {
    // aggiunge classe eth-rev a card & headers, poi un piccolo observer
    let script = el(doc, "script");
    script.set_text_content(Some(concat!(
        "const io=new IntersectionObserver(es=>{es.forEach(e=>{",
        "if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},",
        "{threshold:.12});",
        "document.querySelectorAll('.eth-card').forEach((c,i)=>{",
        "c.classList.add('eth-rev');c.style.animationDelay=(i%6*0.06)+'s';io.observe(c);});"
    )));
    doc.body().unwrap().append_child(&script).unwrap();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Stato + render loop
// ═══════════════════════════════════════════════════════════════════════════
struct State {
    w: i32, h: i32, mx: f32, my: f32,
    a: Target, b: Target,
}

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    console_error();

    let window: Window = web_sys::window().unwrap();
    let document: Document = window.document().unwrap();

    let canvas: HtmlCanvasElement =
        document.get_element_by_id("glc").unwrap().dyn_into()?;
    let gl: GL = canvas.get_context("webgl2")?.unwrap().dyn_into()?;

    // compila i tre programmi; se uno fallisce lo logghiamo chiaramente
    let p_scene = program(&gl, VS_QUAD, FS_SCENE).map_err(err)?;
    let p_post  = program(&gl, VS_QUAD, FS_POST ).map_err(err)?;
    let p_kana  = program(&gl, VS_QUAD, FS_KANA ).map_err(err)?;
    let quad = fullscreen_quad(&gl);

    let dpr = window.device_pixel_ratio().min(2.0); // cap DPR per performance
    let w0 = (window.inner_width()?.as_f64().unwrap()  * dpr) as i32;
    let h0 = (window.inner_height()?.as_f64().unwrap() * dpr) as i32;
    canvas.set_width(w0 as u32);
    canvas.set_height(h0 as u32);

    inject_ui(&document);
    setup_reveal(&document);

    let state = Rc::new(RefCell::new(State {
        w: w0, h: h0, mx: 0.5, my: 0.5,
        a: make_target(&gl, w0, h0),
        b: make_target(&gl, w0, h0),
    }));

    // mouse
    {
        let s = state.clone();
        let cb = Closure::<dyn Fn(MouseEvent)>::new(move |e: MouseEvent| {
            let win = web_sys::window().unwrap();
            let iw = win.inner_width().unwrap().as_f64().unwrap();
            let ih = win.inner_height().unwrap().as_f64().unwrap();
            let mut st = s.borrow_mut();
            st.mx = e.client_x() as f32 / iw as f32;
            st.my = 1.0 - e.client_y() as f32 / ih as f32;
        });
        window.add_event_listener_with_callback("mousemove", cb.as_ref().unchecked_ref())?;
        cb.forget();
    }

    // render loop
    let gl = Rc::new(gl);
    let p_scene = Rc::new(p_scene);
    let p_post  = Rc::new(p_post);
    let p_kana  = Rc::new(p_kana);
    let quad = Rc::new(quad);

    let f: Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>> = Rc::new(RefCell::new(None));
    let g = f.clone();
    let (gl2, ps, pp, pk, q, st, win2) =
        (gl.clone(), p_scene.clone(), p_post.clone(), p_kana.clone(),
         quad.clone(), state.clone(), window.clone());

    *g.borrow_mut() = Some(Closure::new(move |now: f64| {
        let t = (now * 0.001) as f32;
        let dpr = win2.device_pixel_ratio().min(2.0);
        let nw = (win2.inner_width().unwrap().as_f64().unwrap()  * dpr) as i32;
        let nh = (win2.inner_height().unwrap().as_f64().unwrap() * dpr) as i32;

        {
            let mut s = st.borrow_mut();
            if nw != s.w || nh != s.h {
                s.w = nw; s.h = nh;
                let cv: HtmlCanvasElement = win2.document().unwrap()
                    .get_element_by_id("glc").unwrap().dyn_into().unwrap();
                cv.set_width(nw as u32); cv.set_height(nh as u32);
                s.a = make_target(&gl2, nw, nh);
                s.b = make_target(&gl2, nw, nh);
            }
        }

        let (w,h,mx,my,a_tex,a_fbo,b_tex,b_fbo) = {
            let s = st.borrow();
            (s.w,s.h,s.mx,s.my,
             s.a.tex.clone(), s.a.fbo.clone(),
             s.b.tex.clone(), s.b.fbo.clone())
        };

        // PASS 1 scene → A
        gl2.disable(GL::BLEND);
        gl2.bind_framebuffer(GL::FRAMEBUFFER, Some(&a_fbo));
        gl2.viewport(0,0,w,h);
        gl2.use_program(Some(&ps)); bind_quad(&gl2,&ps,&q);
        uniforms(&gl2,&ps,t,w,h,mx,my);
        gl2.draw_arrays(GL::TRIANGLE_STRIP,0,4);

        // PASS 2 post(A) → B
        gl2.bind_framebuffer(GL::FRAMEBUFFER, Some(&b_fbo));
        gl2.viewport(0,0,w,h);
        gl2.use_program(Some(&pp)); bind_quad(&gl2,&pp,&q);
        gl2.active_texture(GL::TEXTURE0);
        gl2.bind_texture(GL::TEXTURE_2D, Some(&a_tex));
        if let Some(l)=gl2.get_uniform_location(&pp,"u_scene"){ gl2.uniform1i(Some(&l),0); }
        uniforms(&gl2,&pp,t,w,h,mx,my);
        gl2.draw_arrays(GL::TRIANGLE_STRIP,0,4);

        // PASS 3 screen: blit B, poi kana additivo
        gl2.bind_framebuffer(GL::FRAMEBUFFER, None);
        gl2.viewport(0,0,w,h);
        gl2.disable(GL::BLEND);
        gl2.use_program(Some(&pp)); bind_quad(&gl2,&pp,&q);
        gl2.active_texture(GL::TEXTURE0);
        gl2.bind_texture(GL::TEXTURE_2D, Some(&b_tex));
        if let Some(l)=gl2.get_uniform_location(&pp,"u_scene"){ gl2.uniform1i(Some(&l),0); }
        uniforms(&gl2,&pp,t,w,h,mx,my);
        gl2.draw_arrays(GL::TRIANGLE_STRIP,0,4);

        gl2.enable(GL::BLEND);
        gl2.blend_func(GL::SRC_ALPHA, GL::ONE);
        gl2.use_program(Some(&pk)); bind_quad(&gl2,&pk,&q);
        uniforms(&gl2,&pk,t,w,h,mx,my);
        gl2.draw_arrays(GL::TRIANGLE_STRIP,0,4);

        win2.request_animation_frame(
            f.borrow().as_ref().unwrap().as_ref().unchecked_ref()).unwrap();
    }));

    window.request_animation_frame(
        g.borrow().as_ref().unwrap().as_ref().unchecked_ref())?;
    Ok(())
}

fn err(s: String) -> JsValue { JsValue::from_str(&s) }
fn console_error() {
    // niente panic hook esterno: log minimale
}
