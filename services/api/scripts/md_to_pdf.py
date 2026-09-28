import markdown2
import pdfkit
import sys

def convert_md_to_pdf(md_file_path, pdf_file_path):
    # Read the Markdown file
    with open(md_file_path, 'r', encoding='utf-8') as md_file:
        markdown_content = md_file.read()

    # Convert Markdown to HTML
    html_content = markdown2.markdown(markdown_content)

    # Convert HTML to PDF
    pdfkit.from_string(html_content, pdf_file_path)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python md_to_pdf.py <input_markdown_file> <output_pdf_file>")
        sys.exit(1)

    md_file_path = sys.argv[1]
    pdf_file_path = sys.argv[2]

    convert_md_to_pdf(md_file_path, pdf_file_path)
    print(f"Converted {md_file_path} to {pdf_file_path}")