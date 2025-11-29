import JSZip from 'jszip';
import { Chapter, BookMetadata } from '../types';
import { marked } from 'marked';
import TurndownService from 'turndown';
// @ts-ignore - html2pdf lacks strict typing in some environments
import html2pdf from 'html2pdf.js';

// Helper to escape XML characters
const escapeXml = (unsafe: string | undefined) => {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

// Helper to make HTML XML-compliant for EPUB (XHTML)
// This fixes "Opening and ending tag mismatch" errors for tags like <hr>, <img>, <br>
const makeXhtmlCompatible = (html: string): string => {
  return html
    .replace(/<hr>/g, '<hr />')
    .replace(/<br>/g, '<br />')
    .replace(/<img([^>]*[^/])>/g, '<img$1 />');
};

// Helper to remove duplicate title at start of content if it exists
const getContentWithTitle = (title: string, content: string, isHtml = false): string => {
  const trimmedContent = content.trim();
  const titlePattern = new RegExp(`^#\\s*${title.trim()}`, 'i');
  
  // If content already starts with the title (Markdown style), return as is
  if (trimmedContent.match(titlePattern)) {
    return content;
  }
  
  // For HTML output (used in EPUB/PDF), check if H1 matches title
  if (isHtml) {
      // Simple check: does it start with <h1>Title</h1>?
      // This is a bit loose but covers standard marked output
      const h1Pattern = new RegExp(`^<h1[^>]*>\\s*${title.trim()}\\s*<\/h1>`, 'i');
      if (trimmedContent.match(h1Pattern)) {
          return content;
      }
      return `<h1>${escapeXml(title)}</h1>\n${content}`;
  }

  // Default markdown prepend
  return `# ${title}\n\n${content}`;
};


// Internal helper to trigger download without external dependencies
const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- EXPORT FUNCTIONS ---

export const exportToEpub = async (bookMeta: BookMetadata, chapters: Chapter[]) => {
  const zip = new JSZip();

  // 1. mimetype (must be first, no compression)
  zip.file('mimetype', 'application/epub+zip', { compression: "STORE" });

  // 2. META-INF/container.xml
  zip.folder('META-INF')?.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
   <rootfiles>
      <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
   </rootfiles>
</container>`);

  const oebps = zip.folder('OEBPS');
  if (!oebps) throw new Error("Failed to create OEBPS folder");

  // Handle Cover Image
  let coverFileName = '';
  let coverId = 'cover-image'; 
  if (bookMeta.coverData && bookMeta.coverMimeType) {
    const parts = bookMeta.coverData.split(',');
    if (parts.length === 2) {
      const base64Data = parts[1];
      const ext = bookMeta.coverMimeType.split('/')[1] || 'jpg';
      coverFileName = `cover.${ext}`;
      oebps.folder('images')?.file(coverFileName, base64Data, { base64: true });
    }
  }

  // 3. Process Chapters content to HTML
  const chapterFiles: { id: string, href: string, title: string }[] = [];
  
  chapters.forEach((chapter, index) => {
    let htmlContent = marked.parse(chapter.content) as string;
    
    // Ensure XHTML compatibility for self-closing tags
    htmlContent = makeXhtmlCompatible(htmlContent);
    
    // Check if the first element is already the title to avoid duplication
    // The getContentWithTitle helper logic is slightly adapted here for HTML structure
    // We check if the generated HTML starts with an H1 that matches the title
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const firstChild = tempDiv.firstElementChild;
    const hasTitle = firstChild && firstChild.tagName === 'H1' && firstChild.textContent?.trim() === chapter.title.trim();
    
    const bodyContent = hasTitle ? htmlContent : `<h1>${escapeXml(chapter.title)}</h1>\n${htmlContent}`;

    const fileName = `chapter_${index + 1}.xhtml`;
    const fileId = `chap${index + 1}`;
    
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN">
<head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
    ${bodyContent}
</body>
</html>`;

    oebps.file(fileName, xhtml);
    chapterFiles.push({ id: fileId, href: fileName, title: chapter.title });
  });

  // 4. Style.css - Optimized
  oebps.file('style.css', `
    @font-face {
      font-family: "Source Han Serif SC";
      src: local("Source Han Serif SC"), local("Songti SC"), local("SimSun");
    }
    body { 
      font-family: "Source Han Serif SC", "Songti SC", "SimSun", serif; 
      line-height: 1.8; 
      margin: 0;
      padding: 1em;
      text-align: justify;
      color: #333;
      background-color: #fff;
    }
    h1, h2, h3, h4, h5, h6 { 
      font-family: "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif; 
      font-weight: bold; 
      color: #1a1a1a; 
      margin-top: 1.5em;
      margin-bottom: 0.8em;
      line-height: 1.4;
    }
    h1 { font-size: 1.6em; text-align: center; margin-bottom: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.5em; }
    p { margin-bottom: 1em; text-indent: 2em; }
    code { font-family: monospace; background: #f5f5f7; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
    img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
    hr { border: 0; border-top: 1px solid #eee; margin: 2em 0; }
  `);

  // 5. content.opf
  let manifestItems = '';
  manifestItems += `<item id="style" href="style.css" media-type="text/css"/>\n`;
  manifestItems += `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n`;
  
  let coverMeta = '';
  if (coverFileName) {
    // EPUB 3 property and standard item
    manifestItems += `<item id="${coverId}" href="images/${coverFileName}" media-type="${bookMeta.coverMimeType}" properties="cover-image" />\n`;
    // EPUB 2 compatibility meta
    coverMeta = `<meta name="cover" content="${coverId}" />`;
  }

  manifestItems += chapterFiles.map(c => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml" />`).join('\n');
  
  const spineItems = chapterFiles.map(c => `<itemref idref="${c.id}" />`).join('\n');

  const isbnMeta = bookMeta.isbn ? `<dc:identifier id="isbn">urn:isbn:${escapeXml(bookMeta.isbn)}</dc:identifier>` : '';
  const tagsMeta = bookMeta.tags && bookMeta.tags.length > 0 ? bookMeta.tags.map(t => `<dc:subject>${escapeXml(t)}</dc:subject>`).join('\n') : '';

  // NOTE: Added <meta name="cover"> for EPUB 2 compatibility which many readers use for thumbnail
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:title>${escapeXml(bookMeta.title)}</dc:title>
        <dc:creator opf:role="aut">${escapeXml(bookMeta.author)}</dc:creator>
        <dc:publisher>${escapeXml(bookMeta.publisher || 'ZenPub')}</dc:publisher>
        <dc:description>${escapeXml(bookMeta.description || '')}</dc:description>
        <dc:language>zh-CN</dc:language>
        <dc:identifier id="BookId">urn:uuid:${crypto.randomUUID()}</dc:identifier>
        <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
        ${isbnMeta}
        ${tagsMeta}
        ${coverMeta}
    </metadata>
    <manifest>
        ${manifestItems}
    </manifest>
    <spine toc="ncx">
        ${spineItems}
    </spine>
</package>`;
  
  oebps.file('content.opf', contentOpf);

  // 6. toc.ncx
  const navPoints = chapterFiles.map((c, i) => `
    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
        <navLabel><text>${escapeXml(c.title)}</text></navLabel>
        <content src="${c.href}"/>
    </navPoint>`).join('\n');

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD NCX 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="urn:uuid:12345"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <docTitle><text>${escapeXml(bookMeta.title)}</text></docTitle>
    <navMap>
        ${navPoints}
    </navMap>
</ncx>`;

  oebps.file('toc.ncx', tocNcx);

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${bookMeta.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_')}.epub`);
};

export const exportToMarkdown = async (bookMeta: BookMetadata, chapters: Chapter[]) => {
  const zip = new JSZip();
  
  zip.file('metadata.json', JSON.stringify(bookMeta, null, 2));
  
  let combinedContent = `# ${bookMeta.title}\n\nAuthor: ${bookMeta.author}\n\n${bookMeta.description}\n\n---\n\n`;
  
  chapters.forEach((chapter, index) => {
    // Use the helper to ensure title isn't duplicated if content already starts with it
    const finalContent = getContentWithTitle(chapter.title, chapter.content, false);
    const fileName = `chapter_${(index + 1).toString().padStart(2, '0')}_${chapter.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_')}.md`;
    
    zip.file(fileName, finalContent);
    combinedContent += `${finalContent}\n\n---\n\n`;
  });
  
  zip.file('full_book.md', combinedContent);
  
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${bookMeta.title}_markdown.zip`);
};

export const exportToPdf = async (bookMeta: BookMetadata, chapters: Chapter[]) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '210mm';
  container.className = 'pdf-export-container';
  
  let html = `<div style="text-align:center; padding-top: 100px; page-break-after: always;">
    <h1 style="font-size: 36px; margin-bottom: 20px;">${bookMeta.title}</h1>
    <h3 style="font-size: 24px; color: #666;">${bookMeta.author}</h3>
    ${bookMeta.publisher ? `<p style="margin-top: 50px;">${bookMeta.publisher}</p>` : ''}
  </div>`;

  chapters.forEach(chapter => {
    // Logic to check duplication
    const rawHtml = marked.parse(chapter.content) as string;
    
    // Temporarily check content for title match
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    const firstChild = tempDiv.firstElementChild;
    const hasTitle = firstChild && (firstChild.tagName === 'H1' || firstChild.tagName === 'H2') && firstChild.textContent?.trim() === chapter.title.trim();
    
    const bodyContent = hasTitle ? rawHtml : `<h2 style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px;">${chapter.title}</h2>\n${rawHtml}`;

    html += `<div style="page-break-after: always; padding: 20px;">
      <div class="prose" style="font-family: serif; line-height: 1.6;">${bodyContent}</div>
    </div>`;
  });

  container.innerHTML = html;
  document.body.appendChild(container);

  const opt = {
    margin:       15,
    filename:     `${bookMeta.title}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } catch (e) {
    console.error("PDF Export Error:", e);
    alert("PDF 导出失败，请重试。");
  } finally {
    document.body.removeChild(container);
  }
};

// --- IMPORT FUNCTIONS ---

export const importEpub = async (file: File): Promise<{ metadata: BookMetadata, chapters: Chapter[] }> => {
  const zip = await JSZip.loadAsync(file);
  
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("Invalid EPUB: container.xml missing");
  const containerXml = await containerFile.async("string");
  
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfile = containerDoc.querySelector("rootfile");
  const opfPath = rootfile?.getAttribute("full-path");
  if (!opfPath) throw new Error("Invalid EPUB: OPF path not found");
  
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("Invalid EPUB: OPF file missing");
  const opfXml = await opfFile.async("string");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");
  
  const metadata: BookMetadata = {
    title: opfDoc.querySelector("title")?.textContent || "Untitled",
    author: opfDoc.querySelector("creator")?.textContent || "Unknown",
    description: opfDoc.querySelector("description")?.textContent || "",
    publisher: opfDoc.querySelector("publisher")?.textContent || "",
    language: opfDoc.querySelector("language")?.textContent || "zh-CN",
    isbn: opfDoc.querySelector("identifier")?.textContent || "",
    tags: Array.from(opfDoc.querySelectorAll("subject")).map(el => el.textContent || "").filter(Boolean)
  };

  const manifestItems: {[key: string]: string} = {};
  opfDoc.querySelectorAll("manifest > item").forEach(item => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifestItems[id] = href;
  });

  const spineRefs: string[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach(itemref => {
    const idref = itemref.getAttribute("idref");
    if (idref) spineRefs.push(idref);
  });

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  
  const opfDir = opfPath.split('/').slice(0, -1).join('/'); 
  
  const chapters: Chapter[] = [];
  
  for (let i = 0; i < spineRefs.length; i++) {
    const id = spineRefs[i];
    const relativeHref = manifestItems[id];
    if (!relativeHref) continue;
    
    const fullPath = opfDir ? `${opfDir}/${relativeHref}` : relativeHref;
    
    const chapFile = zip.file(fullPath);
    if (chapFile) {
      const htmlContent = await chapFile.async("string");
      const doc = parser.parseFromString(htmlContent, "application/xhtml+xml");
      
      const heading = doc.querySelector("h1, h2");
      let title = heading?.textContent || `Chapter ${i + 1}`;

      if (heading && heading.textContent && title.trim() === heading.textContent.trim()) {
         heading.remove();
      }
      
      const markdown = turndownService.turndown(doc.body.innerHTML);
      
      chapters.push({
        id: crypto.randomUUID(),
        title: title,
        content: markdown,
        order: i
      });
    }
  }

  return { metadata, chapters };
};
