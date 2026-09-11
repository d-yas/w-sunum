/**
 * Hand-rolled .pptx: one 16:9 slide per chart, each carrying a PNG that is
 * fitted (contain) and centred. The package is the minimum PowerPoint
 * accepts — presentation, one master, one blank layout, one theme, slides.
 */
// Extension kept so Node's --experimental-strip-types can run this outside Vite.
import { buildZip, type ZipEntry } from "./zip.ts";

export interface PptxSlide {
  png: Uint8Array;
  /** PNG pixel size — used only for aspect ratio. */
  width: number;
  height: number;
  /** Slide background as RRGGBB hex, or null for the theme's white. */
  background: string | null;
  name?: string;
}

const SLIDE_W = 12192000; // 13.333 in
const SLIDE_H = 6858000; // 7.5 in

const NS_A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS_P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const EMPTY_TREE =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rels(items: { id: string; type: string; target: string }[]): string {
  return (
    XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    items.map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${r.target}"/>`).join("") +
    "</Relationships>"
  );
}

function slideXml(s: PptxSlide, index: number): string {
  // Fit the picture inside the slide with a small safe margin.
  const margin = 0;
  const availW = SLIDE_W - 2 * margin;
  const availH = SLIDE_H - 2 * margin;
  const scale = Math.min(availW / s.width, availH / s.height);
  const cx = Math.round(s.width * scale);
  const cy = Math.round(s.height * scale);
  const x = Math.round((SLIDE_W - cx) / 2);
  const y = Math.round((SLIDE_H - cy) / 2);
  const bg = s.background
    ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${s.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`
    : "";
  const name = esc(s.name ?? `Grafik ${index + 1}`);
  return (
    XML +
    `<p:sld ${NS_A} ${NS_R} ${NS_P}><p:cSld>${bg}<p:spTree>${EMPTY_TREE}` +
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="${name}" descr="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

const THEME =
  XML +
  `<a:theme ${NS_A} name="Veri Görsel"><a:themeElements>` +
  '<a:clrScheme name="Veri Görsel"><a:dk1><a:srgbClr val="0B0B0B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="52514E"/></a:dk2><a:lt2><a:srgbClr val="F4F4F2"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="2A78D6"/></a:accent1><a:accent2><a:srgbClr val="EB6834"/></a:accent2><a:accent3><a:srgbClr val="1BAF7A"/></a:accent3><a:accent4><a:srgbClr val="EDA100"/></a:accent4><a:accent5><a:srgbClr val="E87BA4"/></a:accent5><a:accent6><a:srgbClr val="4A3AA7"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="2A78D6"/></a:hlink><a:folHlink><a:srgbClr val="4A3AA7"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="Veri Görsel"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Veri Görsel">' +
  '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
  '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
  "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
  '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
  "</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>";

const MASTER =
  XML +
  `<p:sldMaster ${NS_A} ${NS_R} ${NS_P}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld>` +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  "<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:otherStyle></p:txStyles>" +
  "</p:sldMaster>";

const LAYOUT =
  XML +
  `<p:sldLayout ${NS_A} ${NS_R} ${NS_P} type="blank" preserve="1"><p:cSld name="Boş"><p:spTree>${EMPTY_TREE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

export function buildPptx(slides: PptxSlide[], title = "Grafikler"): Uint8Array<ArrayBuffer> {
  if (slides.length === 0) throw new Error("Slayt yok.");
  const entries: ZipEntry[] = [];

  entries.push({
    name: "[Content_Types].xml",
    data:
      XML +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      slides
        .map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
        .join("") +
      "</Types>",
  });

  entries.push({
    name: "_rels/.rels",
    data: rels([
      { id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" },
      { id: "rId2", type: "metadata/core-properties", target: "docProps/core.xml" },
      { id: "rId3", type: "extended-properties", target: "docProps/app.xml" },
    ]).replace(`${REL}/metadata/core-properties`, "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"),
  });

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  entries.push({
    name: "docProps/core.xml",
    data:
      XML +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${esc(title)}</dc:title><dc:creator>Veri Görsel</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
      "</cp:coreProperties>",
  });
  entries.push({
    name: "docProps/app.xml",
    data:
      XML +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      `<Application>Veri Görsel</Application><Slides>${slides.length}</Slides><PresentationFormat>Geniş ekran</PresentationFormat></Properties>`,
  });

  entries.push({
    name: "ppt/presentation.xml",
    data:
      XML +
      `<p:presentation ${NS_A} ${NS_R} ${NS_P} saveSubsetFonts="1">` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      "<p:sldIdLst>" +
      slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${3 + i}"/>`).join("") +
      "</p:sldIdLst>" +
      `<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="6858000" cy="9144000"/>` +
      '<p:defaultTextStyle><a:defPPr><a:defRPr lang="tr-TR"/></a:defPPr></p:defaultTextStyle>' +
      "</p:presentation>",
  });
  entries.push({
    name: "ppt/_rels/presentation.xml.rels",
    data: rels([
      { id: "rId1", type: "slideMaster", target: "slideMasters/slideMaster1.xml" },
      { id: "rId2", type: "theme", target: "theme/theme1.xml" },
      ...slides.map((_, i) => ({ id: `rId${3 + i}`, type: "slide", target: `slides/slide${i + 1}.xml` })),
    ]),
  });

  entries.push({ name: "ppt/slideMasters/slideMaster1.xml", data: MASTER });
  entries.push({
    name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    data: rels([
      { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
      { id: "rId2", type: "theme", target: "../theme/theme1.xml" },
    ]),
  });
  entries.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: LAYOUT });
  entries.push({
    name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    data: rels([{ id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }]),
  });
  entries.push({ name: "ppt/theme/theme1.xml", data: THEME });

  slides.forEach((s, i) => {
    entries.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(s, i) });
    entries.push({
      name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      data: rels([
        { id: "rId1", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" },
        { id: "rId2", type: "image", target: `../media/image${i + 1}.png` },
      ]),
    });
    entries.push({ name: `ppt/media/image${i + 1}.png`, data: s.png });
  });

  return buildZip(entries);
}
