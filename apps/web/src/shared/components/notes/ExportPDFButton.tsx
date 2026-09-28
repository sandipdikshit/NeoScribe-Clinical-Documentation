import jsPDF from "jspdf";
import { HardDriveDownload } from "lucide-react";
import { Note } from "@/shared/types/note.type";
import MarkdownIt from "markdown-it";

interface Section {
  sectionId: string;
  sectionName: string;
  content: string;
  sequenceNumber: number;
}

interface ExportPDFButtonProps {
  note: Note;
  sections: Section[];
}

const ExportPDFButton: React.FC<ExportPDFButtonProps> = ({
  note,
  sections,
}) => {
  // Initialize markdown parser
  const md = new MarkdownIt({
    html: false,
    breaks: true,
    linkify: true,
  });

  // Helper to load image as base64
  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("No ctx");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  // Helper to render markdown content in PDF
  const renderMarkdownContent = (doc: jsPDF, content: string, startY: number, pageWidth: number): number => {
    let y = startY;
    const margin = 14;
    const maxWidth = pageWidth - (margin * 2);
    let listCounter = 1; // For ordered lists
    let inOrderedList = false;

    // Parse markdown to tokens
    const tokens = md.parse(content, {});

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'heading_open') {
        // Handle headers
        const level = parseInt(token.markup.length.toString());
        const fontSize = level === 1 ? 18 : level === 2 ? 16 : 14;
        const fontWeight = 'bold';

        doc.setFontSize(fontSize);
        doc.setFont("helvetica", fontWeight);
        doc.setTextColor(30, 44, 59);

        // Get the text content from the next token
        const textToken = tokens[i + 1];
        if (textToken && textToken.type === 'inline') {
          const text = textToken.content;
          const lines = doc.splitTextToSize(text, maxWidth);
          lines.forEach((line: string) => {
            doc.text(line, margin, y);
            y += fontSize * 0.4;
          });
          y += 2; // Extra spacing after headers
        }
      } else if (token.type === 'paragraph_open') {
        // Handle paragraphs
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      } else if (token.type === 'inline' && tokens[i-1].type !== 'heading_open') {
        // Handle inline content (text with formatting)
        if (token.children) {
          let currentText = '';
          let currentStyle = 'normal';
          let currentColor = [0, 0, 0];

          for (const child of token.children) {
            if (child.type === 'text') {
              currentText += child.content;
            } else if (child.type === 'strong_open') {
              // Render accumulated text before changing style
              if (currentText.trim()) {
                doc.setFont("helvetica", currentStyle);
                doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
                const lines = doc.splitTextToSize(currentText, maxWidth);
                lines.forEach((line: string) => {
                  doc.text(line, margin, y);
                  y += 12 * 0.4;
                });
                currentText = '';
              }
              currentStyle = 'bold';
            } else if (child.type === 'strong_close') {
              // Render bold text
              if (currentText.trim()) {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
                const lines = doc.splitTextToSize(currentText, maxWidth);
                lines.forEach((line: string) => {
                  doc.text(line, margin, y);
                  y += 12 * 0.4;
                });
                currentText = '';
              }
              currentStyle = 'normal';
            } else if (child.type === 'em_open') {
              // Render accumulated text before changing style
              if (currentText.trim()) {
                doc.setFont("helvetica", currentStyle);
                doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
                const lines = doc.splitTextToSize(currentText, maxWidth);
                lines.forEach((line: string) => {
                  doc.text(line, margin, y);
                  y += 12 * 0.4;
                });
                currentText = '';
              }
              currentStyle = 'italic';
            } else if (child.type === 'em_close') {
              // Render italic text
              if (currentText.trim()) {
                doc.setFont("helvetica", "italic");
                doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
                const lines = doc.splitTextToSize(currentText, maxWidth);
                lines.forEach((line: string) => {
                  doc.text(line, margin, y);
                  y += 12 * 0.4;
                });
                currentText = '';
              }
              currentStyle = 'normal';
            } else if (child.type === 'code_inline') {
              // Render accumulated text before code
              if (currentText.trim()) {
                doc.setFont("helvetica", currentStyle);
                doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
                const lines = doc.splitTextToSize(currentText, maxWidth);
                lines.forEach((line: string) => {
                  doc.text(line, margin, y);
                  y += 12 * 0.4;
                });
                currentText = '';
              }

              // Handle inline code
              doc.setFontSize(11);
              doc.setFont("courier", "normal");
              doc.setTextColor(100, 100, 100);
              const codeText = child.content;
              const codeLines = doc.splitTextToSize(codeText, maxWidth);
              codeLines.forEach((line: string) => {
                doc.text(line, margin, y);
                y += 11 * 0.4;
              });
              doc.setFontSize(12);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(0, 0, 0);
            }
          }

          // Render any remaining text
          if (currentText.trim()) {
            doc.setFont("helvetica", currentStyle);
            doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
            const lines = doc.splitTextToSize(currentText, maxWidth);
            lines.forEach((line: string) => {
              doc.text(line, margin, y);
              y += 12 * 0.4;
            });
          }
          y += 4;
        }
      } else if (token.type === 'list_item_open') {
        // Handle list items
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);

        // Get the text content from the next token
        const textToken = tokens[i + 1];
        if (textToken && textToken.type === 'inline') {
          const prefix = inOrderedList ? `${listCounter}. ` : '- ';
          const text = `${prefix}${textToken.content}`;
          const lines = doc.splitTextToSize(text, maxWidth);
          lines.forEach((line: string) => {
            doc.text(line, margin, y);
            y += 12 * 0.4;
          });
          if (inOrderedList) listCounter++;
        }
      } else if (token.type === 'blockquote_open') {
        // Handle blockquotes
        doc.setFillColor(240, 240, 240);
        doc.rect(margin - 4, y - 2, 4, 12, "F");
        doc.setTextColor(100, 100, 100);
      } else if (token.type === 'blockquote_close') {
        doc.setTextColor(0, 0, 0);
        y += 4;
      } else if (token.type === 'hr') {
        // Handle horizontal rules
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
      } else if (token.type === 'code_block') {
        // Handle code blocks
        doc.setFillColor(245, 245, 245);
        doc.rect(margin - 2, y - 2, maxWidth + 4, 12, "F");
        doc.setFontSize(11);
        doc.setFont("courier", "normal");
        doc.setTextColor(50, 50, 50);

        const codeText = token.content;
        const codeLines = doc.splitTextToSize(codeText, maxWidth - 4);
        codeLines.forEach((line: string) => {
          doc.text(line, margin, y);
          y += 11 * 0.4;
        });

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        y += 4;
      } else if (token.type === 'bullet_list_open') {
        // Handle bullet list opening
        inOrderedList = false;
        y += 2;
      } else if (token.type === 'ordered_list_open') {
        // Handle ordered list opening
        inOrderedList = true;
        listCounter = 1;
        y += 2;
      } else if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
        // Handle list closing - add extra spacing
        inOrderedList = false;
        listCounter = 1;
        y += 4;
      }

      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    }

    return y;
  };

  const handleExportPDF = async () => {
    if (!note) return;
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 0;

    // HEADER: dark blue background
    doc.setFillColor(29, 48, 109); // #1D306D
    doc.rect(0, 0, pageWidth, 54, "F");
    y = 10;

    // Add logo image centered
    try {
      const imgData = await loadImageAsBase64("/name.png");
      const imgProps = doc.getImageProperties(imgData);
      const imgWidth = 40;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      const imgX = (pageWidth - imgWidth) / 2;
      doc.addImage(imgData, "PNG", imgX, y, imgWidth, imgHeight);
      y += imgHeight + 10;
    } catch (e) {
      // If image fails, just move y down
      y += 20;
    }

    // Note Title (large, bold, white, centered)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(23);
    doc.setFont("helvetica", "bold");
    doc.text(note.note_title || "Note", pageWidth / 2, y, { align: "center" });
    y += 5;

    // Time (with clock icon image) and ID, both centered
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    let clockImgWidth = 6;
    let clockImgHeight = 6;
    let timeStr = note.visit_date
      ? new Date(note.visit_date).toLocaleString('en', {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      : "";
    try {
      const clockImgData = await loadImageAsBase64("/calendar.png");
      const timeTextWidth = doc.getTextWidth(timeStr);
      const totalWidth = clockImgWidth + 2 + timeTextWidth;
      const startX = (pageWidth - totalWidth) / 2;
      // Align icon and text to the same baseline
      const baselineY = y + 5; // 5 is a good offset for 12pt font and 6px icon
      // Icon Y: vertically center with text, move 2 points up
      doc.addImage(
        clockImgData,
        "PNG",
        startX,
        baselineY - clockImgHeight + 1.5,
        clockImgWidth,
        clockImgHeight
      );
      // Text Y: baselineY
      doc.text(timeStr, startX + clockImgWidth + 2, baselineY);
    } catch (e) {
      doc.text(timeStr, pageWidth / 2, y, { align: "center" });
    }
    y += 12;

    // BODY: white background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 54, pageWidth, doc.internal.pageSize.getHeight() - 54, "F");
    y = 64;

    // Sections
    sections.forEach((section) => {
      // Section title (gray-100 bg, bold)
      doc.setFillColor(243, 244, 246); // gray-100
      doc.rect(10, y, pageWidth - 20, 8, "F");
      doc.setTextColor(30, 44, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(section.sectionName || "Untitled Section", 12, y + 6);
      y += 16; // more gap below heading

      // Section content with markdown rendering
      const content = section.content || "";
      y = renderMarkdownContent(doc, content, y, pageWidth);
      y += 4;

      // Add new page if near bottom
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`${note.note_title || "note"}.pdf`);
  };

  return (
    <button
      onClick={handleExportPDF}
      className="p-1 flex justify-center items-center text-xs sm:text-sm bg-slate-50 px-3 py-1 text-gray-500 hover:text-blue-600 hover:bg-slate-100 hover:scale-105 rounded-md self-start transition-all"
    >
      <HardDriveDownload className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
      Export PDF
    </button>
  );
};

export default ExportPDFButton;
