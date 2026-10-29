# GIGAWORKS

A 3D browser experience set in a car factory. You walk through it in third person, order your own car at a kiosk, follow it down a moving assembly line through six stations, then drive it out of the roll-up door onto a test track for a timed lap.

Built with Three.js and Vite. Everything in it is made in this repository:

- **Models:** every model was built in Blender from Python scripts (`/blender`).
- **Textures:** all procedural, drawn on canvas at runtime.
- **Sound and music:** synthesised live with the Web Audio API.
- **Assets:** nothing is downloaded from the internet.

## Run it

```bash
npm install && npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

## Controls

| On foot | |
|---|---|
| `W A S D` | walk |
| `Shift` | run |
| Mouse | look (click the view to capture the mouse; `Esc` releases it) |
| `E` | interact: kiosk, info panels, get in the car |
| `T` (hold) | fast-forward the assembly line ×6 |
| `M` | mute / unmute |

| In the car | |
|---|---|
| `W` | throttle |
| `S` | brake, or reverse when stopped |
| `A` / `D` | steer |
| `Space` | handbrake (drift) |
| `R` | reset onto the track |
| `E` | get out (when slow) |
| Mouse | orbit the chase camera |

## The flow (about 5–7 minutes)

1. **Arrival.** You start in the parking lot facing the GIGAWORKS factory. Walk through the automatic sliding doors into the glass lobby.
2. **Order.** At the configurator kiosk, press `E`. Pick a body colour, a wheel style and one extra (spoiler, roof rack or racing stripes), then place the order.
   - You get an order number.
   - The HUD shows a live tracker: current station, progress, ETA and a mini-map.
   - The display car on the lobby turntable previews your choices.
3. **The assembly line.** Your car rides a pulsed line (32 s takt) through six stations. Walk alongside it on the yellow walkway:
   - **Stamping:** a servo press stamps steel blanks into 12 body panels. A transfer robot lays them on the skid as a kit.
   - **Body shop:** four robots weld the panels into a body-in-white, with HDR sparks and flashes.
   - **Paint shop:** spray robots in the booth apply primer, your colour and a clearcoat. The car comes out glossy in your colour.
   - **Engine marriage:** an overhead hanger lifts the body, an AGV brings the drivetrain from below, and nut-runners bolt them together.
   - **Final assembly:** doors, mirrors, glass, seats and dashboard, lights, your wheels and your extra are fitted one by one.
   - **Quality check:** a scanning gate sweeps light beams over the car, the lights are tested, and the screen shows PASS.
4. **Drive out.** The car rolls off the skid into the striped delivery bay. Walk up and press `E` to get in, then drive through the roll-up door.
5. **Test track.** Cross the start line to start the timer, pass all three checkpoints and come back to the line. After your first lap a finish screen shows:
   - your car and its colour
   - the build time
   - the lap time and top speed
   - **Take photo**, which saves a branded PNG of your car.

Other cars in random colours fill the line at every stage. Around the hall:

- Workers operate consoles, patrol and wave or talk when you come close.
- Forklifts beep and stop if you step in front of them, and overhead cranes move crates.
- Station beacons spin while a station is working, and hanging screens show live production numbers.
- Every station has an info stand: press `E` to read about that step.

## Project layout

```
blender/            Blender Python scripts (headless) -> public/models/*.glb
  lib.py            shared bmesh helpers, materials, export, preview renders
  car.py            car built from separate parts (panels, doors, glass, seats, powertrain, wheels ×3, extras, skid)
  factory.py        hall, skylight roof, facade, sign, lobby, kiosk, doors, markings, fence
  machines.py       press, robot arm + tools, conveyor, paint booth, marriage lift, AGV, QC gate, forklift, crane, props
  characters.py     player + worker rigid-limb rigs
  outdoor.py        ground, parking, roads, test track ribbon + curbs, gantry, grandstand, trees
  build_all.sh      rebuild every model
scripts/gen_track.mjs   generates the track centreline used by Blender and the game
src/
  main.js           boot, loading, title, game states, interactions, photo, debug/test API
  line.js           pulsed assembly line and all six station animations
  carBuild.js       per-car part poses as a pure function of (station, progress)
  robots.js         robot arm with analytic 2-bone IK
  world.js          factory/outdoor setup, textures, colliders, doors, screens, display car, vegetation
  npc.js            workers, forklifts, cranes
  player.js         third-person controller + collision-aware camera
  vehicle.js        driving model (tyre slip forces, RWD, handbrake drift, suspension visuals)
  laps.js           lap timer with ordered checkpoints
  audio.js          Web Audio synthesis: ambience, press, weld, spray, servos, engine, tyres, UI, music
  hud.js / ui.js    HUD, mini-map, configurator, info panels, finish screen
tests/e2e.mjs       Playwright end-to-end test + screenshots
BUILD_LOG.md        numbered log of every verification check
```

## Rebuilding the models (optional)

The generated `.glb` files are already in `public/models`, so Blender is not needed to run the game. To regenerate them:

```bash
npm run models
```

This expects Blender at `/Applications/Blender.app`, or set the `BLENDER` environment variable.

## Tests

With `npm run dev` running in another terminal:

```bash
npx playwright install chromium   # one time
npm test
```

The test plays the whole flow headlessly:

- loads the game and walks in
- orders a car and visits every station
- reads an info panel
- gets in, drives a full lap using a built-in test autopilot
- takes the photo

It fails on any console error, page error or failed request. Screenshots are written to `tests/screens/`.

`npm run test:perf` measures uncapped FPS at 1440×900 @ DPR 2 (hall, body shop mid-weld, driving indoors, track) and asserts the camera never clips through walls, pillars or glass.
