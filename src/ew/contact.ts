import { Application, Camera, rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { Color } from "../renderer/color.js";
import { Renderer } from "../renderer/renderer.js";
import { DummyRCS, FA26bRCS, RCSProvider } from "./rcs.js";

const color = new Color([0, 50, 250]);
class Contact {
	public position: Vector3 = new Vector3();
	public velocity: Vector3 = new Vector3();

	constructor(private renderer: Renderer, public rcs: RCSProvider = new FA26bRCS(), public name: string = "Contact") {}

	public update() {
		this.position.set(Application.mouseX / rscale, 0, (Application.mouseY - 50) / rscale);
		this.draw();
	}

	private draw() {
		const x = this.position.x * rscale - Camera.x;
		const y = this.position.z * rscale - Camera.y;

		this.renderer.strokeEllipse(x, y, 5, 5, color);
		const velSize = 15;
		const velNorm = this.velocity.clone().normalize();
		const velX = x + velNorm.x * velSize;
		const velY = y + velNorm.z * velSize;

		this.renderer.line(x, y, velX, velY, color);
		const textWid = this.renderer.textWidth(this.name, 10);
		this.renderer.text(this.name, x - textWid / 2, y + 20, 150, 10);
	}
}

export { Contact };
