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

        newWindow.document.write('</head><body>');
        newWindow.document.write(html);
        newWindow.document.write('</body></html>');
        
        newWindow.document.close();
        
        newWindow.onload = () => {
            newWindow.focus();
            newWindow.print();
        };
    }
}
