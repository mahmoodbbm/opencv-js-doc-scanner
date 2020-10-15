
let originalImg = document.getElementById('original-image');
let inputElement = document.getElementById('image-file-select');

inputElement.addEventListener('change', (event) => {
    if (!(event.target.files && event.target.files[0])) {
        console.log('No files were selected!');
        return;
    }
    originalImg.src = URL.createObjectURL(event.target.files[0]);
}, false);

originalImg.onload = () => {
    let img = cv.imread(originalImg);
    let edgeDetected = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.Canny(img, edgeDetected, 100, 200, 3, true);
    cv.findContours(edgeDetected, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);

    const width = img.cols;
    const height = img.rows;
    // logMat(img);

    let target = getApprox(contours, width, height);

    if (!target) {
        console.log("Failed to find a target.");
        scaleAndShowImage(img, 500, 'canvas1');
        scaleAndShowImage(edgeDetected, 500, 'canvas2');
        hierarchy.delete(); contours.delete(); edgeDetected.delete(); img.delete();
        return;
    }

    let [srcTri, dstTri, dSize] = rectify(target);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);

    let transformed = new cv.Mat();
    cv.warpPerspective(img, transformed, M, dSize);

    let grayed = new cv.Mat();
    cv.cvtColor(transformed, grayed, cv.COLOR_RGBA2GRAY, 0);

    let finalImage = new cv.Mat();
    cv.adaptiveThreshold(grayed, finalImage, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY, 5, 3)

    scaleAndShowImage(img, 500, 'canvas1');
    scaleAndShowImage(edgeDetected, 500, 'canvas2');
    scaleAndShowImage(transformed, 500, 'canvas3');
    scaleAndShowImage(finalImage, 500, 'canvas4');

    transformed.delete(); grayed.delete(); finalImage.delete();
    M.delete(); srcTri.delete(); dstTri.delete(); target.delete();
    hierarchy.delete(); contours.delete(); edgeDetected.delete(); img.delete();
}

function getApprox(contours, width, height) {
    const sorted = new Array();
    for (let i = 0; i < contours.size(); i++) {
        const arcLength = cv.arcLength(contours.get(i), true);
        sorted.push({
            arcLength,
            element: contours.get(i)
        });
    }
    sorted.sort((a, b) => (a.arcLength < b.arcLength) ? 1 : ((b.arcLength < a.arcLength) ? -1 : 0));
    const imagePerimeter = 2 * (width + height);
    for (let i = 0; i < contours.size(); i++) {
        if (sorted[i].arcLength >= imagePerimeter) continue;
        let approx = new cv.Mat();
        cv.approxPolyDP(sorted[i].element, approx, (0.02 * sorted[i].arcLength), true);
        if (approx.size().height == 4) return approx;
    }
    return null;
}

function rectify(target) {
    const vertex = new Array();
    vertex.push(new cv.Point(target.data32S[0 * 4], target.data32S[0 * 4 + 1]));
    vertex.push(new cv.Point(target.data32S[0 * 4 + 2], target.data32S[0 * 4 + 3]));
    vertex.push(new cv.Point(target.data32S[1 * 4], target.data32S[1 * 4 + 1]));
    vertex.push(new cv.Point(target.data32S[1 * 4 + 2], target.data32S[1 * 4 + 3]));

    let xMin = vertex[0].x, yMin = vertex[0].y, xMax = vertex[0].x, yMax = vertex[0].y;
    for (let i = 1; i < vertex.length; i++) {
        if (vertex[i].x < xMin) xMin = vertex[i].x;
        if (vertex[i].x > xMax) xMax = vertex[i].x;
        if (vertex[i].y < yMin) yMin = vertex[i].y;
        if (vertex[i].y > yMax) yMax = vertex[i].y;
    }
    const width = Math.floor(Math.abs(xMax - xMin));
    const height = Math.floor(Math.abs(yMax - yMin));

    let nWest, nEast, sEast, sWest;
    vertex.sort((a, b) => (a.x > b.x) ? 1 : ((b.x > a.x) ? -1 : 0));
    if (vertex[0].y < vertex[1].y) {
        nWest = vertex[0];
        sWest = vertex[1];
    } else {
        nWest = vertex[1];
        sWest = vertex[0];
    }
    if (vertex[2].y > vertex[3].y) {
        sEast = vertex[2];
        nEast = vertex[3];
    } else {
        sEast = vertex[3];
        nEast = vertex[2];
    }

    const src = [nWest.x, nWest.y, nEast.x, nEast.y, sEast.x, sEast.y, sWest.x, sWest.y];
    const dst = [0, 0, width, 0, width, height, 0, height];

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, src);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dst);
    const dSize = new cv.Size(width, height);

    return [srcTri, dstTri, dSize];
}


function logMat(obj) {
    console.log('Mat width: ' + obj.cols + '\n' +
        'Mat height: ' + obj.rows + '\n' +
        'Mat size: ' + obj.size().width + '*' + obj.size().height + '\n' +
        'Mat depth: ' + obj.depth() + '\n' +
        'Mat channels ' + obj.channels() + '\n' +
        'Mat type: ' + obj.type() + '\n');
}

function scaleAndShowImage(image, maxWidth, canvasId) {
    // longerSide = (image.cols > image.rows) ? image.cols : image.rows;
    longerSide = image.cols;
    exponent = 0;
    while (longerSide > maxWidth) {
        longerSide /= 2;
        exponent++;
    }
    divisor = Math.pow(2, exponent);
    let dSize = new cv.Size(image.cols / divisor, image.rows / divisor);
    let resized = new cv.Mat();
    cv.resize(image, resized, dSize, 0, 0, cv.INTER_AREA);
    cv.imshow(canvasId, resized);
    resized.delete();
}
