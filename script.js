let pcrProduct = '';
let electrophoresisInterval;
let masterMix = {
    buffer: false,
    dntp: false,
    enzyme: null
};

function generateDNASequence() {
    const bases = ['A', 'T', 'C', 'G'];
    let sequence = '';
    for (let i = 0; i < 500; i++) {
        sequence += bases[Math.floor(Math.random() * 4)];
    }
    document.getElementById('dnaSequence').value = sequence;
}

function loadFastaFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        const sequence = contents.split('\n').filter(line => !line.startsWith('>')).join('');
        document.getElementById('dnaSequence').value = sequence;
    };
    reader.readAsText(file);
}

function displayPrimerLength() {
    const primerForward = document.getElementById("primerForward").value.length;
    const primerReverse = document.getElementById("primerReverse").value.length;
    document.getElementById("primerInfo").innerText = `Forward Primer Length: ${primerForward} bases, Reverse Primer Length: ${primerReverse} bases`;
    calculateTm();
}

function calculateTm(primer) {
    const aCount = (primer.match(/A/g) || []).length;
    const tCount = (primer.match(/T/g) || []).length;
    const gCount = (primer.match(/G/g) || []).length;
    const cCount = (primer.match(/C/g) || []).length;
    const length = primer.length;

    if (length <= 14) {
        return (2 * (aCount + tCount) + 4 * (gCount + cCount)).toFixed(1);
    } else {
        return (64.9 + 41 * (gCount + cCount - 16.4) / length).toFixed(1);
    }
}

function validatePrimers() {
    const primerForward = document.getElementById("primerForward").value;
    const primerReverse = document.getElementById("primerReverse").value;
    const tmForward = calculateTm(primerForward);
    const tmReverse = calculateTm(primerReverse);
    const annealingTemp = parseInt(document.getElementById("annealingTemp").value);

    if (primerForward.length < 12 || primerReverse.length < 12) {
        alert("Both primers must be at least 12 bases long. Please enter again.");
    } else if (annealingTemp > tmForward + 5 || annealingTemp > tmReverse + 5) {
        alert("Annealing temperature must be within 5°C of primer Tm.");
    } else {
        nextStep(1, 2);
    }
}

function nextStep(currentStep, nextStep) {
    // 酵素が選択されているかを確認する
    if (!masterMix.enzyme) {
        alert('Please select an enzyme before proceeding to the next step.');
        return; // 酵素が選択されていない場合、次のステップに進まない
    }
    document.getElementById(`step${currentStep}`).style.display = 'none';
    document.getElementById(`step${nextStep}`).style.display = 'block';
    updateProgressBar(nextStep);
}

function goToStep(step) {
    const steps = document.querySelectorAll('.step');
    steps.forEach((element, index) => {
        element.style.display = (index === step) ? 'block' : 'none';
    });
    updateProgressBar(step);
}

function updateProgressBar(step) {
    const steps = document.querySelectorAll('.step-progress');
    steps.forEach((element, index) => {
        if (index <= step) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    });
}

function runPCR() {
    const dnaSequence = document.getElementById("dnaSequence").value.toUpperCase();
    const primerForward = document.getElementById("primerForward").value.toUpperCase();
    const primerReverse = document.getElementById("primerReverse").value.toUpperCase();
    const denaturationTemp = parseInt(document.getElementById("denaturationTemp").value);
    const extensionTemp = parseInt(document.getElementById("extensionTemp").value);
    const enzyme = document.getElementById("enzymeSelect").value;
    const cycles = parseInt(document.getElementById("cycles").value);
    // 酵素が選択されていない場合の処理
    if (!masterMix.enzyme) {
        alert("Please select an enzyme before running PCR.");
        return;
    }
    if (denaturationTemp < 92) {
        alert("Denaturation temperature must be at least 92°C.");
        return;
    }

    const optimalTemp = enzyme === "taq" ? 72 : enzyme === "pfu" ? 75 : 70;
    if (Math.abs(extensionTemp - optimalTemp) > 2) {
        alert(`Extension temperature must be within ±2°C of the optimal temperature (${optimalTemp}°C).`);
        return;
    }

    if (dnaSequence.includes(primerForward) && dnaSequence.includes(reverseComplement(primerReverse))) {
        const startIndex = dnaSequence.indexOf(primerForward);
        const endIndex = dnaSequence.indexOf(reverseComplement(primerReverse)) + primerReverse.length;
        pcrProduct = dnaSequence.substring(startIndex, endIndex);

        nextStep(2, 3);
    } else {
        alert("Primers do not match the DNA sequence.");
        document.getElementById('step1').style.display = 'block';
        document.getElementById('step2').style.display = 'none';
    }
}

function performElectrophoresis() {
    if (pcrProduct) {
        const canvas = document.getElementById('gelCanvas');
        const ctx = canvas.getContext('2d');

        // Set the background color to black to make the bands visible
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawLadder(ctx);
        animateBands(ctx, pcrProduct.length);
    } else {
        alert("No PCR product to run electrophoresis.");
        document.getElementById('step2').style.display = 'block';
        document.getElementById('step3').style.display = 'none';
    }
}

function stopElectrophoresis() {
    clearInterval(electrophoresisInterval);
    document.getElementById('step3').style.display = 'block'; // Stay on the same step
}

function drawLadder(ctx) {
    const ladderSizes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    ladderSizes.forEach(size => {
        const position = 600 - Math.log10(size) * 100; // Adjust for canvas height
        ctx.fillStyle = 'white'; // Use white color for the ladder bands
        ctx.fillRect(20, position, 40, 5); // Left ladder
        ctx.fillRect(340, position, 40, 5); // Right ladder
    });
}

function animateBands(ctx, length) {
    const ladderSizes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    let positions = ladderSizes.map(size => ({ size, position: 0, speed: 100 / size }));
    const productPosition = { size: length, position: 0, speed: 100 / length };
    const cycles = parseInt(document.getElementById("cycles").value);
    const intensity = Math.min((cycles - 25) / 7, 1);

    electrophoresisInterval = setInterval(() => {
        ctx.clearRect(20, 0, 40, 600); // Clear previous left ladder positions
        ctx.clearRect(340, 0, 40, 600); // Clear previous right ladder positions
        ctx.clearRect(180, 0, 40, 600); // Clear previous product band position

        ctx.fillStyle = 'white';
        positions.forEach(ladder => {
            ladder.position += ladder.speed;
            if (ladder.position < 600) {
                ctx.fillRect(20, ladder.position, 40, 5); // Left ladder
                ctx.fillRect(340, ladder.position, 40, 5); // Right ladder
            }
        });

        productPosition.position += productPosition.speed;
        if (productPosition.position < 600) {
            ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`; // Use white color for the product band
            ctx.fillRect(180, productPosition.position, 40, 5); // Product band
        }

        if (productPosition.position >= 600 && positions.every(ladder => ladder.position >= 600)) {
            clearInterval(electrophoresisInterval);
            summarizeResults();
        }
    }, 50);
}

function summarizeResults() {
    const primerForward = document.getElementById("primerForward").value.toUpperCase();
    const primerReverse = document.getElementById("primerReverse").value.toUpperCase();
    const primerForwardLength = primerForward.length;
    const primerReverseLength = primerReverse.length;
    const pcrProductLength = pcrProduct.length;
    const dnaSequence = document.getElementById("dnaSequence").value.toUpperCase();
    const denaturationTemp = document.getElementById("denaturationTemp").value;
    const annealingTemp = document.getElementById("annealingTemp").value;
    const extensionTemp = document.getElementById("extensionTemp").value;
    const cycles = document.getElementById("cycles").value;

    const resultText = `
        Original DNA Sequence: ${dnaSequence}<br>
        Forward Primer: ${primerForward} (Length: ${primerForwardLength} bases)<br>
        Reverse Primer: ${primerReverse} (Length: ${primerReverseLength} bases)<br>
        PCR Product Length: ${pcrProductLength} bases<br>
        Denaturation Temperature: ${denaturationTemp} °C<br>
        Annealing Temperature: ${annealingTemp} °C<br>
        Extension Temperature: ${extensionTemp} °C<br>
        Number of Cycles: ${cycles}
    `;

    document.getElementById('result').innerHTML = resultText;
    document.getElementById('downloadHtml').style.display = 'block';
}

function showSummary() {
    summarizeResults();
    document.getElementById('step3').style.display = 'block';
    document.getElementById('result').scrollIntoView();
}

function extractGel() {
    const canvas = document.getElementById('gelCanvas');
    const ctx = canvas.getContext('2d');
    const gelHeight = 600; // Adjust this if your canvas height is different
    const bandY = 600 - Math.log10(pcrProduct.length) * 100;
    const imageData = ctx.getImageData(180, bandY - 5, 40, 10); // Extract a 10px high band centered on bandY
    const newCanvas = document.createElement('canvas');
    newCanvas.width = 40;
    newCanvas.height = 10;
    const newCtx = newCanvas.getContext('2d');
    newCtx.putImageData(imageData, 0, 0);
    const gelImage = newCanvas.toDataURL('image/png');
    const gelImageElement = `<img src="${gelImage}" alt="Extracted Gel Image" style="height: 10px;">`;
    document.getElementById('gelImage').innerHTML = gelImageElement;
    document.getElementById('extractButton').style.display = 'none';
    document.getElementById('sequenceButton').style.display = 'block';
}

function sequencePCRProduct() {
    document.getElementById('sequenceLoading').style.display = 'block';
    setTimeout(() => {
        document.getElementById('sequenceLoading').style.display = 'none';
        document.getElementById('sequenceComplete').style.display = 'block';
    }, 2000);
}

function downloadFasta() {
    const fastaContent = `>PCR_Product\n${pcrProduct}`;
    const blob = new Blob([fastaContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pcr_product.fasta';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadReverseFasta() {
    const reverseComplementSeq = reverseComplement(pcrProduct);
    const fastaContent = `>Reverse_PCR_Product\n${reverseComplementSeq}`;
    const blob = new Blob([fastaContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reverse_pcr_product.fasta';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadHtml() {
    const primerForward = document.getElementById("primerForward").value.toUpperCase();
    const primerReverse = document.getElementById("primerReverse").value.toUpperCase();
    const primerForwardLength = primerForward.length;
    const primerReverseLength = primerReverse.length;
    const pcrProductLength = pcrProduct.length;
    const dnaSequence = document.getElementById("dnaSequence").value.toUpperCase();
    const denaturationTemp = document.getElementById("denaturationTemp").value;
    const annealingTemp = document.getElementById("annealingTemp").value;
    const extensionTemp = document.getElementById("extensionTemp").value;
    const cycles = document.getElementById("cycles").value;
    const canvasImage = getCanvasImage();

    const htmlContent = `
        <html>
            <head>
                <title>PCR Simulation Results</title>
            </head>
            <body>
                <p>Original DNA Sequence: ${dnaSequence}</p>
                <p>Forward Primer: ${primerForward} (Length: ${primerForwardLength} bases)</p>
                <p>Reverse Primer: ${primerReverse} (Length: ${primerReverseLength} bases)</p>
                <p>PCR Product Length: ${pcrProductLength} bases</p>
                <p>Denaturation Temperature: ${denaturationTemp} °C</p>
                <p>Annealing Temperature: ${annealingTemp} °C</p>
                <p>Extension Temperature: ${extensionTemp} °C</p>
                <p>Number of Cycles: ${cycles}</p>
                <img src="${canvasImage}" alt="Gel Electrophoresis Result">
            </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pcr_simulation_results.html';
    a.click();
    URL.revokeObjectURL(url);
}

function getCanvasImage() {
    const canvas = document.getElementById('gelCanvas');
    return canvas.toDataURL('image/png');
}

function reverseComplement(seq) {
    const complement = {
        'A': 'T',
        'T': 'A',
        'C': 'G',
        'G': 'C'
    };
    return seq.split('').reverse().map(base => complement[base]).join('');
}

function addBuffer() {
    masterMix.buffer = true;
    updateMasterMixInfo();
}

function addDntp() {
    masterMix.dntp = true;
    updateMasterMixInfo();
}

function updateOptimalTemp() {
    const enzyme = document.getElementById('enzymeSelect').value;
    masterMix.enzyme = enzyme;
    const optimalTemp = enzyme === "taq" ? 72 : enzyme === "pfu" ? 75 : 70;
    document.getElementById('optimalTempInfo').innerText = `Optimal Extension Temperature: ${optimalTemp}°C`;
    updateMasterMixInfo();
}

function updateMasterMixInfo() {
    const bufferStatus = masterMix.buffer ? 'Added' : 'Not Added';
    const dntpStatus = masterMix.dntp ? 'Added' : 'Not Added';
    const enzymeStatus = masterMix.enzyme ? masterMix.enzyme : 'Not Selected';
    document.getElementById('masterMixInfo').innerText = `Buffer: ${bufferStatus}, dNTP: ${dntpStatus}, Enzyme: ${enzymeStatus}`;
}

function suggestPrimers() {
    const productLengthMin = parseInt(document.getElementById("productLengthMin").value);
    const productLengthMax = parseInt(document.getElementById("productLengthMax").value);
    const dnaSequence = document.getElementById("dnaSequence").value.toUpperCase();
    if (isNaN(productLengthMin) || isNaN(productLengthMax) || productLengthMin < 50 || productLengthMax > 500 || productLengthMin > productLengthMax) {
        alert("Please enter a valid PCR product length range between 50 and 500 bases.");
        return;
    }
    const suggestions = [];
    for (let i = 0; i < dnaSequence.length - productLengthMin + 1; i++) {
        for (let length = productLengthMin; length <= productLengthMax; length += 10) {
            const forwardPrimer = dnaSequence.substring(i, i + 20);
            const reversePrimer = reverseComplement(dnaSequence.substring(i + length - 20, i + length));
            if (calculateTm(forwardPrimer) >= 50 && calculateTm(reversePrimer) >= 50) {
                suggestions.push({ forward: forwardPrimer, reverse: reversePrimer, tmForward: calculateTm(forwardPrimer), tmReverse: calculateTm(reversePrimer) });
            }
        }
    }
    suggestions.sort((a, b) => Math.abs(a.tmForward - 55) + Math.abs(a.tmReverse - 55) - (Math.abs(b.tmForward - 55) + Math.abs(b.tmReverse - 55)));
    displayPrimerSuggestions(suggestions.slice(0, 10));
}

function displayPrimerSuggestions(suggestions) {
    const suggestionsDiv = document.getElementById("primerSuggestions");
    suggestionsDiv.innerHTML = '<p>Click on a primer to select it:</p>';
    suggestions.forEach(pair => {
        const primerElement = document.createElement("div");
        primerElement.className = 'primer-suggestion';
        primerElement.innerHTML = `Forward: ${pair.forward}, Reverse: ${pair.reverse}, Tm: ${pair.tmForward}°C, ${pair.tmReverse}°C`;
        primerElement.onclick = () => {
            document.getElementById('primerForward').value = pair.forward;
            document.getElementById('primerReverse').value = pair.reverse;
            displayPrimerLength();
        };
        suggestionsDiv.appendChild(primerElement);
    });
}
