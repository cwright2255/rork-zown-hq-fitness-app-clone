// app/body-scan/capture.jsx
//
// Turntable-style body scan capture: the user holds still while helper rotates phone around them,
// OR user rotates in place on a turntable / spinning spot.
//
// Key features: // - VisionCamera frame processor analyzing keypoint tracking or DeviceMotion orientation
// - Audio cues via voiceGuidanceService ("Turn slightly right", "Hold still", "Front complete")
// - Visual angle gauge / turntable progress wheel (0..360 deg)
// - Front / Side / Back automatic frame capture triggers
// - Mesh quality indicator (lighting, distance, blur score)