
export function printElement(element: HTMLElement, documentTitle: string) {
    const html = element.innerHTML;
    const newWindow = window.open('', '_blank', 'height=800,width=800');
    
    if (newWindow) {
        newWindow.document.write('<html><head>');
        newWindow.document.write(`<title>${documentTitle}</title>`);
        
        // Copy main stylesheet link
        const links = Array.from(document.getElementsByTagName('link'));
        links.forEach(link => {
             if (link.rel === 'stylesheet') {
                newWindow.document.write(link.outerHTML);
            }
        });

        // Inject all necessary styles for preview and print
        newWindow.document.write(`
            <style>
                /* Screen-only styles for the preview window */
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
                  width: 210mm; /* A4 width */
                  min-height: 297mm; /* A4 height */
                  margin: 2rem auto;
                  padding: 1in;
                  box-sizing: border-box;
                  box-shadow: 0 0 10px rgba(0,0,0,0.15);
                  background: white;
                }

                /* Print-only styles */
                @media print {
                    @page {
                        size: A4;
                        margin: 0.75in;
                    }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    .print-controls {
                        display: none !important;
                    }
                    .print-content-wrapper {
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        width: 100% !important;
                        min-height: 0 !important;
                    }
                }
            </style>
        `);

        newWindow.document.write('</head><body>');
        
        // Add the control buttons
        newWindow.document.write(`
            <div class="print-controls">
                <button id="print-btn">🖨️ Print</button>
                <button id="save-pdf-btn">📄 Save as PDF</button>
            </div>
        `);
        
        // Wrap the report content
        newWindow.document.write(`<div class="print-content-wrapper">${html}</div>`);

        // Add script to handle button clicks
        newWindow.document.write(`
            <script>
                document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
                document.getElementById('save-pdf-btn').addEventListener('click', function() { window.print(); });
            </script>
        `);

        newWindow.document.write('</body></html>');
        
        newWindow.document.close();
        
        newWindow.onload = () => {
            newWindow.focus();
        };
    } else {
        alert('Could not open print window. Please disable your pop-up blocker and try again.');
    }
}
