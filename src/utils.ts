export const deg = (rad: number): number => rad * (180 / Math.PI);
export const rad = (deg: number): number => deg * (Math.PI / 180);
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const fixed = (value: number, digits: number = 2): string => value.toString().substr(0, digits + 2);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const meterToNm = (meters: number) => meters / 1852;
export const nmToMeter = (nm: number) => nm * 1852;
