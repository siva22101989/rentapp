
export function printElement(element: HTMLElement, documentTitle: string) {
    const html = element.innerHTML;
    const newWindow = window.open('', '_blank', 'height=800,width=800');

    if (newWindow) {
        // Copy all stylesheets and style tags from the parent document
        const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'));
        styles.forEach(style => {
            newWindow.document.head.appendChild(style.cloneNode(true));
        });

        newWindow.document.title = documentTitle;

        // Custom styles for the print preview window
        const printPreviewStyles = newWindow.document.createElement('style');
        printPreviewStyles.innerHTML = `
            /* Screen-only styles for the preview window */
            @media screen {
                body {
                    margin: 0;
                    font-family: sans-serif;
                    background-color: #f1f5f9; /* A lighter gray */
                }
                .print-controls {
                    position: sticky;
                    top: 0;
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    padding: 0.75rem;
                    background-color: #334155; /* Darker blue-gray */
                    z-index: 1000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                .print-controls button {
                    font-size: 0.875rem;
                    padding: 0.5rem 1rem;
                    border-radius: 0.375rem;
                    border: none;
                    cursor: pointer;
                    background-color: #f8fafc;
                    color: #1e293b;
                    font-weight: 600;
                    transition: background-color 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .print-controls button:hover {
                    background-color: #e2e8f0;
                }
                .print-content-wrapper {
                  width: 210mm; /* A4 width */
                  min-height: 297mm; /* A4 height */
                  margin: 2rem auto;
                  padding: 0.75in; /* Adjusted for a broader content area */
                  box-sizing: border-box;
                  box-shadow: 0 0 15px rgba(0,0,0,0.2);
                  background: white;
                }
            }

            /* Print-only styles */
            @media print {
                @page {
                    size: A4;
                    margin: 0.75in;
                }
                body {
                    margin: 0 !important;
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                .print-controls {
                    display: none !important;
                }
                .print-content-wrapper {
                    /* Reset wrapper styles for actual printing */
                    box-shadow: none !important;
                    margin: 0 !important;
                    border: none !important;
                    padding: 0 !important;
                    width: 100% !important;
                    min-height: 0 !important;
                    background: transparent !important;
                }
                .print-hide {
                    display: none !important;
                }
            }
        `;
        newWindow.document.head.appendChild(printPreviewStyles);


        // Add the control buttons and content wrapper to the body
        newWindow.document.body.innerHTML = `
            <div class="print-controls">
                <button id="print-btn">🖨️ Print</button>
                <button id="save-pdf-btn">📄 Save as PDF</button>
            </div>
            <div class="print-content-wrapper">${html}</div>
        `;

        // Add script to handle button clicks
        const script = newWindow.document.createElement('script');
        script.innerHTML = `
            document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
            document.getElementById('save-pdf-btn').addEventListener('click', function() { window.print(); });
        `;
        newWindow.document.body.appendChild(script);
        
        newWindow.document.close();

        newWindow.onload = () => {
            newWindow.focus();
        };
    } else {
        alert('Could not open print window. Please disable your pop-up blocker and try again.');
    }
}
