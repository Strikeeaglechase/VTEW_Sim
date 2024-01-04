import { Contact } from "./ew/contact.js";
import { ContactJVis } from "./ew/contactJammingVisulizer.js";
import { Jammer } from "./ew/jammer.js";
import { JEffectVisulizer } from "./ew/jammerEffectivenessVisulizer.js";
import { Missile } from "./ew/missile.js";
import { Radar } from "./ew/radar.js";
import { RadarDisplay } from "./ew/radarDisplay.js";
import { Vector3 } from "./math/vector3.js";
import { Renderer } from "./renderer/renderer.js";

const camPanSpeed = 100;
class Camera {
	public pos: Vector3 = new Vector3();

	static x = 0;
	static y = 0;
	static pos = new Vector3();
	public static instance: Camera = new Camera();

	private keys: Record<string, boolean> = {};

	private constructor() {
		window.addEventListener("keydown", e => (this.keys[e.key] = true));
		window.addEventListener("keyup", e => (this.keys[e.key] = false));
	}

	public update(dt: number) {
		Camera.x = this.pos.x;
		Camera.y = this.pos.y;
		Camera.pos.copy(this.pos);

		if (this.keys["ArrowUp"] || this.keys["w"]) this.pos.y -= camPanSpeed * dt;
		if (this.keys["ArrowDown"] || this.keys["s"]) this.pos.y += camPanSpeed * dt;
		if (this.keys["ArrowLeft"] || this.keys["a"]) this.pos.x -= camPanSpeed * dt;
		if (this.keys["ArrowRight"] || this.keys["d"]) this.pos.x += camPanSpeed * dt;
	}
}

const rscale = 0.005;
class Application {
	static instance: Application;

	private radars: Radar[] = [];
	private contacts: Contact[] = [];
	private jammers: Jammer[] = [];
	private missiles: Missile[] = [];

	private display: RadarDisplay;
	private jEffectVis: JEffectVisulizer;

	public contactOfInterest: Contact | null = null;

	public static mouseX = 0;
	public static mouseY = 0;

	private static debugValues: { [key: string]: any } = {};

	constructor(private renderer: Renderer) {
		Application.instance = this;

		const radar = new Radar(renderer, "F/A-26b");
		const contact = new Contact(renderer);
		const jammer = new Jammer(renderer, "Jammer");
		// const jammer2 = new Jammer(renderer, "J2");

		this.display = new RadarDisplay(renderer, radar, 700, 10, 400, 400);
		// this.jEffectVis = new JEffectVisulizer(renderer, radar, jammer);

		radar.position.set(200 / rscale, 0, renderer.ctx.canvas.height / 2 / rscale);
		contact.position.set(450 / rscale, 0, 250 / rscale);
		contact.velocity.set(200, 0, 40);

		jammer.position.set(656 / rscale, 0, 195 / rscale);
		jammer.target.copy(radar.position);
		// jammer2.position.set(656 / rscale, 0, 195 / rscale);
		// jammer2.target.copy(radar.position);

		const missileRadar = new Radar(renderer, "AIM-120");
		missileRadar.transmissionStrength = 5000;
		missileRadar.recieverSensitivity = 500;
		missileRadar.scanFov = 60;
		missileRadar.minDrawSize = 100;
		const missile = new Missile(renderer, missileRadar);
		missile.position.set(903 / rscale, 0, 631 / rscale);
		// missile.position.set(521 / rscale, 0, 311 / rscale);
		missile.velocity.set(-10, 0, -8);

		radar.aquireLock(contact, true);

		this.contactOfInterest = contact;

		this.radars.push(radar, missileRadar);
		this.contacts.push(contact);
		this.jammers.push(jammer);
		this.missiles.push(missile);
	}

	public update(dt: number) {
		Object.keys(Application.debugValues).forEach(k => (Application.debugValues[k] = "N/A"));

		if (this.jEffectVis) this.jEffectVis.update();

		this.jammers[0].runRGPOAgainst(this.radars[0], this.contacts[0], dt);

		Camera.instance.update(dt);
		this.radars.forEach(r => r.update(dt, this.contacts, this.jammers));
		this.contacts.forEach(c => c.update());
		this.jammers.forEach(j => j.update());
		this.missiles.forEach(m => m.update(dt));

		this.display.update(this.contacts);

		this.renderer.debugObject(Application.debugValues, 10, 10, 255);
	}

	static debug(name: string, val: any) {
		this.debugValues[name] = val;
	}
}

export { Application, Camera, rscale };
