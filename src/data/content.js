// Static content: configurator options and station info texts.

export const COLORS = [
  { id: 'red', name: 'Racing Red', hex: '#c8121c' },
  { id: 'white', name: 'Glacier White', hex: '#e9edf0' },
  { id: 'black', name: 'Midnight Black', hex: '#0b0c0f' },
  { id: 'blue', name: 'Ocean Blue', hex: '#1747b5' },
  { id: 'green', name: 'Lime Green', hex: '#5dc21e' },
  { id: 'orange', name: 'Sunset Orange', hex: '#f4600f' },
  { id: 'grey', name: 'Gunmetal', hex: '#555c66' },
  { id: 'purple', name: 'Royal Purple', hex: '#5b23a0' },
  { id: 'yellow', name: 'Solar Yellow', hex: '#f5c400' },
];

export const WHEELS = [
  { id: 'sport', name: 'SPORT', desc: '5 bold spokes, alloy', mesh: 'wheel_sport' },
  { id: 'turbine', name: 'TURBINE', desc: '12 chrome blades', mesh: 'wheel_turbine' },
  { id: 'aero', name: 'AERO', desc: 'Closed aero dish', mesh: 'wheel_aero' },
];

export const EXTRAS = [
  { id: 'spoiler', name: 'SPOILER', desc: 'Rear wing, +downforce' },
  { id: 'roofrack', name: 'ROOF RACK', desc: 'Adventure ready' },
  { id: 'stripes', name: 'RACING STRIPES', desc: 'Twin centre stripes' },
];

// Index matches layout.json slots.
export const STATION_INFO = [
  {
    title: 'Loading Bay', step: 'STEP 0',
    body: 'Every GIGAWORKS car starts life as an empty, bright-yellow skid: the steel carrier that will hold the car through the whole line. A new skid enters the line every takt cycle and waits here for its build order.',
    facts: [['32 s', 'TAKT TIME'], ['8', 'SKIDS ON LINE'], ['1', 'CAR PER CYCLE']],
  },
  {
    title: 'Stamping', step: 'STEP 1 / 6',
    body: 'A 2,000-tonne servo press forms flat steel coils into 3-D body panels: floor, fenders, quarters, hood, trunk, roof, bumpers and doors. Each blank is fed in, struck once between the upper and lower die, and transferred onto the skid as a kit.',
    facts: [['2,000 t', 'PRESS FORCE'], ['12', 'PANELS / CAR'], ['0.7 mm', 'STEEL GAUGE']],
  },
  {
    title: 'Body Shop', step: 'STEP 2 / 6',
    body: 'Four six-axis robots pick each panel from the kit, hold it in its exact position and resistance-spot-weld it to the floor structure. The result is the "body in white": the bare, welded shell of your car.',
    facts: [['~4,000', 'SPOT WELDS'], ['±0.1 mm', 'ACCURACY'], ['10 kA', 'WELD CURRENT']],
  },
  {
    title: 'Paint Shop', step: 'STEP 3 / 6',
    body: 'Inside the pressurised, dust-free booth, electrostatic bell robots spray primer, the base colour you chose and a protective clearcoat. The clearcoat gives the deep, glossy, mirror-like finish.',
    facts: [['3', 'COATS'], ['120 µm', 'TOTAL FILM'], ['+21 °C', 'BOOTH CLIMATE']],
  },
  {
    title: 'Engine Marriage', step: 'STEP 4 / 6',
    body: 'The painted body is lifted by the overhead hanger while an automated guided vehicle (AGV) brings the complete drivetrain from below: engine, gearbox, driveshaft, axles and suspension. They are "married" and bolted together in one motion.',
    facts: [['412 hp', 'V8 OUTPUT'], ['18', 'BOLTS'], ['± 0.5 mm', 'ALIGNMENT']],
  },
  {
    title: 'Final Assembly', step: 'STEP 5 / 6',
    body: 'Robots and technicians hang the doors and mirrors, bond the glass, install seats and dashboard, fit the lights and finally mount your chosen wheels and extra. The car now looks complete for the first time.',
    facts: [['14', 'OPERATIONS'], ['4', 'WHEELS TORQUED'], ['120 Nm', 'WHEEL TORQUE']],
  },
  {
    title: 'Quality Check', step: 'STEP 6 / 6',
    body: 'A scanning gate sweeps laser and light beams across every surface to measure panel gaps, paint thickness and alignment, while all electrical systems are tested. Only a perfect car receives the green PASS.',
    facts: [['1,200', 'MEASUREMENTS'], ['0.05 mm', 'RESOLUTION'], ['100 %', 'INSPECTED']],
  },
  {
    title: 'Delivery Bay', step: 'DONE',
    body: 'Finished cars roll off the skid onto their own wheels. Yours is waiting in the striped delivery bay: walk up, press E to get in and drive it through the roll-up door onto the GIGAWORKS test track.',
    facts: [['432 m', 'TEST TRACK'], ['14', 'CORNERS'], ['1', 'LAP TO VALIDATE']],
  },
];

export const WORKER_LINES = [
  'Welcome to GIGAWORKS!',
  'Stay behind the yellow rail, please.',
  'Your car is coming along nicely!',
  'Have you seen the paint shop yet?',
  'Mind the forklifts!',
  'The press is my favourite. BOOM!',
  'Safety glasses on? Good.',
  'Another perfect body in white.',
  'Fancy colour choice!',
  'Takt time is everything here.',
];
