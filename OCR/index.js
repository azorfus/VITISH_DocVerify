document.getElementById('uploadImage').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const fileType = file.type;
    
    if (fileType === "application/pdf") {
        handlePDF(file);
    } else {
        handleImage(file);
    }
});


function handleImage(file) {
    const reader = new FileReader();

    reader.onload = function() {
        Tesseract.recognize(
            reader.result,
            'eng',
            {
                logger: m => {
                    const progressElem = document.getElementById('progress');
                    if (progressElem) {
                        progressElem.innerText = `Progress: ${Math.round(m.progress * 100)}%`;
                    }
                }
            }
        ).then(({ data: { text } }) => {
            const outputElem = document.getElementById('outputText');
            if (outputElem) {
                const { results, redactedText } = identifyAndRemovePII(text)
                
                outputElem.innerText = redactedText;

                const piiElem = document.getElementById('piiResults');
                if (piiElem) {
                    piiElem.innerText = JSON.stringify(results, null, 2);
            }
        }
        }).catch(err => {
            console.error(err);
        });
    };
    
    reader.readAsDataURL(file);
}


function handlePDF(file) {
    const reader = new FileReader();
    
    reader.onload = function() {
        const typedarray = new Uint8Array(reader.result);
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';
        pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
            pdf.getPage(1).then(function(page) {
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                
                page.render(renderContext).promise.then(function() {
                    const imgData = canvas.toDataURL('image/png');
                    Tesseract.recognize(
                        imgData,
                        'eng',
                        {
                            logger: m => {
                                const progressElem = document.getElementById('progress');
                                if (progressElem) {
                                    progressElem.innerText = `Progress: ${Math.round(m.progress * 100)}%`;
                                }
                            }
                        }
                    ).then(({ data: { text } }) => {
                        const outputElem = document.getElementById('outputText');
                        if (outputElem) {
                            outputElem.innerText = text;

                            const piiResults = identifyAndRemovePII(text);
                            console.log('PII Results:', piiResults);

                            const piiElem = document.getElementById('piiResults');
                            if (piiElem) {
                                piiElem.innerText = JSON.stringify(piiResults, null, 2);
                            }
                        }
                    }).catch(err => {
                        console.error(err);
                    });
                });
            });
        });
    };
    
    reader.readAsArrayBuffer(file);
}

const pii = {
    aadhaar: /\b\d{4} \d{4} \d{4}\b/g,
    pan: /\b[A-Z]{5}\d{4}[A-Z]{1}\b/g
};

function identifyAndRemovePII(text) {
    const results = {};

    for (const [type, pattern] of Object.entries(pii)) {
        results[type] = [];
        let match;
        while ((match = pattern.exec(text)) !== null) {
            results[type].push(match[0]);

            text = text.replace(match[0], "[REDACTED]");
        }
    }

    return { results, redactedText: text };
}
