
/* ================================================================
Curriculum data and map layout
================================================================ */
const COURSES = window.CURRICULUM_COURSES;
if (!Array.isArray(COURSES) || COURSES.length === 0) {
  throw new Error("The curriculum database contains no courses.");
}
const STORE_KEY = 'feu-bsce-curriculum-progress-v2';
const THEME_KEY = 'feu-curriculum-theme';
const COL_W = 282,
  ROW_H = 128,
  BOX_W = 220,
  BOX_H = 92,
  PAD_X = 65,
  PAD_Y = 86;
const byTerm = {};
COURSES.forEach(c => (byTerm[c.term] ??= []).push(c));
const maxRows = Math.max(...Object.values(byTerm).map(a => a.length));
const termCount = Math.max(...COURSES.map(c => c.term));
const pos = {};
for (const [term, arr] of Object.entries(byTerm)) {
  const offset = (maxRows - arr.length) * ROW_H / 2;
  arr.forEach((c, i) => pos[c.id] = {
	x: PAD_X + (term - 1) * COL_W,
	y: PAD_Y + offset + i * ROW_H
  });
}
const worldW = PAD_X * 2 + (termCount - 1) * COL_W + BOX_W, worldH = PAD_Y * 2 + maxRows * ROW_H;
let taken = new Set();
try {
  const saved = JSON.parse(
    localStorage.getItem(STORE_KEY) || "[]",
  );

  taken = new Set(
    saved.filter((id) =>
      COURSES.some((course) => course.id === id),
    ),
  );
} catch {
  taken = new Set();
}
const world = document.querySelector('#world'),
  svg = document.querySelector('#edges'),
  viewport = document.querySelector('#viewport');
world.style.width = worldW + 'px';
world.style.height = worldH + 'px';
svg.setAttribute('width', worldW);
svg.setAttribute('height', worldH);
const termNames = ['1st Term', '2nd Term', '3rd Term'];
for (let t = 1; t <= termCount; t++) {
  const label = document.createElement('div');
  label.className = 'term-label';
  label.style.left = (PAD_X + (t - 1) * COL_W) + 'px';
  label.style.top = (PAD_Y - 48) + 'px';
  label.style.width = BOX_W + 'px';
  label.innerHTML = `Year ${Math.ceil(t/3)}<small>${termNames[(t-1)%3]}</small>`;
  world.append(label);
}
const NS = 'http://www.w3.org/2000/svg';
/* Draw prerequisite and co-requisite connections behind the cards. */
function addEdge(from, to, type) {
  const a = pos[from],
	b = pos[to];
  if (!a || !b) return;
  const x1 = a.x + BOX_W,
	y1 = a.y + BOX_H / 2,
	x2 = b.x,
	y2 = b.y + BOX_H / 2,
	dx = Math.max(35, (x2 - x1) / 2);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', `M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`);
  path.setAttribute('class', 'edge ' + type);
  path.dataset.from = from;
  path.dataset.to = to;
  svg.append(path);
}
COURSES.forEach(c => {
  c.prereq.forEach(p => addEdge(p, c.id, 'prereq'));
  c.coreq.forEach(p => addEdge(p, c.id, 'coreq'));
});
const courseById = Object.fromEntries(COURSES.map(c => [c.id, c]));

function requirementsText(c) {
  const fmt = ids => ids.map(id => courseById[id]?.code || id).join(', ');
  return [c.prereq.length && `Prerequisite: ${fmt(c.prereq)}`, c.coreq.length && `Co-requisite: ${fmt(c.coreq)}`].filter(Boolean).join(' · ') || 'No prerequisites';
}

function unitLabel(c) {
  return c.labUnits ? `${c.lectureUnits}+${c.labUnits}L` : `${c.units}u`;
}

function unitLong(c) {
  return c.labUnits ? `${c.lectureUnits} lecture plus ${c.labUnits} laboratory units` : `${c.units} units`;
}
/* Build accessible, keyboard-operable course cards. */
COURSES.forEach(c => {
  const box = document.createElement('button');
  box.type = 'button';
  box.className = 'course cat-' + c.cat;
  box.dataset.id = c.id;
  box.style.left = pos[c.id].x + 'px';
  box.style.top = pos[c.id].y + 'px';
  box.title = requirementsText(c);
  box.setAttribute('aria-pressed', taken.has(c.id));
  box.innerHTML = `<span class="check">✓</span><span class="code-row"><span class="code">${c.code}</span><span class="units">${unitLabel(c)}</span></span><span class="name">${c.name}</span>`;
  box.addEventListener('mouseenter', () => highlight(c.id, true));
  box.addEventListener('mouseleave', () => highlight(c.id, false));
  box.addEventListener('focus', () => highlight(c.id, true));
  box.addEventListener('blur', () => highlight(c.id, false));
  box.addEventListener('click', e => {
	if (e.detail === 0) activateCourse(c.id)
  });
  world.append(box);
});

function highlight(id, on) {
  document.querySelectorAll('.edge').forEach(e => {
	if (e.dataset.from === id || e.dataset.to === id) e.classList.toggle('highlight', on)
  });
}

function isAvailable(c) {
  return c.prereq.every(id => taken.has(id));
}

function save() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify([...taken]),
    );
  } catch {
    // Completion still works for the current session when
    // browser storage is unavailable.
  }
}

function toggle(id) {
  taken.has(id) ? taken.delete(id) : taken.add(id);
  save();
  render();
}
/* Prerequisite mode recursively isolates the selected course lineage. */
let prereqMode = false,
  prereqFocus = null;

function prerequisiteChain(id) {
  const found = new Set([id]),
	visit = courseId => {
	  const c = courseById[courseId];
	  if (!c) return;
	  c.prereq.forEach(parent => {
		if (!found.has(parent)) {
		  found.add(parent);
		  visit(parent);
		}
	  });
	};
  visit(id);
  return found;
}

function activateCourse(id) {
  if (prereqMode) {
	prereqFocus = prereqFocus === id ? null : id;
	applyPrereqMode();
  } else toggle(id);
}

function applyPrereqMode() {
  const focus = prereqMode && prereqFocus ? prerequisiteChain(prereqFocus) : null;
  document.querySelectorAll('.course').forEach(box => {
	const dim = !!focus && !focus.has(box.dataset.id);
	box.classList.toggle('prereq-dim', dim);
	box.classList.toggle('prereq-selected', !!focus && box.dataset.id === prereqFocus);
	box.removeAttribute('aria-disabled');
  });
  document.querySelectorAll('.edge').forEach(edge => {
	const active = !!focus && focus.has(edge.dataset.from) && focus.has(edge.dataset.to);
	edge.classList.toggle('prereq-dim', !!focus && !active);
	edge.classList.toggle('prereq-focus', active);
  });
}
const el = id => document.getElementById(id);
/* Keep the toggle label synchronized with the active document theme. */
function syncThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  el('themeBtn').setAttribute('aria-pressed', String(dark));
  el('themeBtn').textContent = dark ? '☀︎' : '⏾';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
	localStorage.setItem(THEME_KEY, next);
  } catch {}
  syncThemeButton();
}
const cats = {
  ged: {
	list: el('listGED'),
	sub: el('subGED'),
	count: el('countGED'),
	label: 'GED / NSTP'
  },
  coe: {
	list: el('listCOE'),
	sub: el('subCOE'),
	count: el('countCOE'),
	label: 'COE'
  },
  ce: {
	list: el('listCE'),
	sub: el('subCE'),
	count: el('countCE'),
	label: 'CE'
  }
};
/* Recalculate course counts, units, progress, and summary scroll spacing. */
function render() {
  document.querySelectorAll('.course').forEach(box => {
	const c = courseById[box.dataset.id],
	  done = taken.has(c.id);
	box.classList.toggle('taken', done);
	box.classList.toggle('unavailable', !done && !isAvailable(c));
	box.setAttribute('aria-pressed', done);
	box.setAttribute('aria-label', `${done?'Completed':'Not completed'}: ${c.code}, ${c.name}, ${unitLong(c)}. ${requirementsText(c)}`)
  });
  document.querySelectorAll('.edge').forEach(e => e.classList.toggle('satisfied', taken.has(e.dataset.from)));
  let leftUnits = 0;
  for (const [key, ui] of Object.entries(cats)) {
	const remaining = COURSES.filter(c => c.cat === key && !taken.has(c.id)),
	  units = remaining.reduce((n, c) => n + c.units, 0);
	leftUnits += units;
	ui.list.innerHTML = remaining.length ? remaining.map(c => `<li><span><span class="lcode">${c.code}</span>${c.name}</span><span class="lunits">${unitLabel(c)}</span></li>`).join('') : `<li class="empty">All ${ui.label} subjects completed.</li>`;
	ui.sub.textContent = units + ' units';
	ui.count.textContent = remaining.length + ' left';
	ui.list.classList.toggle('has-scrollbar', ui.list.scrollHeight > ui.list.clientHeight);
  }
  const totalUnits = COURSES.reduce((n, c) => n + c.units, 0),
	doneUnits = totalUnits - leftUnits,
	pct = totalUnits ? Math.round(doneUnits / totalUnits * 100) : 0;
  el('grandTotal').innerHTML = `${leftUnits} <small>units</small>`;
  el('progressUnits').textContent = `${doneUnits} / ${totalUnits}`;
  el('progressPct').textContent = pct + '%';
  el('progressFill').style.width = pct + '%';
  el('leftCourses').textContent = COURSES.length - taken.size;
  el('doneCourses').textContent = taken.size;
  el('eligibleCourses').textContent = COURSES.filter(c => !taken.has(c.id) && isAvailable(c)).length;
  applyPrereqMode();
}
el('search').addEventListener('input', () => {
  const q = el('search').value.trim().toLowerCase();
  document.querySelectorAll('.course').forEach(box => {
	const c = courseById[box.dataset.id],
	  hit = !q || `${c.code} ${c.name}`.toLowerCase().includes(q);
	box.classList.toggle('search-miss', !hit);
	box.classList.toggle('search-hit', !!q && hit)
  });
});
/* ================================================================
   Pan and zoom gestures
   The fitted scale is also the maximum zoom-out level.
   ================================================================ */
let scale = 1,
  minScale = .2,
  tx = 0,
  ty = 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function transform() {
  const moving = world.classList.contains('gesturing'),
	dpr = window.devicePixelRatio || 1,
	drawX = moving ? tx : Math.round(tx * dpr) / dpr,
	drawY = moving ? ty : Math.round(ty * dpr) / dpr;
  world.style.transform = moving ? `translate3d(${drawX}px,${drawY}px,0) scale(${scale})` : `translate(${drawX}px,${drawY}px) scale(${scale})`;
  world.classList.toggle('overview', scale <= Math.max(minScale * 1.18, .55));
}

function fit() {
  const w = viewport.clientWidth,
	h = viewport.clientHeight;
  minScale = Math.min(Math.min(w / worldW, h / worldH) * .94, 2.5);
  scale = minScale;
  tx = (w - worldW * scale) / 2;
  ty = (h - worldH * scale) / 2;
  transform();
}

function zoomAt(mult, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
  const next = clamp(scale * mult, minScale, 2.5),
	wx = (x - tx) / scale,
	wy = (y - ty) / scale;
  tx = x - wx * next;
  ty = y - wy * next;
  scale = next;
  transform();
}
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const r = viewport.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * .0013), e.clientX - r.left, e.clientY - r.top);
}, {
  passive: false
});
const pointers = new Map();
let start = null,
  pinch = null,
  tapCourse = null,
  moved = false,
  hadPinch = false;
viewport.addEventListener('pointerdown', e => {
  viewport.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {
	x: e.clientX,
	y: e.clientY
  });
  if (pointers.size === 1) {
	moved = false;
	hadPinch = false;
	tapCourse = e.target.closest('.course')?.dataset.id || null;
	start = {
	  x: e.clientX,
	  y: e.clientY,
	  tx,
	  ty
	};
  } else if (pointers.size === 2) {
	const p = [...pointers.values()];
	hadPinch = true;
	tapCourse = null;
	start = null;
	pinch = {
	  dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
	  scale,
	  tx,
	  ty,
	  mid: {
		x: (p[0].x + p[1].x) / 2,
		y: (p[0].y + p[1].y) / 2
	  }
	};
  }
  viewport.classList.add('grabbing');
  world.classList.add('gesturing');
});
viewport.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {
	x: e.clientX,
	y: e.clientY
  });
  if (pointers.size === 2 && pinch) {
	const p = [...pointers.values()],
	  dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
	  r = viewport.getBoundingClientRect(),
	  mx = pinch.mid.x - r.left,
	  my = pinch.mid.y - r.top;
	scale = pinch.scale;
	tx = pinch.tx;
	ty = pinch.ty;
	zoomAt(dist / pinch.dist, mx, my);
	moved = true;
  } else if (pointers.size === 1 && start && !hadPinch) {
	const dx = e.clientX - start.x,
	  dy = e.clientY - start.y;
	if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
	  moved = true;
	  tapCourse = null;
	}
	tx = start.tx + dx;
	ty = start.ty + dy;
	transform();
  }
});

function end(e, cancelled = false) {
  if (!pointers.has(e.pointerId)) return;
  const shouldActivate = !cancelled && pointers.size === 1 && !moved && !hadPinch && tapCourse;
  pointers.delete(e.pointerId);
  if (pointers.size === 1 && hadPinch) {
	start = null;
	pinch = null;
  }
  if (!pointers.size) {
	viewport.classList.remove('grabbing');
	world.classList.remove('gesturing');
	transform();
	if (shouldActivate) activateCourse(tapCourse);
	start = null;
	pinch = null;
	tapCourse = null;
	moved = false;
	hadPinch = false;
  }
}
viewport.addEventListener('pointerup', e => end(e));
viewport.addEventListener('pointercancel', e => end(e, true));

function openResetModal() {
  el('resetModal').hidden = false;
  requestAnimationFrame(() => el('cancelReset').focus());
}

function closeResetModal() {
  el('resetModal').hidden = true;
  el('resetBtn').focus();
}

function resetProgress() {
  taken.clear();
  try {
	localStorage.removeItem(STORE_KEY);
  } catch {}
  document.querySelectorAll('.course').forEach(box => {
	box.classList.remove('taken');
	box.setAttribute('aria-pressed', 'false');
  });
  render();
  closeResetModal();
}
/* ---------- Toolbar and modal controls ---------- */
el('themeBtn').addEventListener('click', toggleTheme);
el('prereqBtn').addEventListener('click', () => {
  prereqMode = !prereqMode;
  prereqFocus = null;
  el('prereqBtn').setAttribute('aria-pressed', String(prereqMode));
  el('prereqBtn').textContent = prereqMode ? 'Prereq mode: On' : 'Prereq mode';
  applyPrereqMode();
});
el('zoomIn').addEventListener('click', () => zoomAt(1.2));
el('zoomOut').addEventListener('click', () => zoomAt(1 / 1.2));
el('fitBtn').addEventListener('click', fit);
el('resetBtn').addEventListener('click', openResetModal);
el('cancelReset').addEventListener('click', closeResetModal);
el('confirmReset').addEventListener('click', resetProgress);
el('resetModal').addEventListener('click', e => {
  if (e.target === el('resetModal')) closeResetModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !el('resetModal').hidden) closeResetModal();
});
window.addEventListener('resize', fit);
syncThemeButton();
render();
requestAnimationFrame(fit);
