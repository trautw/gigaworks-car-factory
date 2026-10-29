Build a complete, polished 3D browser experience called "GIGAWORKS" — a realistic car factory I can walk through in third-person view, where I order my own car, watch it being built step by step on the assembly line, and then drive it out of the factory onto a test track.

AUTONOMY RULES (critical)

* Do NOT ask me any questions. Do not ask for confirmation, preferences, or clarification at any point. Make every decision yourself.
* Do not stop until everything below works end to end without errors. If a tool or approach fails, find a workaround and keep going.
* Everything must be delivered from this single prompt. I will not give follow-up instructions.
* Keep a numbered log of every verification check you run (what you tested and the result) in BUILD_LOG.md.


TECH & ASSET RULES

* Three.js (installed via npm) + Vite. It must start with `npm install && npm run dev`.
* ALL 3D models (the factory building, robot arms, machines, conveyors, car parts, the finished car, the player character, workers) must be created by you in Blender, using Python scripts you write and run headless (`blender --background --python <script>.py`), exported as .glb into the project. Keep the Blender scripts in a /blender folder.
* The car must be built from separate parts (body panels, doors, hood, wheels, windows, seats, engine) so the assembly can really happen piece by piece.
* Do NOT download any models, textures, images, sounds, music or fonts from the internet. Textures must be procedural (shaders, canvas) or baked in Blender. Code libraries from npm are allowed.
* ALL sounds and music must be generated in code with the Web Audio API.


THE EXPERIENCE

1. Arrival: I start outside a huge modern car factory. Big "GIGAWORKS" sign, parking lot, glass entrance with automatic sliding doors.
2. Order terminal: inside the lobby there is a configurator kiosk. I pick body color, wheel style, and one extra (spoiler, roof rack or racing stripes). My order gets an order number and a live progress tracker in the HUD.
3. The assembly line — my car travels through every station on a moving conveyor, and I can walk alongside it and watch each step happen:
   * Stamping: a press stamps flat steel sheets into body panels.
   * Body shop: articulated robot arms weld the panels into a car body, with bright welding sparks and flashes.
   * Paint shop: the body goes through a paint booth and comes out in MY chosen color, with a glossy finish.
   * Engine marriage: the engine and drivetrain are lifted up from below and joined to the body.
   * Final assembly: doors, windows, seats, lights and my chosen wheels are attached one by one by robots and workers.
   * Quality check: a scanning gate with light beams inspects the car and shows a pass screen.
4. Drive out: when the car is finished, I can walk up to it, press E to get in, and drive it out of the factory through a big roll-up door onto an outdoor test track.
5. Test track: a short loop track with a lap timer. Driving must feel good: acceleration, braking, steering, suspension, drift on handbrake.


LIFE IN THE FACTORY

* Other cars (in random colors) are also moving along the line at different stages, so the factory feels busy.
* Workers walk around, operate machines, and react when I come close.
* Warning lights, moving forklifts, overhead cranes, info screens showing live production numbers.
* Interactive info panels at each station: press E to read what happens at that step.


PRESENTATION (make it look like a premium product, not a demo)

* Branded title screen and a real loading screen with progress.
* Realistic industrial lighting: big skylights, shadows, reflections on the car paint, bloom on welding sparks.
* Clean HUD: order number, current station of my car, progress bar, mini-map of the factory, controls hint.
* Sound: factory ambience, hydraulic press hits, welding buzz, spray paint hiss, robot servo sounds, engine sound that changes with speed when driving.
* Smooth third-person controls: WASD to walk, Shift to run, mouse to look, E to interact. Camera must not clip through walls.
* A finish screen after the first lap with my car, its color, the build time and lap time. Option to take a photo of my car and save it as an image.


QUALITY BAR & SELF-TESTING

* The whole flow (order → watch every station → get in → drive out → complete a lap) must be doable in about 5–7 minutes.
* Run the experience in a headless browser (e.g. Playwright), check for console errors, and take screenshots of the entrance, the configurator, each station, the finished car and the test track. Review the screenshots critically and improve visuals, animations and UI. Do at least two full improvement passes.
* Target 60 FPS on a normal laptop.
* When done, write a short README with controls and how to run it.
