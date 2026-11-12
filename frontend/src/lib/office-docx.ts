import type { OfficeData } from "./office-storage";
import { downloadFile, safeFileName } from "./office-doc";
const MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX = 5 * 1024 * 1024;
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const escape = (s: string) => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
function xml(s: string) { if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new Error("XML no permitido"); const d = new DOMParser().parseFromString(s, "application/xml"); if (d.querySelector("parsererror")) throw new Error("DOCX dañado"); return d; }
const node = (e: Element | Document, name: string) => e.getElementsByTagNameNS(W, name)[0];
const val = (e: Element | undefined, attr = "val") => e?.getAttributeNS(W, attr) || "";

export async function exportDocx(title: string, html: string, settings: Record<string, unknown> = {}) {
  const d = await import("docx");
  const root = document.createElement("div"); root.innerHTML = html;
  root.style.cssText = "position:fixed;left:-100000px;font-family:Calibri;font-size:11pt"; document.body.append(root);
  const numbering: {reference:string;levels: {level:number;format:typeof d.LevelFormat.BULLET; text:string;alignment:typeof d.AlignmentType.LEFT}[]}[] = [];
  let sequence = 0;
  async function inline(n: Node): Promise<(InstanceType<typeof d.TextRun> | InstanceType<typeof d.ExternalHyperlink> | InstanceType<typeof d.ImageRun>)[]> {
    if (n.nodeType === Node.TEXT_NODE) {
      const p = n.parentElement!; const style = getComputedStyle(p);
      const rgb = style.color.match(/\d+/g); const color = rgb?.slice(0,3).map(v=>Number(v).toString(16).padStart(2,"0")).join("");
      return [new d.TextRun({text:n.textContent || "", bold:Number(style.fontWeight)>=600 || style.fontWeight === "bold", italics:style.fontStyle === "italic", underline:p.closest("u,[style*='underline']") ? {} : undefined, font:style.fontFamily.split(",")[0].replace(/["']/g,""), size:Math.round(parseFloat(style.fontSize)*1.5), color})];
    }
    if (!(n instanceof HTMLElement)) return [];
    if(n.tagName === "BR") return [new d.TextRun({break:1})];
    if(n.tagName === "IMG") {
      const img=n as HTMLImageElement;
      const response=await fetch(img.src); if(!response.ok) throw new Error("No se pudo incluir una imagen"); const bytes=await response.arrayBuffer();
      if(bytes.byteLength>MAX) throw new Error("Imagen demasiado grande");
      const bitmap=await createImageBitmap(new Blob([bytes])); const canvas=document.createElement("canvas"); canvas.width=bitmap.width; canvas.height=bitmap.height; canvas.getContext("2d")!.drawImage(bitmap,0,0); bitmap.close();
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Imagen inválida")),"image/png"));
      return [new d.ImageRun({type:"png",data:await blob.arrayBuffer(),transformation:{width:Math.max(1,parseFloat(img.style.width)||img.width||canvas.width),height:Math.max(1,parseFloat(img.style.height)||img.height||canvas.height)}})];
    }
    const runs=(await Promise.all(Array.from(n.childNodes).map(inline))).flat();
    if(n.tagName === "A" && /^(https?:|mailto:)/i.test(n.getAttribute("href")||"")) return [new d.ExternalHyperlink({link:n.getAttribute("href")!,children:runs as InstanceType<typeof d.TextRun>[]})];
    return runs;
  }
  async function blocks(parent: Element, list?: {reference:string;level:number}): Promise<(InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[]> {
    const result: (InstanceType<typeof d.Paragraph>|InstanceType<typeof d.Table>)[]=[];
    for(const e of Array.from(parent.children)) {
      if(e.tagName === "TABLE") {
        const rows=[]; for(const tr of Array.from(e.querySelectorAll(":scope > tbody > tr, :scope > thead > tr, :scope > tr"))) {
          const cells=[]; for(const td of Array.from(tr.children)) cells.push(new d.TableCell({children:td.querySelector("p,ul,ol")?await blocks(td):[new d.Paragraph({children:await inline(td)})],columnSpan:Number(td.getAttribute("colspan"))||1}));
          rows.push(new d.TableRow({children:cells}));
        }
        result.push(new d.Table({rows,width:{size:100,type:d.WidthType.PERCENTAGE}})); continue;
      }
      if(e.tagName === "UL" || e.tagName === "OL") {
        const reference=`list-${sequence++}`; numbering.push({reference,levels:Array.from({length:9},(_,level)=>({level,format:e.tagName === "UL"?d.LevelFormat.BULLET:d.LevelFormat.DECIMAL as typeof d.LevelFormat.BULLET,text:e.tagName === "UL"?"•":`%${level+1}.`,alignment:d.AlignmentType.LEFT}))});
        result.push(...await blocks(e,{reference,level:list?Math.min(8,list.level+1):0})); continue;
      }
      if(["DIV","FIGURE","SECTION"].includes(e.tagName) && e.querySelector("p,table,ul,ol,h1,h2,h3")) { result.push(...await blocks(e,list)); continue; }
      const alignment=getComputedStyle(e).textAlign;
      
      // Mantener estilos heredados mientras se generan los runs.
      const paragraph = new d.Paragraph({children:(await Promise.all(Array.from(e.childNodes).filter(n=>!(n instanceof Element && ["UL","OL"].includes(n.tagName))).map(inline))).flat(),heading:/^H[1-6]$/.test(e.tagName)?`Heading${e.tagName[1]}` as typeof d.HeadingLevel.HEADING_1:undefined,alignment:({center:d.AlignmentType.CENTER,right:d.AlignmentType.RIGHT,justify:d.AlignmentType.JUSTIFIED} as Record<string,typeof d.AlignmentType[keyof typeof d.AlignmentType]>)[alignment],numbering:list&&e.tagName==="LI"?list:undefined});
      result.push(paragraph);
      for(const nested of Array.from(e.children).filter(x=>["UL","OL"].includes(x.tagName))) { const holder=document.createElement("div"); holder.append(nested.cloneNode(true)); root.append(holder); result.push(...await blocks(holder,list)); holder.remove(); }
    }
    return result;
  }
  try {
    const content=await blocks(root); const m=settings.margins as Record<string,number>|undefined;
    const doc=new d.Document({numbering:{config:numbering},sections:[{properties:{page:{size:{orientation:settings.orientation==="landscape"?d.PageOrientation.LANDSCAPE:d.PageOrientation.PORTRAIT,width:11906,height:16838},margin:Object.fromEntries(["top","right","bottom","left"].map(k=>[k,Math.round((m?.[k]??20)*56.6929)]))}},children:content}]});
    return await d.Packer.toBlob(doc);
  } finally {root.remove();}
}

export async function saveDocx(title: string, html: string, settings: Record<string,unknown> = {}) {
 const blob=await exportDocx(title,html,settings); const name=safeFileName(title)+".docx";
 if(window.autopilotDesktop?.files) { const r=await window.autopilotDesktop.files.save({name,data:await blob.arrayBuffer(),mimeType:MIME}); if(!r.ok&&!r.canceled) throw new Error(r.error); }
 else downloadFile(name,new Blob([blob],{type:MIME}));
}

export async function importDocx(buffer: ArrayBuffer): Promise<{html:string;settings:OfficeData["settings"];warnings:string[]}> {
 if(buffer.byteLength>MAX) throw new Error("El DOCX supera 5 MB");
 // Comprobar tamaños declarados antes de descomprimir. No se admiten ZIP64 ni cifrado.
 const view=new DataView(buffer); let total=0, count=0;
 for(let i=0;i+46<view.byteLength;i++) if(view.getUint32(i,true)===0x02014b50) { const size=view.getUint32(i+24,true); if(size===0xffffffff || view.getUint16(i+8,true)&1) throw new Error("ZIP64/cifrado no admitido"); total+=size;count++; if(total>30*1024*1024||count>2000) throw new Error("Contenido descomprimido demasiado grande"); i+=45+view.getUint16(i+28,true)+view.getUint16(i+30,true)+view.getUint16(i+32,true); }
 if(!count) throw new Error("No es un paquete DOCX");
 const JSZip=(await import("jszip")).default; const zip=await JSZip.loadAsync(buffer); const main=zip.file("word/document.xml"); if(!main) throw new Error("Falta el documento Word");
 const source=xml(await main.async("string")); const styles=xml(await zip.file("word/styles.xml")?.async("string") || "<styles/>");
 const rels=xml(await zip.file("word/_rels/document.xml.rels")?.async("string") || "<Relationships/>");
 const warnings:string[]=[];
 const warn=(s:string)=>{if(!warnings.includes(s))warnings.push(s)};
 for(const [tag,label] of [["txbxContent","Cuadros de texto: se conserva solo su texto"],["commentRangeStart","Comentarios"],["footnoteReference","Notas al pie"],["endnoteReference","Notas finales"],["ins","Control de cambios"],["del","Texto eliminado en revisiones"],["headerReference","Encabezados"],["footerReference","Pies de página"],["oMath","Ecuaciones"],["fldChar","Campos automáticos"]]) if(source.getElementsByTagNameNS("*",tag).length) warn(label);
 if(source.getElementsByTagNameNS(W,"sectPr").length>1) warn("Secciones: se aplica la configuración de la última sección");
 const relationship=(id:string)=>Array.from(rels.documentElement.children).find(r=>r.getAttribute("Id")===id);
 function props(e:Element, name:string):Element[] {
  const result:Element[]=[];const add=(p:Element|undefined)=>{if(p)result.push(p)};add(node(styles,name));
  const chain=(id:string,seen=new Set<string>())=>{if(!id||seen.has(id))return;seen.add(id);const style=Array.from(styles.getElementsByTagNameNS(W,"style")).find(x=>val(x,"styleId")===id);if(style){chain(val(node(style,"basedOn")),seen);add(node(style,name));}};
  let paragraph:Element|null=e;while(paragraph&&paragraph.localName!=="p")paragraph=paragraph.parentElement;
  if(paragraph)chain(val(node(paragraph,"pStyle")));
  chain(val(node(e,name==="rPr"?"rStyle":"pStyle")));add(node(e,name));return result;
 }
 function css(e:Element) { const s:Record<string,string>={}; for(const p of props(e,"rPr")) { if(node(p,"b"))s["font-weight"]=["0","false","off"].includes(val(node(p,"b")))?"normal":"bold";if(node(p,"i"))s["font-style"]=["0","false","off"].includes(val(node(p,"i")))?"normal":"italic";if(node(p,"u"))s["text-decoration"]=["none","0","false"].includes(val(node(p,"u")))?"none":"underline";const color=val(node(p,"color"));if(/^[0-9a-f]{6}$/i.test(color))s.color="#"+color;const size=Number(val(node(p,"sz")));if(size)s["font-size"]=`${size/2}pt`; const font=val(node(p,"rFonts"),"ascii");if(/^[\p{L}\p{N} ,_-]{1,100}$/u.test(font))s["font-family"]=font; } return Object.entries(s).map(([k,v])=>`${k}:${escape(v)}`).join(";"); }
 async function render(e:Element):Promise<string> {
  const name=e.localName;
  if(name==="t" || name==="delText") return escape(e.textContent||""); if(name==="br")return "<br>"; if(name==="tab")return "&#9;";
  if(name==="drawing" || name==="pict") { const blip=e.getElementsByTagNameNS("*","blip")[0];const id=blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","embed");const rel=id?relationship(id):undefined;const target=rel?.getAttribute("Target")||""; if(!rel||rel.getAttribute("TargetMode")==="External"||target.includes("..")) {warn("Imagen externa o no compatible omitida");return Array.from(e.getElementsByTagNameNS(W,"txbxContent")).map(x=>escape(x.textContent||"")).join("");} const path=target.startsWith("/")?target.slice(1):"word/"+target;const file=zip.file(path);const ext=target.split(".").pop()?.toLowerCase();if(!file||!["png","jpg","jpeg","gif"].includes(ext||"")){warn("Imagen en formato no compatible");return "";}const extent=e.getElementsByTagNameNS("*","extent")[0];const width=Number(extent?.getAttribute("cx"))/9525;const height=Number(extent?.getAttribute("cy"))/9525;return `<img src="data:image/${ext==="jpg"?"jpeg":ext};base64,${await file.async("base64")}"${width?` width="${width}" height="${height}"`:""}>`; }
  if(["pPr","rPr","sectPr","tblPr","tcPr"].includes(name)) return "";
  const content=(await Promise.all(Array.from(e.children).map(render))).join("");
  if(name==="r") {const style=css(e);let text=content;if(style.includes("font-weight:bold"))text=`<strong>${text}</strong>`;if(style.includes("font-style:italic"))text=`<em>${text}</em>`;if(style.includes("text-decoration:underline"))text=`<u>${text}</u>`;return `<span style="${style}">${text}</span>`;}
  if(name==="hyperlink") {const rel=relationship(e.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")||"");const href=rel?.getAttribute("Target")||"";return /^(https?:|mailto:)/i.test(href)?`<a href="${escape(href)}">${content}</a>`:content;}
  if(name==="p") { const style=val(node(e,"pStyle"));const h=style.match(/heading([1-6])/i);const tag=h?"h"+h[1]:"p";const align=props(e,"pPr").map(p=>val(node(p,"jc"))).filter(Boolean).pop()||"left";const paragraph=`<${tag} style="text-align:${align==="both"?"justify":escape(align||"left")}">${content||"<br>"}</${tag}>`;const num=node(e,"numPr");if(num){if(Number(val(node(num,"ilvl")))>0)warn("Listas multinivel: los niveles se importan como listas simples");const numId=val(node(num,"numId"));const numbering=xml(await zip.file("word/numbering.xml")?.async("string")||"<numbering/>");const n=Array.from(numbering.getElementsByTagNameNS(W,"num")).find(n=>val(n,"numId")===numId);const abstract=Array.from(numbering.getElementsByTagNameNS(W,"abstractNum")).find(a=>val(a,"abstractNumId")===val(n?node(n,"abstractNumId"):undefined));const level=Array.from(abstract?.children||[]).find(l=>val(l,"ilvl")===(val(node(num,"ilvl"))||"0"));const list=val(level?node(level,"numFmt"):undefined)==="bullet"?"ul":"ol";return `<${list}><li>${content}</li></${list}>`;}return paragraph; }
  if(name==="tbl") return `<table><tbody>${content}</tbody></table>`;if(name==="tr")return `<tr>${content}</tr>`;if(name==="tc")return `<td colspan="${Number(val(node(e,"gridSpan")))||1}">${content}</td>`;
  return content;
 }
 // Mammoth proporciona un diagnóstico independiente y el respaldo semántico.
 const mammoth=await import("mammoth");const fallback=await mammoth.convertToHtml({arrayBuffer:buffer});fallback.messages.forEach(m=>warn(m.message));
 const body=node(source,"body");if(!body)throw new Error("DOCX sin cuerpo");const html=(await render(body)).replace(/<\/(ol|ul)><\1>/g,"");
 const sect=Array.from(source.getElementsByTagNameNS(W,"sectPr")).pop();const margins=sect?node(sect,"pgMar"):undefined;const page=sect?node(sect,"pgSz"):undefined;
 if(page && ![11906,16838].some(n=>Math.abs(Number(val(page,"w"))-n)<10)) warn("Tamaño de papel: se adapta a A4");
 return {html,settings:{paper:"A4",orientation:val(page,"orient")==="landscape"?"landscape":"portrait",margins:Object.fromEntries(["top","right","bottom","left"].map(k=>[k,Number(val(margins,k)||1134)/56.6929]))},warnings};
}
export async function readOfficeFile(file:File) { if(/\.docx$/i.test(file.name)){ const result=await importDocx(await file.arrayBuffer()); if(result.warnings.length&&!window.confirm("Avisos de importación:\n• "+result.warnings.join("\n• ")+"\n¿Continuar con la importación?"))return null;return result;}const text=await file.text();const {textToHtml}=await import("./office-doc");return {html:/\.html?$/i.test(file.name)?text:textToHtml(text),settings:{}}; }
