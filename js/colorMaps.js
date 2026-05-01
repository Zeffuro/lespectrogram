// Color gradients for the spectrogram.
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function buildGradientMap(stops) {
    const map = [];
    for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let s0 = stops[0], s1 = stops[stops.length - 1];
        for (let j = 0; j < stops.length - 1; j++) {
            if (t >= stops[j][0] && t <= stops[j + 1][0]) {
                s0 = stops[j]; s1 = stops[j + 1]; break;
            }
        }
        const f = (t - s0[0]) / (s1[0] - s0[0] || 1);
        map.push([lerp(s0[1], s1[1], f), lerp(s0[2], s1[2], f), lerp(s0[3], s1[3], f), 255]);
    }
    map.push([0, 0, 0, 0]);
    return map;
}

const COLOR_MAPS = {
    JET:       null, // library default
    GRAYSCALE: buildGradientMap([[0,0,0,0],[1,255,255,255]]),
    HEAT:      buildGradientMap([[0,0,0,0],[0.33,180,0,0],[0.66,255,200,0],[1,255,255,255]]),
    MAGMA:     buildGradientMap([[0,0,0,4],[0.13,28,16,68],[0.25,79,18,123],[0.38,129,37,129],[0.5,181,54,122],[0.63,229,89,100],[0.75,251,136,97],[0.88,254,194,140],[1,252,253,191]]),
    PLASMA:    buildGradientMap([[0,13,8,135],[0.13,75,3,161],[0.25,125,3,168],[0.38,168,34,150],[0.5,203,70,121],[0.63,229,107,93],[0.75,248,148,65],[0.88,253,195,40],[1,240,249,33]]),
    CIVIDIS:   buildGradientMap([[0,0,32,77],[0.13,0,52,110],[0.25,39,72,108],[0.38,77,91,105],[0.5,109,112,108],[0.63,143,132,108],[0.75,181,155,96],[0.88,222,181,67],[1,253,231,37]]),
    VIRIDIS:   buildGradientMap([[0,68,1,84],[0.25,59,82,139],[0.5,33,145,140],[0.75,94,201,98],[1,253,231,37]]),
    INFERNO:   buildGradientMap([[0,0,0,4],[0.25,87,16,110],[0.5,188,55,84],[0.75,249,142,9],[1,252,255,164]])
};

const COLOR_NAMES = {
    JET: "Jet", GRAYSCALE: "Grayscale", HEAT: "Heat",
    MAGMA: "Magma", PLASMA: "Plasma", CIVIDIS: "Cividis (Colorblind)",
    VIRIDIS: "Viridis", INFERNO: "Inferno"
};

