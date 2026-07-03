const { getColorPalette } = require('color-thief-node');
const path = require('path');

const imgPath = path.resolve(__dirname, 'public/assets/logo.jpg');

async function getColors() {
    try {
        const palette = await getColorPalette(imgPath, 5);
        console.log("Palette RGB colors:");
        palette.forEach((color, i) => {
            console.log(`Color ${i + 1}: rgb(${color[0]}, ${color[1]}, ${color[2]})`);
        });
    } catch (err) {
        console.error(err);
    }
}
getColors();
