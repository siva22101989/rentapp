export function printElement(element: HTMLElement, documentTitle: string) {
    const html = element.innerHTML;
    const newWindow = window.open('', '_blank', 'height=800,width=800');
    
    if (newWindow) {
        newWindow.document.write('<html><head>');
        newWindow.document.write(`<title>${documentTitle}</title>`);
        
        const links = Array.from(document.getElementsByTagName('link'));
        links.forEach(link => {
             if (link.rel === 'stylesheet') {
                newWindow.document.write(link.outerHTML);
            }
        });
        
        const styles = Array.from(document.getElementsByTagName('style'));
        styles.forEach(style => {
            newWindow.document.write(style.outerHTML);
        });

        // Add new styles for the control bar and page layout
        newWindow.document.write(`
            <style>
                @media print {
                    .print-controls { display: none !important; }
                    @page {
                        size: A4;
                        margin: 0.5in;
                    }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact; /* Chrome, Safari, Edge */
                        color-adjust: exact; /* Firefox */
                    }
                    .print-content-wrapper {
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                    }
                }
                body {
                    margin: 0;
                    font-family: sans-serif;
                    background-color: #e0e0e0;
                }
                .print-controls {
                    position: sticky;
                    top: 0;
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    padding: 1rem;
                    background-color: #4a5568;
                    border-bottom: 1px solid #2d3748;
                    z-index: 1000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                .print-controls button {
                    font-size: 1rem;
                    padding: 0.5rem 1.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #718096;
                    cursor: pointer;
                    background-color: #f7fafc;
                    color: #2d3748;
                    font-weight: 600;
                    transition: background-color 0.2s;
                }
                .print-controls button:hover {
                    background-color: #edf2f7;
                }
                .print-content-wrapper {
                  width: 210mm;
                  min-height: 297mm;
                  margin: 2rem auto;
                  padding: 1in;
                  box-sizing: border-box;
                  box-shadow: 0 0 10px rgba(0,0,0,0.15);
                  background: white;
                }
            </style>
        `);

        newWindow.document.write('</head><body>');
        
        // Add the control buttons
        newWindow.document.write(`
            <div class="print-controls">
                <button onclick="window.print()">🖨️ Print</button>
                <button onclick="window.print()">📄 Save as PDF</button>
            </div>
        `);
        
        // Wrap the content in a container that looks like a page
        newWindow.document.write(`<div class="print-content-wrapper">${html}</div>`);

        newWindow.document.write('</body></html>');
        
        newWindow.document.close();
        
        newWindow.onload = () => {
            newWindow.focus();
        };
    }
}
