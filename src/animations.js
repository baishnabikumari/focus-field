export const Easing = {
    easeOutCubic: (t) => 1-Math.pow(1 - t, 3),
    easeInOutCubic: (t) => (t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2),
    linear: (t) => t
};

export const FeelPresets = {
    A:{
        rotateDuration: 240,
        hoverGlow: 0.28,
        moveEase: Easing.easeInOutCubic
    },
    B:{
        rotateDuration:140,
        hoverGlow:0.35,
        moveEase:Easing.easeOutCubic
    },
    C:{
        rotateDuration:80,
        hoverGlow:0.15,
        moveEase:Easing.linear
    }
};