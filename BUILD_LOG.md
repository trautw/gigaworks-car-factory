# GIGAWORKS – Build & Verification Log

Numbered log of every verification check run during the build (what was tested → result).

1. Tooling check: Blender 4.3.2 at /Applications/Blender.app (headless OK), Node v23.6.1, npm OK → PASS
2. Playwright Chromium headless WebGL2 probe → renderer "ANGLE (Apple, ANGLE Metal Renderer: Apple M3)" with Metal flags, GPU path available → PASS
3. Track generator `scripts/gen_track.mjs` → 431.9 m closed loop, 216 centreline points written to src/data/track.json → PASS
4. `blender/car.py` headless run → car.glb exported (≈377 KB); workbench previews rendered (front/rear/side/inside) → PASS after fixes
5. Visual review of car previews → found engine poking through hood and seat headrests through roof; lowered powertrain + seats → re-render clean → PASS
6. Visual review of nose/tail → headlights buried in body, odd chrome boxes at rear; moved lights, removed boxes → re-render OK → PASS
7. `blender/factory.py` → factory.glb exported (≈1.1 MB); preview from parking lot shows facade, GIGAWORKS sign, glass lobby; top view shows trusses/skylights/markings → PASS
8. `blender/machines.py` → machines.glb exported (press, robot arm chain, tools, conveyor, paint booth, marriage lift, AGV, QC gate, forklift, crane, stands, racks) → PASS
9. `blender/characters.py` → characters.glb (player + worker rigid-limb rigs) preview OK → PASS
10. `blender/outdoor.py` → outdoor.glb (ground, parking, roads, track ribbon + curbs, gantry, grandstand, tyre walls, trees, poles, cones) top-view preview OK → PASS
11. `npx vite build` production bundle → builds cleanly (39 modules) → PASS
12. Smoke test (tests/smoke.mjs) headless Chromium: load → title → start → 60.5 FPS, 0 console errors → PASS
13. Review of first screenshots → scene washed out (bloom threshold caught sunlit white surfaces, fog too dense, parked-car headlights glowing) → raised bloom threshold to 2.6 (only HDR emissives bloom), lowered exposure/sun, lengthened fog, parked cars lights off → FIXED
14. e2e run #1 (tests/e2e.mjs) → FAIL: player blocked at entrance (door header box above head height blocked 2-D movement) → movement collision now ignores boxes starting above 2 m → FIXED
15. e2e run #1 → FAIL: get-in prompt (test stood 4.5 m away, info stand closer) → test position corrected; car prompt has priority within 3.6 m → FIXED
16. Screenshot review: outdoor instancing templates (tree/pole/cone/board) rendered at world origin inside the paint shop → detached templates from scene → FIXED
17. Screenshot review: paint-booth glass rendered opaque light-blue (glTF alpha not applied) → generic material pass makes *Glass*/Curtain/BeaconLens transparent, double-sided, no depth write → FIXED
18. Screenshot review: car looked like a convertible (glass too transparent, roof cut plane 1.28 m left only a sliver) → roof cut lowered to 1.22 m (Blender), glass tinted darker/opacity 0.82 → FIXED
19. Screenshot review: QC result screen placed in the walkway blocking the view → moved behind the gate on the north side → FIXED
20. e2e run #2 → FAIL: entering the car immediately exited it (E handled twice in the same frame) → E consumed on interaction → FIXED
21. e2e run #3 → FAIL: autopilot (test driver) wandered onto grass, no lap within 150 s; grass drag far too strong → analog-steer autopilot with corner speed planning, grass rolling drag ×2.5 instead of ×6 → drive log shows full lap 24.6 s → FIXED
22. e2e run #4 → FAIL at start (Vite full-page reload mid-test after source edits; not a game bug) → re-run
23. e2e run #5 → ALL 21 CHECKS PASSED: loads 0.9 s, 61 FPS entrance, walk through sliding doors, kiosk prompt, configurator order GW-xxxxx, HUD tracker, car reaches all 6 stations, info panel open/close with E, delivery, get-in prompt, drive mode, 60 FPS on track, drove out + completed lap (24.6 s), photo PNG download, 0 console/page errors / failed requests → PASS

## Improvement pass 1
24. Review: player spawned inside a parking bay (camera clipped a parked car) → spawn moved to the drive aisle (z=39) → FIXED
25. Review: lap timer overlapped the objective banner while driving; order panel too bulky in the car → timer moved below banner, panel compacts in drive mode → FIXED
26. Review: paint booth interior dim, mist barely visible → booth point light, mist particles larger/denser/more opaque → FIXED
27. Physics probe (tests via keyboard on the main straight) → FAIL: top speed capped at 85 km/h (rolling resistance ×10 bug) → fixed rolling term; re-probe: 0-100 km/h ≈ 5 s, 126 km/h at end of straight, handbrake + steer gives drift (yaw 2–3 rad/s), brakes 96→52 km/h in 2 s → PASS
28. Physics probe exposed page error "Cannot read properties of undefined (reading 'distanceToSquared')" in Forklift.update → root cause: first rAF timestamp earlier than seed time ⇒ negative dt ⇒ negative curve parameter ⇒ NaN → dt clamped to [0, 0.05], forklift path parameter wrapped positively; 600 s soak via ff() shows no NaN → FIXED
29. e2e → FAIL: lap not completed — faster car + long autopilot lookahead cut the west hairpin across grass (checkpoint correctly rejected the cut) → shorter lookahead, earlier braking; checkpoint radius 20 m
30. Drive log → car spun repeatedly under throttle: traction-circle removed up to 60 % of rear grip → softened (min 70 % lateral grip under full power) → autopilot lap 31.9 s with no spins → FIXED
31. e2e run → ALL 21 CHECKS PASSED (lap 30.4 s, 61 FPS track, photo download, 0 errors) → PASS

## Improvement pass 2
32. Review of title: sky flat grey (Sky shader viewed away from the sun), title text covered the facade sign → procedural gradient sky dome with sun glow, title block moved to the upper third, title camera reframed → blue sky, sign visible below title → FIXED
33. Review: GIGAWORKS facade letters smeared by bloom → sign emissive lowered (2.4) → readable glow → FIXED
34. Review of photo: headlight bloom too large → headlight emissive + bloom strength reduced → FIXED
35. Added a floating marker (Blender model `marker` in machines.glb) above the finished car until first entered → machines.glb re-exported → PASS
36. Added third-person "player view" screenshots of every station from the walkway → review: all six stations readable through the safety rail; workers wave + speech bubble when approached ("Mind the forklifts!") → default camera pitch lowered so stations fill more of the frame → PASS
37. Added Web Audio check to e2e → AudioContext state "running" with all procedural loops → PASS
38. Clean install: `rm -rf node_modules dist && npm install && npm run dev` → Vite ready in 525 ms, index 200, /models/car.glb 200 (376 KB); playwright has no postinstall download → PASS
39. Final e2e on the fresh install → ALL 23 CHECKS PASSED (title 1.0 s, 61 FPS entrance, 60 FPS track, lap 30.3 s, photo download, audio running, 0 console/page errors) → PASS
40. `npx vite build` → production bundle OK (705 KB JS, 191 KB gzip) → PASS

## Timing budget (by design, verified by the e2e state log)
Walk to kiosk ≈ 15 s, configure ≈ 20–40 s, wait at loading bay ≤ 32 s, 6 stations × 32 s = 192 s, roll-off ≈ 10 s, drive out ≈ 15 s, lap ≈ 30–40 s → ≈ 5–7 min end to end (hold T to fast-forward the line).

## Final verification (performance, camera, lighting)
41. Perf test (tests/perf.mjs, 1440×900 @ DPR 2 → render pixel ratio 1.5, vsync + frame limiter disabled): entrance 69 FPS, body shop mid-weld 75, west end looking down the whole line 75, driving in hall 75, track 81 (≈1000–1300 draw calls incl. shadow pass, ≤0.7 M tris) → PASS (headroom above 60)
42. Draw-call reduction: small car parts (interior, trims, lights, glass, powertrain, extras), brakes and sheet stack no longer cast shadows → hall views −140 draw calls → PASS
43. Camera collision → FAIL: camera pushed 0.1 m through the west wall at point-blank range (0.6 m minimum camera distance) → minimum lowered to 0.15 m (player hidden when that close); car camera minimum 0.3 m → re-test: west wall x=-59.10 (face −59.4) PASS, pillar PASS, lobby glass partition PASS (glass now blocks the camera; was flagged camera-transparent), facade glass from outside PASS, car chase camera swung toward east wall max x=57.56 PASS
44. Shadow frustum light-leak check (±80 m box vs 120 m hall): inside the hall the shadow frustum is now centred on the hall instead of the player; screenshots from the lobby gate looking east and from the delivery bay looking west show uniform roof shadow along the whole hall → PASS
45. Facade sign emissive raised to 3.2 (above the 2.6 bloom threshold) so it glows again → PASS
46. Final-assembly technician now walks to the install point and works on seats and right-side wheels (spec: "attached by robots and workers") → PASS
47. Final e2e after all changes → ALL 23 CHECKS PASSED, 0 errors → PASS
