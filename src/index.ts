import { Application } from "./application.js";
import { Vector3 } from "./math/vector3.js";
import { Renderer } from "./renderer/renderer.js";

const canvas = document.createElement("canvas");
canvas.id = "main";
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");

canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;

let mouseX = 0;
let mouseY = 0;
canvas.addEventListener("mousemove", e => {
	mouseX = e.clientX;
	mouseY = e.clientY;
});

canvas.addEventListener("click", e => {
	console.log(`${mouseX.toFixed(0)}, ${mouseY.toFixed(0)}`);
});

const renderer = new Renderer(canvas.id);
const app = new Application(renderer);

let lastTime = Date.now();
function animate() {
	requestAnimationFrame(animate);
	const now = Date.now();
	const dt = (now - lastTime) / 1000;

	renderer.clear(0);
	Application.mouseX = mouseX;
	Application.mouseY = mouseY;

	app.update(dt);

	lastTime = now;
}
animate();
