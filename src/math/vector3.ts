import { Quaternion } from "./quaternion";
import { Matrix4 } from "./matrix4x4";
import { clamp, deg, fixed } from "../utils";

class Angles {
	public bearing: number = 0;
	public elevation: number = 0;

	constructor(bearing: number = 0, elevation: number = 0) {
		this.bearing = bearing;
		this.elevation = elevation;
	}

	toString(): string {
		return `(${this.bearing}, ${this.elevation})`;
	}
}

class Vector3 {
	public x: number;
	public y: number;
	public z: number;

	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	set(x: number, y: number, z: number): this {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	setScalar(scalar: number): this {
		this.x = scalar;
		this.y = scalar;
		this.z = scalar;
		return this;
	}

	setX(x: number): this {
		this.x = x;
		return this;
	}

	setY(y: number): this {
		this.y = y;
		return this;
	}

	setZ(z: number): this {
		this.z = z;
		return this;
	}

	setComponent(index: number, value: number): this {
		switch (index) {
			case 0:
				this.x = value;
				break;

			case 1:
				this.y = value;
				break;

			case 2:
				this.z = value;
				break;

			default:
				throw new Error("index is out of range: " + index);
		}

		return this;
	}

	getComponent(index: number): any {
		switch (index) {
			case 0:
				return this.x;

			case 1:
				return this.y;

			case 2:
				return this.z;

			default:
				throw new Error("index is out of range: " + index);
		}
	}

	clone(): Vector3 {
		return new Vector3(this.x, this.y, this.z);
	}

	copy(v: Vector3): this {
		this.x = v.x;
		this.y = v.y;
		this.z = v.z;
		return this;
	}

	add(v: Vector3): this {
		this.x += v.x;
		this.y += v.y;
		this.z += v.z;
		return this;
	}

	addScalar(s: number): this {
		this.x += s;
		this.y += s;
		this.z += s;
		return this;
	}

	addVectors(a: Vector3, b: Vector3): this {
		this.x = a.x + b.x;
		this.y = a.y + b.y;
		this.z = a.z + b.z;
		return this;
	}

	addScaledVector(v: Vector3, s: number): this {
		this.x += v.x * s;
		this.y += v.y * s;
		this.z += v.z * s;
		return this;
	}

	sub(v: Vector3): this {
		this.x -= v.x;
		this.y -= v.y;
		this.z -= v.z;
		return this;
	}

	subScalar(s: number): this {
		this.x -= s;
		this.y -= s;
		this.z -= s;
		return this;
	}

	subVectors(a: Vector3, b: Vector3): this {
		this.x = a.x - b.x;
		this.y = a.y - b.y;
		this.z = a.z - b.z;
		return this;
	}

	multiply(v: Vector3): this {
		this.x *= v.x;
		this.y *= v.y;
		this.z *= v.z;
		return this;
	}

	multiplyScalar(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		return this;
	}

	multiplyVectors(a: Vector3, b: Vector3): this {
		this.x = a.x * b.x;
		this.y = a.y * b.y;
		this.z = a.z * b.z;
		return this;
	}

	applyEuler(euler: Vector3, order: string = "XYZ"): this {
		return this.applyQuaternion(new Quaternion().setFromEuler(euler, order));
	}

	applyAxisAngle(axis: Vector3, angle: number): this {
		return this.applyQuaternion(new Quaternion().setFromAxisAngle(axis, angle));
	}

	applyQuaternion(q: Quaternion): this {
		const x = this.x,
			y = this.y,
			z = this.z;
		const qx = q.x,
			qy = q.y,
			qz = q.z,
			qw = q.w; // calculate quat * vector

		const ix = qw * x + qy * z - qz * y;
		const iy = qw * y + qz * x - qx * z;
		const iz = qw * z + qx * y - qy * x;
		const iw = -qx * x - qy * y - qz * z; // calculate result * inverse quat

		this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
		this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
		this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
		return this;
	}

	transformDirection(m: Matrix4): this {
		// input: THREE.Matrix4 affine matrix
		// vector interpreted as a direction
		const x = this.x,
			y = this.y,
			z = this.z;
		const e = m.elements;
		this.x = e[0] * x + e[4] * y + e[8] * z;
		this.y = e[1] * x + e[5] * y + e[9] * z;
		this.z = e[2] * x + e[6] * y + e[10] * z;
		return this.normalize();
	}

	setFromMatrixPosition(m: Matrix4): this {
		const e = m.elements;
		this.x = e[12];
		this.y = e[13];
		this.z = e[14];
		return this;
	}

	setFromMatrixScale(m: Matrix4): this {
		const sx = this.setFromMatrixColumn(m, 0).length();
		const sy = this.setFromMatrixColumn(m, 1).length();
		const sz = this.setFromMatrixColumn(m, 2).length();
		this.x = sx;
		this.y = sy;
		this.z = sz;
		return this;
	}

	setFromMatrixColumn(m: Matrix4, index: number): this {
		return this.fromArray(m.elements, index * 4);
	}

	setFromMatrix3Column(m: Matrix4, index: number): this {
		return this.fromArray(m.elements, index * 3);
	}

	setFromRotationMatrix(m: Matrix4, order: string): this {
		// assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
		const te = m.elements;
		const m11 = te[0],
			m12 = te[4],
			m13 = te[8];
		const m21 = te[1],
			m22 = te[5],
			m23 = te[9];
		const m31 = te[2],
			m32 = te[6],
			m33 = te[10];

		if (order == "XYZ") {
			this.y = Math.asin(clamp(m13, -1, 1));

			if (Math.abs(m13) < 0.9999999) {
				this.x = Math.atan2(-m23, m33);
				this.z = Math.atan2(-m12, m11);
			} else {
				this.x = Math.atan2(m32, m22);
				this.z = 0;
			}
		} else if (order == "YXZ") {
			this.x = Math.asin(-clamp(m23, -1, 1));

			if (Math.abs(m23) < 0.9999999) {
				this.y = Math.atan2(m13, m33);
				this.z = Math.atan2(m21, m22);
			} else {
				this.y = Math.atan2(-m31, m11);
				this.z = 0;
			}
		} else if (order == "ZXY") {
			this.x = Math.asin(clamp(m32, -1, 1));

			if (Math.abs(m32) < 0.9999999) {
				this.y = Math.atan2(-m31, m33);
				this.z = Math.atan2(-m12, m22);
			} else {
				this.y = 0;
				this.z = Math.atan2(m21, m11);
			}
		} else if (order == "ZYX") {
			this.y = Math.asin(-clamp(m31, -1, 1));

			if (Math.abs(m31) < 0.9999999) {
				this.x = Math.atan2(m32, m33);
				this.z = Math.atan2(m21, m11);
			} else {
				this.x = 0;
				this.z = Math.atan2(-m12, m22);
			}
		} else if (order == "YZX") {
			this.z = Math.asin(clamp(m21, -1, 1));

			if (Math.abs(m21) < 0.9999999) {
				this.x = Math.atan2(-m23, m22);
				this.y = Math.atan2(-m31, m11);
			} else {
				this.x = 0;
				this.y = Math.atan2(m13, m33);
			}
		} else if (order == "XZY") {
			this.z = Math.asin(-clamp(m12, -1, 1));

			if (Math.abs(m12) < 0.9999999) {
				this.x = Math.atan2(m32, m22);
				this.y = Math.atan2(m13, m11);
			} else {
				this.x = Math.atan2(-m23, m33);
				this.y = 0;
			}
		} else {
			console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
		}

		return this;
	}

	divide(v: Vector3): this {
		this.x /= v.x;
		this.y /= v.y;
		this.z /= v.z;
		return this;
	}

	divideScalar(scalar: number): this {
		return this.multiplyScalar(1 / scalar);
	}

	min(v: Vector3): this {
		this.x = Math.min(this.x, v.x);
		this.y = Math.min(this.y, v.y);
		this.z = Math.min(this.z, v.z);
		return this;
	}

	max(v: Vector3): this {
		this.x = Math.max(this.x, v.x);
		this.y = Math.max(this.y, v.y);
		this.z = Math.max(this.z, v.z);
		return this;
	}

	clamp(min: Vector3, max: Vector3): this {
		// assumes min < max, componentwise
		this.x = Math.max(min.x, Math.min(max.x, this.x));
		this.y = Math.max(min.y, Math.min(max.y, this.y));
		this.z = Math.max(min.z, Math.min(max.z, this.z));
		return this;
	}

	clampScalar(minVal: number, maxVal: number): this {
		this.x = Math.max(minVal, Math.min(maxVal, this.x));
		this.y = Math.max(minVal, Math.min(maxVal, this.y));
		this.z = Math.max(minVal, Math.min(maxVal, this.z));
		return this;
	}

	clampLength(min: number, max: number): this {
		const length = this.length();
		return this.divideScalar(length || <number>1).multiplyScalar(Math.max(min, Math.min(max, length)));
	}

	floor(): this {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		this.z = Math.floor(this.z);
		return this;
	}

	ceil(): this {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		this.z = Math.ceil(this.z);
		return this;
	}

	round(): this {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		this.z = Math.round(this.z);
		return this;
	}

	roundToZero(): this {
		this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
		this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
		this.z = this.z < 0 ? Math.ceil(this.z) : Math.floor(this.z);
		return this;
	}

	negate(): this {
		this.x = -this.x;
		this.y = -this.y;
		this.z = -this.z;
		return this;
	}

	dot(v: Vector3): number {
		return this.x * v.x + this.y * v.y + this.z * v.z;
	} // TODO lengthSquared?

	lengthSq(): number {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}

	length(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	manhattanLength(): number {
		return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
	}

	normalize(): this {
		return this.divideScalar(this.length() || 1);
	}

	setLength(length: number): this {
		return this.normalize().multiplyScalar(length);
	}

	lerp(v: Vector3, alpha: number): this {
		this.x += (v.x - this.x) * alpha;
		this.y += (v.y - this.y) * alpha;
		this.z += (v.z - this.z) * alpha;
		return this;
	}

	lerpVectors(v1: Vector3, v2: Vector3, alpha: number): this {
		this.x = v1.x + (v2.x - v1.x) * alpha;
		this.y = v1.y + (v2.y - v1.y) * alpha;
		this.z = v1.z + (v2.z - v1.z) * alpha;
		return this;
	}

	cross(v: Vector3): this {
		return this.crossVectors(this, v);
	}

	crossVectors(a: Vector3, b: Vector3): this {
		const ax = a.x,
			ay = a.y,
			az = a.z;
		const bx = b.x,
			by = b.y,
			bz = b.z;
		this.x = ay * bz - az * by;
		this.y = az * bx - ax * bz;
		this.z = ax * by - ay * bx;
		return this;
	}

	projectOnVector(v: Vector3): this {
		const denominator = v.lengthSq();
		if (denominator === 0) return this.set(0, 0, 0);
		const scalar = v.dot(this) / denominator;
		return this.copy(v).multiplyScalar(scalar);
	}

	reflect(normal: Vector3): this {
		// reflect incident vector off plane orthogonal to normal
		// normal is assumed to have unit length
		return this.sub(new Vector3().copy(normal).multiplyScalar(2 * this.dot(normal)));
	}

	angleTo(v: Vector3): number {
		const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
		if (denominator === 0) return Math.PI / 2;
		const theta = this.dot(v) / denominator; // clamp, to handle numerical problems

		return Math.acos(clamp(theta, -1, 1));
	}

	distanceTo(v: Vector3): number {
		return Math.sqrt(this.distanceToSquared(v));
	}

	distanceToSquared(v: Vector3): number {
		const dx = this.x - v.x,
			dy = this.y - v.y,
			dz = this.z - v.z;
		return dx * dx + dy * dy + dz * dz;
	}

	manhattanDistanceTo(v: Vector3): number {
		return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
	}

	setFromSphericalCoords(radius: number, phi: number, theta: number): this {
		const sinPhiRadius = Math.sin(phi) * radius;
		this.x = sinPhiRadius * Math.sin(theta);
		this.y = Math.cos(phi) * radius;
		this.z = sinPhiRadius * Math.cos(theta);
		return this;
	}

	equals(v: Vector3): boolean {
		return v.x === this.x && v.y === this.y && v.z === this.z;
	}

	fromArray(array: number[], offset = 0): this {
		this.x = array[offset];
		this.y = array[offset + 1];
		this.z = array[offset + 2];
		return this;
	}

	toArray(array: number[] = [], offset = 0): any[] {
		array[offset] = this.x;
		array[offset + 1] = this.y;
		array[offset + 2] = this.z;
		return array;
	}

	random(): this {
		this.x = Math.random();
		this.y = Math.random();
		this.z = Math.random();
		return this;
	}

	randomDirection(): this {
		// Derived from https://mathworld.wolfram.com/SpherePointPicking.html
		const u = (Math.random() - 0.5) * 2;
		const t = Math.random() * Math.PI * 2;
		const f = Math.sqrt(1 - u ** 2);
		this.x = f * Math.cos(t);
		this.y = f * Math.sin(t);
		this.z = u;
		return this;
	}

	angles(): Angles {
		let bearing = deg(Math.atan2(this.z, this.x));
		let elevation = deg(Math.atan(-this.y / Math.sqrt(this.x * this.x + this.z * this.z)));

		if (bearing < 0) bearing += 360;
		bearing %= 360;

		elevation = clamp(elevation, -90, 90);

		const angles: Angles = new Angles(bearing, elevation);

		return angles;
	}

	toString(): string {
		return `(${this.x}, ${this.y}, ${this.z})`;
	}

	str(dig: number = 2): string {
		return `(${fixed(this.x, dig)}, ${fixed(this.y, dig)}, ${fixed(this.z, dig)})`;
	}
}

export { Vector3 };
