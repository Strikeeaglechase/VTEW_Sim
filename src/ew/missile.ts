import { rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { Color } from "../renderer/color.js";
import { Renderer } from "../renderer/renderer.js";
import { nmToMeter } from "../utils.js";
import { Contact } from "./contact.js";
import { Radar } from "./radar.js";

const maxSpeed = nmToMeter(3); // 3 miles per second
const acceleration = 3000; // 200 m/s^2
const color = new Color([255, 0, 0]);

class Missile {
	public position: Vector3 = new Vector3();
	public velocity: Vector3 = new Vector3();

	private targetPosition: Vector3;
	private targetVelocity: Vector3;

	constructor(private renderer: Renderer, private radar: Radar) {}

	public update(dt: number) {
		// this.runPhysics(dt);
		this.draw();

		this.radar.position.copy(this.position);
		this.radar.rotation = this.getScanDir();

		let closestDetectedTarget: Contact;
		let closestDistance = Infinity;
		this.radar.detectedContacts.forEach(contact => {
			const distance = contact.position.distanceTo(this.targetPosition ?? this.position);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestDetectedTarget = contact;
			}
		});

		if (closestDetectedTarget) {
			const lock = this.radar.aquireLock(closestDetectedTarget, false);
			if (lock) {
				this.targetPosition = lock.position;
				this.targetVelocity = lock.velocity;
			}
		}
	}

	private draw() {
		const x = this.position.x * rscale;
		const y = this.position.z * rscale;

		const size = 3;
		this.renderer.strokeTriangle(x - size, y, x + size, y, x, y + size, color);
	}

	private getScanDir() {
		if (this.targetPosition) return this.targetPosition.clone().sub(this.position).normalize().angles().bearing - this.radar.scanFov / 2;
		else return this.velocity.clone().normalize().angles().bearing - this.radar.scanFov / 2;
	}

	private runPhysics(dt: number) {
		let accelerationVector: Vector3;
		if (this.targetPosition) accelerationVector = this.position.clone().sub(this.targetPosition).normalize().multiplyScalar(-acceleration);
		else accelerationVector = this.velocity.clone().normalize().multiplyScalar(acceleration);

		this.velocity.add(accelerationVector.multiplyScalar(dt));
		this.velocity.clampLength(0, maxSpeed);
		this.position.add(this.velocity.clone().multiplyScalar(dt));
	}
}

export { Missile };
