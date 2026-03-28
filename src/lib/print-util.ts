
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
            /* Screen-only styles for the print preview window */
            @media screen {
                body {
                    margin: 0;
                    font-family: 'Poppins', sans-serif; /* Match app font */
                    background-color: hsl(var(--muted)); /* Use theme color */
                }
                .print-controls {
                    position: sticky;
                    top: 0;
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    padding: 0.75rem;
                    background-color: hsl(var(--card)); /* Use theme card color */
                    border-bottom: 1px solid hsl(var(--border));
                    z-index: 1000;
                }
                .print-controls button {
                    font-family: 'Poppins', sans-serif;
                    font-size: 0.875rem;
                    padding: 0.5rem 1.25rem;
                    border-radius: 0.5rem; /* Match app's radius */
                    border: 1px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                #print-btn {
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border-color: hsl(var(--primary));
                }
                #print-btn:hover {
                    background-color: hsl(var(--primary) / 0.9);
                }
                #save-pdf-btn {
                     background-color: hsl(var(--secondary));
                     color: hsl(var(--secondary-foreground));
                     border-color: hsl(var(--border));
                }
                #save-pdf-btn:hover {
                    background-color: hsl(var(--accent));
                }
                .print-content-wrapper {
                  width: 210mm; /* A4 width */
                  min-height: 297mm; /* A4 height */
                  margin: 2rem auto;
                  padding: 0.75in;
                  box-sizing: border-box;
                  box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.05); /* Softer shadow */
                  background: white;
                  border-radius: 2px; /* Slight rounding on paper */
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
                    border-radius: 0 !important;
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
